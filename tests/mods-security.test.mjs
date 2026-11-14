import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { validateManifest, path, LIMITS, crc32 } from '../src/client/mods/format.mjs';
import { validatePackage, readArchive } from '../src/client/mods/archive.mjs';
import { makeZip } from '../scripts/cosmetic-zip.mjs';
const root = new URL('../examples/creature-mods/copperbloom/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', root))),
  model = readFileSync(new URL('model.glb', root)),
  icon = readFileSync(new URL('icon.png', root)),
  license = readFileSync(new URL('LICENSE.txt', root));
const bytes = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
function pack(m = manifest, g = model, extras = []) {
  return bytes(
    makeZip([
      ['manifest.json', Buffer.from(JSON.stringify(m))],
      ['LICENSE.txt', license],
      ...(g ? [['model.glb', g]] : []),
      ['icon.png', icon],
      ...extras,
    ]),
  );
}
function editGLB(change) {
  const jl = model.readUInt32LE(12),
    g = JSON.parse(model.subarray(20, 20 + jl).toString());
  const bin = Buffer.from(model.subarray(28 + jl));
  change(g, bin);
  let j = Buffer.from(JSON.stringify(g));
  j = Buffer.concat([j, Buffer.alloc((4 - (j.length % 4)) % 4, 32)]);
  const h = Buffer.from(model.subarray(0, 20)),
    b = Buffer.alloc(8);
  h.writeUInt32LE(28 + j.length + bin.length, 8);
  h.writeUInt32LE(j.length, 12);
  b.writeUInt32LE(bin.length);
  b.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([h, j, b, bin]);
}
test('original demo passes full archive, manifest, GLB, PNG and provenance validation', async () => {
  const mod = await validatePackage(pack());
  assert.equal(mod.manifest.id, 'asciosh-copperbloom');
  assert.equal(mod.stats.triangles, 772);
  assert.ok(mod.stats.radius < 1);
  assert.equal(mod.stats.pixels, 128 * 128);
  const proof = JSON.parse(readFileSync(new URL('PROVENANCE.json', root)));
  assert.equal(proof.files['model.glb'].sha256, createHash('sha256').update(model).digest('hex'));
  assert.equal(manifest.license, 'CC0-1.0');
});
test('manifest rejects versions, gameplay fields, missing rights and unsafe references', () => {
  for (const patch of [
    { formatVersion: 2 },
    { compatibility: 'new-runtime' },
    { species: 'unknown' },
    { license: 'unverified' },
    { rights: '' },
    { model: 'https://example.test/x.glb' },
    { damage: 900 },
    { cooldown: 0 },
    { effects: [{ type: 'script', strength: 1 }] },
    { animations: { idle: 'x', damage: 'y' } },
  ])
    assert.throws(() => validateManifest({ ...manifest, ...patch }));
  assert.throws(() => validateManifest(JSON.parse('{"__proto__":{},"formatVersion":1}')));
});
test('archive paths cannot traverse, use Windows device names, URLs or executable types', async () => {
  for (const name of [
    '../a.glb',
    'a/../../b.glb',
    '/root.glb',
    'C:/a.glb',
    'a\\b.glb',
    'https://x/a.glb',
    '%2e%2e/a.glb',
    'con.glb',
    'a/./b.glb',
    'a//b.glb',
    'a\0.glb',
  ])
    assert.throws(() => path(name), name);
  for (const name of ['run.js', 'setup.exe', 'shader.wasm', 'art.svg', 'a.dll'])
    await assert.rejects(
      () => validatePackage(pack(manifest, model, [[name, Buffer.from('data')]])),
      /file type/,
    );
});
test('ZIP rejects symlinks, duplicate names, forged offsets, corruption and expansion metadata', async () => {
  const symlink = Buffer.from(pack());
  let central = symlink.readUInt32LE(symlink.length - 6);
  symlink.writeUInt32LE(0xa1ff0000, central + 38);
  await assert.rejects(() => readArchive(bytes(symlink)), /Symlinks/);
  await assert.rejects(
    () =>
      readArchive(
        bytes(
          makeZip([
            ['x.txt', license],
            ['X.txt', license],
          ]),
        ),
      ),
    /Duplicate/,
  );
  const forged = Buffer.from(pack());
  central = forged.readUInt32LE(forged.length - 6);
  forged.writeUInt32LE(5, central + 42);
  await assert.rejects(() => readArchive(bytes(forged)), /Overlapping/);
  const bomb = Buffer.from(pack());
  central = bomb.readUInt32LE(bomb.length - 6);
  bomb.writeUInt32LE(LIMITS.extracted + 1, central + 24);
  await assert.rejects(() => readArchive(bytes(bomb)), /expansion/);
  const corrupt = Buffer.from(pack());
  corrupt[40] ^= 1;
  await assert.rejects(() => readArchive(bytes(corrupt)), /disagreement|CRC/);
  await assert.rejects(() => validatePackage(new ArrayBuffer(LIMITS.archive + 1)), /8 MiB/);
});
test('bounded DEFLATE decoding rejects a bomb despite a forged small declared size', async () => {
  const expanded = Buffer.alloc(300000, 65),
    compressed = deflateRawSync(expanded),
    name = Buffer.from('x.txt');
  const local = Buffer.alloc(30),
    central = Buffer.alloc(46),
    end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(crc32(expanded), 14);
  local.writeUInt32LE(compressed.length, 18);
  local.writeUInt32LE(16, 22);
  local.writeUInt16LE(name.length, 26);
  central.writeUInt32LE(0x02014b50);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(crc32(expanded), 16);
  central.writeUInt32LE(compressed.length, 20);
  central.writeUInt32LE(16, 24);
  central.writeUInt16LE(name.length, 28);
  const at = 30 + name.length + compressed.length;
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(46 + name.length, 12);
  end.writeUInt32LE(at, 16);
  await assert.rejects(
    () => readArchive(bytes(Buffer.concat([local, name, compressed, central, name, end]))),
    /expansion/,
  );
});
test('packages reject missing or invalid assets and undeclared files', async () => {
  await assert.rejects(() => validatePackage(pack(manifest, null)), /Missing declared/);
  await assert.rejects(() => validatePackage(pack(manifest, Buffer.from('not a model'))), /GLB/);
  await assert.rejects(() => validatePackage(pack(manifest, model, [['notes.txt', license]])), /Undeclared/);
});
test('GLB rejects URLs, extensions, root motion, cycles, malicious names and oversized geometry', async () => {
  const edits = [
    (g) => (g.buffers[0].uri = 'https://example.test/data.bin'),
    (g) => (g.images = [{ uri: 'https://example.test/a.png' }]),
    (g) => (g.images = [{ uri: 'data:image/png;base64,AAA' }]),
    (g) => (g.extensionsUsed = ['KHR_draco_mesh_compression']),
    (g) => (g.animations[0].channels[0].target.path = 'translation'),
    (g) => g.nodes[0].children.push(0),
    (g) => (g.nodes[1].name = '../parent'),
    (g) => (g.meshes[0].primitives = Array(25).fill(g.meshes[0].primitives[0])),
    (g) => (g.accessors[0].count = 999999),
  ];
  for (const edit of edits) await assert.rejects(() => validatePackage(pack(manifest, editGLB(edit))));
  await assert.rejects(
    () =>
      validatePackage(
        pack(
          manifest,
          editGLB((g, b) => b.writeFloatLE(NaN, g.bufferViews[0].byteOffset)),
        ),
      ),
    /finite/,
  );
});
test('PNG dimensions and animated/executable image formats are rejected before GPU admission', async () => {
  const huge = Buffer.from(icon);
  huge.writeUInt32BE(4096, 16);
  huge.writeUInt32BE(crc32(huge.subarray(12, 29)), 29);
  const m = { ...manifest, icon: 'bad.png' };
  await assert.rejects(
    () =>
      validatePackage(
        bytes(
          makeZip([
            ['manifest.json', Buffer.from(JSON.stringify(m))],
            ['LICENSE.txt', license],
            ['model.glb', model],
            ['bad.png', huge],
          ]),
        ),
      ),
    /PNG/,
  );
});

test('repeated mesh nodes cannot bypass rendered triangle/draw budgets', async () => {
  const repeated = editGLB((g) => {
    for (let i = 0; i < 25; i++) {
      g.nodes[0].children.push(g.nodes.length);
      g.nodes.push({ name: 'copy_' + i, mesh: 0 });
    }
  });
  await assert.rejects(() => validatePackage(pack(manifest, repeated)), /rendered geometry/);
});

test('accessor enum lookups cannot inherit prototype names or poison numeric budgets', async () => {
  for (const type of ['__proto__', 'constructor', 'toString']) {
    const crafted = editGLB((g) =>
      g.accessors.push({ bufferView: 0, componentType: 5126, count: 300001, type }),
    );
    await assert.rejects(() => validatePackage(pack(manifest, crafted)), /accessor/);
  }
});
