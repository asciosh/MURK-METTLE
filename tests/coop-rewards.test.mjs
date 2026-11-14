import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../worker/account.mjs', import.meta.url), 'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor(ctx) { this.ctx = ctx; } }');
const { PlayerAccount } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
class Storage {
  values = new Map();
  async get(k) { return this.values.get(k); }
  async put(k, v) { this.values.set(k, structuredClone(v)); }
  async transaction(fn) { return fn(this); }
}
const account = new PlayerAccount({ storage: new Storage() });
function send(id, pulse, trusted=true) {
  return account.fetch(new Request('https://internal/api/account/coop-reward', {
    method: 'POST', headers: { 'X-MM-Account': 'forestplayer',
      ...(trusted ? { 'X-MM-Reward-Source': 'game-room-v1' } : {}) },
    body: JSON.stringify({ id, pulse }),
  }));
}
test('server-owned reward is idempotent and protected from ordinary account requests', async () => {
  assert.equal((await send('kill:encounter-123', false, false)).status, 403);
  const bonded = await account.fetch(new Request('https://internal/api/account/coop-creature', { method: 'POST', headers: { 'X-MM-Account': 'forestplayer', 'X-MM-Reward-Source': 'game-room-v1' }, body: JSON.stringify({ action: 'bond' }) }));
  assert.equal(bonded.status, 200);
  const first = await (await send('kill:encounter-123', true)).json();
  assert.deepEqual(first.stats, { xp: 50, kills: 1, creatureXp: 40 });
  assert.equal(first.duplicate, false);
  const retry = await (await send('kill:encounter-123', true)).json();
  assert.equal(retry.duplicate, true);
  assert.deepEqual(retry.stats, first.stats);
  const second = await (await send('kill:encounter-456', false)).json();
  assert.deepEqual(second.stats, { xp: 100, kills: 2, creatureXp: 40 });
});
