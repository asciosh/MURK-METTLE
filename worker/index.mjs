// v0.11: Vite static assets and co-op rooms share the same *.workers.dev origin.
import { GameRoom } from './room.mjs';
export { GameRoom };
export { PlayerProfile } from './profile.mjs';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
