import test from 'node:test';
import assert from 'node:assert/strict';
import { CREATURES, SPECIES_IDS } from '../../shared/expansion.mjs';
import { normalizeCollection } from '../../shared/collection.mjs';
import { createEvolutionCatalog, availableEvolutions, planEvolution, legacyEvolutionPreview,
  levelFromXP, EVOLUTION_DEMO_CATALOG } from '../../shared/creature-evolution.mjs';

const family = EVOLUTION_DEMO_CATALOG.families.glimmerpaw;
const ctx = (xp = 0, more = {}) => ({ xp, ...more });

test('M04-B registered catalog includes archived five original evolution chains without renaming forms', () => {
  assert.equal(EVOLUTION_DEMO_CATALOG.familyIds.length, 6);
  for (const id of SPECIES_IDS) {
    assert.equal(EVOLUTION_DEMO_CATALOG.families[id].archive, true);
    assert.deepEqual(EVOLUTION_DEMO_CATALOG.families[id].forms.map(f => f.name), CREATURES[id].forms);
    assert.equal(availableEvolutions(EVOLUTION_DEMO_CATALOG, id, id, ctx(119))[0].ready, false);
    assert.equal(availableEvolutions(EVOLUTION_DEMO_CATALOG, id, id, ctx(120))[0].ready, true);
    assert.equal(availableEvolutions(EVOLUTION_DEMO_CATALOG, id, `${id}-2`, ctx(400))[0].ready, true);
  }
});

test('levels are deterministic, monotonic, clamped and refuse NaN', () => {
  assert.equal(levelFromXP(-40), 1);
  assert.equal(levelFromXP(NaN), 1);
  assert.equal(levelFromXP(0), 1);
  assert.equal(levelFromXP(60), 2);
  assert.equal(levelFromXP(960), 5);
  assert.equal(levelFromXP(Number.MAX_VALUE), 100);
});

test('two branches are independently gated by level, time and items', () => {
  assert.equal(family.evolutions.length, 3);
  const locked = availableEvolutions(EVOLUTION_DEMO_CATALOG, 'glimmerpaw', 'glimmerpaw', ctx(0));
  assert.equal(locked.length, 2);
  assert.ok(locked.every(e => !e.ready));
  const day = availableEvolutions(EVOLUTION_DEMO_CATALOG, 'glimmerpaw', 'glimmerpaw', ctx(960, { timeOfDay: 'day' }));
  assert.equal(day[0].ready, true);
  assert.equal(day[1].ready, false);
  assert.deepEqual(day[1].missing, ['Need moon_shard']);
  const withItem = availableEvolutions(EVOLUTION_DEMO_CATALOG, 'glimmerpaw', 'glimmerpaw', ctx(960, { timeOfDay: 'night', items: { moon_shard: 1 } }));
  assert.equal(withItem[0].ready, false);
  assert.equal(withItem[1].ready, true);
  assert.deepEqual(withItem[1].consumes, [{ itemId: 'moon_shard', count: 1 }]);
});

test('friendship and trusted trade must BOTH be confirmed', () => {
  const spec = 'glimmerpaw';
  assert.equal(availableEvolutions(EVOLUTION_DEMO_CATALOG, spec, 'sunmane', { friendship: 90 })[0].ready, false);
  assert.equal(availableEvolutions(EVOLUTION_DEMO_CATALOG, spec, 'sunmane', { trustedTrade: true })[0].ready, false);
  assert.equal(availableEvolutions(EVOLUTION_DEMO_CATALOG, spec, 'sunmane', { trustedTrade: true, friendship: 80 })[0].ready, true);
});

test('evolution plan is pure, does not spend inventory, rejects unknown/locked targets', () => {
  const snapshot = Object.freeze({ xp: 960, timeOfDay: 'night', items: Object.freeze({ moon_shard: 1 }) });
  const ok = planEvolution(EVOLUTION_DEMO_CATALOG, 'glimmerpaw', 'glimmerpaw', 'moonpelt', snapshot);
  assert.deepEqual(ok, { ok: true, familyId: 'glimmerpaw', from: 'glimmerpaw', to: 'moonpelt', consumes: [{ itemId: 'moon_shard', count: 1 }] });
  assert.equal(snapshot.items.moon_shard, 1);
  assert.equal(planEvolution(EVOLUTION_DEMO_CATALOG, 'glimmerpaw', 'glimmerpaw', 'starcrest', snapshot).ok, false);
  assert.equal(planEvolution(EVOLUTION_DEMO_CATALOG, 'glimmerpaw', 'glimmerpaw', 'moonpelt', { xp: 960 }).ok, false);
  assert.equal(availableEvolutions(EVOLUTION_DEMO_CATALOG, 'glimmerpaw', '__proto__', snapshot).length, 0);
});

test('rejects cyclic and dangling references, duplicate ids, oversized and invalid rule definitions', () => {
  const start = { id: 'foo', name: 'Foo', forms: [{ id: 'foo', name: 'Foo' }, { id: 'bar', name: 'Bar' }], evolutions: [{ from: 'foo', to: 'bar', all: [{kind:'xp',value:50}] }] };
  assert.equal(createEvolutionCatalog([start]).familyIds.length, 1);
  assert.throws(() => createEvolutionCatalog([start,start]), /family id/);
  assert.throws(() => createEvolutionCatalog([{...start,evolutions:[...start.evolutions, {from:'bar',to:'foo', all:[{kind:'level',value:5}]}]}]), /cycle/);
  assert.throws(() => createEvolutionCatalog([{...start,evolutions:[{from:'foo',to:'missing',all:[{kind:'xp',value:50}]}]}]), /endpoints/);
  assert.throws(() => createEvolutionCatalog([{...start,evolutions:[{from:'foo',to:'bar',all:[{kind:'item',value:'../../file'}]}]}]), /item id/);
  assert.throws(() => createEvolutionCatalog([{...start,evolutions:[{from:'foo',to:'bar',all:[{kind:'script',value:'alert(1)'}]}]}]), /requirement kind/);
  assert.throws(() => createEvolutionCatalog(Array.from({length:257}, (_,i) => ({...start,id:'s'+i,forms:[{id:'f'+i,name:'F'}],evolutions:[]}))), /family count/);
});

test('legacy save preview preserves ownership and XP without changing the input or extending schema', () => {
  const raw = { active: 'mossback', creatures: Object.fromEntries(SPECIES_IDS.map(id => [id, { owned: id === 'mossback', xp: 410 }])) };
  const before = JSON.stringify(raw);
  const preview = legacyEvolutionPreview(raw);
  assert.equal(preview.length, 5);
  assert.equal(preview.find(e=>e.species==='mossback').formId, 'mossback-3');
  assert.equal(preview.find(e=>e.species==='reedwisp').owned, false);
  assert.equal(JSON.stringify(raw), before);
  assert.deepEqual(normalizeCollection(raw), raw);
});

test('catalog uses pure JS, lab is a simulation only and M04-A imports are untouched', async () => {
  const fs = await import('node:fs');
  const source = fs.readFileSync(new URL('../../src/nextgen/modding/CreatureEvolutionLab.ts', import.meta.url),'utf8');
  const bridge = fs.readFileSync(new URL('../../src/nextgen/modding/NextgenModBridge.ts', import.meta.url),'utf8');
  assert.match(source, /planEvolution\(/);
  assert.doesNotMatch(source, /fetch\(|\.send\(|localStorage|indexedDB|innerHTML|eval\(/);
  assert.match(bridge, /registry\.acquire\(this\.species\)/);
});
