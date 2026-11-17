import test from 'node:test';
import assert from 'node:assert/strict';

import { CharacterController } from '../../src/nextgen/core/CharacterController.ts';
import { ThirdPersonCamera } from '../../src/nextgen/core/ThirdPersonCamera.ts';

const terrain = {
  size: 200,
  heightAt: () => 0
};

const normalCamera = {
  front: [0, 0, -1],
  right: [1, 0, 0]
};

const turnedCamera = {
  front: [1, 0, 0],
  right: [0, 0, 1]
};

const idle = {
  forward: 0,
  strafe: 0
};

const position = [100, 0, 100];

function createController() {
  return new CharacterController({
    speed: 4.8,
    radius: 0.4,
    terrain
  });
}

function near(actual, expected, tolerance = 0.01) {
  assert.ok(
    Math.abs(actual - expected) < tolerance,
    `Expected ${expected}, received ${actual}`
  );
}

function distance(pose) {
  return Math.hypot(
    pose.position[0] - pose.target[0],
    pose.position[1] - pose.target[1],
    pose.position[2] - pose.target[2]
  );
}

test('Aim starts disabled', () => {
  const controller = createController();

  const state = controller.update(
    16, idle, normalCamera
  );

  assert.equal(state.aiming, false);
});

test('Aim activates and releases', () => {
  const controller = createController();

  assert.equal(
    controller.update(
      16, { ...idle, aim: true }, normalCamera
    ).aiming,
    true
  );

  assert.equal(
    controller.update(
      16, idle, normalCamera
    ).aiming,
    false
  );
});

test('Aim reset clears stored state immediately', () => {
  const controller = createController();

  controller.update(
    16, { ...idle, aim: true }, normalCamera
  );

  controller.resetAim();

  assert.equal(
    controller.update(0, idle, normalCamera).aiming,
    false
  );
});

test('Stationary aiming follows camera direction', () => {
  const controller = createController();

  const state = controller.update(
    16, { ...idle, aim: true }, turnedCamera
  );

  assert.deepEqual(state.facing, [1, 0, 0]);
});

test('Aiming preserves camera-facing while strafing', () => {
  const controller = createController();

  const state = controller.update(
    100,
    { ...idle, strafe: 1, aim: true },
    turnedCamera
  );

  assert.deepEqual(state.facing, [1, 0, 0]);
  near(state.position[0], 100);
  near(state.position[2], 100.48);
});

test('Aim does not override dodge direction', () => {
  const controller = createController();

  controller.update(
    100,
    { ...idle, forward: 1, dodge: true },
    normalCamera
  );

  const state = controller.update(
    100,
    { ...idle, aim: true },
    turnedCamera
  );

  assert.equal(state.dodging, true);
  assert.deepEqual(state.facing, [0, 0, -1]);
});

test('Aim does not override airborne facing', () => {
  const controller = createController();

  controller.update(
    100,
    { ...idle, jump: true },
    normalCamera
  );

  const state = controller.update(
    100,
    { ...idle, aim: true },
    turnedCamera
  );

  assert.equal(state.airborne, true);
  assert.deepEqual(state.facing, [0, 0, -1]);
});

test('Aim camera smoothly zooms in', () => {
  const camera = new ThirdPersonCamera();

  const initial = camera.update(
    16, position, terrain
  );

  const aiming = camera.update(
    16, position, terrain, true
  );

  assert.ok(aiming.fov < initial.fov);
  assert.ok(distance(aiming) < distance(initial));
  assert.ok(aiming.fov > ThirdPersonCamera.AIM_FOV);
});

test('Aim camera converges to shoulder position', () => {
  const camera = new ThirdPersonCamera();

  let pose;

  for (let i = 0; i < 120; i++) {
    pose = camera.update(
      16, position, terrain, true
    );
  }

  near(pose.fov, 45);
  near(distance(pose), 3);
  near(pose.target[0], 100.75);
  near(pose.target[2], 100);
});

test('Releasing aim restores default camera', () => {
  const camera = new ThirdPersonCamera();

  for (let i = 0; i < 120; i++) {
    camera.update(16, position, terrain, true);
  }

  let pose;

  for (let i = 0; i < 120; i++) {
    pose = camera.update(16, position, terrain, false);
  }

  near(pose.fov, 58);
  near(distance(pose), 5.5);
  near(pose.target[0], 100);
});

test('Aim camera preserves terrain collision', () => {
  const camera = new ThirdPersonCamera();

  const ridge = {
    heightAt: (x, z) =>
      z >= 102 && z <= 104 ? 8 : 0
  };

  const pose = camera.update(
    100, position, ridge, true
  );

  assert.ok(pose.position[2] < 102);
});

test('Shoulder offset respects lateral terrain collision', () => {
  const camera = new ThirdPersonCamera();

  const ridge = {
    heightAt: (x, z) => x >= 100.4 ? 8 : 0
  };

  let pose;

  for (let i = 0; i < 120; i++) {
    pose = camera.update(
      16, position, ridge, true
    );
  }

  assert.ok(pose.target[0] < 100.4);
});