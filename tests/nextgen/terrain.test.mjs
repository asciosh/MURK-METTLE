import test from 'node:test';
import assert from 'node:assert/strict';
import { TerrainGenerator } from '../../src/nextgen/core/TerrainGenerator.ts';

test('TerrainGenerator same-seed determinism', () => {
  const a = new TerrainGenerator(12345);
  const b = new TerrainGenerator(12345);

  assert.deepEqual(a.getHeights(), b.getHeights());
  assert.equal(a.heightAt(53.25, 71.75), b.heightAt(53.25, 71.75));
});

test('TerrainGenerator different-seed variation', () => {
  const a = new TerrainGenerator(12345);
  const b = new TerrainGenerator(999999);

  assert.notDeepEqual(a.getHeights(), b.getHeights());
});

test('TerrainGenerator grid dimensions', () => {
  const t = new TerrainGenerator(42);

  assert.equal(t.size, 200);
  assert.equal(t.gridSize, 257);
  assert.equal(t.cellSize, 200 / 256);
  assert.equal(t.getHeights().length, 257 * 257);
});

test('TerrainGenerator elevation bounds 0-20m', () => {
  const t = new TerrainGenerator(42);

  for (const h of t.getHeights()) {
    assert.ok(Number.isFinite(h));
    assert.ok(h >= 0 && h <= 20);
  }
});

test('TerrainGenerator continuous elevation variation', () => {
  const t = new TerrainGenerator(42);

  assert.ok(new Set(t.getHeights()).size > 100);
});

test('TerrainGenerator bounded adjacent height differences', () => {
  const t = new TerrainGenerator(42);
  const heights = t.getHeights();
  const grid = t.gridSize;

  for (let z = 0; z < grid; z++) {
    for (let x = 0; x < grid; x++) {
      const i = z * grid + x;

      if (x + 1 < grid) {
        assert.ok(Math.abs(heights[i] - heights[i + 1]) <= 1);
      }

      if (z + 1 < grid) {
        assert.ok(Math.abs(heights[i] - heights[i + grid]) <= 1);
      }
    }
  }
});

test('TerrainGenerator boundary coordinate clamping', () => {
  const t = new TerrainGenerator(42);

  assert.equal(t.heightAt(-1000, -1000), t.heightAt(0, 0));
  assert.equal(t.heightAt(1000, 1000), t.heightAt(200, 200));

  assert.equal(t.heightAt(-500, 50), t.heightAt(0, 50));
  assert.equal(t.heightAt(500, 50), t.heightAt(200, 50));

  assert.equal(t.heightAt(50, -500), t.heightAt(50, 0));
  assert.equal(t.heightAt(50, 500), t.heightAt(50, 200));
});

test('TerrainGenerator triangle interpolation accuracy', () => {
  const t = new TerrainGenerator(42);
  const heights = t.getHeights();
  const grid = t.gridSize;
  const cell = t.cellSize;

  // Controlled, non-coplanar test cell.
  heights[0] = 2;
  heights[1] = 6;
  heights[grid] = 10;
  heights[grid + 1] = 20;

  assert.equal(t.heightAt(cell * 0.25, cell * 0.25), 5);
  assert.equal(t.heightAt(cell * 0.75, cell * 0.75), 14);
  assert.equal(t.heightAt(cell * 0.5, cell * 0.5), 8);
});

test('TerrainGenerator minimum sampled elevation matches grid', () => {
  const t = new TerrainGenerator(42);
  const heights = t.getHeights();
  const min = Math.min(...heights);
  const i = heights.indexOf(min);

  const x = (i % t.gridSize) * t.cellSize;
  const z = Math.floor(i / t.gridSize) * t.cellSize;

  assert.equal(t.heightAt(x, z), min);
  assert.ok(min >= 0);
});

test('TerrainGenerator maximum sampled elevation matches grid', () => {
  const t = new TerrainGenerator(42);
  const heights = t.getHeights();
  const max = Math.max(...heights);
  const i = heights.indexOf(max);

  const x = (i % t.gridSize) * t.cellSize;
  const z = Math.floor(i / t.gridSize) * t.cellSize;

  assert.equal(t.heightAt(x, z), max);
  assert.ok(max <= 20);
});