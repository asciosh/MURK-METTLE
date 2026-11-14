// Cloudflare Durable Object — shared four-player session state.
// This is an authoritative combat prototype, not yet an account/inventory server.
import { DurableObject } from 'cloudflare:workers';

const TYPES = [
  { id: 'runner', hp: 80, speed: 3.05, damage: 10 },
  { id: 'barkhide', hp: 145, speed: 1.58, damage: 17 },
  { id: 'sporeling', hp: 65, speed: 2.75, damage: 8 },
  { id: 'ashwalker', hp: 110, speed: 2.08, damage: 13 },
];
const MAX_PLAYERS = 4;
const SNAPSHOT_MS = 100; // 10 Hz snapshots; client renders between buffered samples.
const isNumber = value => typeof value === 'number' && Number.isFinite(value);
const selectZombie = (last = null, generation = 0) => {
  const options = TYPES.filter(type => type.id !== last);
  const type = options[Math.floor(Math.random() * options.length)];
  return { x: 0.7, z: -9.5, hp: type.hp, max: type.hp, strain: type.id,
    speed: type.speed, damage: type.damage, generation, encounterId: crypto.randomUUID(), lastHit: 0, deadAt: 0 };
};

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.players = new Map();
    this.zombie = selectZombie();
    this.lastTick = Date.now();
    this.timer = null;
    // Socket attachments recover player positions when a Durable Object wakes.
    for (const ws of this.ctx.getWebSockets()) {
      const data = ws.deserializeAttachment();
      if (data?.id && this.players.size < MAX_PLAYERS) this.players.set(ws, {
        id: data.id, username: data.username || '', x: data.x ?? 0, z: data.z ?? 0, yaw: data.yaw ?? 0,
        hp: data.hp ?? 100, lastMove: Date.now(), attackAt: 0, pulseAt: 0,
        messageAt: 0, upgrades: { sharpened: false, balanced: false },
      });
    }
    if (this.players.size) this.startTick();
  }

  async fetch(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return new Response('Expected WebSocket', { status: 426 });
    if (this.players.size >= MAX_PLAYERS)
      return new Response('Room full (4 players)', { status: 429 });
    const url = new URL(request.url);
    const code = (url.searchParams.get('code') || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{3,12}$/.test(code)) return new Response('Invalid code', { status: 400 });
    const username = request.headers.get('X-MM-Verified-User') || '';
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return new Response('Verified account required', { status: 401 });
    // Block two simultaneous sockets for the same account in one room.
    if ([...this.players.values()].some(p => p.username === username))
      return new Response('Account already connected to this room', { status: 409 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const player = { id: crypto.randomUUID(), username, x: 0, z: 0, yaw: 0,
      hp: 100, lastMove: Date.now(), attackAt: 0, pulseAt: 0, messageAt: 0 };
    this.players.set(server, player);
    this.saveAttachment(server, player);
    this.send(server, { type: 'welcome', id: player.id, code });
    this.startTick();
    return new Response(null, { status: 101, webSocket: client });
  }

  startTick() {
    if (this.timer || !this.players.size) return;
    this.lastTick = Date.now();
    this.timer = setInterval(() => this.tick(), SNAPSHOT_MS);
  }
  stopTick() { if (this.timer) clearInterval(this.timer); this.timer = null; }
  send(socket, msg) {
    try { socket.send(JSON.stringify(msg)); } catch { /* socket is closing */ }
  }
  broadcast(msg) { for (const socket of this.players.keys()) this.send(socket, msg); }
  saveAttachment(socket, player) {
    socket.serializeAttachment({ id: player.id, username: player.username, x: player.x, z: player.z,
      yaw: player.yaw, hp: player.hp });
  }

  async webSocketMessage(socket, raw) {
    const player = this.players.get(socket);
    if (!player || typeof raw !== 'string' || raw.length > 2048) return;
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;
    const now = Date.now();
    if (msg.type === 'move') {
      if (!isNumber(msg.x) || !isNumber(msg.z) || !isNumber(msg.yaw)) return;
      if (Math.abs(msg.x) > 25 || Math.abs(msg.z) > 25 || Math.abs(msg.yaw) > 1000) return;
      // Guard against high packet rates and large impossible teleports.
      if (now - player.messageAt < 45) return;
      player.messageAt = now;
      const dt = Math.min(0.5, (now - player.lastMove) / 1000);
      if (Math.hypot(msg.x - player.x, msg.z - player.z) > 9 * dt + 1.5) return;
      if (player.hp <= 0) return;
      player.x = msg.x; player.z = msg.z; player.yaw = msg.yaw; player.lastMove = now;
      this.saveAttachment(socket, player);
      return;
    }
    if (msg.type === 'sync-equipment') {
      // Obtain upgrades from account storage; never accept equipment flags from packets.
      try {
        const target = this.env.PLAYER_ACCOUNTS.get(this.env.PLAYER_ACCOUNTS.idFromName(player.username));
        const response = await target.fetch(new Request('https://internal/api/account/coop-equipment', {
          method: 'GET', headers: { 'X-MM-Account': player.username, 'X-MM-Reward-Source': 'game-room-v1' },
        }));
        if (response.ok) {
          const data = await response.json();
          player.upgrades = { sharpened: data.upgrades?.sharpened === true,
            balanced: data.upgrades?.balanced === true };
        }
      } catch (error) { console.warn('Unable to verify equipment', error); }
      return;
    }
    if (msg.type === 'restart') {
      if (player.hp <= 0) {
        player.hp = 100; player.x = 0; player.z = 0;
        player.lastMove = now;
        this.saveAttachment(socket, player);
        this.send(socket, { type: 'damage', hp: 100 });
      }
      return;
    }
    if (msg.type !== 'attack' && msg.type !== 'pulse') return;
    const zombie = this.zombie;
    if (player.hp <= 0 || zombie.hp <= 0) return;
    const pulse = msg.type === 'pulse';
    const cooldown = pulse ? 8000 : 480;
    if (now - (pulse ? player.pulseAt : player.attackAt) < cooldown) return;
    if (pulse) player.pulseAt = now; else player.attackAt = now;
    const distance = Math.hypot(zombie.x - player.x, zombie.z - player.z);
    if (distance > (pulse ? 7.5 : (player.upgrades?.balanced ? 3.35 : 2.65))) return;
    if (!pulse) {
      const vx = (zombie.x - player.x) / Math.max(distance, 0.001);
      const vz = (zombie.z - player.z) / Math.max(distance, 0.001);
      if ((-Math.sin(player.yaw) * vx - Math.cos(player.yaw) * vz) < -0.15) return;
    }
    // Co-op weapon upgrades are loaded from the authenticated account, never from client input.
    zombie.hp = Math.max(0, zombie.hp - (pulse ? 35 : (player.upgrades?.sharpened ? 55 : 40)));
    if (zombie.hp === 0) {
      zombie.deadAt = now;
      // Co-op XP is awarded by the room, never by a player-supplied packet.
      // Account storage uses the unique encounter ID to reject duplicate awards.
      const eventId = `kill:${zombie.encounterId}`;
      try {
        const target = this.env.PLAYER_ACCOUNTS.get(this.env.PLAYER_ACCOUNTS.idFromName(player.username));
        const response = await target.fetch(new Request('https://internal/api/account/coop-reward', {
          method: 'POST', headers: { 'Content-Type': 'application/json',
            'X-MM-Account': player.username, 'X-MM-Reward-Source': 'game-room-v1' },
          body: JSON.stringify({ id: eventId, pulse }),
        }));
        if (!response.ok) throw new Error(`Reward store returned ${response.status}`);
        const result = await response.json();
        this.send(socket, { type: 'reward', xp: 50, creatureXp: pulse ? 40 : 0,
          material: result.material || null, totals: result.stats, duplicate: !!result.duplicate });
      } catch (error) {
        // No client-side award fallback: failure must remain visible and
        // investigated rather than creating untrusted progression.
        this.send(socket, { type: 'error', message: 'Cloud reward could not be saved. Please report this match.' });
        console.error('Co-op reward failed', error);
      }
      this.broadcast({ type: 'kill', by: player.id, pulse, x: zombie.x, z: zombie.z });
    }
  }
  webSocketClose(socket) { this.drop(socket); }
  webSocketError(socket) { this.drop(socket); try { socket.close(1011, 'Socket error'); } catch {} }
  drop(socket) {
    this.players.delete(socket);
    if (!this.players.size) { this.stopTick(); this.zombie = selectZombie(); }
  }

  tick() {
    if (!this.players.size) { this.stopTick(); return; }
    const now = Date.now();
    const dt = Math.min(0.25, (now - this.lastTick) / 1000);
    this.lastTick = now;
    const zombie = this.zombie;
    if (zombie.hp === 0) {
      if (now - zombie.deadAt > 6000) this.zombie = selectZombie(zombie.strain, zombie.generation + 1);
    } else {
      const alive = [...this.players.entries()].filter(([, p]) => p.hp > 0);
      alive.sort((a, b) => Math.hypot(zombie.x-a[1].x, zombie.z-a[1].z) -
        Math.hypot(zombie.x-b[1].x, zombie.z-b[1].z));
      if (alive.length) {
        const [socket, target] = alive[0];
        const dist = Math.hypot(zombie.x - target.x, zombie.z - target.z);
        if (dist > 1.62 && dist < 18) {
          const step = Math.min(dist - 1.62, zombie.speed * dt);
          zombie.x += (target.x - zombie.x) / dist * step;
          zombie.z += (target.z - zombie.z) / dist * step;
        } else if (dist <= 1.62 && now - zombie.lastHit > 1350) {
          zombie.lastHit = now;
          target.hp = Math.max(0, target.hp - zombie.damage);
          this.saveAttachment(socket, target);
          this.send(socket, { type: 'damage', hp: target.hp });
        }
      }
    }
    this.broadcast({ type: 'snapshot',
      players: [...this.players.values()].map(({ id, x, z, yaw, hp }) => ({ id, x, z, yaw, hp })),
      zombie: { x: this.zombie.x, z: this.zombie.z, hp: this.zombie.hp,
        max: this.zombie.max, strain: this.zombie.strain, generation: this.zombie.generation },
    });
  }
}
