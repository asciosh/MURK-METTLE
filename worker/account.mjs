import { DurableObject } from 'cloudflare:workers';

// Private-beta identity: PIN-only authentication with per-account persistent lockout.
// Do not use for monetary value, trading, competitive rankings or public accounts.
const SAVE_KEYS = [
  'murk-mettle-v04-progression', 'murk-mettle-v05-inventory',
  'murk-mettle-v06-crafting', 'murk-mettle-v07-expeditions',
  'murk-mettle-v05-bond-retreat',
];
const MAX_BODY = 4096;
const SESSION_LIFETIME = 7 * 24 * 60 * 60 * 1000;
const encoder = new TextEncoder();
const json = (data, status = 200, headers = {}) => Response.json(data, {
  status, headers: { 'Cache-Control': 'no-store', ...headers },
});
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
const randomHex = n => hex(crypto.getRandomValues(new Uint8Array(n)));
async function sha256(s) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(s)))); }
async function pinHash(pin, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bytes = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256);
  return hex(new Uint8Array(bytes));
}
function validSave(data) {
  return data && typeof data === 'object' && !Array.isArray(data)
    && Object.keys(data).every(k => SAVE_KEYS.includes(k))
    && Object.values(data).every(v => v === null || (typeof v === 'string' && v.length < 2048));
}
function parseCookie(request) {
  const header = request.headers.get('Cookie') || '';
  const part = header.split(';').map(s => s.trim()).find(s => s.startsWith('mm_session='));
  return part ? part.slice('mm_session='.length) : '';
}
function sessionCookie(username, token) {
  return `mm_session=${username}.${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_LIFETIME / 1000}`;
}
const clearCookie = 'mm_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
const clearLegacyCookie = 'mm_session=; HttpOnly; Secure; SameSite=Strict; Path=/api/account; Max-Age=0';

export class PlayerAccount extends DurableObject {
  async fetch(request) {
    const url = new URL(request.url);
    const op = url.pathname.split('/').at(-1);
    const username = request.headers.get('X-MM-Account') || '';
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return json({ error: 'Invalid username' }, 400);
    const now = Date.now();
    const storage = this.ctx.storage;
    const record = await storage.get('account');
    if (op === 'register' || op === 'login') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      if (Number(request.headers.get('Content-Length') || '0') > 512) return json({ error: 'Too large' }, 413);
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Invalid JSON' }, 400); }
      const pin = body?.pin;
      if (typeof pin !== 'string' || !/^\d{6,8}$/.test(pin)) return json({ error: 'Use a 6–8 digit PIN' }, 400);
      const failures = await storage.get('failures') || { count: 0, until: 0 };
      if (failures.until > now) return json({ error: 'Too many attempts. Try later.' }, 429, { 'Retry-After': String(Math.ceil((failures.until - now) / 1000)) });
      if (op === 'register' && record) return json({ error: 'Username unavailable' }, 409);
      if (op === 'login' && !record) return json({ error: 'Invalid username or PIN' }, 401);
      if (op === 'register') {
        const salt = randomHex(16);
        await storage.put('account', { salt, hash: await pinHash(pin, salt), createdAt: now });
      } else {
        const actual = await pinHash(pin, record.salt);
        if (actual !== record.hash) {
          const count = failures.count + 1;
          const until = count >= 5 ? now + 15 * 60_000 : 0;
          await storage.put('failures', { count: until ? 0 : count, until });
          return json({ error: 'Invalid username or PIN' }, 401);
        }
      }
      await storage.put('failures', { count: 0, until: 0 });
      const token = randomHex(32);
      const sessions = await storage.get('sessions') || {};
      for (const [hash, exp] of Object.entries(sessions)) if (exp <= now) delete sessions[hash];
      sessions[await sha256(token)] = now + SESSION_LIFETIME;
      // Allow at most four concurrent browser sessions.
      while (Object.keys(sessions).length > 4) delete sessions[Object.keys(sessions)[0]];
      await storage.put('sessions', sessions);
      return json({ ok: true, username, hasSave: !!(await storage.get('save')) }, 200, { 'Set-Cookie': sessionCookie(username, token) });
    }
    const cookie = parseCookie(request);
    const [cookieName, token] = cookie.split('.');
    if (!record || cookieName !== username || !/^[a-f0-9]{64}$/.test(token || '')) return json({ error: 'Login required' }, 401);
    const tokenHash = await sha256(token);
    const sessions = await storage.get('sessions') || {};
    if (!sessions[tokenHash] || sessions[tokenHash] <= now) return json({ error: 'Session expired; log in again' }, 401);
    if (op === 'logout') {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
      delete sessions[tokenHash];
      await storage.put('sessions', sessions);
      const headers = new Headers({ 'Cache-Control': 'no-store' });
      headers.append('Set-Cookie', clearCookie);
      headers.append('Set-Cookie', clearLegacyCookie);
      return Response.json({ ok: true }, { headers });
    }
    if (op === 'me') return json({ username, hasSave: !!(await storage.get('save')) }, 200, { 'Set-Cookie': sessionCookie(username, token) });
    if (op === 'save') {
      if (request.method === 'GET') {
        const saved = await storage.get('save');
        return json(saved ? { ...saved, revision: saved.revision ?? 0 } : { version: 1, revision: 0, data: null, updatedAt: null });
      }
      if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405);
      const text = await request.text();
      if (text.length > MAX_BODY) return json({ error: 'Save is too large' }, 413);
      let body;
      try { body = JSON.parse(text); } catch { return json({ error: 'Invalid JSON' }, 400); }
      if (!body || !Number.isSafeInteger(body.revision) || body.revision < 0 || !validSave(body.data))
        return json({ error: 'Invalid save or missing revision' }, 400);
      // Transactional compare-and-swap: two sessions using the same revision cannot both win.
      const result = await storage.transaction(async txn => {
        const previous = await txn.get('save');
        const revision = previous?.revision ?? 0; // v0.13 saves migrate without deleting data.
        if (body.revision !== revision) return { conflict: true, revision, updatedAt: previous?.updatedAt ?? null };
        const value = { version: 2, revision: revision + 1, data: body.data, updatedAt: now };
        await txn.put('save', value);
        return { ok: true, revision: value.revision, updatedAt: now };
      });
      return result.conflict ? json({ error: 'Cloud save changed on another device. Restore or review before uploading again.', ...result }, 409) : json(result);
    }
    return json({ error: 'Not found' }, 404);
  }
}
