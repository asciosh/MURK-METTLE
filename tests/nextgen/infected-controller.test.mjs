import test from 'node:test';
import assert from 'node:assert/strict';

import {
  InfectedController
} from '../../src/nextgen/core/InfectedController.ts';

const terrain = {
  size: 200,
  heightAt: () => 0
};

function create(ground = terrain) {
  return new InfectedController({
    terrain: ground,
    spawn: { x: 100, z: 100 }
  });
}

test('Infected starts idle with full health', () => {
  const state = create().getState();

  assert.equal(state.health, 100);
  assert.equal(state.animation, 'idle');
  assert.deepEqual(state.position, [100, 0, 100]);
});

test('Infected ignores distant targets', () => {
  const enemy = create();

  const state = enemy.update(100, [130, 0, 100]);

  assert.equal(state.animation, 'idle');
  assert.deepEqual(state.position, [100, 0, 100]);
});

test('Infected runs toward distant detected targets', () => {
  const enemy = create();

  const state = enemy.update(100, [110, 0, 100]);

  assert.equal(state.animation, 'run');
  assert.ok(Math.abs(state.position[0] - 100.32) < 0.000001);
  assert.deepEqual(state.facing, [1, 0, 0]);
});

test('Infected walks near the player', () => {
  const enemy = create();

  const state = enemy.update(100, [104, 0, 100]);

  assert.equal(state.animation, 'walk');
  assert.ok(Math.abs(state.position[0] - 100.16) < 0.000001);
});

test('Infected stops at melee range and attacks', () => {
  const enemy = create();
  const target = [102, 0, 100];

  for (let i = 0; i < 10; i++) {
    enemy.update(100, target);
  }

  const state = enemy.getState();

  assert.equal(state.animation, 'attack');
  assert.ok(Math.abs(102 - state.position[0] - 1.65) < 0.000001);
});

test('Attack impact occurs once after windup', () => {
  const enemy = create();
  const target = [101.5, 0, 100];

  assert.equal(enemy.update(16, target).animation, 'attack');

  for (let i = 0; i < 4; i++) {
    assert.equal(enemy.update(100, target).attackHit, false);
  }

  assert.equal(enemy.update(50, target).attackHit, true);

  for (let i = 0; i < 10; i++) {
    assert.equal(enemy.update(50, target).attackHit, false);
  }
});

test('Moving away during windup avoids the attack', () => {
  const enemy = create();

  enemy.update(16, [101.5, 0, 100]);

  for (let i = 0; i < 10; i++) {
    assert.equal(
      enemy.update(100, [105, 0, 100]).attackHit,
      false
    );
  }
});

test('Airborne targets can avoid melee damage', () => {
  const enemy = create();

  enemy.update(16, [101.5, 0, 100]);

  for (let i = 0; i < 5; i++) {
    assert.equal(
      enemy.update(100, [101.5, 2, 100]).attackHit,
      false
    );
  }
});

test('Damage interrupts attack and activates hit reaction', () => {
  const enemy = create();

  enemy.update(16, [101.5, 0, 100]);

  assert.equal(enemy.damage(25), true);

  const state = enemy.getState();

  assert.equal(state.health, 75);
  assert.equal(state.animation, 'hit');
  assert.equal(state.speed, 0);
});

test('Infected recovers from hit reaction', () => {
  const enemy = create();

  enemy.damage(25);

  for (let i = 0; i < 4; i++) {
    enemy.update(100, null);
  }

  assert.equal(enemy.getState().animation, 'idle');
});

test('Dead infected cannot move or attack', () => {
  const enemy = create();

  enemy.damage(100);

  const before = enemy.getState();
  const after = enemy.update(100, [101, 0, 100]);

  assert.equal(after.health, 0);
  assert.equal(after.animation, 'death');
  assert.equal(after.attackHit, false);
  assert.deepEqual(after.position, before.position);
  assert.equal(enemy.damage(10), false);
});

test('Infected follows terrain elevation', () => {
  const enemy = create({
    size: 200,
    heightAt: (x, z) => x * 0.1 + z * 0.1
  });

  const state = enemy.update(100, [110, 20, 100]);

  assert.ok(
    Math.abs(
      state.position[1] -
      (state.position[0] + state.position[2]) * 0.1
    ) < 0.000001
  );
});

test('Invalid time and damage inputs are safe', () => {
  const enemy = create();
  const before = enemy.getState();

  assert.equal(enemy.damage(NaN), false);
  assert.equal(enemy.damage(-10), false);

  assert.deepEqual(
    enemy.update(NaN, [110, 0, 100]),
    before
  );
});

test('Returned state cannot mutate controller position', () => {
  const enemy = create();

  const state = enemy.getState();
  state.position[0] = 0;

  assert.equal(enemy.getState().position[0], 100);
});