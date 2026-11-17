import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import { PlayerAvatar } from '../../src/nextgen/core/PlayerAvatar.ts';

test('Avatar contains visible geometry', () => {
  const avatar = new PlayerAvatar();

  assert.ok(avatar.root.children.length > 0);

  avatar.dispose();
});

test('Avatar follows controller position', () => {
  const avatar = new PlayerAvatar();

  avatar.update({
    position: [25, 5, 50],
    facing: [0, 0, -1]
  });

  assert.deepEqual(
    avatar.root.position.toArray(),
    [25, 5, 50]
  );

  avatar.dispose();
});

test('Avatar rotates toward movement direction', () => {
  const avatar = new PlayerAvatar();

  avatar.update({
    position: [0, 0, 0],
    facing: [1, 0, 0]
  });

  assert.ok(
    Math.abs(avatar.root.rotation.y + Math.PI / 2)
      < 0.000001
  );

  avatar.dispose();
});

test('Avatar disposal releases owned resources once', () => {
  const avatar = new PlayerAvatar();
  const scene = new THREE.Scene();

  scene.add(avatar.root);

  const resources = new Set();

  for (const mesh of avatar.root.children) {
    resources.add(mesh.geometry);
    resources.add(mesh.material);
  }

  let disposed = 0;

  for (const resource of resources) {
    resource.addEventListener('dispose', () => {
      disposed++;
    });
  }

  avatar.dispose();
  avatar.dispose();

  assert.equal(disposed, resources.size);
  assert.equal(avatar.root.parent, null);
  assert.equal(avatar.root.children.length, 0);
});