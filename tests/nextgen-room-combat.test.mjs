import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { newVitals, spawnHorde } from '../shared/survival.mjs';
import { newArsenal } from '../shared/expansion.mjs';
import { REVIVE_RULES, nextgenShots, newNextgenCombat, fireShotgun, reloadShotgun, settleShotgun, toggleNextgenResonance, consumeNextgenResonance } from '../shared/nextgen-combat.mjs';

const source = (await readFile(new URL('../server/cloudflare/room.mjs', import.meta.url), 'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';", 'class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env;}}')
  .replaceAll(/'\.\.\/\.\.\/shared\/([^']+)'/g, (_, file) => JSON.stringify(new URL('../shared/' + file, import.meta.url).href));
const { GameRoom } = await import(`data:text/javascript,${encodeURIComponent(source)}`);
function fixture() {
  const room = new GameRoom({ storage: { get: async () => undefined, put: async () => {} }, blockConcurrencyWhile: fn => fn(), getWebSockets: () => [], id: { toString: () => 'test-room' } }, {});
  room.horde.step = () => [];
  const add = (id, x = 0, z = 0) => {
    const p = { id, username: id, x, z, yaw: 0, hp: 100, lastMove: Date.now(), messageAt: 0, attackAt: 0, pulseAt: 0, arsenal: newArsenal(), supplies: {}, survival: newVitals(), movingUntil: 0, hurtUntil: 0, moveBudget: 0.75, budgetAt: Date.now(), pose: { weapon: 'pistol', aiming: false, pitch: 0, sprinting: false } };
    const packets = [], socket = { send: raw => packets.push(JSON.parse(raw)), serializeAttachment: () => {} };
    room.players.set(socket, p);
    const send = msg => room.webSocketMessage(socket, JSON.stringify(msg));
    return { p, packets, socket, send, hello: () => send({ type: 'nextgen-hello', version: 1 }) };
  };
  return { room, add };
}
const shot = weapon => ({ type: 'shoot', weapon, direction: { x: 0, y: 0, z: -1 } });
test('wild capture requires negotiated NEXTGEN, living survivor and location; server owns encounter identity', async()=>{
  const {NEXTGEN_MAP}=await import('../shared/nextgen-terrain.mjs');
  const {NATIVE_CAPTURE}=await import('../shared/nextgen-creature-roster.mjs');
  const {room,add}=fixture(), a=add('capturer'), b=add('observer'); room.map=NEXTGEN_MAP;
  const calls=[]; const native={id:'server-owned-id',familyId:'lanternkin',formId:'lanternkin',xp:0,origin:'native',status:'available'};
  room.env.PLAYER_ACCOUNTS={idFromName:x=>x,get:()=>({fetch:async req=>{calls.push(await req.json()); return Response.json({native:new URL(req.url).pathname.endsWith('coop-reward')?{...native,xp:40}:native});}})};
  const capture={type:'capture',id:NATIVE_CAPTURE.id,xp:99999,instanceId:'spoofed'};
  await a.send(capture); assert.equal(calls.length,0);
  await a.hello(); await b.hello(); await a.send(capture); assert.equal(calls.length,0);
  Object.assign(a.p,{x:NATIVE_CAPTURE.x,z:NATIVE_CAPTURE.z,hp:0}); await a.send(capture); assert.equal(calls.length,0);
  a.p.hp=100; await a.send(capture);assert.equal(calls.length,0);const attempt=a.p.captureAttempt;assert.ok(attempt);assert.equal(attempt.endsAt-attempt.startedAt,NATIVE_CAPTURE.duration);
  await a.send(capture);assert.equal(a.p.captureAttempt,attempt);room.tick();assert.equal(calls.length,0);
  a.p.x+=.4;room.tick();assert.equal(a.p.captureAttempt,null);assert.equal(calls.length,0);
  a.p.x=NATIVE_CAPTURE.x;await a.send(capture);a.p.captureAttempt.endsAt=Date.now()-1;
  room.horde.step=()=>{a.p.hp-=10;return [{playerId:a.p.id,damage:10}];};room.tick();assert.equal(a.p.captureAttempt,null);assert.equal(calls.length,0);
  room.horde.step=()=>[];await a.send(capture);a.p.captureAttempt.endsAt=Date.now()-1;room.tick();await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(calls,[{id:'capture:test-room:0'}]);
  assert.equal(a.p.native.id,native.id); assert.equal(a.p.creatureOwned,true);
  await a.send(capture); assert.equal(calls.length,1);
  room.tick(); const snapshot=b.packets.findLast(p=>p.type==='snapshot');
  assert.equal(snapshot.players.find(p=>p.id===a.p.id).creatureInstanceId,native.id);
  assert.equal(snapshot.players.find(p=>p.id===a.p.id).captureAvailable,false);
  assert.equal(snapshot.players.find(p=>p.id===a.p.id).captureKit,0);
  assert.equal(snapshot.players.find(p=>p.id===b.p.id).captureAvailable,true);
  assert.equal(snapshot.players.find(p=>p.id===b.p.id).captureKit,1);
  const e=spawnHorde([a.p],1,'capture-fight')[0]; Object.assign(e,{x:a.p.x,z:a.p.z-1,hp:20,encounterId:'capture-fight-enemy'}); room.horde.enemies=[e];
  await a.send({type:'pulse',instanceId:'spoofed',xp:99999});
  assert.equal(e.hp,0); assert.equal(calls[1].instanceId,native.id); assert.equal(calls[1].pulse,true);
  assert.equal(a.p.native.xp,40); assert.equal(a.p.native.formId,'lanternkin');
});
test('native autonomous room combat credits only the deployed specimen, damages and recovers real companion HP',async()=>{
  const {NEXTGEN_MAP}=await import('../shared/nextgen-terrain.mjs');
  const {SUPPLIES}=await import('../shared/expansion.mjs');
  const {room,add}=fixture(),a=add('petowner'),b=add('observer');room.map=NEXTGEN_MAP;
  const native={id:'real-specimen',familyId:'lanternkin',formId:'lanternkin',xp:0,origin:'native',status:'available'};
  a.p.native=native;a.p.creatureOwned=true;await a.hello();await b.hello();
  const pet=a.p.nativeCombat;assert.equal(pet.hp,80);
  const calls=[];room.env.PLAYER_ACCOUNTS={idFromName:x=>x,get:()=>({fetch:async req=>{calls.push(await req.json());return Response.json({native:{...native,xp:12},stats:{xp:50}});}})};
  await a.send({type:'companion-mode',mode:'aggressive',damage:9999,hp:999});assert.equal(pet.mode,'aggressive');assert.equal(pet.hp,80);
  await b.send({type:'companion-mode',mode:'aggressive',instanceId:native.id});assert.equal(b.p.nativeCombat,undefined);
  const e=spawnHorde([a.p],1,'native-attack')[0];Object.assign(e,{x:pet.x,z:pet.z+.5,hp:12});room.horde.enemies=[e];
  room.tick();assert.equal(e.hp,0);assert.equal(room.mission.kills,1);
  assert.ok(b.packets.some(p=>p.type==='companion-strike'&&p.auto&&p.by===a.p.id));
  room.tick();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,1);assert.equal(calls[0].instanceId,native.id);assert.equal(a.p.native.xp,12);
  // Inject an accepted horde hit through the same path as production, then reject abilities until resupply.
  room.horde.step=(_players,_dt,_now,pets)=>{assert.equal(pets[0],pet);pet.hp=0;return [{playerId:pet.id,damage:80}];};
  room.tick();assert.equal(pet.mode,'follow');assert.equal(a.p.hp,100);
  let prior=a.packets.filter(p=>p.type==='action').length;await a.send({type:'pulse'});assert.equal(a.packets.filter(p=>p.type==='action').length,prior);
  await a.send({type:'companion-mode',mode:'aggressive'});assert.equal(pet.mode,'follow');
  Object.assign(a.p,{x:50,z:50});await a.send({type:'resupply',id:SUPPLIES[0].id});assert.equal(pet.hp,0);
  Object.assign(a.p,{x:SUPPLIES[0].x,z:SUPPLIES[0].z});await a.send({type:'resupply',id:SUPPLIES[0].id});assert.equal(pet.hp,80);
  assert.ok(a.packets.some(p=>p.type==='companion-status'&&/recovered/.test(p.message)));
});
test('NEXTGEN room derives height from shared terrain and ignores client-provided Y', async()=>{
  const {NEXTGEN_MAP,roomHeight}=await import('../shared/nextgen-terrain.mjs');
  const {room,add}=fixture(),a=add('terrain');room.map=NEXTGEN_MAP;await a.hello();
  const e=spawnHorde([a.p],1,'terrain')[0];Object.assign(e,{x:0,z:-2,hp:200});room.horde.enemies=[e];
  const dy=roomHeight(0,-2)+1.1-roomHeight(0,0)-1.32,l=Math.hypot(dy,2);
  await a.send({type:'shoot',weapon:'pistol',y:999,origin:{x:0,y:999,z:0},direction:{x:0,y:dy/l,z:-2/l}});
  const ack=a.packets.find(p=>p.type==='shot');assert.equal(ack.origin.y,roomHeight(0,0)+1.32);assert.ok(ack.hit);assert.equal(e.hp,166);
});
test('legacy clients cannot use extension weapons or opt into damage via packet flags', async () => {
  const { room, add } = fixture(), a = add('legacy');
  await a.send(shot('shotgun'));
  assert.equal(a.packets.filter(e => e.type === 'shot').length, 0);
  await a.send({ ...shot('pistol'), resonant: true, damage: 9999 });
  assert.equal(a.p.arsenal.pistol.magazine, 11); assert.equal(a.packets.find(e => e.type === 'shot').resonant, undefined);
  room.tick(); assert.equal(a.packets.at(-1).players[0].nextgen, undefined);
});
test('shotgun magazine, five deterministic rays and legacy-compatible packet are authoritative', async () => {
  const { room, add } = fixture(), a = add('shooter'), b = add('legacy');
  await a.hello(); await a.send(shot('shotgun')); await a.send(shot('shotgun'));
  assert.equal(a.p.nextgen.shotgun.magazine, 4); assert.equal(a.p.arsenal.rifle.magazine, 30);
  const event = b.packets.find(e => e.type === 'shot'); assert.equal(event.weapon, 'rifle'); assert.equal(event.nextgenWeapon, 'shotgun'); assert.equal(event.pellets.length, 5);
  await a.send({ type: 'reload', weapon: 'shotgun' }); assert.ok(a.p.nextgen.shotgun.reloadAt > Date.now());
  a.p.nextgen.shotgun.reloadAt = Date.now() - 1; room.tick(); assert.equal(a.p.nextgen.shotgun.magazine, 5); assert.equal(a.p.nextgen.shotgun.reserve, 29);
  await a.hello(); assert.equal(a.p.nextgen.shotgun.reserve, 29, 'hello must not reset ammo');
});
test('pellets group damage once per target and keep normalized directions', () => {
  const enemies = [{ x: 0, z: -2, hp: 200 }];
  const hits = nextgenShots(enemies, { x: 0, y: 1.32, z: 0 }, { x: 0, y: 0, z: -1 }, 'shotgun', false);
  assert.equal(hits.damage.size, 1); assert.ok(Math.abs(hits.damage.get(enemies[0]) - 72) < 1e-6);
  assert.ok(hits.rays.every(r => Math.abs(Math.hypot(r.direction.x,r.direction.y,r.direction.z)-1) < 1e-9));
});
test('pure shotgun reload cannot create ammo or fire during reload', () => {
  const s = newNextgenCombat(); assert.equal(fireShotgun(s, 1000), true); assert.equal(fireShotgun(s, 1001), false);
  assert.equal(reloadShotgun(s, 2000), true); assert.equal(fireShotgun(s, 2001), false);
  settleShotgun(s, 5000); assert.equal(s.shotgun.magazine + s.shotgun.reserve, 34);
});
test('resonance transition blocks fire, accepted shots consume exact server charge', async () => {
  const { room, add } = fixture(), a = add('resonant'); await a.hello();
  await a.send({ type: 'nextgen-resonance' }); await a.send(shot('pistol'));
  assert.equal(a.p.arsenal.pistol.magazine, 12); assert.equal(a.p.nextgen.charge, 100);
  a.p.nextgen.transitionUntil = Date.now() - 1; await a.send(shot('pistol'));
  assert.equal(a.p.arsenal.pistol.magazine, 11); assert.equal(a.p.nextgen.charge, 75);
  assert.ok(a.packets.some(e => e.type === 'shot' && e.resonant));
  await a.send({ type: 'nextgen-equip', weapon: 'shotgun' }); assert.equal(a.p.nextgen.resonant, false);
  await a.hello(); assert.equal(a.p.nextgen.charge, 75);
  const s = newNextgenCombat(); s.charge = 10; assert.equal(toggleNextgenResonance(s, 1), false); assert.equal(consumeNextgenResonance(s, 1), false);
});
test('owned directed companion strike is range and cooldown checked, never client-selected damage', async () => {
  const { room, add } = fixture(), a = add('companion'); await a.hello();
  const e = spawnHorde([a.p], 1, 'strike')[0]; Object.assign(e, { x: 0, z: -2, hp: 80 }); room.horde.enemies = [e];
  await a.send({ type: 'companion-strike', damage: 9999 }); assert.equal(e.hp, 80);
  a.p.creatureOwned = true; await a.send({ type: 'companion-strike', damage: 9999 }); assert.equal(e.hp, 68);
  await a.send({ type: 'companion-strike' }); assert.equal(e.hp, 68);
  a.p.nextgen.companionAt = 0; e.z = -20; await a.send({ type: 'companion-strike' }); assert.equal(e.hp, 68);
  assert.equal(a.packets.filter(e => e.type === 'companion-strike').length, 1);
});
test('fatal server damage opens a bounded downed state only for opted-in clients', async () => {
  const { room, add } = fixture(), a = add('downed'), old = add('old'); await a.hello();
  room.horde.step = () => { a.p.hp = old.p.hp = 0; return [{ playerId: a.p.id }, { playerId: old.p.id }]; };
  room.tick(); assert.ok(a.p.nextgen.downedUntil > Date.now()); assert.equal(old.p.nextgen, undefined);
  room.horde.step = () => []; await old.send({ type: 'restart' }); assert.equal(old.p.hp, 100);
});
test('revive consumes one bandage, rejects duplicate/self/range and completes only after time', async () => {
  const { room, add } = fixture(), a = add('medic'), b = add('downed', 1, 0), c = add('third');
  await Promise.all([a.hello(), b.hello(), c.hello()]); b.p.hp = 0; b.p.nextgen.downedUntil = Date.now() + REVIVE_RULES.downedMs;
  await a.send({ type: 'revive', target: a.p.id }); assert.equal(a.p.survival.bandages, 2);
  a.p.x = 10; await a.send({ type: 'revive', target: b.p.id }); assert.equal(a.p.survival.bandages, 2);
  a.p.x = 0; await a.send({ type: 'revive', target: b.p.id }); assert.equal(a.p.survival.bandages, 1);
  await c.send({ type: 'revive', target: b.p.id }); assert.equal(c.p.survival.bandages, 2);
  room.tick(); assert.equal(b.p.hp, 0); a.p.nextgen.revive.endsAt = Date.now()-1;
  room.tick(); assert.equal(b.p.hp, REVIVE_RULES.health); assert.equal(b.p.x, 1); assert.equal(b.p.nextgen.downedUntil, 0); assert.equal(a.p.nextgen.revive, null);
  assert.ok(c.packets.some(e => e.type === 'revive-state' && e.status === 'completed'));
});
test('revive cancels on movement, damage, target disconnect and expiration without refund', async () => {
  const { room, add } = fixture(), a = add('medic'), b = add('target', 1, 0); await a.hello(); await b.hello();
  b.p.hp = 0; b.p.nextgen.downedUntil = Date.now() + REVIVE_RULES.downedMs;
  await a.send({ type: 'revive', target: b.p.id }); await a.send({ type: 'move', x: .1, z: 0, yaw: 0 });
  assert.equal(a.p.nextgen.revive, null); assert.equal(a.p.survival.bandages, 1); assert.equal(b.p.hp, 0);
  a.p.movingUntil = 0; await a.send({ type: 'revive', target: b.p.id }); assert.ok(a.p.nextgen.revive);
  room.horde.step = () => { a.p.hp -= 10; return [{ playerId: a.p.id }]; }; a.p.nextgen.revive.endsAt = Date.now()-1; room.tick();
  assert.equal(a.p.nextgen.revive, null); assert.equal(b.p.hp, 0); assert.equal(a.p.survival.bandages, 0);
  room.horde.step = () => []; a.p.survival.bandages = 2; await a.send({ type: 'revive', target: b.p.id }); room.drop(b.socket); assert.equal(a.p.nextgen.revive, null);
  const c = add('expired', 1, 0); await c.hello(); c.p.hp = 0; c.p.nextgen.downedUntil = Date.now()-1;
  await a.send({ type: 'revive', target: c.p.id }); assert.equal(a.p.nextgen.revive, null);
});
