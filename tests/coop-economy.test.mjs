import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';

const source = (await readFile(new URL('../worker/account.mjs', import.meta.url), 'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor(ctx) { this.ctx = ctx; } }');
const { PlayerAccount } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
class Storage {
  values = new Map();
  async get(k) { return this.values.get(k); }
  async put(k, v) { this.values.set(k, structuredClone(v)); }
  async transaction(callback) { return callback(this); }
}
const storage = new Storage();
const account = new PlayerAccount({ storage });
const username = 'tester';
const token = 'a'.repeat(64);
const hash = Buffer.from(await webcrypto.subtle.digest('SHA-256', new TextEncoder().encode(token))).toString('hex');
await storage.put('account', { salt: 'irrelevant', hash: 'irrelevant' });
await storage.put('sessions', { [hash]: Date.now() + 600_000 });
const headers = { 'Cookie': `mm_session=${username}.${token}`, 'X-MM-Account': username };
const request = (op, method='GET', data=undefined) => account.fetch(new Request(`https://internal/api/account/${op}`, {
  method, headers: { ...headers, ...(data ? { 'Content-Type': 'application/json' } : {}) },
  body: data ? JSON.stringify(data) : undefined,
}));
async function kill(id, pulse=false) {
  const response = await account.fetch(new Request('https://internal/api/account/coop-reward', {
    method: 'POST', headers: { 'X-MM-Account': username, 'X-MM-Reward-Source': 'game-room-v1' },
    body: JSON.stringify({ id, pulse }),
  }));
  assert.equal(response.status, 200); return response.json();
}
test('co-op salvage is server-issued exactly once; crafting spends verified materials', async () => {
  assert.equal((await request('coop-state')).status, 200);
  assert.equal((await request('coop-craft','POST',{recipe:'sharpened'})).status, 409);
  const materialOrder = ['scrap','fiber','spore','scrap','fiber'];
  for (let i=0;i<5;i++) {
    const result = await kill(`kill:trusted-${i}`, i === 0);
    assert.equal(result.material, materialOrder[i]);
  }
  const retry = await kill('kill:trusted-4');
  assert.equal(retry.duplicate, true);
  const after = await (await request('coop-state')).json();
  assert.deepEqual(after.inventory, { scrap: 2, fiber: 2, spore: 1 });
  assert.equal(after.stats.xp, 250);
  assert.equal(after.stats.creatureXp, 40);
  assert.equal((await request('coop-craft','POST',{recipe:'balanced'})).status, 200);
  const state = await (await request('coop-state')).json();
  assert.deepEqual(state.inventory, { scrap: 0, fiber: 0, spore: 1 });
  assert.equal(state.upgrades.balanced, true);
  assert.equal((await request('coop-craft','POST',{recipe:'balanced'})).status, 409);
  assert.equal((await request('coop-craft','POST',{recipe:'__proto__'})).status, 400);
  assert.equal((await request('coop-craft','POST',{recipe:'restorative'})).status, 409);
});
