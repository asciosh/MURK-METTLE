import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';

import { WeaponPoseLayer } from '../../src/nextgen/core/WeaponPoseLayer.ts';
import { AvatarAnimator } from '../../src/nextgen/core/AvatarAnimator.ts';
import { ThirdPersonCamera } from '../../src/nextgen/core/ThirdPersonCamera.ts';

const neutral = new THREE.Quaternion();

const recoil = new THREE.Quaternion()
  .setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1);

const idle = {
  speed: 0,
  sprinting: false,
  airborne: false,
  dodging: false,
  aiming: true
};

function clip(name, duration) {
  return new THREE.AnimationClip(name, duration, [
    new THREE.QuaternionKeyframeTrack(
      'upperarm_l.quaternion',
      [0, duration / 2, duration],
      [
        ...neutral.toArray(),
        ...recoil.toArray(),
        ...neutral.toArray()
      ]
    )
  ]);
}

function createLayer() {
  return new WeaponPoseLayer([
    clip('PistolShoot', 0.6),
    clip('PistolReload', 1.6)
  ]);
}

function createAnimator() {
  const root = new THREE.Group();
  const arm = new THREE.Bone();

  arm.name = 'upperarm_l';
  root.add(arm);

  const clips = [
    'Idle', 'Walk', 'Run', 'Aim',
    'JumpStart', 'JumpLoop', 'JumpLand', 'Dodge'
  ].map(name => new THREE.AnimationClip(name, 1, [
    new THREE.QuaternionKeyframeTrack(
      'upperarm_l.quaternion',
      [0, 1],
      [
        ...neutral.toArray(),
        ...neutral.toArray()
      ]
    )
  ]));

  clips.push(
    clip('PistolShoot', 0.6),
    clip('PistolReload', 1.6)
  );

  return new AvatarAnimator(root, clips);
}

test('Shooting starts and completes once', () => {
  const layer = createLayer();

  layer.update(16, true, true);
  assert.equal(layer.getActiveAction(), 'shoot');

  for (let i = 0; i < 7; i++) {
    layer.update(100, true);
  }

  assert.equal(layer.getActiveAction(), null);
});

test('Weapon layer samples animated rotations', () => {
  const layer = createLayer();
  const result = new THREE.Quaternion();

  layer.update(16, true, true);
  layer.update(100, true);

  assert.equal(layer.sample('upperarm_l', result), true);
  assert.ok(result.angleTo(neutral) > 0.1);
});

test('Reload takes priority over simultaneous shooting', () => {
  const layer = createLayer();

  layer.update(16, true, true, true);

  assert.equal(layer.getActiveAction(), 'reload');
});

test('Shooting cannot interrupt reload', () => {
  const layer = createLayer();

  layer.update(16, true, false, true);
  layer.update(100, true, true);

  assert.equal(layer.getActiveAction(), 'reload');
});

test('Disabling aim cancels weapon actions', () => {
  const layer = createLayer();

  layer.update(16, true, false, true);
  layer.update(16, false);

  assert.equal(layer.getActiveAction(), null);
});

test('Missing weapon clips are safe', () => {
  const layer = new WeaponPoseLayer([]);

  layer.update(16, true, true);

  assert.equal(layer.getActiveAction(), null);
});

test('Reload preserves walking animation', () => {
  const animator = createAnimator();

  animator.update(100, {
    ...idle,
    speed: 4.8,
    reload: true
  });

  assert.equal(animator.getActiveClip(), 'walk');
  assert.equal(animator.getWeaponAction(), 'reload');

  animator.dispose();
});

test('Jump and dodge cancel weapon actions', () => {
  for (const interruption of [
    { airborne: true },
    { dodging: true }
  ]) {
    const animator = createAnimator();

    animator.update(100, {
      ...idle,
      reload: true
    });

    animator.update(100, {
      ...idle,
      ...interruption
    });

    assert.equal(animator.getWeaponAction(), null);
    assert.equal(animator.getAimWeight(), 0);

    animator.dispose();
  }
});

test('Camera looks upward without entering terrain', () => {
  const terrain = {
    size: 200,
    heightAt: () => 0
  };

  for (const aiming of [false, true]) {
    const camera = new ThirdPersonCamera();

    camera.rotate(0, -1000);

    const pose = camera.update(
      100,
      [100, 0, 100],
      terrain,
      aiming
    );

    assert.ok(pose.position[1] < pose.target[1]);

    assert.ok(
      pose.position[1] >= ThirdPersonCamera.CLEARANCE
    );
  }
});