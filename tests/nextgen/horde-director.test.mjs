import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HordeDirector,
  createWaveSpawns,
  separateInfected
} from '../../src/nextgen/core/HordeDirector.ts';

const terrain = {
  size: 200,
  heightAt: () => 0
};

function clearWave(director, count) {
  assert.equal(director.step(100, 0, count), false);

  for (let i = 0; i < 79; i++) {
    assert.equal(
      director.step(100, 0, count),
      false
    );
  }

  assert.equal(
    director.step(100, 0, count),
    true
  );
}

test('First wave contains three infected', () => {
  const director = new HordeDirector();

  assert.equal(director.spawnCount, 3);
  assert.equal(director.getState(3, 3).wave, 1);
});

test('Wave does not advance while infected remain alive', () => {
  const director = new HordeDirector();

  for (let i = 0; i < 100; i++) {
    assert.equal(director.step(100, 1, 3), false);
  }

  assert.equal(director.getState(1, 3).wave, 1);
});

test('Cleared wave waits eight seconds', () => {
  const director = new HordeDirector();

  clearWave(director, 3);

  assert.equal(director.spawnCount, 4);
  assert.equal(director.getState(4, 4).wave, 2);
});

test('Wave progression is capped at six enemies', () => {
  const director = new HordeDirector();

  for (let i = 0; i < 10; i++) {
    clearWave(director, director.spawnCount);
  }

  assert.equal(director.spawnCount, 6);
});

test('Kills persist across waves', () => {
  const director = new HordeDirector();

  clearWave(director, 3);

  assert.equal(director.getState(2, 4).kills, 5);
});

test('Restart clears wave progression and kills', () => {
  const director = new HordeDirector();

  clearWave(director, 3);
  director.reset();

  assert.equal(director.spawnCount, 3);
  assert.equal(director.getState(3, 3).wave, 1);
  assert.equal(director.getState(3, 3).kills, 0);
});

test('Spawn locations are deterministic', () => {
  const position = [100, 0, 100];

  assert.deepEqual(
    createWaveSpawns(position, terrain, 6, 3),
    createWaveSpawns(position, terrain, 6, 3)
  );
});

test('Infected spawn at a safe distance from the player', () => {
  const player = [100, 0, 100];

  const spawns = createWaveSpawns(
    player,
    terrain,
    6,
    1
  );

  assert.equal(spawns.length, 6);

  for (const spawn of spawns) {
    const distance = Math.hypot(
      spawn.x - player[0],
      spawn.z - player[2]
    );

    assert.ok(distance >= 11.99);
    assert.ok(distance <= 14.01);
  }
});

test('Spawn locations remain inside terrain boundaries', () => {
  for (const player of [
    [0.4, 0, 0.4],
    [199.6, 0, 0.4],
    [0.4, 0, 199.6],
    [199.6, 0, 199.6]
  ]) {
    const spawns = createWaveSpawns(
      player,
      terrain,
      6,
      2
    );

    assert.equal(spawns.length, 6);

    for (const spawn of spawns) {
      assert.ok(spawn.x >= 0.4);
      assert.ok(spawn.z >= 0.4);
      assert.ok(spawn.x <= 199.6);
      assert.ok(spawn.z <= 199.6);
    }
  }
});

function agent(x, z, health = 100) {
  const position = [x, 0, z];

  return {
    getState: () => ({
      position: [...position],
      health
    }),

    separate(dx, dz) {
      position[0] += dx;
      position[2] += dz;
    }
  };
}

test('Overlapping infected separate even at identical positions', () => {
  const a = agent(10, 10);
  const b = agent(10, 10);

  for (let i = 0; i < 20; i++) {
    separateInfected([a, b], 100);
  }

  const pa = a.getState().position;
  const pb = b.getState().position;

  assert.ok(
    Math.hypot(pa[0] - pb[0], pa[2] - pb[2])
      >= 0.8499
  );
});

test('Dead infected are not moved by separation', () => {
  const a = agent(10, 10, 0);
  const b = agent(10, 10);

  separateInfected([a, b], 100);

  assert.deepEqual(a.getState().position, [10, 0, 10]);
  assert.deepEqual(b.getState().position, [10, 0, 10]);
});