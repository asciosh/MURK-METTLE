import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// Test the real Worker module with only the Cloudflare DurableObject base shimmed.
const source = (await readFile(new URL('../server/cloudflare/account.mjs', import.meta.url), 'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor(ctx) { this.ctx = ctx; } }');
const { PlayerAccount } = await import(`data:text/javascript,${encodeURIComponent(source.replaceAll(/'\.\.\/\.\.\/shared\/([^']+)'/g, (_, file) => JSON.stringify(new URL('../shared/' + file, import.meta.url).href)))}`);
class Storage {
  values = new Map();
  async get(key) { return this.values.get(key); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  async transaction(fn) { return fn(this); }
}
const storage = new Storage();
const account = new PlayerAccount({ storage });
const base = 'https://example.test/api/account/';
const user = 'testaccount';
async function send(op, method, data, cookie = '') {
  const request = new Request(`${base}${op}`, {
    method,
    headers: { 'X-MM-Account': user, ...(cookie ? { Cookie: cookie } : {}) },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  const response = await account.fetch(request);
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie') };
}
test('new and legacy saves require compare-and-swap revision, and never overwrite on a stale revision', async () => {
  const reg = await send('register', 'POST', { pin: '12345678' });
  assert.equal(reg.status, 200);
  const cookie = reg.cookie.split(';')[0];
  const original = await send('save', 'GET', undefined, cookie);
  assert.equal(original.data.revision, 0);
  assert.equal(original.data.data, null);
  const snapshotA = { 'murk-mettle-v04-progression': '{"xp":10}' };
  const snapshotB = { 'murk-mettle-v04-progression': '{"xp":20}' };
  const first = await send('save', 'PUT', { revision: 0, data: snapshotA }, cookie);
  assert.equal(first.status, 200);
  assert.equal(first.data.revision, 1);
  const stale = await send('save', 'PUT', { revision: 0, data: snapshotB }, cookie);
  assert.equal(stale.status, 409);
  assert.equal(stale.data.revision, 1);
  const after = await send('save', 'GET', undefined, cookie);
  assert.deepEqual(after.data.data, snapshotA);
  const retry = await send('save', 'PUT', { revision: 1, data: snapshotB }, cookie);
  assert.equal(retry.status, 200);
  assert.equal(retry.data.revision, 2);
  const missingRevision = await send('save', 'PUT', snapshotA, cookie);
  assert.equal(missingRevision.status, 400);
  // Migration: old v0.13 saves have version 1 and no revision.
  await storage.put('save', { version: 1, data: snapshotA, updatedAt: 123 });
  const legacy = await send('save', 'GET', undefined, cookie);
  assert.equal(legacy.data.revision, 0);
  assert.deepEqual(legacy.data.data, snapshotA);
  const migrated = await send('save', 'PUT', { revision: 0, data: snapshotB }, cookie);
  assert.equal(migrated.status, 200);
  assert.equal(migrated.data.revision, 1);
});
