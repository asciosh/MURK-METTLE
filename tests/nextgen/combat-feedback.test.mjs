import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { AvatarAnimator } from '../../src/nextgen/core/AvatarAnimator.ts';
import { CombatController } from '../../src/nextgen/core/CombatController.ts';
import { CombatFeedback } from '../../src/nextgen/core/CombatFeedback.ts';

const idle = { speed: 0, sprinting: false, airborne: false, dodging: false };
const clips = names => names.map(n => new THREE.AnimationClip(n, 1, []));
const makeAnimator = (names = ['Idle','Walk','Melee','Bandage','Hit','Death','Dodge']) =>
  new AvatarAnimator(new THREE.Group(), clips(names));

test('Installed survivor GLB contains both new action clips and prior combat clips', () => {
  const file = readFileSync(new URL('../../public/models/nextgen/survivor.glb', import.meta.url));
  assert.equal(file.readUInt32LE(0), 0x46546c67);
  assert.equal(file.readUInt32LE(12 + 4), 0x4e4f534a);
  const json = JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString('utf8'));
  const names = json.animations.map(a => a.name);
  for (const name of ['Melee','Bandage','Hit','Death','PistolShoot','PistolReload']) {
    assert.ok(names.includes(name), 'Missing survivor clip: ' + name);
  }
  for (const [name, expected] of [['Melee', 0.65], ['Bandage', 2.6]]) {
    const clip = json.animations.find(a => a.name === name);
    const end = Math.max(...clip.samplers.map(s => json.accessors[s.input].max[0]));
    assert.ok(Math.abs(end - expected) < 0.002);
  }
});

test('Melee plays once through recovery and returns to locomotion', () => {
  const a = makeAnimator();
  a.update(16, { ...idle, melee: true });
  assert.equal(a.getActiveClip(), 'melee');
  for (let i = 0; i < 6; i++) a.update(100, idle);
  assert.equal(a.getActiveClip(), 'melee');
  a.update(34, idle);
  a.update(16, idle);
  assert.equal(a.getActiveClip(), 'idle');
  a.dispose();
});

test('Bandage is held until healing completes or is canceled', () => {
  const a = makeAnimator();
  a.update(16, { ...idle, healing: true });
  for (let i = 0; i < 25; i++) a.update(100, { ...idle, healing: true });
  assert.equal(a.getActiveClip(), 'bandage');
  a.update(16, { ...idle, speed: 2 });
  assert.equal(a.getActiveClip(), 'walk');
  a.dispose();
});

test('Hit and death override melee and bandage; missing clips stay safe', () => {
  const a = makeAnimator();
  a.update(16, { ...idle, melee: true });
  a.update(16, { ...idle, hit: true });
  assert.equal(a.getActiveClip(), 'hit');
  a.update(16, { ...idle, dead: true, healing: true });
  assert.equal(a.getActiveClip(), 'death');
  a.dispose();
  const fallback = makeAnimator(['Idle']);
  fallback.update(16, { ...idle, melee: true });
  fallback.update(16, { ...idle, healing: true });
  assert.equal(fallback.getActiveClip(), 'idle');
  fallback.dispose();
});

test('Bandage cannot start before melee recovery finishes', () => {
  const c = new CombatController();
  const input = { enabled: false, shoot: false, reload: false };
  c.takeDamage(30, 0);
  assert.equal(c.step(16, { ...input, melee: true }).meleeStarted, true);
  c.step(100, input);
  assert.equal(c.step(80, input).meleeHit, true);
  assert.equal(c.step(16, { ...input, bandage: true }).healStarted, false);
  for (let i = 0; i < 5; i++) c.step(100, input);
  assert.equal(c.step(16, { ...input, bandage: true }).healStarted, true);
});

test('Muzzle and impact effects use a bounded reusable pool and expire', () => {
  const f = new CombatFeedback();
  const muzzle = new THREE.Vector3(1,2,3);
  f.shot();
  f.update(16, muzzle);
  const flash = f.root.getObjectByName('Pistol muzzle flash');
  assert.equal(flash.visible, true);
  assert.deepEqual(flash.position.toArray(), [1,2,3]);
  f.update(16, null);
  assert.equal(flash.visible, false);
  for (let i = 0; i < 20; i++) f.impact([0,0,0], [0,0,1], false);
  assert.equal(f.root.children.length, 5);
  assert.equal(f.root.children.filter(c => c.visible).length, 4);
  f.update(200, muzzle);
  assert.equal(f.root.children.filter(c => c.visible).length, 0);
  f.shot();
  f.reset();
  assert.equal(f.needsMuzzle, false);
  f.dispose();
  f.dispose();
  assert.equal(f.root.children.length, 0);
});
