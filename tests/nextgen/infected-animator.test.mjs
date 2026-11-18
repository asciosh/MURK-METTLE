import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from 'three/webgpu';

import {
  InfectedAnimator
} from '../../src/nextgen/core/InfectedAnimator.ts';

function fixture() {
  const root = new THREE.Group();

  const joint = new THREE.Bone();
  joint.name = 'Joint';

  root.add(joint);

  const clips = [
    ['Idle', 1, 0],
    ['Walk', 1, 1],
    ['Run', 1, 2],
    ['Attack', 1, 3],
    ['Hit', 0.333, 4],
    ['Death', 2.375, 5]
  ].map(([name, duration, end]) =>
    new THREE.AnimationClip(name, duration, [
      new THREE.VectorKeyframeTrack(
        'Joint.position',
        [0, duration],
        [0, 0, 0, end, 0, 0]
      )
    ])
  );

  return { root, joint, clips };
}

test('Infected animator starts idle', () => {
  const { root, clips } = fixture();

  const animator = new InfectedAnimator(root, clips);

  assert.equal(animator.getActiveClip(), 'idle');

  animator.dispose();
});

test('Infected switches between walking and running', () => {
  const { root, clips } = fixture();

  const animator = new InfectedAnimator(root, clips);

  animator.update(100, {
    animation: 'walk',
    speed: 1.6
  });

  assert.equal(animator.getActiveClip(), 'walk');

  animator.update(100, {
    animation: 'run',
    speed: 3.2
  });

  assert.equal(animator.getActiveClip(), 'run');

  animator.dispose();
});

test('Infected animation changes bone transforms', () => {
  const { root, joint, clips } = fixture();

  const animator = new InfectedAnimator(root, clips);

  for (let i = 0; i < 4; i++) {
    animator.update(100, {
      animation: 'walk',
      speed: 1.6
    });
  }

  assert.ok(joint.position.x > 0);

  animator.dispose();
});

test('Attack animation plays once and stops', () => {
  const { root, joint, clips } = fixture();

  const animator = new InfectedAnimator(root, clips);

  for (let i = 0; i < 20; i++) {
    animator.update(100, {
      animation: 'attack',
      speed: 0
    });
  }

  assert.equal(animator.getActiveClip(), 'attack');

  assert.ok(Math.abs(joint.position.x - 3) < 0.000001);

  animator.dispose();
});

test('Hit reaction can interrupt an attack', () => {
  const { root, clips } = fixture();

  const animator = new InfectedAnimator(root, clips);

  animator.update(100, {
    animation: 'attack',
    speed: 0
  });

  animator.update(100, {
    animation: 'hit',
    speed: 0
  });

  assert.equal(animator.getActiveClip(), 'hit');

  animator.update(100, {
    animation: 'idle',
    speed: 0
  });

  assert.equal(animator.getActiveClip(), 'idle');

  animator.dispose();
});

test('Death animation remains in its final pose', () => {
  const { root, joint, clips } = fixture();

  const animator = new InfectedAnimator(root, clips);

  for (let i = 0; i < 30; i++) {
    animator.update(100, {
      animation: 'death',
      speed: 0
    });
  }

  assert.ok(Math.abs(joint.position.x - 5) < 0.000001);

  animator.update(100, {
    animation: 'idle',
    speed: 0
  });

  assert.equal(animator.getActiveClip(), 'death');

  assert.ok(Math.abs(joint.position.x - 5) < 0.000001);

  animator.dispose();
});

test('Infected animator disposal is idempotent', () => {
  const { root, clips } = fixture();

  const animator = new InfectedAnimator(root, clips);

  animator.dispose();
  animator.dispose();

  animator.update(100, {
    animation: 'walk',
    speed: 1.6
  });

  assert.equal(animator.getActiveClip(), null);
});