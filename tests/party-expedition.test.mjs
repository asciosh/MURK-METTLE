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
const eventId = 'mission:abcdef0123456789:1';
const headers = { 'X-MM-Account': 'test_user', 'X-MM-Reward-Source': 'game-room-v1' };
function mission(id, source='game-room-v1') {
  return account.fetch(new Request('https://internal/api/account/coop-expedition', {
    method: 'POST', headers: { ...headers, 'X-MM-Reward-Source': source }, body: JSON.stringify({ id }),
  }));
}
test('party extraction is internal-only, idempotent and gives exactly 150 persistent XP', async () => {
  assert.equal((await mission(eventId, 'untrusted')).status, 403);
  assert.equal((await mission('invalid')).status, 400);
  const first = await (await mission(eventId)).json();
  assert.equal(first.duplicate, false);
  assert.equal(first.stats.xp, 150);
  assert.equal(first.stats.extractions, 1);
  const again = await (await mission(eventId)).json();
  assert.equal(again.duplicate, true);
  assert.equal(again.stats.xp, 150);
  const second = await (await mission('mission:abcdef0123456789:2')).json();
  assert.equal(second.stats.xp, 300);
  assert.equal(second.stats.extractions, 2);
});

test('room defines server-side, bounded and distance-checked mission events', async () => {
  const room = await readFile(new URL('../worker/room.mjs', import.meta.url), 'utf8');
  assert.match(room, /const MISSION_KILLS = 3/);
  assert.match(room, /const MISSION_SALVAGE = 2/);
  assert.match(room, /msg\.type === 'pickup'/);
  assert.match(room, /msg\.type === 'extract'/);
  assert.match(room, /Math\.hypot\(item\.x - player\.x, item\.z - player\.z\) > 2\.7/);
  assert.match(room, /this\.mission\.salvage\.includes\(item\.id\)/);
  assert.match(room, /this\.mission\.phase = 'extracting'/);
});
