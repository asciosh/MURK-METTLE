import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeActorPose, solveArm } from '../shared/actor-pose.mjs';
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

test('cosmetic pose rejects arbitrary weapons and clamps non-finite camera values', () => {
  assert.deepEqual(sanitizeActorPose(), { weapon: 'pistol', aiming: false, sprinting: false, pitch: 0 });
  for (const invalid of [null, undefined, 'bad', NaN, 123]) assert.equal(sanitizeActorPose(invalid).weapon, 'pistol');
  assert.deepEqual(
    sanitizeActorPose({ weapon: '__proto__', aiming: 'true', sprinting: 1, pitch: Infinity }),
    sanitizeActorPose(),
  );
  assert.deepEqual(sanitizeActorPose({ weapon: 'rifle', aiming: true, sprinting: true, pitch: 99 }), {
    weapon: 'rifle',
    aiming: true,
    sprinting: true,
    pitch: 0.95,
  });
  assert.equal(sanitizeActorPose({ pitch: -100 }).pitch, -0.65);
});

test('articulated arms keep bone lengths and reach valid targets across both shoulders', () => {
  for (const side of [-1, 1])
    for (let i = 0; i < 100; i++) {
      const shoulder = { x: side * 0.285, y: 1.47, z: 0 };
      const hand = {
        x: 0.1 + Math.sin(i) * 0.1,
        y: 1.15 + Math.cos(i * 0.4) * 0.12,
        z: -0.2 - Math.abs(Math.sin(i * 0.7)) * 0.25,
      };
      const pose = solveArm(shoulder, hand, { x: side * 0.55, y: -0.8, z: 0.25 });
      assert.ok(Math.abs(distance(shoulder, pose.elbow) - 0.32) < 1e-9);
      assert.ok(Math.abs(distance(pose.elbow, pose.wrist) - 0.3) < 1e-9);
      if (distance(shoulder, hand) < 0.619) assert.ok(distance(pose.wrist, hand) < 1e-9);
      assert.ok(Object.values(pose.elbow).every(Number.isFinite));
    }
});

test('unreachable and coincident arm targets remain finite without stretching limbs', () => {
  const origin = { x: 0, y: 0, z: 0 };
  for (const hand of [origin, { x: 40, y: -40, z: 0 }, { x: 0, y: -0.3, z: 0 }]) {
    const p = solveArm(origin, hand, { x: 0, y: -1, z: 0 });
    assert.ok(Object.values(p.wrist).every(Number.isFinite));
    assert.ok(Math.abs(distance(origin, p.elbow) - 0.32) < 1e-9);
    assert.ok(Math.abs(distance(p.elbow, p.wrist) - 0.3) < 1e-9);
  }
});
