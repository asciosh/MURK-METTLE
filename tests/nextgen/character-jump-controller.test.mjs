import test from 'node:test';
import assert from 'node:assert/strict';
import { CharacterController } from '../../src/nextgen/core/CharacterController.ts';

const camera = {
  front: [0, 0, -1],
  right: [1, 0, 0]
};

const idle = { forward: 0, strafe: 0 };

const terrain = {
  size: 200,
  heightAt: () => 0
};

function createController(options = {}) {
  return new CharacterController({
    speed: 4.8,
    radius: 2,
    terrain,
    ...options
  });
}

function near(actual, expected) {
  assert.ok(Math.abs(actual - expected) < 0.000001);
}

test('Jump lifts character above terrain', () => {
  const c = createController();

  const r = c.update(100, {
    ...idle, jump: true
  }, camera);

  assert.equal(r.grounded, false);
  assert.equal(r.airborne, true);
  assert.ok(r.position[1] > 0);
});

test('Character lands and resets vertical velocity', () => {
  const c = createController();

  c.update(100, { ...idle, jump: true }, camera);

  for (let i = 0; i < 20; i++) {
    c.update(100, idle, camera);
  }

  const r = c.update(100, idle, camera);

  assert.equal(r.grounded, true);
  assert.equal(r.airborne, false);
  near(r.position[1], 0);
  near(r.verticalVelocity, 0);
});

test('Holding jump does not repeat after landing', () => {
  const c = createController();

  for (let i = 0; i < 25; i++) {
    c.update(100, {
      ...idle, jump: true
    }, camera);
  }

  near(c.getPosition()[1], 0);

  c.update(100, idle, camera);

  const r = c.update(100, {
    ...idle, jump: true
  }, camera);

  assert.equal(r.airborne, true);
});

test('Midair dodge is prevented', () => {
  const c = createController();

  c.update(100, { ...idle, jump: true }, camera);

  const r = c.update(100, {
    ...idle, dodge: true
  }, camera);

  assert.equal(r.dodging, false);
  assert.equal(r.airborne, true);
  near(r.stamina, 100);
});

test('Jump during dodge is prevented', () => {
  const c = createController();

  c.update(100, { ...idle, dodge: true }, camera);

  const r = c.update(100, {
    ...idle, jump: true
  }, camera);

  assert.equal(r.dodging, true);
  assert.equal(r.airborne, false);
  near(r.position[1], 0);
});

test('Dodge takes priority over simultaneous jump', () => {
  const c = createController();

  const r = c.update(100, {
    ...idle,
    dodge: true,
    jump: true
  }, camera);

  assert.equal(r.dodging, true);
  assert.equal(r.airborne, false);
});

test('Airborne movement works without sprinting', () => {
  const c = createController();

  const r = c.update(100, {
    forward: 1,
    strafe: 0,
    jump: true,
    sprint: true
  }, camera);

  assert.equal(r.airborne, true);
  assert.equal(r.sprinting, false);

  near(r.position[2], 99.52);
  near(r.stamina, 100);
});

test('Landing follows uneven terrain', () => {
  const slope = {
    size: 200,
    heightAt: (x, z) => 5 + (100 - z) * 0.1
  };

  const c = createController({ terrain: slope });

  c.update(100, {
    forward: 1,
    strafe: 0,
    jump: true
  }, camera);

  for (let i = 0; i < 20; i++) {
    c.update(100, {
      forward: 1, strafe: 0
    }, camera);
  }

  const [x, y, z] = c.getPosition();

  near(y, slope.heightAt(x, z));
});

test('Invalid time step does not consume jump input', () => {
  const c = createController();

  c.update(NaN, {
    ...idle, jump: true
  }, camera);

  const r = c.update(100, {
    ...idle, jump: true
  }, camera);

  assert.equal(r.airborne, true);
});