import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { emptyCollection } from '../shared/collection.mjs';
import { NEXTGEN_ROSTER_KEY, reconcileRoster, rosterView, nativeFormXP } from '../shared/nextgen-creature-roster.mjs';

const makeLegacy = (xp = 0) => {
  const collection = emptyCollection(); collection.creatures.lanternkin = { owned: true, xp };
  return collection;
};
test('legacy ownership migrates once, preserves XP and existing stages, and never grants unowned creatures', () => {
  const legacy = makeLegacy(399); legacy.creatures.emberling.xp = 800;
  const snapshot = structuredClone(legacy);
  const roster = reconcileRoster(undefined, legacy, () => 'creature-1');
  assert.deepEqual(legacy, snapshot);
  assert.equal(roster.activeId, 'creature-1');
  assert.equal(roster.instances.length, 1);
  assert.deepEqual(roster.instances[0], { id: 'creature-1', familyId: 'lanternkin', formId: 'lanternkin-2', xp: 399, origin: 'legacy', status: 'available' });
  assert.equal(rosterView(roster).instances[0].nextXP, 400);
  const next = reconcileRoster(roster, makeLegacy(400), () => assert.fail('Should not generate another ID'));
  assert.equal(next.instances[0].formId, 'lanternkin-3');
  assert.equal(next.instances[0].xp, 400);
  assert.equal(roster.instances[0].xp, 399);
  assert.deepEqual(reconcileRoster(next, makeLegacy(120)), next);
});

test('lost instance is not resurrected, unsupported versions fail closed, and native duplicates are preserved', () => {
  const roster = reconcileRoster(undefined, makeLegacy(), () => 'old');
  roster.instances[0].status = 'lost';
  roster.instances.push({ id: 'new', familyId: 'lanternkin', formId: 'lanternkin', xp: 0, origin: 'native', status: 'available' });
  const after = reconcileRoster(roster, makeLegacy(800));
  assert.equal(after.activeId, null);
  assert.equal(after.instances.length, 2);
  assert.equal(after.instances[0].status, 'lost');
  assert.equal(after.instances[0].xp, 0);
  assert.equal(after.instances[1].xp, 0);
  assert.throws(() => reconcileRoster({ version: 99, instances: [] }, makeLegacy()), /Unsupported/);
  assert.throws(() => reconcileRoster({ version: 1, instances: [...roster.instances, roster.instances[0]] }, makeLegacy()), /Invalid/);
});

// Exercise the real account implementation without a network or production data.
const source = (await readFile(new URL('../server/cloudflare/account.mjs', import.meta.url), 'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject { constructor(ctx) { this.ctx = ctx; } }')
  .replaceAll(/'\.\.\/\.\.\/shared\/([^']+)'/g, (_, file) => JSON.stringify(new URL('../shared/' + file, import.meta.url).href));
const { PlayerAccount } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
class Storage {
  values = new Map();
  async get(key) { return structuredClone(this.values.get(key)); }
  async put(key, value) { this.values.set(key, structuredClone(value)); }
  async transaction(fn) { return fn(this); }
}
const createClient = (storage, username) => {
  let cookie = '';
  let account = new PlayerAccount({ storage });
  async function send(op, method = 'GET', data, internal = false, authenticated = true) {
    const response = await account.fetch(new Request(`https://example.test/api/account/${op}`, {
      method, headers: { 'X-MM-Account': username, ...(authenticated && cookie ? { Cookie: cookie } : {}), ...(internal ? { 'X-MM-Reward-Source': 'game-room-v1' } : {}) },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    }));
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, data: await response.json() };
  }
  return { send, restart: () => { account = new PlayerAccount({ storage }); } };
};

test('authenticated roster persists stable identities; server-only bonding/rewards progress one instance and preserve legacy saves', async () => {
  const storage = new Storage(); const client = createClient(storage, 'rostertest');
  const other = createClient(new Storage(), 'otheraccount');
  assert.equal((await client.send('nextgen-roster')).status, 401);
  assert.equal(await storage.get(NEXTGEN_ROSTER_KEY), undefined);
  assert.equal((await client.send('register', 'POST', { pin: '12345678' })).status, 200);
  assert.equal((await other.send('register', 'POST', { pin: '12345678' })).status, 200);
  await storage.put('coop-collection', makeLegacy(100));
  const legacySave = { version: 1, revision: 4, data: { 'murk-mettle-v04-progression': '{"xp":90}' }, updatedAt: 1 };
  await storage.put('save', legacySave);
  const initial = await client.send('nextgen-roster');
  assert.equal(initial.status, 200);
  const first = initial.data.roster.instances[0]; assert.equal(first.xp, 100);
  assert.deepEqual(await storage.get('coop-collection'), makeLegacy(100));
  assert.deepEqual(await storage.get('save'), legacySave);
  assert.deepEqual((await other.send('nextgen-roster')).data.roster.instances, []);
  client.restart();
  assert.deepEqual((await client.send('nextgen-roster')).data, initial.data);
  assert.equal((await client.send('nextgen-roster', 'POST', { xp: 99999 })).status, 405);
  assert.equal((await client.send('coop-collection', 'POST', { action: 'bond', species: 'emberling' })).status, 403);
  const event = { id: 'kill:roster-test-1', pulse: true, species: 'lanternkin' };
  assert.equal((await client.send('coop-reward', 'POST', event)).status, 403);
  assert.equal((await client.send('coop-reward', 'POST', event, true)).status, 200);
  assert.equal((await client.send('coop-reward', 'POST', event, true)).data.duplicate, true);
  const progressed = (await client.send('nextgen-roster')).data.roster.instances[0];
  assert.equal(progressed.id, first.id); assert.equal(progressed.xp, 140); assert.equal(progressed.formId, 'lanternkin-2');
  assert.equal((await storage.get(NEXTGEN_ROSTER_KEY)).instances[0].xp, 140);
  assert.equal((await client.send('coop-collection', 'POST', { action: 'bond', species: 'emberling' }, true)).status, 200);
  const bonded = (await client.send('nextgen-roster')).data.roster;
  assert.equal(bonded.instances.length, 2);
  assert.notEqual(bonded.activeId, first.id);
  assert.equal(bonded.instances.find(c => c.id === bonded.activeId).familyId, 'emberling');
  assert.deepEqual(await storage.get('save'), legacySave);
});

