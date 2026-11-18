import { test } from 'node:test';
import assert from 'node:assert/strict';
import { roomMove, roomToScene, roomDirection, validateRoomCode } from '../../src/nextgen/core/RoomIntent.ts';
import { WORLD_BOUNDARY } from '../../shared/expansion.mjs';

test('room coordinates map server origin and negative coordinates onto the NEXTGEN plane', () => {
  assert.deepEqual(roomToScene(0, 0), [100, 0, 100]);
  assert.deepEqual(roomToScene(-90, 90), [10, 0, 190]);
});
test('room input is normalized and latency does not grant extra movement', () => {
  const p = roomMove({ x: 0, z: 0 }, 1, 1, 0, false, 500);
  assert.ok(Math.hypot(p.x, p.z) <= 0.480001);
  assert.deepEqual(roomMove({ x: 0, z: 0 }, 1, 0, 0, false, 100), { x: 0, z: -0.48 });
  assert.ok(roomMove({ x: WORLD_BOUNDARY - 0.5, z: 0 }, 0, 1, 0, true, 100).x < WORLD_BOUNDARY);
});
test('aim direction is normalized and follows actor yaw', () => {
  const d = roomDirection(1.2, -0.4);
  assert.ok(Math.abs(Math.hypot(d.x, d.y, d.z) - 1) < 1e-9);
  assert.ok(roomDirection(0, 0).z === -1);
});
test('room codes follow the existing room contract', () => {
  assert.equal(validateRoomCode(' bloom '), 'BLOOM');
  assert.equal(validateRoomCode('a!'), null);
});
