import test from 'node:test';
import assert from 'node:assert/strict';
import { CharacterJump } from '../../src/nextgen/core/CharacterJump.ts';

test('Character starts grounded', () => {
  const jump = new CharacterJump();

  assert.equal(jump.isAirborne(), false);
  assert.equal(jump.getVelocity(), 0);
});

test('Jump produces upward movement', () => {
  const jump = new CharacterJump();

  assert.equal(jump.start(), true);

  const y = jump.advance(100, 0, 0);

  assert.ok(y > 0);
  assert.equal(jump.isAirborne(), true);
});

test('Double jump is prevented', () => {
  const jump = new CharacterJump();

  assert.equal(jump.start(), true);
  assert.equal(jump.start(), false);
});

test('Gravity eventually returns character to ground', () => {
  const jump = new CharacterJump();

  jump.start();

  let y = 0;
  let peak = 0;

  for (let i = 0; i < 120; i++) {
    y = jump.advance(16.6667, y, 0);
    peak = Math.max(peak, y);
  }

  assert.ok(peak > 1.35 && peak < 1.4);
  assert.equal(y, 0);
  assert.equal(jump.isAirborne(), false);
  assert.equal(jump.getVelocity(), 0);
});

test('Character can jump again after landing', () => {
  const jump = new CharacterJump();

  jump.start();

  let y = 0;

  for (let i = 0; i < 20; i++) {
    y = jump.advance(100, y, 0);
  }

  assert.equal(jump.start(), true);
});

test('Landing respects terrain elevation', () => {
  const jump = new CharacterJump();

  jump.start();

  let y = 5;

  for (let i = 0; i < 20; i++) {
    y = jump.advance(100, y, 5.5);
  }

  assert.equal(y, 5.5);
  assert.equal(jump.isAirborne(), false);
});

test('Invalid time steps do not change physics state', () => {
  const jump = new CharacterJump();

  jump.start();

  assert.equal(jump.advance(NaN, 0, 0), 0);
  assert.equal(jump.advance(-100, 0, 0), 0);
  assert.equal(jump.getVelocity(), 5.2);
});