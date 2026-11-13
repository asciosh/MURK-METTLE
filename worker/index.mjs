// v0.11: Vite static assets and co-op rooms share the same *.workers.dev origin.
import { GameRoom } from './room.mjs';
export { GameRoom };

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
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
