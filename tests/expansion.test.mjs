import test from 'node:test';
import { newVitals, spawnHorde } from '../shared/survival.mjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  WORLD_BOUNDARY,
  CREATURES,
  SPECIES_IDS,
  WEAPONS,
  BUILDINGS,
  newArsenal,
  fireWeapon,
  reloadWeapon,
  settleReload,
  constrainPosition,
  shotDistance,
  evolutionStage,
  creaturePower,
} from '../shared/expansion.mjs';

test('magazines cannot fire empty, bypass cooldown, fire during reload or create ammunition', () => {
  const a = newArsenal();
  assert.equal(fireWeapon(a, 'not-a-gun', 1000), false);
  assert.equal(fireWeapon(a, 'pistol', 1000), true);
  assert.equal(fireWeapon(a, 'pistol', 1100), false);
  for (let i = 1; i < 12; i++) assert.equal(fireWeapon(a, 'pistol', 1000 + i * 280), true);
  assert.equal(a.pistol.magazine, 0);
  assert.equal(fireWeapon(a, 'pistol', 5000), false);
  assert.equal(reloadWeapon(a, 'pistol', 5000), true);
  assert.equal(reloadWeapon(a, 'pistol', 5100), false);
  assert.equal(fireWeapon(a, 'pistol', 5300), false);
  settleReload(a, 'pistol', 6399);
  assert.equal(a.pistol.magazine, 0);
  settleReload(a, 'pistol', 6400);
  assert.equal(a.pistol.magazine, 12);
  assert.equal(a.pistol.reserve, 48);
  a.rifle.magazine = 28;
  a.rifle.reserve = 1;
  reloadWeapon(a, 'rifle', 7000);
  settleReload(a, 'rifle', 9100);
  assert.equal(a.rifle.magazine, 29);
  assert.equal(a.rifle.reserve, 0);
});

test('expanded sector constrains actors, shares building collision and blocks shots through walls', () => {
  const pos = constrainPosition({ x: 500, z: -500 });
  assert.ok(Math.abs(pos.x) < WORLD_BOUNDARY);
  assert.ok(Math.abs(pos.z) < WORLD_BOUNDARY);
  const b = BUILDINGS[0],
    inside = constrainPosition({ x: b.x, z: b.z });
  assert.ok(Math.abs(inside.x - b.x) >= b.w / 2 || Math.abs(inside.z - b.z) >= b.d / 2);
  assert.equal(shotDistance({ x: 0, y: 1.32, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, z: -10 }, 65) !== null, true);
  assert.equal(shotDistance({ x: 0, y: 1.32, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, z: -10 }, 65), null);
  assert.equal(
    shotDistance({ x: b.x, y: 1.32, z: b.z + 12 }, { x: 0, y: 0, z: -1 }, { x: b.x, z: b.z - 12 }, 65),
    null,
  );
});

test('every creature has three named forms with deterministic evolution and stronger abilities', () => {
  assert.equal(SPECIES_IDS.length, 5);
  for (const id of SPECIES_IDS) {
    assert.equal(CREATURES[id].forms.length, 3);
    assert.equal(evolutionStage(119), 0);
    assert.equal(evolutionStage(120), 1);
    assert.equal(evolutionStage(399), 1);
    assert.equal(evolutionStage(400), 2);
    assert.ok(creaturePower(id, 400).damage > creaturePower(id, 0).damage);
  }
});

