import test from 'node:test';
import assert from 'node:assert/strict';

import {
  findShotTarget
} from '../../src/nextgen/core/ShotQuery.ts';

const origin = [0, 1.3, 0];
const forward = [0, 0, -1];
const flat = () => 0;

const target = (x, z, health = 100) => ({
  position: [x, 0, z],
  health
});

function query(targets, direction = forward, terrain = flat) {
  return findShotTarget(
    origin,
    direction,
    origin,
    targets,
    35,
    terrain
  );
}

test('Bullet hits an infected directly ahead', () => {
  assert.equal(query([target(0, -10)]), 0);
});

test('Bullet misses an infected outside the crosshair', () => {
  assert.equal(query([target(2, -10)]), null);
});

test('Bullet selects the nearest living infected', () => {
  assert.equal(query([
    target(0, -20),
    target(0, -5)
  ]), 1);
});

test('Dead infected do not block bullets', () => {
  assert.equal(query([
    target(0, -5, 0),
    target(0, -10)
  ]), 1);
});

test('Targets outside weapon range are ignored', () => {
  assert.equal(query([target(0, -50)]), null);
});

test('Terrain blocks bullets', () => {
  const hill = (x, z) =>
    z < -4 && z > -6 ? 3 : 0;

  assert.equal(
    query([target(0, -10)], forward, hill),
    null
  );
});

test('Targets behind the player are ignored', () => {
  assert.equal(query([target(0, 5)]), null);
});

test('Invalid shooting directions are rejected', () => {
  assert.equal(query([target(0, -10)], [0, 0, 0]), null);
  assert.equal(query([target(0, -10)], [NaN, 0, 0]), null);
});

test('Shots above the infected miss', () => {
  assert.equal(
    query([target(0, -10)], [0, 1, -1]),
    null
  );
});