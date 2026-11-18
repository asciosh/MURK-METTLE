import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enemyMotion, smoothRoomPosition, confirmedShotSegment, roomAimDirection } from '../../src/nextgen/core/RoomPresentation.ts';

const enemy = (patch = {}) => ({ id: 'enemy', x: 0, z: -10, hp: 80, max: 80, state: 'idle', strain: 'runner', generation: 1, ...patch });
test('server movement drives infected locomotion without mutating snapshots', () => {
  const initial = enemyMotion(undefined, enemy(), 16, []);
  const next = Object.freeze(enemy({ x: 0.25, state: 'chase' }));
  const motion = enemyMotion(initial, next, 100, []);
  assert.equal(motion.animation, 'run'); assert.equal(motion.hp, 80); assert.equal(next.x, 0.25);
  assert.equal(motion.yaw, -Math.PI / 2);
});
test('server windup starts one attack and repeated attack states do not loop it', () => {
  let m = enemyMotion(undefined, enemy(), 100, []);
  m = enemyMotion(m, enemy({ state: 'windup' }), 100, [{ x: 0, z: -9 }]);
  assert.equal(m.animation, 'attack'); assert.equal(m.attackMs, 1000);
  for (let i = 0; i < 11; i++) m = enemyMotion(m, enemy({ state: 'attack' }), 100, []);
  assert.equal(m.animation, 'idle');
  m = enemyMotion(m, enemy({ state: 'windup' }), 100, []); assert.equal(m.animation, 'attack');
});
test('confirmed HP reductions trigger hit poses; death takes priority', () => {
  let m = enemyMotion(undefined, enemy(), 100, []);
  m = enemyMotion(m, enemy({ hp: 40 }), 16, []); assert.equal(m.animation, 'hit');
  m = enemyMotion(m, enemy({ hp: 0, state: 'dead' }), 16, []); assert.equal(m.animation, 'death');
});
test('render smoothing never changes the network target, snaps large corrections', () => {
  const target = Object.freeze({ x: 0.5, z: 0 });
  const p = smoothRoomPosition({ x: 0, z: 0 }, target, 16);
  assert.ok(p.x > 0 && p.x < target.x); assert.equal(target.x, 0.5);
  assert.deepEqual(smoothRoomPosition(p, { x: 3, z: 0 }, 16), { x: 3, z: 0 });
});
test('shot VFX endpoint uses only server-confirmed origin, direction and distance', () => {
  assert.deepEqual(confirmedShotSegment({ x: -2, y: 1.32, z: 4 }, { x: 0, y: 0, z: -1 }, 8), { from: [98, 1.32, 104], to: [98, 1.32, 96] });
  assert.equal(confirmedShotSegment({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 2 }, 8), null);
  assert.equal(confirmedShotSegment({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, Infinity), null);
});
test('shoulder aim convergence returns a normalized forward direction', () => {
  const dir = roomAimDirection({ x: 0, z: 0 }, { x: 0.75, y: 1.32, z: 3 }, { x: 0, y: 0, z: -1 }, 65, [enemy({ x: 0.75 })]);
  assert.ok(dir.x > 0 && dir.z < 0); assert.ok(Math.abs(Math.hypot(dir.x, dir.y, dir.z) - 1) < 1e-9);
});

test('co-op chase retains run animation during one or two delayed room snapshots', () => {
  let m = enemyMotion(undefined, enemy({ state: 'chase', x: 0 }), 16, []);
  assert.equal(m.animation, 'run');
  for (let i = 0; i < 16; i++) {
    m = enemyMotion(m, enemy({ state: 'chase', x: 0 }), 16, []);
    assert.equal(m.animation, 'run', `frame ${i} must not flicker to idle`);
  }
  m = enemyMotion(m, enemy({ state: 'chase', x: 0.4 }), 16, []);
  assert.equal(m.animation, 'run');
  assert.ok(m.speed >= 2.25);
});
test('investigating uses walk while delayed; genuine idle returns to idle', () => {
  let m = enemyMotion(undefined, enemy({ state: 'investigate' }), 16, []);
  for (let i = 0; i < 12; i++) {
    m = enemyMotion(m, enemy({ state: 'investigate' }), 16, []);
    assert.equal(m.animation, 'walk');
  }
  for (let i = 0; i < 20; i++) m = enemyMotion(m, enemy({ state: 'idle' }), 16, []);
  assert.equal(m.animation, 'idle');
  m = enemyMotion(m, enemy({ state: 'dead', hp: 0 }), 16, []);
  assert.equal(m.animation, 'death');
});
test('a stepped visual target eases without affecting the network snapshot', () => {
  const server = Object.freeze({ x: 0.8, z: -0.2 });
  let visual = { x: 0, z: 0 };
  visual = smoothRoomPosition(visual, server, 16);
  assert.ok(visual.x > 0 && visual.x < server.x);
  for (let i = 0; i < 40; i++) visual = smoothRoomPosition(visual, server, 16);
  assert.ok(Math.abs(visual.x - server.x) < 1e-6);
  assert.deepEqual(server, { x: 0.8, z: -0.2 });
});
