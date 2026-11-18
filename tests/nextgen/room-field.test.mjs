import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyCollection } from '../../shared/collection.mjs';
import { CREATURES, SUPPLIES } from '../../shared/expansion.mjs';
import { PICKUPS, EXTRACTION } from '../../shared/coop-rules.mjs';
import { roomFieldTargets, nearestFieldTarget, fieldIntent, nextOwnedSpecies, companionFollow } from '../../src/nextgen/core/RoomFieldRules.ts';

const mission = { pickups: [...PICKUPS], ready: false, phase: 'active' };
test('unconfirmed collection does not invent bondable creatures', () => {
  const targets = roomFieldTargets(null, null);
  assert.equal(targets.length, SUPPLIES.length);
  assert.ok(targets.every(t => t.kind === 'resupply'));
});
test('nearest bond target is range checked and generates the existing room intent', () => {
  const targets = roomFieldTargets(emptyCollection(), mission);
  const pos = CREATURES.lanternkin;
  const t = nearestFieldTarget(pos, targets);
  assert.equal(t.kind, 'bond'); assert.deepEqual(fieldIntent(t), { type: 'bond', body: { species: 'lanternkin' } });
  assert.equal(nearestFieldTarget({ x: 0, z: 0 }, targets), null);
});
test('owned creatures no longer appear as unowned habitats; cycling only selects owned species', () => {
  const collection = emptyCollection();
  collection.creatures.lanternkin.owned = true;
  assert.equal(nextOwnedSpecies(collection), null);
  collection.creatures.emberling.owned = true;
  assert.equal(nextOwnedSpecies(collection), 'emberling');
  assert.ok(!roomFieldTargets(collection, mission).some(t => t.kind === 'bond' && t.id === 'lanternkin'));
});
test('mission markers follow server pickups and extraction lock', () => {
  const targets = roomFieldTargets(emptyCollection(), mission);
  const sample = nearestFieldTarget(PICKUPS[0], targets);
  assert.deepEqual(fieldIntent(sample), { type: 'pickup', body: { id: PICKUPS[0].id } });
  const changed = roomFieldTargets(emptyCollection(), { pickups: [PICKUPS[1]], ready: true, phase: 'active' });
  assert.ok(!changed.some(t => t.kind === 'pickup' && t.id === PICKUPS[0].id));
  assert.equal(fieldIntent(targets.find(t => t.kind === 'extract')), null);
  assert.deepEqual(fieldIntent(nearestFieldTarget(EXTRACTION, changed)), { type: 'extract', body: {} });
});
test('supplies use existing IDs and authoritative range; presentation follow stays in bounds', () => {
  const supply = SUPPLIES[0];
  assert.deepEqual(fieldIntent(nearestFieldTarget(supply, roomFieldTargets(null, null))), { type: 'resupply', body: { id: supply.id } });
  const follow = companionFollow({ x: 89.6, z: 89.6 }, 0);
  assert.ok(follow.x < 90 && follow.z < 90);
});
