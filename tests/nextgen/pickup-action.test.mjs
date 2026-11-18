import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { PICKUP, PickupController } from '../../src/nextgen/core/PickupController.ts';
import { LootField } from '../../src/nextgen/core/LootField.ts';
import { CombatController } from '../../src/nextgen/core/CombatController.ts';
import { AvatarAnimator } from '../../src/nextgen/core/AvatarAnimator.ts';
const step = (p, time) => {
  let contact = null;
  for (let d = time; d > 0; d -= 100) contact = p.advance(Math.min(100, d)) ?? contact;
  return contact;
};

test('Survivor asset includes the pickup clip and spine-attached backpack', () => {
  const data = readFileSync(new URL('../../public/models/nextgen/survivor.glb', import.meta.url));
  const json = JSON.parse(data.subarray(20,20+data.readUInt32LE(12)));
  assert.equal(json.animations.length, 17);
  const pickup = json.animations.find(a => a.name === 'Pickup');
  assert.ok(pickup);
  assert.ok(Math.abs(Math.max(...pickup.samplers.map(s=>json.accessors[s.input].max[0]))*1000-PICKUP.durationMs)<1);
  const bag = json.nodes.findIndex(n=>n.name==='SurvivalBackpack');
  assert.ok(bag>=0);
  assert.ok(json.nodes.find(n=>n.name==='spine_03').children.includes(bag));
});
test('Picking up emits a single contact at 450ms, holds until stowing and recovers', () => {
  const p = new PickupController();
  assert.equal(p.begin(1,'ammo'),true);
  assert.equal(p.begin(2,'bandage'),false);
  assert.equal(step(p,449),null);
  assert.equal(p.heldKind,null);
  assert.equal(step(p,1),1);
  assert.equal(p.markCollected(),true);
  assert.equal(p.markCollected(),false);
  assert.equal(p.heldKind,'ammo');
  assert.equal(step(p,650),null);
  assert.equal(p.heldKind,null);
  assert.equal(p.active,true);
  step(p,250);
  assert.equal(p.active,false);
});
test('Canceled pickup never emits a late contact', () => {
  const p = new PickupController();
  p.begin(1,'bandage');step(p,300);p.cancel();
  assert.equal(step(p,2000),null);
  assert.equal(p.markCollected(),false);
  assert.equal(p.heldKind,null);
});
test('Contact commits exactly the selected drop and cannot switch to a nearby one', () => {
  const f = new LootField();const c = new CombatController();
  f.spawn('ammo',12,[.5,0,0]);f.spawn('ammo',12,[0,0,0]);
  const selected=f.getState()[0];
  const p=new PickupController();p.begin(selected.id,selected.kind);
  const id=step(p,PICKUP.contactMs);
  assert.equal(f.collectById(id,[0,0,0],(_,n)=>c.addReserveAmmo(n),PICKUP.reach).amount,12);
  assert.equal(c.getState().reserve,60);
  assert.equal(f.getState()[0].id!==id,true);
  assert.equal(f.collectById(id,[0,0,0],(_,n)=>c.addReserveAmmo(n),PICKUP.reach).amount,0);
  f.dispose();
});
test('Contact rejects an out-of-reach target without removing or granting loot', () => {
  const f=new LootField();const c=new CombatController();
  f.spawn('ammo',12,[1.1,0,0]);
  const id=f.getState()[0].id;
  assert.equal(f.collectById(id,[0,0,0],(_,n)=>c.addReserveAmmo(n),PICKUP.reach).status,'not-nearby');
  assert.equal(c.getState().reserve,48);
  assert.equal(f.getState().length,1);
  f.dispose();
});
test('Pickup animation follows action state and hit/death override it', () => {
  const names=['Idle','Pickup','Hit','Death','Dodge'];
  const a=new AvatarAnimator(new THREE.Group(),names.map(n=>new THREE.AnimationClip(n,1,[])));
  const idle={speed:0,sprinting:false,airborne:false,dodging:false};
  a.update(16,{...idle,pickingUp:true});
  assert.equal(a.getActiveClip(),'pickup');
  a.update(16,idle);
  assert.equal(a.getActiveClip(),'idle');
  a.update(16,{...idle,pickingUp:true});
  a.update(16,{...idle,pickingUp:true,hit:true});
  assert.equal(a.getActiveClip(),'hit');
  a.update(16,{...idle,pickingUp:true,dead:true});
  assert.equal(a.getActiveClip(),'death');a.dispose();
});
