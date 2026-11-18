import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import { CompanionAvatar } from '../../src/nextgen/core/CompanionAvatar.ts';
import { CompanionController } from '../../src/nextgen/core/CompanionController.ts';
import { ResonanceProp } from '../../src/nextgen/core/ResonanceProp.ts';
import { LongGunProp } from '../../src/nextgen/core/LongGunProp.ts';

test('Companion presentation follows terrain state and displays pulse without leaking resources',()=>{
  const c=new CompanionController(),a=new CompanionAvatar(),scene=new THREE.Scene(),height=()=>0;
  scene.add(a.root);c.reset([10,0,10],[0,0,-1],height);a.update(16,c.getState());
  assert.deepEqual(a.root.position.toArray(),c.getState().position);
  c.step(16,[10,0,10],[0,0,-1],[{position:[12,0,11],health:100}],true,height);
  a.update(16,c.getState());assert.equal(a.root.children[1].visible,true);
  a.dispose();a.dispose();assert.equal(a.root.parent,null);assert.equal(a.root.children.length,0);
});
test('Resonance rails expand and retract on every supported weapon',()=>{
  for(const id of ['pistol','rifle','shotgun']){
    const prop=new ResonanceProp(id);assert.equal(prop.root.visible,false);
    for(let i=0;i<10;i++)prop.update(50,true,false);assert.equal(prop.root.visible,true);
    for(let i=0;i<20;i++)prop.update(50,false,false);assert.equal(prop.root.visible,false);
    prop.dispose();prop.dispose();assert.equal(prop.root.children.length,0);
  }
});
test('Shotgun pump moves the support grip during cycling and returns to neutral',()=>{
  const gun=new LongGunProp('shotgun'),neutral=gun.support.position.z;
  gun.animateAction(16,true,false,'shoot');gun.animateAction(100,false,false,'shoot');
  assert.ok(gun.support.position.z>neutral);
  for(let i=0;i<10;i++)gun.animateAction(100,false,false,null);
  assert.ok(Math.abs(gun.support.position.z-neutral)<1e-6);gun.dispose();
});
