import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import { AvatarAnimator } from '../../src/nextgen/core/AvatarAnimator.ts';

function createAnimator() {
  const root = new THREE.Group();

  const clips = ['Idle', 'Walk', 'Run'].map(
    name => new THREE.AnimationClip(name, 1, [
      new THREE.NumberKeyframeTrack(
        '.position[x]',
        [0, 1],
        [0, 1]
      )
    ])
  );

  return {
    root,
    animator: new AvatarAnimator(root, clips)
  };
}

const idle = {
  speed: 0,
  sprinting: false,
  airborne: false,
  dodging: false
};

test('Animator starts with idle', () => {
  const { animator } = createAnimator();

  assert.equal(animator.getActiveClip(), 'idle');

  animator.dispose();
});

test('Animation mixer changes model transforms', () => {
  const { root, animator } = createAnimator();

  animator.update(100, idle);

  assert.ok(root.position.x > 0);

  animator.dispose();
});

test('Movement activates walking animation', () => {
  const { animator } = createAnimator();

  animator.update(16, {
    ...idle,
    speed: 4.8
  });

  assert.equal(animator.getActiveClip(), 'walk');

  animator.dispose();
});

test('Sprint activates running animation', () => {
  const { animator } = createAnimator();

  animator.update(16, {
    ...idle,
    speed: 8,
    sprinting: true
  });

  assert.equal(animator.getActiveClip(), 'run');

  animator.dispose();
});

test('Stopping movement restores idle animation', () => {
  const { animator } = createAnimator();

  animator.update(16, {
    ...idle,
    speed: 4.8
  });

  animator.update(16, idle);

  assert.equal(animator.getActiveClip(), 'idle');

  animator.dispose();
});

test('Airborne movement uses temporary idle fallback', () => {
  const { animator } = createAnimator();

  animator.update(16, {
    ...idle,
    speed: 4.8,
    airborne: true
  });

  assert.equal(animator.getActiveClip(), 'idle');

  animator.dispose();
});

test('Animator disposal is safe and idempotent', () => {
  const { animator } = createAnimator();

  animator.dispose();
  animator.dispose();

  animator.update(16, idle);

  assert.equal(animator.getActiveClip(), null);
});