import test from 'node:test';
import assert from 'node:assert/strict';

import {
  generateVegetation,
  createVegetationChunks,
  isChunkVisible,
  CHUNK_SIZE
} from '../../src/nextgen/core/VegetationSystem.ts';

import {
  TerrainGenerator
} from '../../src/nextgen/core/TerrainGenerator.ts';

const flatTerrain = {
  size: 200,
  heightAt: () => 8
};

test('Vegetation placement is deterministic', () => {
  const a = generateVegetation(flatTerrain, 12345);
  const b = generateVegetation(flatTerrain, 12345);

  assert.deepEqual(a, b);
});

test('Different seeds produce different vegetation', () => {
  const a = generateVegetation(flatTerrain, 12345);
  const b = generateVegetation(flatTerrain, 54321);

  assert.notDeepEqual(a, b);
});

test('All six environment types are generated', () => {
  const placements = generateVegetation(flatTerrain);

  const expected = {
    pine: 100,
    deciduous: 60,
    bush: 90,
    grass: 400,
    rock: 40,
    log: 15
  };

  for (const [kind, count] of Object.entries(expected)) {
    assert.equal(
      placements.filter(p => p.kind === kind).length,
      count
    );
  }
});

test('Vegetation remains inside terrain boundaries', () => {
  const placements = generateVegetation(flatTerrain);

  for (const p of placements) {
    assert.ok(p.x >= 10 && p.x <= 190);
    assert.ok(p.z >= 10 && p.z <= 190);
    assert.ok(p.scale >= 0.75 && p.scale <= 1.4);
    assert.ok(p.rotation >= 0 && p.rotation < Math.PI * 2);
  }
});

test('Vegetation follows the terrain heightfield', () => {
  const terrain = new TerrainGenerator(12345);
  const placements = generateVegetation(terrain);

  assert.ok(placements.length > 0);

  for (const p of placements) {
    assert.equal(p.y, terrain.heightAt(p.x, p.z));
  }
});

test('Spatial chunks contain every placement exactly once', () => {
  const placements = generateVegetation(flatTerrain);
  const chunks = createVegetationChunks(placements);
  const combined = chunks.flatMap(c => c.placements);

  assert.equal(combined.length, placements.length);
  assert.equal(new Set(combined).size, placements.length);

  for (const chunk of chunks) {
    for (const p of chunk.placements) {
      assert.equal(Math.floor(p.x / CHUNK_SIZE), chunk.x);
      assert.equal(Math.floor(p.z / CHUNK_SIZE), chunk.z);
    }
  }
});

test('Nearby chunks are visible and distant chunks are culled', () => {
  const chunk = {
    x: 2,
    z: 3,
    placements: []
  };

  assert.equal(isChunkVisible(chunk, 60, 85, 10), true);
  assert.equal(isChunkVisible(chunk, 40, 85, 10), true);
  assert.equal(isChunkVisible(chunk, 39, 85, 10), false);
  assert.equal(isChunkVisible(chunk, 0, 0, 10), false);
});

test('Chunk culling uses correct diagonal distance', () => {
  const chunk = {
    x: 2,
    z: 3,
    placements: []
  };

  assert.equal(isChunkVisible(chunk, 40, 65, 14), false);
  assert.equal(isChunkVisible(chunk, 40, 65, 15), true);
});