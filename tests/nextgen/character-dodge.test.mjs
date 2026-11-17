import test from 'node:test';
import assert from 'node:assert/strict';
import { CharacterController } from '../../src/nextgen/core/CharacterController.ts';

const terrain = { size: 200, heightAt: () => 0 };

const camera = {
  front: [0, 0, -1],
  right: [1, 0, 0]
};

const idle = { forward: 0, strafe: 0 };

function createController(options = {}) {
  return new CharacterController({
    speed: 4.8,
    radius: 2,
    terrain,
    ...options
  });
}

function near(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 0.000001,
    `Expected ${expected}, received ${actual}`
  );
}

test('Dodge consumes 25 stamina only once', () => {
  const c = createController();

  let r = c.update(100, {
    ...idle, dodge: true
  }, camera);

  near(r.stamina, 75);
  assert.equal(r.dodging, true);

  r = c.update(100, {
    ...idle, dodge: true
  }, camera);

  near(r.stamina, 75);
});

test('Forward dodge travels exactly 3 metres', () => {
  const c = createController();

  c.update(100, { ...idle, dodge: true }, camera);
  c.update(100, idle, camera);

  const r = c.update(100, idle, camera);

  near(r.position[2], 97);
  near(r.position[0], 100);
  assert.equal(r.dodging, false);
});

test('Directional dodge locks its original direction', () => {
  const c = createController();

  c.update(100, {
    forward: 0, strafe: 1, dodge: true
  }, camera);

  c.update(100, {
    forward: 1, strafe: 0
  }, camera);

  const r = c.update(100, {
    forward: 0, strafe: -1
  }, camera);

  near(r.position[0], 103);
  near(r.position[2], 100);
});

test('Diagonal dodge preserves distance', () => {
  const c = createController();

  c.update(100, {
    forward: 1, strafe: 1, dodge: true
  }, camera);

  c.update(100, idle, camera);
  const r = c.update(100, idle, camera);

  near(Math.hypot(
    r.position[0] - 100,
    r.position[2] - 100
  ), 3);
});

test('Dodge cooldown prevents immediate repetition', () => {
  const c = createController();

  c.update(100, { ...idle, dodge: true }, camera);
  c.update(100, idle, camera);
  c.update(100, idle, camera);

  const r = c.update(100, {
    ...idle, dodge: true
  }, camera);

  near(r.stamina, 75);
  assert.equal(r.dodging, false);
  assert.ok(r.dodgeCooldownMs > 0);
});

test('Holding dodge does not trigger repeated actions', () => {
  const c = createController();

  for (let i = 0; i < 10; i++) {
    c.update(100, {
      ...idle, dodge: true
    }, camera);
  }

  near(c.getPosition()[2], 97);

  c.update(100, idle, camera);

  const r = c.update(100, {
    ...idle, dodge: true
  }, camera);

  assert.equal(r.dodging, true);
});

test('Insufficient stamina prevents dodge', () => {
  const c = createController();

  for (let i = 0; i < 34; i++) {
    c.update(100, {
      forward: 1, strafe: 0, sprint: true
    }, camera);
  }

  const before = c.getPosition();

  const r = c.update(100, {
    ...idle, dodge: true
  }, camera);

  assert.ok(r.stamina < 25);
  assert.equal(r.dodging, false);
  assert.deepEqual(r.position, before);
});

test('Dodge respects terrain boundaries', () => {
  const c = createController({
    spawn: { x: 197, z: 100 }
  });

  c.update(100, {
    forward: 0, strafe: 1, dodge: true
  }, camera);

  c.update(100, idle, camera);
  const r = c.update(100, idle, camera);

  near(r.position[0], 198);
});

test('Dodge takes priority over sprint', () => {
  const c = createController();

  const r = c.update(100, {
    forward: 1,
    strafe: 0,
    sprint: true,
    dodge: true
  }, camera);

  assert.equal(r.dodging, true);
  assert.equal(r.sprinting, false);

  near(r.stamina, 75);
  near(r.position[2], 99);
});