import test from 'node:test';
import assert from 'node:assert/strict';
import { KeyboardInput } from '../../src/nextgen/core/KeyboardInput.ts';

test('Keyboard starts idle', () => {
  const k = new KeyboardInput();

  assert.deepEqual(k.read(), {
    forward: 0,
    strafe: 0,
    sprint: false,
    jump: false,
    dodge: false
  });
});

test('WASD produces directional movement', () => {
  const k = new KeyboardInput();

  k.keyDown('KeyW');
  k.keyDown('KeyD');

  const input = k.read();

  assert.equal(input.forward, 1);
  assert.equal(input.strafe, 1);
});

test('Opposite movement cancels out', () => {
  const k = new KeyboardInput();

  k.keyDown('KeyW');
  k.keyDown('KeyS');
  k.keyDown('KeyA');
  k.keyDown('KeyD');

  assert.equal(k.read().forward, 0);
  assert.equal(k.read().strafe, 0);
});

test('Releasing keys stops movement', () => {
  const k = new KeyboardInput();

  k.keyDown('KeyW');
  k.keyUp('KeyW');

  assert.equal(k.read().forward, 0);
});

test('Both Shift keys support sprint', () => {
  const k = new KeyboardInput();

  k.keyDown('ShiftLeft');
  k.keyDown('ShiftRight');

  assert.equal(k.read().sprint, true);

  k.keyUp('ShiftLeft');

  assert.equal(k.read().sprint, true);

  k.keyUp('ShiftRight');

  assert.equal(k.read().sprint, false);
});

test('Quick jump presses are not lost', () => {
  const k = new KeyboardInput();

  k.keyDown('Space');
  k.keyUp('Space');

  assert.equal(k.read().jump, true);
  assert.equal(k.read().jump, false);
});

test('Holding dodge does not repeat', () => {
  const k = new KeyboardInput();

  k.keyDown('ControlLeft');

  assert.equal(k.read().dodge, true);

  k.keyDown('ControlLeft', true);

  assert.equal(k.read().dodge, false);
});

test('Consecutive jump presses produce separate pulses', () => {
  const k = new KeyboardInput();

  k.keyDown('Space');
  k.keyUp('Space');

  assert.equal(k.read().jump, true);

  k.keyDown('Space');
  k.keyUp('Space');

  assert.equal(k.read().jump, false);
  assert.equal(k.read().jump, true);
});

test('Reset clears held keys and pending actions', () => {
  const k = new KeyboardInput();

  k.keyDown('KeyW');
  k.keyDown('ShiftLeft');
  k.keyDown('Space');
  k.keyDown('ControlLeft');

  k.reset();

  assert.deepEqual(k.read(), {
    forward: 0,
    strafe: 0,
    sprint: false,
    jump: false,
    dodge: false
  });
});