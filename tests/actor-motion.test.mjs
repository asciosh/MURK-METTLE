import test from 'node:test';
import assert from 'node:assert/strict';
import { solveLeg, footCycle } from '../shared/actor-motion.mjs';

test('leg solving preserves authored segment lengths and keeps boots level for reachable ankle targets', () => {
  for (let i = 0; i < 100; i++) {
    const y = -0.38 - (i / 100) * 0.2,
      z = Math.sin(i) * 0.22,
      pose = solveLeg(y, z);
    const ankleY = -0.34 * Math.cos(pose.hip) - 0.33 * Math.cos(pose.hip + pose.knee),
      ankleZ = -0.34 * Math.sin(pose.hip) - 0.33 * Math.sin(pose.hip + pose.knee);
    assert.ok(Math.abs(ankleY - y) < 1e-10);
    assert.ok(Math.abs(ankleZ - z) < 1e-10);
    assert.ok(Math.abs(pose.hip + pose.knee + pose.foot) < 1e-10);
  }
  for (const [y, z] of [
    [0, 0],
    [-20, 20],
    [-0.001, 0.001],
  ])
    assert.ok(Object.values(solveLeg(y, z)).every(Number.isFinite));
});
test('foot cycles keep stance on the floor, lift during recovery, and wrap without a discontinuity', () => {
  assert.equal(footCycle(0).lift, 0);
  assert.equal(footCycle(Math.PI * 0.7).stance, true);
  assert.ok(footCycle(Math.PI * 1.6).lift > 0);
  assert.ok(footCycle(Math.PI * 1.6, 1).lift > footCycle(Math.PI * 1.6, 0).lift);
  assert.ok(Math.abs(footCycle(Math.PI * 2 - 1e-6).z - footCycle(0).z) < 1e-6);
});
