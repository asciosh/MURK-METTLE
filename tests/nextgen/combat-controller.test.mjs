import test from 'node:test';
import assert from 'node:assert/strict';

import {
  COMBAT,
  CombatController
} from '../../src/nextgen/core/CombatController.ts';

const shoot = {
  enabled: true,
  shoot: true,
  reload: false
};

const reload = {
  enabled: true,
  shoot: false,
  reload: true
};

const idle = {
  enabled: true,
  shoot: false,
  reload: false
};

function advance(combat, milliseconds, input = idle) {
  for (let remaining = milliseconds; remaining > 0;) {
    const dt = Math.min(100, remaining);
    combat.step(dt, input);
    remaining -= dt;
  }
}

test('Combat starts with full health and ammunition', () => {
  const combat = new CombatController();

  assert.equal(combat.getState().health, 100);
  assert.equal(combat.getState().ammo, 12);
  assert.equal(combat.getState().reserve, 48);
  assert.equal(combat.alive, true);
});

test('Shooting consumes exactly one round', () => {
  const combat = new CombatController();

  assert.equal(combat.step(16, shoot).shot, true);
  assert.equal(combat.getState().ammo, 11);
  assert.equal(combat.getState().shotsFired, 1);
});

test('Fire cooldown prevents rapid shots', () => {
  const combat = new CombatController();

  combat.step(16, shoot);

  assert.equal(combat.step(16, shoot).shot, false);

  advance(combat, COMBAT.fireIntervalMs);

  assert.equal(combat.step(16, shoot).shot, true);
});

test('Empty magazines cannot fire', () => {
  const combat = new CombatController();

  for (let i = 0; i < 12; i++) {
    combat.step(16, shoot);
    advance(combat, COMBAT.fireIntervalMs);
  }

  assert.equal(combat.getState().ammo, 0);
  assert.equal(combat.step(16, shoot).shot, false);
});

test('Reload transfers ammunition from reserve', () => {
  const combat = new CombatController();

  combat.step(16, shoot);
  advance(combat, COMBAT.fireIntervalMs);

  assert.equal(combat.step(16, reload).reloadStarted, true);
  assert.equal(combat.getState().reloading, true);

  advance(combat, COMBAT.reloadMs);

  assert.equal(combat.getState().ammo, 12);
  assert.equal(combat.getState().reserve, 47);
  assert.equal(combat.getState().reloading, false);
});

test('Shooting is blocked during reload', () => {
  const combat = new CombatController();

  combat.step(16, shoot);

  advance(combat, COMBAT.fireIntervalMs);

  combat.step(16, reload);

  assert.equal(combat.step(16, shoot).shot, false);
});

test('Releasing aim cancels reload without transferring ammunition', () => {
  const combat = new CombatController();

  combat.step(16, shoot);
  advance(combat, COMBAT.fireIntervalMs);

  combat.step(16, reload);

  combat.step(16, {
    enabled: false,
    shoot: false,
    reload: false
  });

  assert.equal(combat.getState().reloading, false);
  assert.equal(combat.getState().ammo, 11);
  assert.equal(combat.getState().reserve, 48);
});

test('Inactive weapon cannot shoot', () => {
  const combat = new CombatController();

  assert.equal(combat.step(16, {
    ...shoot,
    enabled: false
  }).shot, false);
});

test('Damage grace prevents stacked hits', () => {
  const combat = new CombatController();

  assert.equal(combat.takeDamage(12, 650), true);
  assert.equal(combat.takeDamage(12, 650), false);
  assert.equal(combat.getState().health, 88);

  advance(combat, 650);

  assert.equal(combat.takeDamage(12, 650), true);
  assert.equal(combat.getState().health, 76);
});

test('Death prevents further combat', () => {
  const combat = new CombatController();

  combat.takeDamage(1000, 650);

  assert.equal(combat.alive, false);
  assert.equal(combat.getState().health, 0);
  assert.equal(combat.step(16, shoot).shot, false);
  assert.equal(combat.takeDamage(12, 650), false);
});

test('Weapon timing respects animation duration', () => {
  const combat = new CombatController();

  combat.configureWeapon(1000, 2000);
  combat.step(16, shoot);

  advance(combat, 500);

  assert.equal(combat.step(16, shoot).shot, false);

  advance(combat, 500);

  assert.equal(combat.step(16, reload).reloadStarted, true);
  assert.equal(combat.getState().reloadRemainingMs, 2000);
});

test('Invalid input cannot corrupt combat state', () => {
  const combat = new CombatController();

  assert.equal(combat.takeDamage(NaN, 650), false);
  assert.equal(combat.takeDamage(-10, 650), false);
  assert.equal(combat.step(NaN, shoot).shot, false);
  assert.equal(combat.getState().health, 100);
});

test('Combat records hits and kills', () => {
  const combat = new CombatController();

  combat.recordHit(false);
  combat.recordHit(true);

  assert.equal(combat.getState().shotsHit, 2);
  assert.equal(combat.getState().kills, 1);
});

test('Wave rewards restore health without exceeding capacity', () => {
  const combat = new CombatController();

  combat.takeDamage(40, 0);

  combat.rewardWave();

  assert.equal(combat.getState().health, 80);

  combat.rewardWave();
  combat.rewardWave();

  assert.equal(combat.getState().health, 100);
  assert.equal(combat.getState().reserve, 48);
});