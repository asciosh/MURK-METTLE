import test from 'node:test';
import assert from 'node:assert/strict';
import { CharacterController } from '../../src/nextgen/core/CharacterController.ts';

const terrain = { size: 200, heightAt: () => 0 };

const camera = {
  front: [0, 0, -1],
  right: [1, 0, 0]
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

test('Walking preserves stamina', () => {
  const c = createController();
  const r = c.update(100, {
    forward: 1, strafe: 0
  }, camera);

  near(r.position[2], 99.52);
  near(r.stamina, 100);
  assert.equal(r.sprinting, false);
});

test('Sprinting increases speed and consumes stamina', () => {
  const c = createController();
  const r = c.update(100, {
    forward: 1, strafe: 0, sprint: true
  }, camera);

  near(r.position[2], 99.2);
  near(r.stamina, 97.7);
  assert.equal(r.sprinting, true);
});

test('Diagonal sprint respects maximum speed', () => {
  const c = createController();
  const r = c.update(100, {
    forward: 1, strafe: 1, sprint: true
  }, camera);

  near(Math.hypot(
    r.position[0] - 100,
    r.position[2] - 100
  ), 0.8);
});

test('Standing still with sprint held preserves stamina', () => {
  const c = createController();
  const r = c.update(100, {
    forward: 0, strafe: 0, sprint: true
  }, camera);

  near(r.stamina, 100);
  assert.equal(r.sprinting, false);
});

test('Blocked movement does not consume stamina', () => {
  const c = createController({
    spawn: { x: 198, z: 100 }
  });

  const r = c.update(100, {
    forward: 0, strafe: 1, sprint: true
  }, camera);

  near(r.position[0], 198);
  near(r.stamina, 100);
  assert.equal(r.sprinting, false);
});

test('Exhaustion forces walking speed', () => {
  const c = createController();
  const input = {
    forward: 1, strafe: 0, sprint: true
  };

  for (let i = 0; i < 44; i++) {
    c.update(100, input, camera);
  }

  const before = c.getPosition();

  const r = c.update(100, input, camera);

  assert.equal(r.exhausted, true);
  assert.equal(r.sprinting, false);
  near(before[2] - r.position[2], 0.48);
});