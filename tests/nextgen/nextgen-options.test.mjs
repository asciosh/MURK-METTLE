import assert from 'node:assert/strict';
import { test } from 'node:test';
import { QUALITY_OPTIONS, QUALITY_STORAGE_KEY, NEXTGEN_CONTROLS, nextgenQuality, savedNextgenQuality, saveNextgenQuality } from '../../src/nextgen/core/NextgenOptions.ts';

test('quality is strictly limited to three known rendering presets', () => {
  assert.deepEqual(QUALITY_OPTIONS.map(p => p.id), ['low', 'balanced', 'cinematic']);
  for (const invalid of [null, {}, 'ultra', 'mobile', '../low', 42]) assert.equal(nextgenQuality(invalid), 'balanced');
});
test('device-local rendering preference safely persists without cloud state', () => {
  const stored = new Map();
  const store = { getItem: key => stored.get(key) ?? null, setItem: (key, value) => { stored.set(key, value); } };
  assert.equal(savedNextgenQuality(store), 'balanced');
  assert.equal(saveNextgenQuality(store, 'cinematic'), 'cinematic');
  assert.equal(stored.get(QUALITY_STORAGE_KEY), 'cinematic');
  assert.equal(savedNextgenQuality(store), 'cinematic');
  assert.equal(savedNextgenQuality({ getItem: () => { throw Error('denied'); } }), 'balanced');
  assert.equal(saveNextgenQuality({ setItem: () => { throw Error('denied'); } }, 'low'), 'low');
});
test('shared controls display only actions available in the corresponding mode', () => {
  const labels = key => NEXTGEN_CONTROLS[key].map(p => p[0]);
  assert.ok(labels('solo').includes('Space'));
  assert.ok(labels('solo').includes('Ctrl'));
  assert.ok(labels('coop').includes('Space'));
  assert.ok(labels('coop').includes('Ctrl'));
  assert.ok(labels('coop').includes('V'));
  assert.ok(labels('shared').includes('Esc'));
});
