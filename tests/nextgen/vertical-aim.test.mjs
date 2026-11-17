import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';

import { AvatarAnimator } from '../../src/nextgen/core/AvatarAnimator.ts';
import { ThirdPersonCamera } from '../../src/nextgen/core/ThirdPersonCamera.ts';

const motion = {
  speed: 0,
  sprinting: false,
  airborne: false,
  dodging: false,
  aiming: true
};

function pose(angle) {
  return new THREE.Quaternion()
    .setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      angle
    );
}

function track(name, rotation) {
  return new THREE.QuaternionKeyframeTrack(
    `${name}.quaternion`,
    [0, 1],
    [
      ...rotation.toArray(),
      ...rotation.toArray()
    ]
  );
}

function createAnimator(vertical = true) {
  const root = new THREE.Group();

  const arm = new THREE.Bone();
  arm.name = 'upperarm_l';

  const leg = new THREE.Bone();
  leg.name = 'thigh_l';

  root.add(arm, leg);

  const clips = [
    'Idle', 'Walk', 'Run', 'Aim',
    'JumpStart', 'JumpLoop', 'JumpLand', 'Dodge'
  ].map(name => new THREE.AnimationClip(name, 1, [
    track('upperarm_l', pose(0)),
    track('thigh_l', pose(0))
  ]));

  if (vertical) {
    clips.push(
      new THREE.AnimationClip('AimUp', 1, [
        track('upperarm_l', pose(1.49)),
        track('thigh_l', pose(1))
      ]),
      new THREE.AnimationClip('AimDown', 1, [
        track('upperarm_l', pose(-1.548)),
        track('thigh_l', pose(-1))
      ])
    );
  }

  clips.push(
  new THREE.AnimationClip('PistolShoot', 1, [
    track('upperarm_l', pose(0.3))
  ])
);

  return {
    animator: new AvatarAnimator(root, clips),
    arm,
    leg
  };
}

function advance(animator, input) {
  for (let i = 0; i < 10; i++) {
    animator.update(100, input);
  }
}

test('Positive pitch blends upward', () => {
  const { animator, arm } = createAnimator();

  advance(animator, {
    ...motion,
    aimPitch: 0.6
  });

  assert.ok(arm.quaternion.x > 0);
  assert.ok(Math.abs(animator.getAimPitch() - 0.6) < 0.01);

  animator.dispose();
});

test('Negative pitch blends downward', () => {
  const { animator, arm } = createAnimator();

  advance(animator, {
    ...motion,
    aimPitch: -0.8
  });

  assert.ok(arm.quaternion.x < 0);

  animator.dispose();
});

test('Vertical aiming preserves lower body', () => {
  const { animator, leg } = createAnimator();

  advance(animator, {
    ...motion,
    speed: 4.8,
    aimPitch: 0.5
  });

  assert.equal(animator.getActiveClip(), 'walk');

  assert.ok(
    leg.quaternion.angleTo(pose(0)) < 0.001
  );

  animator.dispose();
});

test('Invalid pitch stays finite', () => {
  const { animator } = createAnimator();

  advance(animator, {
    ...motion,
    aimPitch: NaN
  });

  assert.equal(animator.getAimPitch(), 0);

  animator.dispose();
});

test('Releasing aim clears vertical pose', () => {
  const { animator, arm } = createAnimator();

  advance(animator, {
    ...motion,
    aimPitch: 0.6
  });

  advance(animator, {
    ...motion,
    aiming: false
  });

  assert.equal(animator.getAimPitch(), 0);
  assert.equal(animator.getAimWeight(), 0);

  assert.ok(
    arm.quaternion.angleTo(pose(0)) < 0.001
  );

  animator.dispose();
});

test('Missing vertical poses preserve neutral aim', () => {
  const { animator, arm } = createAnimator(false);

  advance(animator, {
    ...motion,
    aimPitch: 0.6
  });

  assert.ok(
    arm.quaternion.angleTo(pose(0)) < 0.001
  );

  animator.dispose();
});

test('Camera reports upward aim as positive pitch', () => {
  const camera = new ThirdPersonCamera();

  camera.rotate(0, -1000);

  assert.ok(camera.getAimPitch() > 0);

  camera.rotate(0, 1000);

  assert.ok(camera.getAimPitch() < 0);
});

test('Recoil preserves vertical aim', () => {
  const { animator, arm } = createAnimator();

  advance(animator, {
    ...motion,
    aimPitch: 0.6
  });

  animator.update(16, {
    ...motion,
    aimPitch: 0.6,
    shoot: true
  });

  assert.equal(animator.getWeaponAction(), 'shoot');

  assert.ok(
    arm.quaternion.angleTo(pose(0.9)) < 0.01
  );

  animator.dispose();
});