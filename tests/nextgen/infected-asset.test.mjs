import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const data = readFileSync(
  new URL('../../public/models/nextgen/infected.glb', import.meta.url)
);

assert.equal(data.toString('ascii', 0, 4), 'glTF');
assert.equal(data.readUInt32LE(4), 2);
assert.equal(data.readUInt32LE(8), data.length);

const jsonLength = data.readUInt32LE(12);

const gltf = JSON.parse(
  data.toString('utf8', 20, 20 + jsonLength)
);

const bin = data.subarray(28 + jsonLength);

test('Infected asset respects geometry and file budgets', () => {
  assert.ok(data.length <= 4 * 1024 * 1024);

  const triangles = gltf.meshes.reduce(
    (total, mesh) => total + mesh.primitives.reduce(
      (sum, primitive) =>
        sum + gltf.accessors[primitive.indices].count / 3,
      0
    ),
    0
  );

  assert.ok(triangles <= 35000);
  assert.equal(gltf.meshes.length, 7);
  assert.equal(gltf.skins.length, 1);
  assert.equal(gltf.skins[0].joints.length, 53);
});

test('Infected has six valid animation clips', () => {
  const expected = [
    'Idle', 'Walk', 'Run', 'Attack', 'Hit', 'Death'
  ];

  assert.deepEqual(
    gltf.animations.map(animation => animation.name).sort(),
    expected.sort()
  );

  for (const animation of gltf.animations) {
    assert.ok(animation.channels.length > 0);

    const duration = Math.max(
      ...animation.samplers.map(
        sampler => gltf.accessors[sampler.input].max[0]
      )
    );

    assert.ok(Number.isFinite(duration));
    assert.ok(duration > 0);
  }
});

test('Infected textures are embedded and bounded', () => {
  assert.equal(gltf.images.length, 8);
  assert.deepEqual(gltf.extensionsRequired ?? [], []);

  for (const image of gltf.images) {
    assert.equal(image.uri, undefined);
    assert.equal(image.mimeType, 'image/png');

    const view = gltf.bufferViews[image.bufferView];
    const offset = view.byteOffset ?? 0;

    const width = bin.readUInt32BE(offset + 16);
    const height = bin.readUInt32BE(offset + 20);

    assert.ok(width > 0 && width <= 512);
    assert.ok(height > 0 && height <= 512);
  }

  for (const buffer of gltf.buffers) {
    assert.equal(buffer.uri, undefined);
  }
});