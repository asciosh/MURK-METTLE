import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SURVIVAL,
  newVitals,
  canSprint,
  stepVitals,
  beginHealing,
  cancelHealing,
  refillVitals,
  admitMovement,
  spawnHorde,
  stepHorde,
  alertHorde,
  damageEnemy,
  bulletTarget,
  meleeTarget,
  pulseTargets,
  findRoute,
  HordeSimulation,
} from '../shared/survival.mjs';
import { BUILDINGS, WORLD_BOUNDARY } from '../shared/expansion.mjs';
const survivor = (id = 'one', x = 0, z = 0) => ({ id, x, z, hp: 100, yaw: 0, hurtUntil: 0 });
const enemy = (id = 'enemy', x = 0, z = -5) => ({
  ...spawnHorde([survivor()], 1, 'test')[0],
  id,
  encounterId: id,
  x,
  z,
  homeX: x,
  homeZ: z,
  hp: 100,
  max: 100,
  damage: 10,
});

test('sprinting exhausts stamina, waits before regenerating, and needs recovery before restarting', () => {
  const s = newVitals();
  let now = 10000;
  for (let i = 0; i < 30 && !s.exhausted; i++) {
    now += 250;
    stepVitals(s, 0.25, now, { moving: true, sprint: true });
  }
  assert.equal(s.stamina, 0);
  assert.equal(canSprint(s), false);
  assert.equal(s.sprinting, false);
  stepVitals(s, 0.25, now + 500, {});
  assert.equal(s.stamina, 0);
  for (let i = 0; i < 8; i++) stepVitals(s, 0.25, now + 1200 + i * 250, {});
  assert.ok(s.stamina >= 25);
  assert.equal(canSprint(s), true);
  const before = s.stamina;
  stepVitals(s, 0.25, now + 5000, { moving: false, sprint: true });
  assert.ok(s.stamina >= before);
  assert.equal(s.sprinting, false);
});

test('movement budget cannot accumulate per-packet tolerance or bypass exhausted sprint speed', () => {
  const player = { survival: newVitals(), moveBudget: 0, budgetAt: 10000 };
  player.survival.stamina = 0;
  player.survival.exhausted = true;
  assert.equal(admitMovement(player, 0.8, true, 10100), false);
  assert.equal(admitMovement(player, 0.48, true, 10100), true);
  for (let i = 1; i <= 20; i++) assert.equal(admitMovement(player, 0.48, true, 10100 + i * 100), true);
  assert.equal(admitMovement(player, 0.5, false, 12100), false);
  player.survival = newVitals();
  player.moveBudget = 0;
  player.budgetAt = 20000;
  assert.equal(admitMovement(player, 0.8, true, 20100), true);
  assert.equal(admitMovement(player, 40, true, 90000), false);
  assert.ok(player.moveBudget <= 1.2);
  assert.equal(admitMovement(player, NaN, true, 90100), false);
});

test('bandages consume one stock at start and heal once only after completing uninterrupted', () => {
  const s = newVitals();
  assert.equal(beginHealing(s, 100, 1000), false);
  assert.equal(beginHealing(s, 0, 1000), false);
  assert.equal(beginHealing(s, 30, 1000), true);
  assert.equal(s.bandages, 1);
  assert.equal(beginHealing(s, 30, 1100), false);
  assert.equal(stepVitals(s, 0.1, 3599, {}), 0);
  assert.equal(stepVitals(s, 0.1, 3600, {}), 40);
  assert.equal(stepVitals(s, 0.1, 4000, {}), 0);
  assert.equal(beginHealing(s, 70, 5000), true);
  assert.equal(s.bandages, 0);
  stepVitals(s, 0.1, 5100, { moving: true });
  assert.equal(s.healEndsAt, 0);
  assert.equal(stepVitals(s, 0.1, 9000, {}), 0);
  assert.equal(beginHealing(s, 70, 10000), false);
  refillVitals(s);
  assert.equal(s.bandages, 2);
  beginHealing(s, 40, 11000);
  assert.equal(cancelHealing(s), true);
  assert.equal(s.bandages, 1);
  assert.equal(stepVitals(s, 0.1, 14000, {}), 0);
});

