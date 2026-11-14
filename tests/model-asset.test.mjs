import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('bundled survivor has valid bounded animation accessors and compatible equipment nodes', async () => {
  const bytes = await readFile(new URL('../public/models/survivor.glb', import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(4), 2);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.ok(bytes.length < 100_000);
  const jsonLength = bytes.readUInt32LE(12);
  const gltf = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
  const binaryLength = bytes.readUInt32LE(20 + jsonLength);
  assert.equal(gltf.skins?.length ?? 0, 0, 'This asset uses rigid node animation, not a skeletal rig');
  for (const name of ['pack', 'pack-panel', 'beacon', 'belt-pouch']) assert.ok(gltf.nodes.some((n) => n.name === name));
  assert.deepEqual(
    gltf.animations.map((c) => c.name),
    ['Idle', 'Walk', 'Run', 'Attack', 'Hit', 'Death'],
  );
  for (const view of gltf.bufferViews) assert.ok((view.byteOffset ?? 0) + view.byteLength <= binaryLength);
  for (const clip of gltf.animations) {
    for (const channel of clip.channels) {
      assert.ok(gltf.nodes[channel.target.node]);
      const sampler = clip.samplers[channel.sampler];
      const input = gltf.accessors[sampler.input],
        output = gltf.accessors[sampler.output];
      assert.equal(input.count, output.count);
      assert.ok(input.count >= 2);
      assert.equal(input.type, 'SCALAR');
      assert.equal(output.type, 'VEC4');
    }
  }
  const manifest = JSON.parse(await readFile(new URL('../public/models/manifest.json', import.meta.url)));
  assert.equal(
    manifest.survivor.presentation,
    'equipment',
    'Legacy rigid limbs must not replace articulated combat poses',
  );
});
