import test from 'node:test';
import assert from 'node:assert/strict';
import { CharacterStamina } from '../../src/nextgen/core/CharacterStamina.ts';

test('Character starts with full stamina', () => {
  const stamina = new CharacterStamina();

  assert.equal(stamina.getState().stamina, 100);
  assert.equal(stamina.canSprint(), true);
});

test('Sprinting consumes stamina', () => {
  const stamina = new CharacterStamina();

  const result = stamina.update(100, true, true);

  assert.equal(result.sprinting, true);
  assert.ok(Math.abs(result.stamina - 97.7) < 0.000001);
});

test('Standing still does not consume stamina', () => {
  const stamina = new CharacterStamina();

  for (let i = 0; i < 20; i++) {
    stamina.update(100, false, true);
  }

  assert.equal(stamina.getState().stamina, 100);
  assert.equal(stamina.getState().sprinting, false);
});

test('Stamina regeneration respects recovery delay', () => {
  const stamina = new CharacterStamina();

  stamina.update(100, true, true);

  const depleted = stamina.getState().stamina;

  for (let i = 0; i < 10; i++) {
    stamina.update(100, false, false);
  }

  assert.equal(stamina.getState().stamina, depleted);

  stamina.update(100, false, false);

  assert.ok(stamina.getState().stamina > depleted);
});

test('Exhaustion prevents sprinting until recovery', () => {
  const stamina = new CharacterStamina();

  for (let i = 0; i < 44; i++) {
    stamina.update(100, true, true);
  }

  assert.equal(stamina.getState().stamina, 0);
  assert.equal(stamina.getState().exhausted, true);
  assert.equal(stamina.canSprint(), false);

  for (let i = 0; i < 100; i++) {
    if (stamina.canSprint()) break;

    const result = stamina.update(100, true, true);
    assert.equal(result.sprinting, false);
  }

  assert.ok(stamina.getState().stamina >= 25);
  assert.equal(stamina.canSprint(), true);

  assert.equal(
    stamina.update(100, true, true).sprinting,
    true
  );
});

test('Invalid and oversized time steps are safe', () => {
  const stamina = new CharacterStamina();

  for (const dt of [-100, NaN, Infinity, 0]) {
    stamina.update(dt, true, true);
  }

  assert.equal(stamina.getState().stamina, 100);

  stamina.update(5000, true, true);

  assert.ok(
    Math.abs(stamina.getState().stamina - 97.7) < 0.000001
  );
});

test('Stamina snapshots cannot mutate internal state', () => {
  const stamina = new CharacterStamina();

  const state = stamina.getState();
  state.stamina = -100;
  state.exhausted = true;

  assert.equal(stamina.getState().stamina, 100);
  assert.equal(stamina.getState().exhausted, false);
});