test('groups scale for the party, stay inside bounds and never start on top of survivors', () => {
  for (const players of [
    [survivor()],
    [survivor('a', 88, 88)],
    Array.from({ length: 4 }, (_, i) => survivor('p' + i, i, 0)),
  ]) {
    const group = spawnHorde(players, 1, 'group');
    assert.equal(group.length, players.length === 4 ? 6 : 3);
    assert.equal(new Set(group.map((e) => e.id)).size, group.length);
    for (const e of group) {
      assert.ok(Math.abs(e.x) < WORLD_BOUNDARY && Math.abs(e.z) < WORLD_BOUNDARY);
      assert.ok(players.every((p) => Math.hypot(p.x - e.x, p.z - e.z) >= 10));
    }
  }
  assert.equal(spawnHorde([survivor()], 40).length, SURVIVAL.maxEnemies);
});

test('bullets choose the first living target, melee faces its target, and pulses hit a visible group', () => {
  const group = [enemy('near', 0, -2), enemy('far', 0, -8), enemy('behind', 0, 2)];
  assert.equal(bulletTarget(group, { x: 0, y: 1.3, z: 0 }, { x: 0, y: 0, z: -1 }, 60).enemy.id, 'near');
  assert.equal(meleeTarget(group, { x: 0, z: 0, yaw: 0 }, 3).id, 'near');
  assert.equal(pulseTargets(group, { x: 0, z: 0 }, 3).length, 2);
  assert.equal(damageEnemy(group[0], 200), true);
  assert.equal(damageEnemy(group[0], 200), false);
  assert.equal(bulletTarget(group, { x: 0, y: 1.3, z: 0 }, { x: 0, y: 0, z: -1 }, 60).enemy.id, 'far');
  const b = BUILDINGS[0],
    covered = enemy('covered', b.x, b.z - 10);
  assert.equal(bulletTarget([covered], { x: b.x, y: 1.3, z: b.z + 10 }, { x: 0, y: 0, z: -1 }, 60), null);
  assert.equal(pulseTargets([covered], { x: b.x, z: b.z + 10 }, 30).length, 0);
});

test('melee has a dodgeable windup and a crowd cannot apply simultaneous stacked damage', () => {
  const p = survivor(),
    a = enemy('a', 0, -1.4),
    b = enemy('b', 1.4, 0);
  assert.equal(stepHorde([a, b], [p], 0.1, 10000).length, 0);
  assert.equal(a.state, 'windup');
  assert.equal(p.hp, 100);
  assert.equal(stepHorde([a, b], [p], 0.1, 10449).length, 0);
  const hits = stepHorde([a, b], [p], 0.1, 10450);
  assert.equal(hits.length, 1);
  assert.equal(p.hp, 90);
  const dodger = survivor(),
    attacker = enemy('d', 0, -1.4);
  stepHorde([attacker], [dodger], 0.1, 20000);
  dodger.x = 6;
  assert.equal(stepHorde([attacker], [dodger], 0.1, 20450).length, 0);
  assert.equal(dodger.hp, 100);
});

test('gunshots trigger investigation and routes bend around solid buildings', () => {
  const b = BUILDINGS[0],
    start = { x: b.x, z: b.z + 8 },
    goal = { x: b.x, z: b.z - 8 };
  const route = findRoute(start, goal);
  assert.ok(route.length > 4);
  assert.ok(route.some((p) => Math.abs(p.x - b.x) > b.w / 2));
  for (const point of route)
    assert.ok(Math.abs(point.x - b.x) >= b.w / 2 + 0.5 || Math.abs(point.z - b.z) >= b.d / 2 + 0.5);
  const e = enemy('noise', 0, -25),
    p = survivor();
  alertHorde([e], p, 10000);
  stepHorde([e], [p], 0.1, 10001);
  assert.equal(e.state, 'investigate');
  stepHorde([e], [p], 0.1, 30000);
  assert.equal(e.state, 'idle');
});

test('cleared waves wait before replacing enemies and packets exclude navigation internals', () => {
  const simulation = new HordeSimulation(),
    p = survivor();
  simulation.step([p], 0.1, 10000);
  assert.equal(simulation.wave, 1);
  const oldIds = simulation.enemies.map((e) => e.id);
  for (const e of simulation.enemies) damageEnemy(e, 1000);
  simulation.step([p], 0.1, 11000);
  assert.equal(simulation.nextWaveAt, 19000);
  simulation.step([p], 0.1, 18999);
  assert.equal(simulation.wave, 1);
  simulation.step([p], 0.1, 19000);
  assert.equal(simulation.wave, 2);
  assert.ok(simulation.enemies.every((e) => !oldIds.includes(e.id)));
  const packet = simulation.packet();
  assert.equal(packet.enemies.length, 3);
  assert.ok(packet.enemies.every((e) => !('route' in e)));
  const empty = new HordeSimulation();
  empty.step([{ ...p, hp: 0 }], 0.1, 1);
  assert.equal(empty.enemies.length, 0);
});
