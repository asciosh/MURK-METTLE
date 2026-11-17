import test from 'node:test';
import assert from 'node:assert/strict';
import { ThirdPersonCamera } from '../../src/nextgen/core/ThirdPersonCamera.ts';

const terrain = { heightAt: () => 0 };

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 0.000001);
}

test('Camera starts behind the character', () => {
  const c = new ThirdPersonCamera();
  const pose = c.update(16, [100, 0, 100], terrain);

  near(pose.position[0], 100);
  assert.ok(pose.position[2] > 100);
  assert.ok(pose.position[1] > 1.35);
});

test('Camera maintains its default distance', () => {
  const c = new ThirdPersonCamera();
  const pose = c.update(16, [100, 0, 100], terrain);

  near(Math.hypot(
    pose.position[0] - pose.target[0],
    pose.position[1] - pose.target[1],
    pose.position[2] - pose.target[2]
  ), 5.5);
});

test('Mouse rotation changes movement orientation', () => {
  const c = new ThirdPersonCamera();

  c.rotate(
    Math.PI / 2 / ThirdPersonCamera.SENSITIVITY,
    0
  );

  const orientation = c.getOrientation();

  near(orientation.front[0], 1);
  near(orientation.front[2], 0);
  near(orientation.right[2], 1);
});

test('Camera follows character smoothly', () => {
  const c = new ThirdPersonCamera();

  c.update(16, [100, 0, 100], terrain);

  const pose = c.update(
    16, [110, 0, 100], terrain
  );

  assert.ok(pose.target[0] > 100);
  assert.ok(pose.target[0] < 110);
});

test('Camera reduces distance before obstructing terrain', () => {
  const c = new ThirdPersonCamera();

  const ridge = {
    heightAt: (x, z) =>
      z >= 102 && z <= 104 ? 8 : 0
  };

  const pose = c.update(
    16, [100, 0, 100], ridge
  );

  assert.ok(pose.position[2] < 102);
});

test('Invalid mouse input cannot corrupt orientation', () => {
  const c = new ThirdPersonCamera();

  c.rotate(NaN, Infinity);

  const orientation = c.getOrientation();

  near(orientation.front[0], 0);
  near(orientation.front[2], -1);
});

test('Returned target cannot mutate internal state', () => {
  const c = new ThirdPersonCamera();

  const pose = c.update(
    16, [100, 0, 100], terrain
  );

  pose.target[0] = 999;

  const next = c.update(
    16, [100, 0, 100], terrain
  );

  near(next.target[0], 100);
});