import test from 'node:test';
import assert from 'node:assert/strict';
import { forestZone, foliageScale, TRAIL_SPURS, WORLD_DECOR_BUDGET } from '../src/client/game/world-composition.mjs';
import { TREES, CREATURES, SUPPLIES, BUILDINGS, constrainPosition } from '../shared/expansion.mjs';

test('forest presentation produces distinct habitat zones without mutating authoritative locations', () => {
  const before = JSON.stringify({ TREES, CREATURES, SUPPLIES, BUILDINGS });
  const types = new Set(TREES.map((t) => forestZone(t.x, t.z)));
  assert.deepEqual([...types].sort(), ['broadleaf', 'pine', 'wetland']);
  assert.equal(forestZone(CREATURES.mossback.x, CREATURES.mossback.z), 'pine');
  assert.equal(forestZone(CREATURES.reedwisp.x, CREATURES.reedwisp.z), 'wetland');
  assert.equal(JSON.stringify({ TREES, CREATURES, SUPPLIES, BUILDINGS }), before);
});
test('every tree retains ten bounded crown slots and pine crowns taper toward the top', () => {
  for (const zone of ['pine', 'wetland', 'broadleaf'])
    for (let i = 0; i < 10; i++) {
      const s = foliageScale(zone, i);
      assert.ok(s.width > 0 && s.width < 1.5);
      assert.ok(s.height > 0 && s.height < 1.2);
      assert.ok(s.y >= 3.8 && s.y <= 10);
    }
  assert.ok(foliageScale('pine', 0).width > foliageScale('pine', 9).width);
});
test('spurs align with existing wetland walkway and relay supply without moving either', () => {
  assert.deepEqual(TRAIL_SPURS[1], { x1: -49.5, z1: -10, x2: -48, z2: -16 });
  for (const s of TRAIL_SPURS)
    for (let i = 0; i <= 100; i++) {
      const p = { x: s.x1 + ((s.x2 - s.x1) * i) / 100, z: s.z1 + ((s.z2 - s.z1) * i) / 100 };
      const q = constrainPosition({ ...p });
      assert.ok(Math.hypot(p.x - q.x, p.z - q.z) < 0.01);
    }
  const end = TRAIL_SPURS[2],
    supply = SUPPLIES.find((p) => p.id === 'relay');
  assert.equal(end.x2, supply.x);
  assert.equal(end.z2, supply.z);
  assert.ok(WORLD_DECOR_BUDGET.grass < 6500 && WORLD_DECOR_BUDGET.ferns < 900 && WORLD_DECOR_BUDGET.pebbles < 850);
  assert.ok(WORLD_DECOR_BUDGET.lilyPads <= 64);
});
