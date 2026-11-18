import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CREATURES, SPECIES_IDS, creaturePower } from '../../shared/expansion.mjs';
import { emptyCollection, normalizeCollection } from '../../shared/collection.mjs';

const archive = JSON.parse(fs.readFileSync(new URL('../../docs/nextgen/archive/M03-ORIGINAL-CREATURES.json', import.meta.url), 'utf8'));

test('M04 archives all five original creature definitions without changing combat rules', () => {
  assert.deepEqual(archive.species, CREATURES);
  assert.equal(Object.keys(archive.species).length, 5);
  for (const id of SPECIES_IDS) {
    assert.equal(archive.species[id].forms.length, 3);
    assert.ok(creaturePower(id, 400).damage > creaturePower(id, 0).damage);
  }
});

test('M04 preserves existing cloud collection IDs, ownership and XP', () => {
  const collection = emptyCollection();
  for (const id of SPECIES_IDS) collection.creatures[id] = { owned: true, xp: 411 };
  collection.active = SPECIES_IDS[2];
  assert.deepEqual(normalizeCollection(collection), collection);
});

test('NEXTGEN mod bridge never modifies account, room, or creature progression', () => {
  const source = fs.readFileSync(new URL('../../src/nextgen/modding/NextgenModBridge.ts', import.meta.url), 'utf8');
  assert.match(source, /registry\.acquire\(this\.species\)/);
  assert.match(source, /root\.position\.copy\(source\.position\)/);
  assert.doesNotMatch(source, /\.send\(|fetch\(|\.xp\s*=/);
});

test('NEXTGEN mod menu reuses the existing cosmetic ZIP validator', () => {
  const source = fs.readFileSync(new URL('../../src/nextgen/modding/NextgenModsTab.ts', import.meta.url), 'utf8');
  assert.match(source, /registry\.import\(file\)/);
  assert.match(source, /registry\.restoreOriginals\(\)/);
  assert.match(source, /registry\.preview\(id\)/);
  assert.doesNotMatch(source, /innerHTML|eval\(/);
});
