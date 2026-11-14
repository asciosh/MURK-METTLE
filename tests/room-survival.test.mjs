import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { newVitals, spawnHorde } from '../shared/survival.mjs';
import { newArsenal } from '../shared/expansion.mjs';
const source = (await readFile(new URL('../server/cloudflare/room.mjs', import.meta.url), 'utf8'))
  .replace(
    "import { DurableObject } from 'cloudflare:workers';",
    'class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env;}}',
  )
  .replaceAll(/'\.\.\/\.\.\/shared\/([^']+)'/g, (_, file) =>
    JSON.stringify(new URL('../shared/' + file, import.meta.url).href),
  );
const { GameRoom } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
const make = () => {
  const ctx = {
    storage: { get: async () => undefined, put: async () => {} },
    blockConcurrencyWhile: (fn) => fn(),
    getWebSockets: () => [],
    id: { toString: () => 'abcdef0123456789' },
  };
  const room = new GameRoom(ctx, {}),
    packets = [],
    socket = { send: (s) => packets.push(JSON.parse(s)), serializeAttachment: () => {} };
  const p = {
    id: 'survivor',
    username: 'tester',
    x: 0,
    z: 0,
    yaw: 0,
    hp: 30,
    lastMove: Date.now(),
    messageAt: 0,
    attackAt: 0,
    pulseAt: 0,
    arsenal: newArsenal(),
    supplies: {},
    survival: newVitals(),
    movingUntil: 0,
    hurtUntil: 0,
    moveBudget: 0,
    budgetAt: Date.now(),
    pose: { weapon: 'pistol', aiming: false, pitch: 0, sprinting: false },
  };
  room.players.set(socket, p);
  const send = (body) => room.webSocketMessage(socket, JSON.stringify(body));
  return { room, p, packets, send };
};
test('room bandaging consumes stock, caps healing at 100, and does not move the player', async () => {
  const { room, p, packets, send } = make();
  p.x = 4;
  p.z = 3;
  await send({ type: 'heal' });
  assert.equal(p.survival.bandages, 1);
  assert.ok(p.survival.healEndsAt > Date.now());
  await send({ type: 'heal' });
  assert.equal(p.survival.bandages, 1);
  p.survival.healEndsAt = Date.now() - 1;
  room.tick();
  assert.equal(p.hp, 70);
  assert.equal(p.x, 4);
  assert.equal(p.z, 3);
  await send({ type: 'heal' });
  p.survival.healEndsAt = Date.now() - 1;
  room.tick();
  assert.equal(p.hp, 100);
  assert.equal(p.survival.bandages, 0);
  assert.ok(packets.some((e) => e.type === 'damage' && e.hp === 100));
  await send({ type: 'heal' });
  assert.equal(p.survival.bandages, 0);
  room.stopTick();
});
test('damage and attacks interrupt room healing, and only dead players can restart', async () => {
  const { room, p, send } = make();
  p.hp = 70;
  await send({ type: 'heal' });
  await send({ type: 'attack' });
  assert.equal(p.survival.healEndsAt, 0);
  assert.equal(p.survival.bandages, 1);
  await send({ type: 'heal' });
  const e = spawnHorde([p], 1, 'hurt')[0];
  Object.assign(e, { x: 0, z: -1, damage: 10, windupEndsAt: Date.now() - 1 });
  room.horde.enemies = [e];
  room.tick();
  assert.equal(p.hp, 60);
  assert.equal(p.survival.healEndsAt, 0);
  await send({ type: 'restart' });
  assert.equal(p.hp, 60);
  p.hp = 0;
  await send({ type: 'heal' });
  assert.equal(p.hp, 0);
  await send({ type: 'restart' });
  assert.equal(p.hp, 100);
  assert.equal(p.survival.bandages, 2);
  assert.equal(p.survival.stamina, 100);
  assert.equal(p.x, 0);
  assert.equal(room.horde.enemies.length, 3);
  room.stopTick();
});
test('room rejects exhausted speed bypass and resupply at a distant cache', async () => {
  const { room, p, packets, send } = make();
  p.hp = 100;
  p.survival.stamina = 0;
  p.survival.exhausted = true;
  p.budgetAt = Date.now() - 100;
  await send({ type: 'move', x: 3, z: 0, yaw: 0, sprinting: true });
  assert.equal(p.x, 0);
  assert.ok(packets.some((e) => e.type === 'correction' && e.x === 0));
  p.messageAt = 0;
  p.budgetAt = Date.now() - 100;
  p.moveBudget = 0;
  await send({ type: 'move', x: 0.4, z: 0, yaw: 0, sprinting: true });
  assert.equal(p.x, 0.4);
  p.survival.bandages = 0;
  await send({ type: 'resupply', id: 'town' });
  assert.equal(p.survival.bandages, 0);
  p.x = -3;
  p.z = 3;
  await send({ type: 'resupply', id: 'camp' });
  assert.equal(p.survival.bandages, 2);
  p.survival.bandages = 0;
  await send({ type: 'resupply', id: 'camp' });
  assert.equal(p.survival.bandages, 0);
  room.stopTick();
});

test('room broadcasts cosmetic pulse and melee only for accepted living-player actions', async () => {
  const { room, p, packets, send } = make();
  await send({ type: 'pulse' });
  assert.equal(packets.filter((e) => e.type === 'action').length, 0);
  p.creatureOwned = true;
  await send({ type: 'pulse' });
  await send({ type: 'pulse' });
  assert.equal(packets.filter((e) => e.type === 'action' && e.action === 'pulse').length, 1);
  await send({ type: 'attack' });
  await send({ type: 'attack' });
  assert.equal(packets.filter((e) => e.type === 'action' && e.action === 'melee').length, 1);
  p.hp = 0;
  p.attackAt = 0;
  await send({ type: 'attack' });
  assert.equal(packets.filter((e) => e.type === 'action').length, 2);
  room.stopTick();
});

test('slow analog movement interrupts bandaging just like a full keyboard step', async () => {
  const { room, p, send } = make();
  p.hp = 50;
  await send({ type: 'heal' });
  assert.ok(p.survival.healEndsAt > 0);
  p.moveBudget = 0.2;
  p.messageAt = 0;
  await send({ type: 'move', x: 0.01, z: 0, yaw: 0 });
  assert.equal(p.x, 0.01);
  assert.equal(p.survival.healEndsAt, 0);
  assert.equal(p.survival.bandages, 1);
  assert.equal(p.hp, 50);
  room.stopTick();
});
