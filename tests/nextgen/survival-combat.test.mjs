import test from 'node:test';
import assert from 'node:assert/strict';
import { CombatController, COMBAT } from '../../src/nextgen/core/CombatController.ts';
import { findMeleeTarget } from '../../src/nextgen/core/ShotQuery.ts';
import { LootField } from '../../src/nextgen/core/LootField.ts';

const idle = { enabled: false, shoot: false, reload: false };
function tick(c, ms, input = idle) {
  let r;
  while (ms > 0) { const dt = Math.min(ms, 100); r = c.step(dt, input); ms -= dt; }
  return r;
}

test('Bandage consumes one item, heals after 2.6s and caps health', () => {
  const c = new CombatController(); c.takeDamage(30, 0);
  assert.equal(c.step(16, { ...idle, bandage: true }).healStarted, true);
  assert.equal(c.getState().bandages, 1);
  tick(c, 2500); assert.equal(c.getState().health, 70);
  tick(c, 100); assert.equal(c.getState().health, 100);
  assert.equal(c.getState().healing, false);
});
test('Movement and damage interrupt bandaging without refund', () => {
  const c = new CombatController(); c.takeDamage(50, 0);
  c.step(16, { ...idle, bandage: true });
  c.step(16, { ...idle, moving: true }); tick(c, 3000);
  assert.equal(c.getState().health, 50);
  c.step(16, { ...idle, bandage: true }); c.takeDamage(10, 0); tick(c, 3000);
  assert.equal(c.getState().health, 40); assert.equal(c.getState().bandages, 0);
});
test('Cannot bandage at full health or after death', () => {
  const c = new CombatController();
  assert.equal(c.step(16, { ...idle, bandage: true }).healStarted, false);
  c.takeDamage(100, 0);
  assert.equal(c.step(16, { ...idle, bandage: true }).healStarted, false);
  assert.equal(c.getState().bandages, 2);
});
test('Melee winds up, strikes once, and obeys cooldown', () => {
  const c = new CombatController();
  assert.equal(c.step(16, { ...idle, melee: true }).meleeStarted, true);
  assert.equal(c.step(100, idle).meleeHit, false);
  assert.equal(c.step(80, idle).meleeHit, true);
  assert.equal(c.step(16, { ...idle, melee: true }).meleeStarted, false);
  tick(c, COMBAT.meleeCooldownMs);
  assert.equal(c.step(16, { ...idle, melee: true }).meleeStarted, true);
});
test('Damage cancels a pending melee strike', () => {
  const c = new CombatController(); c.step(16, { ...idle, melee: true });
  c.takeDamage(12, 0); assert.equal(tick(c, 300).meleeHit, false);
});
test('Melee selects a nearby living forward enemy, rejects behind and above', () => {
  const targets = [{ position: [0,0,1], health: 100 },
    { position: [0,2,-1], health: 100 }, { position: [0,0,-1], health: 0 },
    { position: [0,0,-1.5], health: 100 }];
  assert.equal(findMeleeTarget([0,0,0],[0,0,-1],targets,2,()=>0), 3);
  assert.equal(findMeleeTarget([0,0,0],[0,0,-1],targets,2,()=>2), null);
});
test('Loot is bounded, distance checked, and cannot be collected twice', () => {
  const field = new LootField(); field.spawn('ammo', 12, [0,0,0]);
  assert.equal(field.collect([5,0,0], (_, n) => n), 0);
  assert.equal(field.collect([0,0,0], () => 0), 0);
  assert.equal(field.collect([0,0,0], () => 4), 4);
  assert.equal(field.getState()[0].amount, 8);
  assert.equal(field.collect([0,0,0], (_, n) => n), 8);
  assert.equal(field.collect([0,0,0], (_, n) => n), 0);
  for (let i = 0; i < LootField.LIMIT; i++) assert.equal(field.spawn('bandage', 1, [i,0,0]), true);
  assert.equal(field.spawn('ammo', 12, [0,0,0]), false);
  field.dispose(); assert.equal(field.getState().length, 0);
});
test('Inventory pickup is capped and dead player cannot collect', () => {
  const c = new CombatController();
  assert.equal(c.getState().reserve, 48);
  assert.equal(c.addReserveAmmo(12), 12);
  assert.equal(c.addReserveAmmo(20), 12);
  assert.equal(c.addReserveAmmo(1), 0); assert.equal(c.addBandages(1), 0);
  c.takeDamage(40, 0); c.step(16, { ...idle, bandage: true });
  assert.equal(c.addBandages(5), 1); assert.equal(c.getState().bandages, 2);
  c.takeDamage(100, 0); assert.equal(c.addBandages(1), 0);
});
