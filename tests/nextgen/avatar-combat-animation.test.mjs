import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';

import {
  AvatarAnimator
} from '../../src/nextgen/core/AvatarAnimator.ts';

const idle = {
  speed: 0,
  sprinting: false,
  airborne: false,
  dodging: false
};

function setup() {
  const root = new THREE.Group();
  const pelvis = new THREE.Bone();

  pelvis.name = 'pelvis';
  root.add(pelvis);

  const clip = (name, duration, from, to) =>
    new THREE.AnimationClip(name, duration, [
      new THREE.VectorKeyframeTrack(
        'pelvis.position',
        [0, duration],
        [0, from, 0, 0, to, 0]
      )
    ]);

  const animator = new AvatarAnimator(root, [
    clip('Idle', 1, 1, 1),
    clip('Walk', 1, 1, 1),
    clip('Run', 1, 1, 1),
    clip('Hit', 0.333, 1, 1),
    clip('Death', 2.375, 1, 0)
  ]);

  return { animator, pelvis };
}

test('Damage activates hit animation', () => {
  const { animator } = setup();

  animator.update(16, { ...idle, hit: true });
  assert.equal(animator.getActiveClip(), 'hit');

  animator.dispose();
});

test('Hit reaction recovers to locomotion', () => {
  const { animator } = setup();

  animator.update(16, { ...idle, hit: true });

  for (let i = 0; i < 5; i++) {
    animator.update(100, idle);
  }

  assert.equal(animator.getActiveClip(), 'idle');

  animator.dispose();
});

test('Death overrides hit reaction', () => {
  const { animator } = setup();

  animator.update(16, { ...idle, hit: true });
  animator.update(16, {
    ...idle,
    hit: true,
    dead: true
  });

  assert.equal(animator.getActiveClip(), 'death');

  animator.dispose();
});

test('Death holds its final pose', () => {
  const { animator, pelvis } = setup();

  for (let i = 0; i < 35; i++) {
    animator.update(100, { ...idle, dead: true });
  }

  assert.equal(animator.getActiveClip(), 'death');
  assert.ok(Math.abs(pelvis.position.y) < 0.001);

  animator.dispose();
});

test('Restart restores idle animation', () => {
  const { animator } = setup();

  animator.update(100, { ...idle, dead: true });
  animator.update(100, idle);

  assert.equal(animator.getActiveClip(), 'idle');

  animator.dispose();
});