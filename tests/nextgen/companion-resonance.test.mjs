import test from 'node:test';
import assert from 'node:assert/strict';
import { CombatController } from '../../src/nextgen/core/CombatController.ts';
import { CompanionController, COMPANION } from '../../src/nextgen/core/CompanionController.ts';
import { RESONANCE, resonantBallistics } from '../../src/nextgen/core/WeaponResonance.ts';
import { findWeaponHits } from '../../src/nextgen/core/ShotQuery.ts';

const idle={enabled:true,shoot:false,reload:false};
const shoot={...idle,shoot:true};
const ground=()=>0,owner=[10,0,10],facing=[0,0,-1];
const tick=(c,ms)=>{while(ms>0){const dt=Math.min(ms,100);c.step(dt,idle);ms-=dt;}};
const pet=()=>{const c=new CompanionController();c.reset(owner,facing,ground);return c;};
const target=(position,health=100)=>({position,health});

test('Resonance transition gates fire; each empowered shot consumes exactly one round and charge',()=>{
  const c=new CombatController();assert.equal(c.toggleResonance(),true);assert.equal(c.step(100,shoot).shot,false);
  tick(c,RESONANCE.transitionMs);const hit=c.step(16,shoot);assert.equal(hit.resonantShot,true);assert.equal(c.getState().ammo,11);
  assert.equal(c.getState().resonance.charge,75);assert.equal(c.getState().resonance.empoweredShots,1);
});
test('Form auto-deactivates on depletion, recovers only in standard form, and never refills ammunition',()=>{
  const c=new CombatController();c.toggleResonance();tick(c,420);
  for(let i=0;i<4;i++){assert.equal(c.step(16,shoot).resonantShot,true);if(i<3)tick(c,350);}
  const depleted=c.getState();assert.equal(depleted.resonance.active,false);assert.equal(depleted.resonance.charge,0);assert.equal(depleted.ammo,8);
  tick(c,350);assert.equal(c.toggleResonance(),false);tick(c,4500);assert.ok(c.getState().resonance.charge>=25);assert.equal(c.getState().ammo,8);
});
test('Weapon switch and damage cancel resonance without refund; dead player cannot toggle',()=>{
  const c=new CombatController();c.collectLoot('rifle',1);c.toggleResonance();tick(c,420);c.step(16,shoot);tick(c,350);
  const charge=c.getState().resonance.charge;assert.equal(c.selectWeapon('rifle'),true);assert.equal(c.getState().resonance.active,false);assert.equal(c.getState().resonance.charge,charge);
  tick(c,420);assert.equal(c.toggleResonance(),true);tick(c,420);c.takeDamage(100,0);assert.equal(c.getState().resonance.active,false);assert.equal(c.toggleResonance(),false);
});
test('Resonant ballistics modify damage, range and spread without changing normal shot contracts',()=>{
  assert.equal(resonantBallistics('pistol').damage,34);assert.equal(resonantBallistics('pistol',true).damage,48);
  assert.ok(resonantBallistics('shotgun',true).spread<1);
  const args=[[0,1,0],[0,0,-1],[0,1,0],[target([0,0,-39])],ground];
  assert.deepEqual(findWeaponHits('pistol',...args),[]);assert.deepEqual(findWeaponHits('pistol',...args,true),[{index:0,damage:48}]);
});
test('Companion starts passive; follows its owner and never attacks without command',()=>{
  const c=pet(),enemy=target([12,0,11]);
  assert.deepEqual(c.step(100,owner,facing,[enemy],false,ground),[]);
  const initial=c.getState().position;
  for(let i=0;i<15;i++)c.step(100,[14,0,10],facing,[enemy],false,ground);
  assert.ok(c.getState().position[0]>initial[0]);assert.equal(c.getState().attacks,0);
});
test('Assist attacks once per interval, then recall disables basic attacks',()=>{
  const c=pet(),enemy=target([12,0,11]);c.toggleAssist();
  assert.deepEqual(c.step(100,owner,facing,[enemy],false,ground),[{index:0,damage:COMPANION.basicDamage,kind:'basic'}]);
  for(let i=0;i<12;i++)assert.deepEqual(c.step(100,owner,facing,[enemy],false,ground),[]);
  assert.equal(c.step(50,owner,facing,[enemy],false,ground).length,1);c.toggleAssist();
  for(let i=0;i<20;i++)assert.deepEqual(c.step(100,owner,facing,[enemy],false,ground),[]);
  assert.equal(c.getState().attacks,2);
});
test('Assist chases only living nearby targets and stays tethered to its owner',()=>{
  const c=pet();c.toggleAssist();const enemies=[target([10,0,4],0),target([30,0,30]),target([14,0,9])];
  let strikes=[];for(let i=0;i<20&&!strikes.length;i++)strikes=c.step(100,owner,facing,enemies,false,ground);
  assert.equal(strikes[0].index,2);assert.ok(Math.hypot(c.getState().position[0]-10,c.getState().position[2]-10)<=COMPANION.leash);
});
test('Pulse uses shared species damage/range/cooldown, caps targets and rejects duplicate activation',()=>{
  const c=pet(),enemies=[target([12,0,11]),target([13,0,11]),target([14,0,11]),target([15,0,11]),target([30,0,30]),target([12,0,11],0)];
  const hits=c.step(16,owner,facing,enemies,true,ground);assert.equal(hits.length,3);assert.ok(hits.every(x=>x.damage===35&&x.kind==='pulse'));
  assert.equal(c.getState().pulseCooldownMs,8000);assert.deepEqual(c.step(16,owner,facing,enemies,true,ground),[]);
  assert.equal(c.getState().pulses,1);
});
test('Pulse rejects terrain-obstructed targets without charging cooldown; death clears assist',()=>{
  const c=pet(),enemies=[target([16,0,11])];const wall=(x)=>x>13&&x<15?5:0;
  assert.deepEqual(c.step(16,owner,facing,enemies,true,wall),[]);assert.equal(c.getState().pulseCooldownMs,0);
  c.toggleAssist();assert.deepEqual(c.step(16,null,facing,enemies,true,ground),[]);assert.equal(c.getState().mode,'inactive');assert.equal(c.getState().assist,false);
});
test('Companion kills count for waves without modifying firearm accuracy or ammo',()=>{
  const c=new CombatController();c.recordCompanionHit(true);assert.equal(c.getState().kills,1);assert.equal(c.getState().companionHits,1);assert.equal(c.getState().shotsHit,0);assert.equal(c.getState().ammo,12);
});
