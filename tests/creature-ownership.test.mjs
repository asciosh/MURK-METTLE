import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const text = (await readFile(new URL('../worker/account.mjs', import.meta.url), 'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor(ctx) { this.ctx = ctx; } }');
const { PlayerAccount } = await import(`data:text/javascript,${encodeURIComponent(text)}`);
class Storage {
  map = new Map();
  async get(k) { return this.map.get(k); }
  async put(k, v) { this.map.set(k, structuredClone(v)); }
  async transaction(callback) { return callback(this); }
}
const account = new PlayerAccount({ storage: new Storage() });
const internal = { 'X-MM-Account': 'tester', 'X-MM-Reward-Source': 'game-room-v1' };
const request = (method, source, body) => account.fetch(new Request('https://internal/api/account/coop-creature', {
  method, headers: { 'X-MM-Account': 'tester', ...(source ? { 'X-MM-Reward-Source': source } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
}));
const reward = (id, pulse) => account.fetch(new Request('https://internal/api/account/coop-reward', {
  method: 'POST', headers: internal, body: JSON.stringify({ id, pulse }),
}));

test('creature ownership is private, persistent, and required for trusted pulse XP', async () => {
  assert.equal((await request('GET')).status, 403);
  assert.equal((await request('POST', undefined, { action: 'bond' })).status, 403);
  assert.equal((await reward('kill:unbonded-001', true)).status, 409);
  const initial = await (await request('GET', 'game-room-v1')).json();
  assert.equal(initial.creature.owned, false);
  const first = await (await request('POST', 'game-room-v1', { action: 'bond' })).json();
  assert.equal(first.creature.owned, true);
  const again = await (await request('POST', 'game-room-v1', { action: 'bond' })).json();
  assert.equal(again.creature.xp, 0);
  const kill = await (await reward('kill:trusted-pulse-01', true)).json();
  assert.equal(kill.stats.creatureXp, 40);
  const retry = await (await reward('kill:trusted-pulse-01', true)).json();
  assert.equal(retry.duplicate, true);
  const persistent = await (await request('GET', 'game-room-v1')).json();
  assert.deepEqual(persistent.creature, { species: 'lanternkin', owned: true, xp: 40 });
});
