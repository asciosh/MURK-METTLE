import test from 'node:test';
import assert from 'node:assert/strict';

import * as THREE from 'three/webgpu';

import {
  InfectedModelPool
} from '../../src/nextgen/core/InfectedModel.ts';

function fixture() {
  const scene = new THREE.Group();

  const geometry = new THREE.BoxGeometry(1, 2, 1);
  const count = geometry.attributes.position.count;

  const indices = new Uint16Array(count * 4);
  const weights = new Float32Array(count * 4);

  for (let i = 0; i < count; i++) {
    weights[i * 4] = 1;
  }

  geometry.setAttribute(
    'skinIndex',
    new THREE.Uint16BufferAttribute(indices, 4)
  );

  geometry.setAttribute(
    'skinWeight',
    new THREE.Float32BufferAttribute(weights, 4)
  );

  const texture = new THREE.Texture();

  const material = new THREE.MeshStandardMaterial({
    map: texture
  });

  const mesh = new THREE.SkinnedMesh(
    geometry,
    material
  );

  mesh.name = 'Body';

  const bone = new THREE.Bone();
  bone.name = 'Root';

  mesh.add(bone);
  scene.add(mesh);

  mesh.updateMatrixWorld(true);

  mesh.bind(new THREE.Skeleton([bone]));

  const animations = [
    'Idle', 'Walk', 'Run',
    'Attack', 'Hit', 'Death'
  ].map(name =>
    new THREE.AnimationClip(name, 1, [])
  );

  return {
    gltf: {
      scene,
      scenes: [scene],
      animations
    },
    geometry,
    material,
    texture
  };
}

function createPool(asset) {
  return new InfectedModelPool({
    loadAsync: async () => asset.gltf
  });
}

test('Infected model loads only once', async () => {
  const asset = fixture();

  let loads = 0;

  const pool = new InfectedModelPool({
    loadAsync: async () => {
      loads++;
      return asset.gltf;
    }
  });

  const results = await Promise.all([
    pool.load('infected.glb'),
    pool.load('infected.glb'),
    pool.load('infected.glb')
  ]);

  assert.deepEqual(results, [true, true, true]);
  assert.equal(loads, 1);

  pool.dispose();
});

test('Infected instances share geometry and materials', async () => {
  const asset = fixture();
  const pool = createPool(asset);

  assert.equal(await pool.load('infected.glb'), true);

  const a = pool.create();
  const b = pool.create();

  const meshA = a.root.getObjectByName('Body');
  const meshB = b.root.getObjectByName('Body');

  assert.notEqual(meshA, meshB);

  assert.equal(meshA.geometry, meshB.geometry);
  assert.equal(meshA.material, meshB.material);
  assert.equal(meshA.material.map, meshB.material.map);

  assert.equal(pool.count, 2);

  pool.dispose();
});

test('Infected instances have independent skeletons', async () => {
  const pool = createPool(fixture());

  await pool.load('infected.glb');

  const a = pool.create();
  const b = pool.create();

  const meshA = a.root.getObjectByName('Body');
  const meshB = b.root.getObjectByName('Body');

  assert.notEqual(meshA.skeleton, meshB.skeleton);

  assert.notEqual(
    meshA.skeleton.bones[0],
    meshB.skeleton.bones[0]
  );

  meshA.skeleton.bones[0].position.x = 5;

  assert.equal(meshB.skeleton.bones[0].position.x, 0);

  pool.dispose();
});

test('Infected model is normalized to ground level', async () => {
  const pool = createPool(fixture());

  await pool.load('infected.glb');

  const model = pool.create();

  model.root.updateMatrixWorld(true);

  const bounds = new THREE.Box3()
    .setFromObject(model.root);

  assert.ok(Math.abs(bounds.min.y) < 0.000001);

  const height = bounds.max.y - bounds.min.y;

  assert.ok(
    Math.abs(height - InfectedModelPool.HEIGHT) < 0.000001
  );

  pool.dispose();
});

test('Disposing an enemy preserves shared resources', async () => {
  const asset = fixture();
  const pool = createPool(asset);

  let geometryDisposals = 0;
  let materialDisposals = 0;
  let textureDisposals = 0;

  asset.geometry.addEventListener('dispose', () => {
    geometryDisposals++;
  });

  asset.material.addEventListener('dispose', () => {
    materialDisposals++;
  });

  asset.texture.addEventListener('dispose', () => {
    textureDisposals++;
  });

  await pool.load('infected.glb');

  const a = pool.create();
  const b = pool.create();

  a.dispose();
  a.dispose();

  assert.equal(pool.count, 1);

  assert.equal(geometryDisposals, 0);
  assert.equal(materialDisposals, 0);
  assert.equal(textureDisposals, 0);

  assert.equal(b.hasSkeleton, true);

  pool.dispose();
  pool.dispose();

  assert.equal(pool.count, 0);

  assert.equal(geometryDisposals, 1);
  assert.equal(materialDisposals, 1);
  assert.equal(textureDisposals, 1);
});

test('Missing animation rejects the infected model', async () => {
  const asset = fixture();

  asset.gltf.animations.pop();

  const pool = createPool(asset);

  assert.equal(await pool.load('infected.glb'), false);
  assert.equal(pool.loaded, false);
  assert.equal(pool.create(), null);

  pool.dispose();
});

test('Late loading after disposal cannot create an enemy', async () => {
  const asset = fixture();

  let resolve;

  const pool = new InfectedModelPool({
    loadAsync: () => new Promise(done => {
      resolve = done;
    })
  });

  let disposals = 0;

  asset.geometry.addEventListener('dispose', () => {
    disposals++;
  });

  const loading = pool.load('infected.glb');

  pool.dispose();

  resolve(asset.gltf);

  assert.equal(await loading, false);
  assert.equal(pool.loaded, false);
  assert.equal(pool.create(), null);
  assert.equal(disposals, 1);
});