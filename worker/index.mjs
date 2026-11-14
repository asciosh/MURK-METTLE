// v0.11: Vite static assets and co-op rooms share the same *.workers.dev origin.
import { GameRoom } from './room.mjs';
export { GameRoom };
export { PlayerProfile } from './profile.mjs';
export { PlayerAccount } from './account.mjs';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/account/')) {
      const op = url.pathname.split('/').at(-1);
      if (!['register', 'login', 'me', 'logout', 'save', 'coop-state', 'coop-craft'].includes(op)) return new Response('Not found', { status: 404 });
      if (['register', 'login', 'logout', 'coop-craft'].includes(op) && request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (op === 'save' && !['PUT', 'GET'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
      if (['me', 'coop-state'].includes(op) && request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
      // Prevent cross-site request forgery; same-origin requests only.
      if (request.method !== 'GET') {
        const origin = request.headers.get('Origin');
        if (origin !== url.origin) return new Response('Forbidden origin', { status: 403 });
      }
      const username = op === 'register' || op === 'login'
        ? (() => { try { return (url.searchParams.get('username') || '').toLowerCase(); } catch { return ''; } })()
        : ((request.headers.get('Cookie') || '').match(/(?:^|;\s*)mm_session=([a-z0-9_]{3,20})\.[a-f0-9]{64}/)?.[1] || '');
      if (!/^[a-z0-9_]{3,20}$/.test(username)) return Response.json({ error: 'Login required or invalid username' }, { status: 401 });
      const id = env.PLAYER_ACCOUNTS.idFromName(username);
      const forwarded = new Request(request);
      forwarded.headers.set('X-MM-Account', username);
      return env.PLAYER_ACCOUNTS.get(id).fetch(forwarded);
    }
    if (url.pathname === '/room') {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('WebSocket upgrade required', { status: 426 });
      }
      const code = (url.searchParams.get('code') || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{3,12}$/.test(code)) {
        return new Response('Room codes must be 3–12 letters or numbers', { status: 400 });
      }
      // Require an authenticated session before allowing access to rooms.
      const cookie = request.headers.get('Cookie') || '';
      const match = cookie.match(/(?:^|;\s*)mm_session=([a-z0-9_]{3,20})\.[a-f0-9]{64}/);
      if (!match) return new Response('Account login required', { status: 401 });
      const account = env.PLAYER_ACCOUNTS.get(env.PLAYER_ACCOUNTS.idFromName(match[1]));
      const check = await account.fetch(new Request(new URL('/api/account/me', url.origin), {
        headers: { 'Cookie': cookie, 'X-MM-Account': match[1] },
      }));
      if (!check.ok) return new Response('Session expired', { status: 401 });
      // Only the edge Worker may assert this verified account identity.
      const forwarded = new Request(request);
      forwarded.headers.set('X-MM-Verified-User', match[1]);
      // A separate Durable Object instance is identified by each room code.
      const id = env.GAME_ROOMS.idFromName(code);
      return env.GAME_ROOMS.get(id).fetch(forwarded);
    }
    return env.ASSETS.fetch(request);
  },
};
