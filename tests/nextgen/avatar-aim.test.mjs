import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import { AvatarAnimator } from '../../src/nextgen/core/AvatarAnimator.ts';

const idle = {
  speed: 0,
  sprinting: false,
  airborne: false,
  dodging: false,
  aiming: false
};

const normalPose = new THREE.Quaternion();

const aimPose = new THREE.Quaternion()
  .setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.2);

function rotation(name, start, end = start) {
  return new THREE.QuaternionKeyframeTrack(
    `${name}.quaternion`,
    [0, 1],
    [...start.toArray(), ...end.toArray()]
  );
}

function createAnimator(includeAim = true) {
  const root = new THREE.Group();

  const arm = new THREE.Bone();
  arm.name = 'upperarm_l';

  const leg = new THREE.Bone();
  leg.name = 'thigh_l';

  const pelvis = new THREE.Bone();
  pelvis.name = 'pelvis';

  root.add(pelvis);
  pelvis.add(arm, leg);

  const clips = [
    'Idle', 'Walk', 'Run',
    'JumpStart', 'JumpLoop', 'JumpLand', 'Dodge'
  ].map(name => new THREE.AnimationClip(name, 1, [
    rotation('upperarm_l', normalPose),
    rotation('thigh_l', normalPose, aimPose),
    rotation('pelvis', normalPose)
  ]));

  if (includeAim) {
    clips.push(new THREE.AnimationClip('Aim', 1, [
      rotation('upperarm_l', aimPose),
      rotation('thigh_l', aimPose),
      rotation('pelvis', aimPose)
    ]));
  }

  return {
    animator: new AvatarAnimator(root, clips),
    arm,
    leg,
    pelvis
  };
}

function advance(animator, motion, steps = 4) {
  for (let i = 0; i < steps; i++) {
    animator.update(50, motion);
  }
}

function quaternionNear(actual, expected) {
  assert.ok(Math.abs(actual.dot(expected)) > 0.99999);
}

test('Aim starts inactive', () => {
  const { animator } = createAnimator();

  assert.equal(animator.getAimWeight(), 0);
  animator.dispose();
});

test('Aim blends smoothly into the upper-body pose', () => {
  const { animator, arm } = createAnimator();

  animator.update(50, { ...idle, aiming: true });

  assert.ok(animator.getAimWeight() > 0);
  assert.ok(animator.getAimWeight() < 1);

  advance(animator, { ...idle, aiming: true });

  assert.equal(animator.getAimWeight(), 1);
  quaternionNear(arm.quaternion, aimPose);

  animator.dispose();
});

test('Aim preserves walking legs and pelvis', () => {
  const aimed = createAnimator();
  const normal = createAnimator();

  advance(aimed.animator, {
    ...idle,
    speed: 4.8,
    aiming: true
  });

  advance(normal.animator, {
    ...idle,
    speed: 4.8
  });

  assert.equal(aimed.animator.getActiveClip(), 'walk');

  quaternionNear(
    aimed.leg.quaternion,
    normal.leg.quaternion
  );

  quaternionNear(
    aimed.pelvis.quaternion,
    normal.pelvis.quaternion
  );

  quaternionNear(aimed.arm.quaternion, aimPose);

  aimed.animator.dispose();
  normal.animator.dispose();
});

test('Aim preserves running animation', () => {
  const { animator } = createAnimator();

  advance(animator, {
    ...idle,
    speed: 8,
    sprinting: true,
    aiming: true
  });

  assert.equal(animator.getActiveClip(), 'run');
  assert.equal(animator.getAimWeight(), 1);

  animator.dispose();
});

test('Releasing aim restores base pose without drift', () => {
  const { animator, arm } = createAnimator();

  for (let i = 0; i < 10; i++) {
    advance(animator, { ...idle, aiming: true });
    advance(animator, idle);

    assert.equal(animator.getAimWeight(), 0);
    quaternionNear(arm.quaternion, normalPose);
  }

  animator.dispose();
});

test('Jump takes priority over aiming', () => {
  const { animator } = createAnimator();

  advance(animator, { ...idle, aiming: true });

  animator.update(50, {
    ...idle,
    aiming: true,
    airborne: true
  });

  assert.equal(animator.getActiveClip(), 'jumpstart');
  assert.equal(animator.getAimWeight(), 0);

  animator.dispose();
});

test('Dodge and recovery take priority over aiming', () => {
  const { animator } = createAnimator();

  advance(animator, { ...idle, aiming: true });

  animator.update(50, {
    ...idle,
    aiming: true,
    dodging: true
  });

  assert.equal(animator.getActiveClip(), 'dodge');
  assert.equal(animator.getAimWeight(), 0);

  advance(animator, { ...idle, aiming: true });

  assert.equal(animator.getActiveClip(), 'dodge');
  assert.equal(animator.getAimWeight(), 0);

  advance(animator, { ...idle, aiming: true }, 20);

  assert.equal(animator.getActiveClip(), 'idle');
  assert.equal(animator.getAimWeight(), 1);

  animator.dispose();
});

test('Missing Aim clip preserves normal locomotion', () => {
  const { animator } = createAnimator(false);

  advance(animator, {
    ...idle,
    speed: 4.8,
    aiming: true
  });

  assert.equal(animator.getActiveClip(), 'walk');
  assert.equal(animator.getAimWeight(), 0);

  animator.dispose();
});