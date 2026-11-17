import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import { PistolProp } from '../../src/nextgen/core/PistolProp.ts';

test('Pistol attaches to right hand bone', () => {
  const hand = new THREE.Bone();
  const pistol = new PistolProp(hand);

  assert.equal(pistol.root.parent, hand);
  assert.equal(pistol.muzzle.parent, pistol.root);

  pistol.dispose();
});

test('Pistol contains visible mesh geometry', () => {
  const pistol = new PistolProp(new THREE.Bone());

  assert.ok(
    pistol.root.children.some(
      node => node instanceof THREE.Mesh
    )
  );

  pistol.dispose();
});

test('Pistol visibility follows aim weight', () => {
  const pistol = new PistolProp(new THREE.Bone());

  assert.equal(pistol.root.visible, false);

  pistol.update(1);
  assert.equal(pistol.root.visible, true);

  pistol.update(0);
  assert.equal(pistol.root.visible, false);

  pistol.dispose();
});

test('Muzzle follows hand movement', () => {
  const hand = new THREE.Bone();
  const pistol = new PistolProp(hand);

  const initial = pistol.getMuzzlePosition();

  hand.position.set(2, 3, 4);

  const moved = pistol.getMuzzlePosition();

  const expected = initial.clone().add(
    new THREE.Vector3(2, 3, 4)
  );

  assert.ok(moved.distanceTo(expected) < 0.000001);

  pistol.dispose();
});

test('Pistol disposal releases resources once', () => {
  const hand = new THREE.Bone();
  const pistol = new PistolProp(hand);

  const geometries = new Set();
  const materials = new Set();

  pistol.root.traverse(node => {
    if (node instanceof THREE.Mesh) {
      geometries.add(node.geometry);
      materials.add(node.material);
    }
  });

  let disposed = 0;

  for (const resource of [...geometries, ...materials]) {
    resource.addEventListener('dispose', () => {
      disposed++;
    });
  }

  pistol.dispose();
  pistol.dispose();

  assert.equal(pistol.root.parent, null);
  assert.equal(pistol.root.children.length, 0);
  assert.equal(disposed, geometries.size + materials.size);
});