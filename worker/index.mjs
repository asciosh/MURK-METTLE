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
      if (!['register', 'login', 'me', 'logout', 'save'].includes(op)) return new Response('Not found', { status: 404 });
      if (['register', 'login', 'logout'].includes(op) && request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      if (op === 'save' && !['PUT', 'GET'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
      if (['me'].includes(op) && request.method !== 'GET') return new Response('Method not allowed', { status: 405 });
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
    if (url.pathname === '/api/profile') {
      if (request.method !== 'GET' && request.method !== 'PUT') return new Response('Method not allowed', { status: 405 });
      const bearer = request.headers.get('Authorization') || '';
      const key = bearer.startsWith('Bearer ') ? bearer.slice(7) : '';
      if (!/^[a-f0-9]{64}$/.test(key)) return new Response('Missing or invalid recovery key', { status: 401 });
      return env.PLAYER_PROFILES.get(env.PLAYER_PROFILES.idFromName(key)).fetch(request);
    }
    if (url.pathname === '/room') {
      if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
        return new Response('WebSocket upgrade required', { status: 426 });
      }
      const code = (url.searchParams.get('code') || '').trim().toUpperCase();
      if (!/^[A-Z0-9]{3,12}$/.test(code)) {
        return new Response('Room codes must be 3–12 letters or numbers', { status: 400 });
      }
      // A separate Durable Object instance is identified by each room code.
      const id = env.GAME_ROOMS.idFromName(code);
      return env.GAME_ROOMS.get(id).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};
