import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMovePack, MoveDeck } from '../shared/local-creature-moves.mjs';
import { CompanionController } from '../src/nextgen/core/CompanionController.ts';
const move=(id,extra={})=>({id,name:id,type:'neutral',effect:'impact',pose:'attack',damage:14,range:3,targets:1,cooldownMs:1200,windupMs:0,statusMs:0,healPercent:0,...extra});
const raw=()=>({format:'mm-local-moves-v1',profiles:[{appearanceId:'original-rig-test',name:'Test creature',moves:[move('tap'),move('ray',{effect:'beam',pose:'charge',windupMs:800,cooldownMs:2500,damage:35,range:8}),move('mist',{effect:'sleep',pose:'cast',damage:0,statusMs:3000})],equipped:['tap','ray','mist']}]});
test('validates a bounded local move pack; rejects extra fields, unknown effects, excessive damage and duplicate loadout',()=>{
  assert.equal(validateMovePack(raw()).profiles[0].moves.length,3);
  for(const bad of [p=>p.profiles[0].moves[0].damage=1000,p=>p.profiles[0].moves[0].effect='execute',p=>p.profiles[0].moves[0].script='x',p=>p.profiles[0].equipped=['tap','tap'],p=>p.profiles[0].equipped=['unknown'],p=>p.profiles[0].moves[0].statusMs=1000,p=>p.profiles[0].moves[0].cooldownMs=100,p=>p.profiles[0].moves[0].healPercent=50]){const x=raw();bad(x);assert.throws(()=>validateMovePack(x));}
});
test('move deck sequences charge, independent cooldowns and cancellation',()=>{
  const d=new MoveDeck(validateMovePack(raw()).profiles[0]);assert.equal(d.begin(1).id,'ray');assert.equal(d.begin(0),null);
  for(let i=0;i<7;i++)assert.equal(d.tick(100),null);
  assert.equal(d.tick(100).damage,35);assert.equal(d.begin(0),null);
  for(let i=0;i<4;i++)d.tick(100);
  assert.equal(d.begin(0).id,'tap');assert.equal(d.tick(0).damage,14);assert.equal(d.hud()[0].remaining,1200);assert.ok(d.hud()[1].remaining>0);
  const other=new MoveDeck(validateMovePack(raw()).profiles[0]);other.begin(1);other.cancel();for(let i=0;i<10;i++)assert.equal(other.tick(100),null);assert.ok(other.hud()[1].remaining>0);
});
test('real solo controller applies chosen move and rechecks target range after charge; original fallback remains',()=>{
  const c=new CompanionController(),owner=[0,0,0],facing=[0,0,-1],height=()=>0;
  c.reset(owner,facing,height);c.setMoveProfile(validateMovePack(raw()).profiles[0]);assert.equal(c.getState().name,'Test creature');
  const close=[{health:100,position:[1.6,0,2]}];
  assert.equal(c.step(16,owner,facing,close,false,height,0)[0].damage,14);
  for(let i=0;i<4;i++)c.step(100,owner,facing,close,false,height);
  assert.deepEqual(c.step(16,owner,facing,close,false,height,1),[]);assert.equal(c.moveCast.id,'ray');
  for(let i=0;i<8;i++)assert.deepEqual(c.step(100,owner,facing,[],false,height),[]);
  assert.match(c.moveMessage,/OUT OF RANGE/);
  for(let i=0;i<4;i++)c.step(100,owner,facing,close,false,height);
  assert.equal(c.step(16,owner,facing,close,false,height,2)[0].move.statusMs,3000);
  c.setMoveProfile(null);assert.equal(c.hasMoves,false);assert.equal(c.moveHud,null);
});
test('custom moves never execute while gameplay input is inhibited',()=>{
  const c=new CompanionController(),owner=[0,0,0],facing=[0,0,-1],height=()=>0,close=[{health:100,position:[1.6,0,2]}];
  c.reset(owner,facing,height);c.setMoveProfile(validateMovePack(raw()).profiles[0]);c.toggleAssist();
  assert.deepEqual(c.step(100,owner,facing,close,false,height,0,false),[]);
  assert.deepEqual(c.step(100,owner,facing,close,false,height,1),[]);
  for(let i=0;i<10;i++)assert.deepEqual(c.step(100,owner,facing,close,false,height,undefined,false),[]);
});
