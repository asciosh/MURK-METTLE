import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NEXTGEN_MAP } from '../shared/nextgen-terrain.mjs';
import { newVitals } from '../shared/survival.mjs';
import { newArsenal } from '../shared/expansion.mjs';
import { NEXTGEN_MOBILITY, newNextgenMobility, beginNextgenDodge, beginNextgenJump, advanceNextgenDodge, nextgenJumpHeight, nextgenMobilitySnapshot } from '../shared/nextgen-mobility.mjs';
const source=(await readFile(new URL('../server/cloudflare/room.mjs', import.meta.url),'utf8'))
  .replace("import { DurableObject } from 'cloudflare:workers';",'class DurableObject {constructor(ctx,env){this.ctx=ctx;this.env=env;}}')
  .replaceAll(/'\.\.\/\.\.\/shared\/([^']+)'/g,(_,file)=>JSON.stringify(new URL('../shared/'+file,import.meta.url).href));
const { GameRoom }=await import(`data:text/javascript,${encodeURIComponent(source)}`);
function fixture(){
  const room=new GameRoom({storage:{get:async()=>undefined,put:async()=>{}},blockConcurrencyWhile:fn=>fn(),getWebSockets:()=>[]},{});
  room.map=NEXTGEN_MAP;room.horde.map=NEXTGEN_MAP;room.horde.step=()=>[];
  const p={id:'actor',username:'actor',x:0,z:0,yaw:0,hp:100,lastMove:Date.now(),messageAt:0,attackAt:0,pulseAt:0,arsenal:newArsenal(),supplies:{},survival:newVitals(),movingUntil:0,hurtUntil:0,moveBudget:.75,budgetAt:Date.now(),pose:{weapon:'pistol',aiming:false,pitch:0,sprinting:false}};
  const packets=[],socket={send:raw=>packets.push(JSON.parse(raw)),serializeAttachment:()=>{}};
  room.players.set(socket,p);
  const send=msg=>room.webSocketMessage(socket,JSON.stringify(msg));
  return {room,p,packets,send};
}
test('legacy player cannot use NEXTGEN dodge or jump messages',async()=>{
  const f=fixture();
  await f.send({type:'nextgen-dodge',x:0,z:-1});await f.send({type:'nextgen-jump'});
  assert.equal(f.p.nextgen,undefined);assert.equal(f.p.survival.stamina,100);
});
test('server consumes stamina once, validates dodge vector and simulates bounded motion',async()=>{
  const f=fixture();await f.send({type:'nextgen-hello',version:1});
  await f.send({type:'nextgen-dodge',x:10000,z:0});assert.equal(f.p.survival.stamina,100);
  await f.send({type:'nextgen-dodge',x:0,z:-1});assert.equal(f.p.survival.stamina,75);
  await f.send({type:'nextgen-dodge',x:0,z:-1});assert.equal(f.p.survival.stamina,75);
  const m=f.p.nextgen.mobility;m.dodgeLastStep-=100;m.dodgeStarted-=100;m.dodgeUntil-=100;
  f.room.tick();assert.ok(f.p.z<0 && f.p.z> -1.2,'server movement must obey speed budget');
  assert.equal(f.packets.at(-1).players[0].nextgen.dodging,true);
  await f.send({type:'move',x:30,z:30,yaw:0});assert.ok(f.p.z<0&&f.p.x===0,'no client teleport during dodge');
  assert.ok(f.packets.some(msg=>msg.type==='correction'));
});
test('jump is server-driven, height is bounded, and repeated input cannot reset its timer',async()=>{
  const f=fixture();await f.send({type:'nextgen-hello',version:1});
  await f.send({type:'nextgen-jump'});const m=f.p.nextgen.mobility;
  const start=m.jumpStarted;assert.ok(start>0);
  await f.send({type:'nextgen-jump'});assert.equal(m.jumpStarted,start);
  m.jumpStarted-=170;m.jumpUntil-=170;
  f.room.tick();const state=f.packets.at(-1).players[0].nextgen;
  assert.equal(state.airborne,true);assert.ok(state.jumpHeight>0 && state.jumpHeight<=NEXTGEN_MOBILITY.jumpHeight);
  assert.equal(nextgenJumpHeight(m,m.jumpUntil+1),0);
});
test('mobility rejects downed, healing or reviving actors and respects terrain constraints',()=>{
  const player={hp:100,x:99.5,z:0,survival:newVitals(),nextgen:{revive:null}};
  const m=newNextgenMobility(),at=2000;
  assert.equal(beginNextgenDodge(m,player,1,0,at),true);
  m.dodgeLastStep=at;const moved=advanceNextgenDodge(m,player,at+100,NEXTGEN_MAP.constrain);
  assert.ok(player.x<=NEXTGEN_MAP.boundary);assert.equal(typeof moved,'boolean');
  const old=player.survival.stamina;
  assert.equal(beginNextgenJump(m,player,at+150),false);
  assert.equal(player.survival.stamina,old);
  player.nextgen.revive={targetId:'other'};
  assert.equal(beginNextgenJump(m,player,at+2000),false);
  player.nextgen.revive=null;player.survival.healEndsAt=20000;
  assert.equal(beginNextgenDodge(m,player,0,-1,at+2000),false);
  player.survival.healEndsAt=0;player.hp=0;
  assert.equal(beginNextgenDodge(m,player,0,-1,at+2000),false);
  assert.equal(beginNextgenJump(m,player,at+2000),false);
  assert.deepEqual(nextgenMobilitySnapshot(null,at),{dodging:false,airborne:false,jumpHeight:0});
});
