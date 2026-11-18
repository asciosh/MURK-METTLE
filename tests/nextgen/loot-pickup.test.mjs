import test from 'node:test';
import assert from 'node:assert/strict';
import { CombatController, COMBAT } from '../../src/nextgen/core/CombatController.ts';
import { LootField } from '../../src/nextgen/core/LootField.ts';

const origin = [0, 0, 0];
const accept = c => (kind, n) => kind === 'ammo' ? c.addReserveAmmo(n) : c.addBandages(n);
const prefer = c => item => c.pickupCapacity(item.kind) > 0;

test('Ammo starts at 48, two pickups reach 72, and full drops remain', () => {
  const c = new CombatController();
  const field = new LootField();
  assert.equal(c.getState().reserve, 48);
  assert.equal(c.getState().reserveCapacity, 72);
  for (let i = 0; i < 3; i++) field.spawn('ammo', 12, origin);
  assert.deepEqual(field.collectDetailed(origin, accept(c)), { status:'collected', kind:'ammo', amount:12 });
  assert.equal(c.getState().reserve, 60);
  assert.equal(field.collectDetailed(origin, accept(c)).amount, 12);
  assert.equal(c.getState().reserve, 72);
  assert.equal(field.collectDetailed(origin, accept(c)).status, 'full');
  assert.equal(field.getState().length, 1);
  field.dispose();
});

test('Nearby collectable ammo is preferred over a closer full bandage drop', () => {
  const c = new CombatController();
  const field = new LootField();
  field.spawn('bandage', 1, origin);
  field.spawn('ammo', 12, [1, 0, 0]);
  assert.equal(field.nearby(origin, prefer(c)).kind, 'ammo');
  assert.equal(field.collectDetailed(origin, accept(c), prefer(c)).kind, 'ammo');
  assert.equal(field.getState().length, 1);
  assert.equal(field.getState()[0].kind, 'bandage');
  assert.equal(field.collectDetailed(origin, accept(c), prefer(c)).status, 'full');
  field.dispose();
});

test('Partial pickup keeps the remainder and its marker; complete pickup removes both', () => {
  const c = new CombatController();
  c.addReserveAmmo(20);
  const field = new LootField();
  field.spawn('ammo', 12, origin);
  const group = field.root.children[0];
  assert.equal(group.children.length, 2);
  assert.ok(group.getObjectByName('Loot marker ammo'));
  assert.equal(field.collectDetailed(origin, accept(c)).amount, 4);
  assert.equal(field.getState()[0].amount, 8);
  assert.equal(field.root.children.length, 1);
  assert.equal(field.collectDetailed(origin, () => 8).amount, 8);
  assert.equal(field.getState().length, 0);
  assert.equal(field.root.children.length, 0);
  assert.equal(field.collectDetailed(origin, accept(c)).status, 'not-nearby');
  field.dispose();
});

test('Wave reward never discards picked-up reserve above the automatic refill limit', () => {
  const c = new CombatController();
  c.addReserveAmmo(24);
  c.rewardWave();
  assert.equal(c.getState().reserve, COMBAT.reserveCapacity);
  assert.equal(c.pickupCapacity('ammo'), 0);
  c.takeDamage(100, 0);
  assert.equal(c.pickupCapacity('ammo'), 0);
  assert.equal(c.addReserveAmmo(12), 0);
});

test('Loot outside pickup range is not accepted and invalid results cannot remove it', () => {
  const field = new LootField();
  field.spawn('ammo', 12, [3, 0, 0]);
  assert.equal(field.collectDetailed(origin, () => 12).status, 'not-nearby');
  assert.equal(field.collectDetailed([3,0,0], () => 13).status, 'unavailable');
  assert.equal(field.getState()[0].amount, 12);
  field.clear();
  assert.equal(field.root.children.length, 0);
  assert.equal(field.getState().length, 0);
  field.dispose();
});