test('ordinary legacy users do not create roster records until the account journal is opened', async () => {
  const storage = new Storage(); const client = createClient(storage, 'legacyonly');
  assert.equal((await client.send('register', 'POST', { pin: '12345678' })).status, 200);
  assert.equal((await client.send('coop-collection', 'POST', { action: 'bond', species: 'lanternkin' }, true)).status, 200);
  assert.equal(await storage.get(NEXTGEN_ROSTER_KEY), undefined);
  const initial = await client.send('nextgen-roster');
  assert.equal(initial.data.roster.instances.length, 1);
});

test('native captures are server-only, idempotent, independent, selectable and explicitly evolved', async () => {
  const storage = new Storage(), client = createClient(storage,'capturetest'), other = createClient(new Storage(),'captureother');
  await client.send('register','POST',{pin:'12345678'}); await other.send('register','POST',{pin:'12345678'});
  await storage.put('coop-collection',makeLegacy(20));
  const initial = (await client.send('nextgen-roster')).data.roster;
  const capture = id => client.send('coop-native-capture','POST',{id},true);
  assert.equal((await client.send('coop-native-capture','POST',{id:'capture:room-test:1'})).status,403);
  const first = (await capture('capture:room-test:1')).data.native;
  assert.equal(first.xp,0); assert.equal(first.formId,'lanternkin'); assert.notEqual(first.id,initial.activeId);
  assert.equal((await capture('capture:room-test:1')).status,409);
  const second = (await capture('capture:room-test:2')).data.native; assert.notEqual(first.id,second.id);
  const select = id => client.send('nextgen-roster-action','POST',{action:'select',id});
  const evolve = (id,targetId) => client.send('nextgen-roster-action','POST',{action:'evolve',id,targetId});
  assert.equal((await select(first.id)).status,200);
  assert.equal((await other.send('nextgen-roster-action','POST',{action:'select',id:first.id})).status,409);
  assert.equal((await evolve(first.id,'lanternkin-2')).status,409);
  assert.equal((await client.send('nextgen-roster-action','POST',{action:'evolve',id:first.id,targetId:'lanternkin-2',xp:400})).status,400);
  for (let i=0;i<3;i++) {
    const reward = {id:`kill:native-test-${i}`,pulse:true,species:'lanternkin',instanceId:first.id};
    assert.equal((await client.send('coop-reward','POST',reward,true)).status,200);
    assert.equal((await client.send('coop-reward','POST',reward,true)).data.duplicate,true);
  }
  let roster = (await client.send('nextgen-roster')).data.roster;
  assert.equal(roster.activeId,first.id); assert.equal(roster.instances.length,3);
  const ready = roster.instances.find(c=>c.id===first.id);
  assert.equal(ready.xp,120); assert.equal(ready.formId,'lanternkin'); assert.equal(nativeFormXP(ready),0);
  assert.equal(ready.nextFormId,'lanternkin-2');
  assert.equal(roster.instances.find(c=>c.id===second.id).xp,0);
  assert.equal(roster.instances.find(c=>c.id===initial.activeId).xp,20);
  assert.equal((await evolve(first.id,'lanternkin-3')).status,409);
  assert.equal((await evolve(first.id,'lanternkin-2')).status,200);
  assert.equal((await evolve(first.id,'lanternkin-2')).status,409);
  client.restart(); roster=(await client.send('nextgen-roster')).data.roster;
  assert.equal(roster.instances.find(c=>c.id===first.id).formId,'lanternkin-2');
  assert.equal(nativeFormXP(roster.instances.find(c=>c.id===first.id)),120);
  assert.equal((await client.send('coop-collection?nextgen=1','GET',undefined,true)).data.native.id,first.id);
  assert.equal((await select(initial.activeId)).status,200);
  assert.equal((await client.send('coop-collection?nextgen=1','GET',undefined,true)).data.native,null);
  assert.deepEqual(await storage.get('coop-collection'),makeLegacy(20));
});
