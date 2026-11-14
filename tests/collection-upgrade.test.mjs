import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeCollection, evolutionProgress, journalEntry } from '../shared/collection.mjs';
import { CREATURES, constrainPosition, creaturePower } from '../shared/expansion.mjs';

test('old three-species saves add locked species and preserve active ownership and independent XP', () => {
  const old = {
    active: 'emberling',
    creatures: {
      lanternkin: { owned: true, xp: 189 },
      emberling: { owned: true, xp: 423 },
      reedwisp: { owned: false, xp: 0 },
    },
  };
  const upgraded = normalizeCollection(old, { owned: true, xp: 20 });
  assert.equal(upgraded.active, 'emberling');
  assert.deepEqual(upgraded.creatures.lanternkin, old.creatures.lanternkin);
  assert.deepEqual(upgraded.creatures.emberling, old.creatures.emberling);
  for (const id of ['mossback', 'stormrook']) assert.deepEqual(upgraded.creatures[id], { owned: false, xp: 0 });
  assert.equal(Object.keys(old.creatures).length, 3);
  assert.deepEqual(normalizeCollection(upgraded), upgraded);
});
test('collection normalization handles invalid active species, malformed XP and legacy fallback', () => {
  const c = normalizeCollection(
    {
      active: '__proto__',
      creatures: { mossback: { owned: true, xp: Infinity }, stormrook: { owned: true, xp: 999999 } },
    },
    { owned: true, xp: 121 },
  );
  assert.equal(c.active, 'lanternkin');
  assert.equal(c.creatures.lanternkin.xp, 121);
  assert.equal(c.creatures.mossback.xp, 0);
  assert.equal(c.creatures.stormrook.xp, 250000);
  assert.equal(normalizeCollection(null, null).creatures.lanternkin.owned, false);
});
test('journal progress resets at each evolution boundary and final forms stay complete', () => {
  assert.deepEqual(evolutionProgress(119), { stage: 0, next: 120, remaining: 1, fraction: 119 / 120 });
  assert.deepEqual(evolutionProgress(120), { stage: 1, next: 400, remaining: 280, fraction: 0 });
  assert.equal(evolutionProgress(260).fraction, 0.5);
  assert.deepEqual(evolutionProgress(400), { stage: 2, next: null, remaining: 0, fraction: 1 });
  for (const id of ['mossback', 'stormrook']) {
    assert.equal(journalEntry(id, 120).forms.filter((f) => f.unlocked).length, 2);
    assert.deepEqual(constrainPosition({ x: CREATURES[id].x, z: CREATURES[id].z }), {
      x: CREATURES[id].x,
      z: CREATURES[id].z,
    });
    assert.ok(creaturePower(id, 400).damage > creaturePower(id, 0).damage);
  }
});
const source = (await readFile(new URL('../server/cloudflare/account.mjs', import.meta.url), 'utf8'))
  .replace(
    "import { DurableObject } from 'cloudflare:workers';",
    'class DurableObject {constructor(ctx){this.ctx=ctx}}',
  )
  .replaceAll(/'\.\.\/\.\.\/shared\/([^']+)'/g, (_, f) =>
    JSON.stringify(new URL('../shared/' + f, import.meta.url).href),
  );
const { PlayerAccount } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
test('account upgrades saved collections, rejects unowned selections, and persists new-species evolution rewards once', async () => {
  const values = new Map([
    [
      'coop-collection',
      {
        active: 'lanternkin',
        creatures: {
          lanternkin: { owned: true, xp: 230 },
          emberling: { owned: false, xp: 0 },
          reedwisp: { owned: false, xp: 0 },
        },
      },
    ],
  ]);
  const storage = {
    get: async (k) => structuredClone(values.get(k)),
    put: async (k, v) => values.set(k, structuredClone(v)),
    transaction: async (fn) => fn(storage),
  };
  const account = new PlayerAccount({ storage });
  const send = (op, body) =>
    account.fetch(
      new Request('https://internal/api/account/' + op, {
        method: body ? 'POST' : 'GET',
        headers: { 'X-MM-Account': 'tester', 'X-MM-Reward-Source': 'game-room-v1' },
        body: body ? JSON.stringify(body) : undefined,
      }),
    );
  assert.equal((await send('coop-collection', { action: 'select', species: 'mossback' })).status, 409);
  for (const species of ['mossback', 'stormrook']) {
    assert.equal((await send('coop-collection', { action: 'bond', species })).status, 200);
    for (let i = 0; i < 10; i++) {
      const body = { id: `kill:v024-${species}-${i}`, pulse: true, species };
      assert.equal((await send('coop-reward', body)).status, 200);
      assert.equal((await send('coop-reward', body)).status, 200);
    }
  }
  const { collection } = await (await send('coop-collection')).json();
  assert.equal(collection.creatures.lanternkin.xp, 230);
  assert.equal(collection.creatures.mossback.xp, 400);
  assert.equal(collection.creatures.stormrook.xp, 400);
  assert.equal(collection.active, 'stormrook');
});
