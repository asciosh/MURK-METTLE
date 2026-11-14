import { WebSocketServer } from 'ws';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
const PORT = Number(process.env.ROOM_PORT || 8787);
const rooms = new Map();
const TYPES = [
  { id: 'runner', hp: 80, speed: 3.05, damage: 10 },
  { id: 'barkhide', hp: 145, speed: 1.58, damage: 17 },
  { id: 'sporeling', hp: 65, speed: 2.75, damage: 8 },
  { id: 'ashwalker', hp: 110, speed: 2.08, damage: 13 },
];
const makeZombie = (last, generation = 0) => {
  const choice = TYPES.filter(t => t.id !== last);
  const type = choice[Math.floor(Math.random() * choice.length)];
  return { x: 0.7, z: -9.5, hp: type.hp, max: type.hp, strain: type.id, speed: type.speed, damage: type.damage, generation, lastHit: 0, deadAt: 0 };
};
const send = (ws, message) => { if (ws.readyState === 1) ws.send(JSON.stringify(message)); };
const broadcast = (room, message) => { for (const p of room.players.values()) send(p.ws, message); };
const server = createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('Murk & Mettle room server'); });
const wss = new WebSocketServer({ server, path: '/room', maxPayload: 2048 });
const validCode = code => /^[A-Z0-9]{3,12}$/.test(code);
wss.on('connection', (ws, request) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const code = (url.searchParams.get('code') || '').trim().toUpperCase();
  if (!validCode(code)) { send(ws, { type: 'error', message: 'Room code must be 3–12 letters or numbers.' }); ws.close(); return; }
  let room = rooms.get(code);
  if (!room) { room = { players: new Map(), zombie: makeZombie(null) }; rooms.set(code, room); }
  if (room.players.size >= 4) { send(ws, { type: 'error', message: 'Room is full (4 players).' }); ws.close(); return; }
  const id = randomUUID();
  const player = { id, ws, x: 0, z: 0, yaw: 0, hp: 100, lastMove: Date.now(), attackAt: 0, pulseAt: 0 };
  room.players.set(id, player);
  send(ws, { type: 'welcome', id, code });
  ws.on('message', data => {
    let msg;
    try { msg = JSON.parse(String(data)); } catch { return; }
    if (!msg || typeof msg.type !== 'string') return;
    const now = Date.now();
    const zombie = room.zombie;
    if (msg.type === 'move') {
      const { x, z, yaw } = msg;
      if (![x,z,yaw].every(n => typeof n === 'number' && Number.isFinite(n))) return;
      if (Math.abs(x) > 25 || Math.abs(z) > 25 || Math.abs(yaw) > 1000) return;
      const dt = Math.min(0.5, (now - player.lastMove)/1000);
      const distance = Math.hypot(x - player.x, z - player.z);
      if (distance > 9 * dt + 1.5) return;
      player.x = x; player.z = z; player.yaw = yaw; player.lastMove = now;
    } else if (msg.type === 'attack' || msg.type === 'pulse') {
      if (player.hp <= 0 || zombie.hp <= 0) return;
      const pulse = msg.type === 'pulse';
      const cooldown = pulse ? 8000 : 480;
      const previous = pulse ? player.pulseAt : player.attackAt;
      if (now - previous < cooldown) return;
      if (pulse) player.pulseAt = now; else player.attackAt = now;
      const distance = Math.hypot(zombie.x - player.x, zombie.z - player.z);
      if (distance > (pulse ? 7.5 : 2.65)) return;
      if (!pulse) {
        const vx = (zombie.x - player.x)/Math.max(distance, 0.001);
        const vz = (zombie.z - player.z)/Math.max(distance, 0.001);
        if ((-Math.sin(player.yaw) * vx - Math.cos(player.yaw) * vz) < -0.15) return;
      }
      zombie.hp = Math.max(0, zombie.hp - (pulse ? 35 : msg.sharpened === true ? 55 : 40));
      if (zombie.hp === 0) { zombie.deadAt = now; broadcast(room, { type: 'kill', by: id, pulse, x: zombie.x, z: zombie.z }); }
    } else if (msg.type === 'restart') {
      if (player.hp === 0) { player.hp = 100; player.x = 0; player.z = 0; player.lastMove = now; send(ws, { type: 'damage', hp: 100 }); }
    }
  });
  ws.on('close', () => { room.players.delete(id); if (room.players.size === 0) rooms.delete(code); });
});
let lastTick = Date.now();
setInterval(() => {
  const now = Date.now(); const dt = Math.min(0.1, (now - lastTick)/1000); lastTick = now;
  for (const room of rooms.values()) {
    const zombie = room.zombie;
    if (zombie.hp === 0) {
      if (now - zombie.deadAt > 6000) room.zombie = makeZombie(zombie.strain, zombie.generation+1);
    } else {
      const alive = [...room.players.values()].filter(p => p.hp > 0);
      alive.sort((a,b) => Math.hypot(zombie.x-a.x,zombie.z-a.z)-Math.hypot(zombie.x-b.x,zombie.z-b.z));
      const target = alive[0];
      if (target) {
        const dist = Math.hypot(zombie.x-target.x,zombie.z-target.z);
        if (dist > 1.62 && dist < 18) {
          const step = Math.min(dist-1.62,zombie.speed*dt);
          zombie.x += (target.x-zombie.x)/dist*step;
          zombie.z += (target.z-zombie.z)/dist*step;
        } else if (dist <= 1.62 && now-zombie.lastHit>1350) {
          zombie.lastHit = now;
          target.hp = Math.max(0,target.hp-zombie.damage);
          send(target.ws, { type: 'damage', hp: target.hp });
        }
      }
    }
    broadcast(room, { type:'snapshot', players: [...room.players.values()].map(({ id,x,z,yaw,hp })=>({id,x,z,yaw,hp})), zombie: { x: room.zombie.x,z: room.zombie.z,hp: room.zombie.hp,max: room.zombie.max,strain: room.zombie.strain,generation:room.zombie.generation } });
  }
}, 100);
server.listen(PORT,'0.0.0.0',()=>console.log(`Co-op room server on :${PORT}`));