const shim = 'class DurableObject { constructor(ctx,env) { this.ctx=ctx;this.env=env; } }';
const source = (await readFile(new URL('../server/cloudflare/account.mjs', import.meta.url), 'utf8')).replace(
  "import { DurableObject } from 'cloudflare:workers';",
  shim,
);
const { PlayerAccount } = await import(`data:text/javascript,${encodeURIComponent(source.replaceAll(/'\.\.\/\.\.\/shared\/([^']+)'/g, (_, file) => JSON.stringify(new URL('../shared/' + file, import.meta.url).href)))}`);
class Storage {
  values = new Map();
  async get(k) {
    return structuredClone(this.values.get(k));
  }
  async put(k, v) {
    this.values.set(k, structuredClone(v));
  }
  async transaction(fn) {
    return fn(this);
  }
}
const storage = new Storage();
const account = new PlayerAccount({ storage });
const headers = { 'X-MM-Account': 'tester', 'X-MM-Reward-Source': 'game-room-v1' };
const send = (op, body) =>
  account.fetch(
    new Request(`https://internal/api/account/${op}`, {
      method: body ? 'POST' : 'GET',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
test('collection migrates legacy Lanternkin and preserves independent species XP across switching and retries', async () => {
  await storage.put('coop-creature', { species: 'lanternkin', owned: true, xp: 160 });
  let c = await (await send('coop-collection')).json();
  assert.equal(c.collection.creatures.lanternkin.xp, 160);
  assert.equal((await send('coop-collection', { action: 'select', species: 'reedwisp' })).status, 409);
  assert.equal((await send('coop-collection', { action: 'bond', species: '__proto__' })).status, 400);
  await send('coop-collection', { action: 'bond', species: 'emberling' });
  for (let i = 0; i < 3; i++)
    assert.equal(
      (await send('coop-reward', { id: `kill:expansion-${i}`, pulse: true, species: 'emberling' })).status,
      200,
    );
  await send('coop-reward', { id: 'kill:expansion-0', pulse: true, species: 'emberling' });
  c = await (await send('coop-collection')).json();
  assert.equal(c.collection.creatures.emberling.xp, 120);
  assert.equal(c.collection.creatures.lanternkin.xp, 160);
  await send('coop-collection', { action: 'select', species: 'lanternkin' });
  c = await (await send('coop-collection')).json();
  assert.equal(c.collection.active, 'lanternkin');
  assert.equal(c.collection.creatures.emberling.owned, true);
});

test('real room validates firearm direction, ammo, cooldown, range, cover and bonding distance', async () => {
  const expansionURL = new URL('../shared/expansion.mjs', import.meta.url).href;
  const coopURL = new URL('../shared/coop-rules.mjs', import.meta.url).href;
  const roomSource = (await readFile(new URL('../server/cloudflare/room.mjs', import.meta.url), 'utf8'))
    .replace("import { DurableObject } from 'cloudflare:workers';", shim)
    .replaceAll("'../../shared/collection.mjs'", JSON.stringify(new URL('../shared/collection.mjs', import.meta.url).href))
    .replaceAll("'../../shared/expansion.mjs'", JSON.stringify(expansionURL))
    .replaceAll("'../../shared/coop-rules.mjs'", JSON.stringify(coopURL))
    .replaceAll("'../../shared/survival.mjs'", JSON.stringify(new URL('../shared/survival.mjs', import.meta.url).href))
    .replaceAll(
      "'../../shared/actor-pose.mjs'",
      JSON.stringify(new URL('../shared/actor-pose.mjs', import.meta.url).href),
    );
  const { GameRoom } = await import(`data:text/javascript,${encodeURIComponent(roomSource)}`);
  const ctx = {
    storage: new Storage(),
    blockConcurrencyWhile: (fn) => fn(),
    getWebSockets: () => [],
    id: { toString: () => 'abcdef0123456789' },
  };
  const room = new GameRoom(ctx, { PLAYER_ACCOUNTS: { idFromName: (n) => n, get: () => account } });
  const packets = [],
    socket = { send: (s) => packets.push(JSON.parse(s)), serializeAttachment: () => {} };
  const collection = (await (await send('coop-collection')).json()).collection;
  const p = {
    id: 'test',
    username: 'tester',
    x: 0,
    z: 0,
    yaw: 0,
    hp: 100,
    survival: newVitals(),
    movingUntil: 0,
    hurtUntil: 0,
    attackAt: 0,
    pulseAt: 0,
    arsenal: newArsenal(),
    supplies: {},
    collection,
    creatureOwned: true,
  };
  room.players.set(socket, p);
  const enemy = spawnHorde([p], 1, 'test')[0];
  Object.assign(enemy, { x: 0, z: -10, hp: 100, max: 100, id: 'test-shooting-01', encounterId: 'test-shooting-01' });
  room.horde.enemies = [enemy];
  room.horde.wave = 1;
  const msg = (body) => room.webSocketMessage(socket, JSON.stringify(body));
  await msg({ type: 'shoot', weapon: 'pistol', direction: { x: 0, y: 0, z: -4 } });
  assert.equal(p.arsenal.pistol.magazine, 12);
  assert.equal(room.horde.enemies[0].hp, 100);
  await msg({ type: 'shoot', weapon: 'pistol', direction: { x: 0, y: 0, z: -1 } });
  assert.equal(room.horde.enemies[0].hp, 66);
  assert.equal(p.arsenal.pistol.magazine, 11);
  await msg({ type: 'shoot', weapon: 'pistol', direction: { x: 0, y: 0, z: -1 } });
  assert.equal(room.horde.enemies[0].hp, 66);
  p.arsenal.pistol.readyAt = 0;
  await msg({ type: 'shoot', weapon: 'pistol', direction: { x: 1, y: 0, z: 0 } });
  assert.equal(room.horde.enemies[0].hp, 66);
  assert.equal(p.arsenal.pistol.magazine, 10);
  await msg({ type: 'reload', weapon: 'pistol' });
  assert.ok(p.arsenal.pistol.reloadAt > 0);
  p.arsenal.pistol.readyAt = 0;
  await msg({ type: 'shoot', weapon: 'pistol', direction: { x: 0, y: 0, z: -1 } });
  assert.equal(room.horde.enemies[0].hp, 66);
  await msg({ type: 'bond', species: 'reedwisp' });
  assert.equal(p.collection.creatures.reedwisp.owned, false);
  await msg({ type: 'resupply', id: 'town' });
  assert.equal(p.supplies.town, undefined);
  p.arsenal.pistol.reloadAt = 0;
  p.arsenal.pistol.readyAt = 0;
  const b = BUILDINGS[0];
  p.x = b.x;
  p.z = b.z + 12;
  room.horde.enemies[0].x = b.x;
  room.horde.enemies[0].z = b.z - 12;
  await msg({ type: 'shoot', weapon: 'pistol', direction: { x: 0, y: 0, z: -1 } });
  assert.equal(room.horde.enemies[0].hp, 66);
  assert.ok(packets.some((e) => e.type === 'shot' && e.hit === false));
  p.messageAt = 0;
  p.lastMove = Date.now();
  const beforeAmmo = p.arsenal.pistol.magazine;
  await msg({ type: 'move', x: p.x, z: p.z, yaw: p.yaw, weapon: 'rifle', aiming: true, pitch: 12, sprinting: true });
  assert.equal(p.pose.weapon, 'rifle');
  assert.equal(p.pose.pitch, 0.95);
  assert.equal(p.arsenal.pistol.magazine, beforeAmmo);
  room.tick();
  const actor = packets
    .filter((e) => e.type === 'snapshot')
    .at(-1)
    .players.find((a) => a.id === p.id);
  assert.equal(actor.weapon, 'rifle');
  assert.equal(actor.aiming, true);
  assert.equal(actor.pitch, 0.95);
  room.stopTick();
});
