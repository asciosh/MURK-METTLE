// Original project asset authoring; no Blender rig, provider jobs or third-party art.
import * as THREE from 'three';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { crc32 } from '../src/client/mods/format.mjs';
import { makeZip } from './cosmetic-zip.mjs';
const folder = new URL('../examples/creature-mods/copperbloom/', import.meta.url),
  publicFolder = new URL('../public/mod-examples/', import.meta.url);
mkdirSync(folder, { recursive: true });
mkdirSync(publicFolder, { recursive: true });
const manifest = {
  formatVersion: 1,
  id: 'asciosh-copperbloom',
  name: 'Copperbloom',
  version: '1.0.0',
  author: 'asciosh / MURK & METTLE',
  license: 'CC0-1.0',
  attribution: 'Original Copperbloom geometry, animation and icon authored in source for MURK & METTLE.',
  rights: 'original',
  compatibility: 'creature-cosmetics-v1',
  species: 'lanternkin',
  model: 'model.glb',
  icon: 'icon.png',
  animations: { idle: 'Breathe', walk: 'Rustle', run: 'Rustle', pulse: 'Unfurl' },
  effects: [{ type: 'pulse-glow', strength: 0.7 }],
};
const license =
  'Copperbloom original demonstration asset\n\nCopyright and related rights waived by asciosh under CC0 1.0 Universal, to the extent permitted by law. You may use, modify and redistribute this original model, node animation and icon, including commercially, without attribution or permission. No warranty is provided.\n\nCC0 1.0 Universal: https://creativecommons.org/publicdomain/zero/1.0/\nLegal code: https://creativecommons.org/publicdomain/zero/1.0/legalcode\n\nThis dedication applies to this original demo asset, not to the game engine or third-party dependencies. No franchise assets, reference models, downloaded textures or paid generation services were used.\n';
const chunks = [],
  views = [],
  accessors = [];
let offset = 0;
function append(array, type, count, componentType, min, max) {
  const raw = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  const view = views.length;
  views.push({ buffer: 0, byteOffset: offset, byteLength: raw.length });
  chunks.push(raw);
  offset += raw.length;
  const pad = (4 - (offset % 4)) % 4;
  if (pad) {
    chunks.push(Buffer.alloc(pad));
    offset += pad;
  }
  const a = { bufferView: view, componentType, count, type };
  if (min) a.min = min;
  if (max) a.max = max;
  accessors.push(a);
  return accessors.length - 1;
}
const materials = [
  ['copper', [0.43, 0.24, 0.12, 1], 0.28],
  ['verdigris', [0.19, 0.48, 0.39, 1], 0.06],
  ['dark', [0.055, 0.09, 0.075, 1], 0],
  ['nectar', [0.65, 0.88, 0.52, 1], 0],
].map(([name, color, metal]) => ({
  name,
  pbrMetallicRoughness: { baseColorFactor: color, metallicFactor: metal, roughnessFactor: 0.7 },
  ...(name === 'nectar' ? { emissiveFactor: [0.22, 0.4, 0.09] } : {}),
}));
const meshes = [],
  nodes = [{ name: 'copperbloom', children: [] }];
let triangleCount = 0;
function part(name, geometry, material, translation = [0, 0, 0]) {
  const pos = geometry.getAttribute('position'),
    normal = geometry.getAttribute('normal');
  const box = new THREE.Box3().setFromBufferAttribute(pos);
  const attrs = {
    POSITION: append(
      new Float32Array(pos.array),
      'VEC3',
      pos.count,
      5126,
      box.min.toArray(),
      box.max.toArray(),
    ),
    NORMAL: append(new Float32Array(normal.array), 'VEC3', normal.count, 5126),
  };
  if (geometry.getAttribute('uv')) {
    const uv = geometry.getAttribute('uv');
    attrs.TEXCOORD_0 = append(new Float32Array(uv.array), 'VEC2', uv.count, 5126);
  }
  const indices = geometry.index
    ? new Uint16Array(geometry.index.array)
    : Uint16Array.from({ length: pos.count }, (_, i) => i);
  const index = append(indices, 'SCALAR', indices.length, 5123);
  triangleCount += indices.length / 3;
  meshes.push({ name, primitives: [{ attributes: attrs, indices: index, material }] });
  const id = nodes.length;
  nodes.push({ name, mesh: meshes.length - 1, translation });
  nodes[0].children.push(id);
  geometry.dispose();
  return id;
}
part('copper_bulb', new THREE.IcosahedronGeometry(0.31, 2).scale(0.88, 1.22, 0.85), 0);
part('heart', new THREE.OctahedronGeometry(0.14).scale(0.8, 1.25, 0.55), 3, [0, 0.01, -0.265]);
for (const side of [-1, 1])
  part('eye_' + (side < 0 ? 'l' : 'r'), new THREE.IcosahedronGeometry(0.035, 1).scale(0.8, 1, 0.5), 2, [
    side * 0.11,
    0.23,
    -0.22,
  ]);
part('stem', new THREE.CylinderGeometry(0.035, 0.055, 0.2, 6), 1, [0, -0.43, 0]);
const petals = [];
for (let i = 0; i < 5; i++) {
  const a = (i * Math.PI * 2) / 5;
  const g = new THREE.SphereGeometry(0.2, 8, 6).scale(0.45, 1.25, 0.22).rotateY(-a);
  const id = part('petal_' + i, g, i % 2 ? 0 : 1, [Math.cos(a) * 0.17, 0.38, Math.sin(a) * 0.17]);
  petals.push(id);
}
const animations = [];
for (const [name, duration, amount] of [
  ['Breathe', 2, 0.08],
  ['Rustle', 0.8, 0.2],
  ['Unfurl', 0.65, 0.5],
]) {
  const times = new Float32Array([0, duration / 2, duration]),
    input = append(times, 'SCALAR', 3, 5126, [0], [duration]);
  const samplers = [],
    channels = [];
  for (const [i, id] of petals.entries()) {
    const a = (i * Math.PI * 2) / 5,
      axis = new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)),
      q = new THREE.Quaternion().setFromAxisAngle(axis, amount);
    const output = append(new Float32Array([0, 0, 0, 1, ...q.toArray(), 0, 0, 0, 1]), 'VEC4', 3, 5126);
    samplers.push({ input, output, interpolation: 'LINEAR' });
    channels.push({ sampler: samplers.length - 1, target: { node: id, path: 'rotation' } });
  }
  animations.push({ name, samplers, channels });
}
const bin = Buffer.concat(chunks),
  gltf = {
    asset: { version: '2.0', generator: 'MURK-METTLE original Copperbloom source exporter' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes,
    meshes,
    materials,
    animations,
    accessors,
    bufferViews: views,
    buffers: [{ byteLength: bin.length }],
  };
let json = Buffer.from(JSON.stringify(gltf));
json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
const header = Buffer.alloc(20);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(28 + json.length + bin.length, 8);
header.writeUInt32LE(json.length, 12);
header.writeUInt32LE(0x4e4f534a, 16);
const bh = Buffer.alloc(8);
bh.writeUInt32LE(bin.length);
bh.writeUInt32LE(0x004e4942, 4);
const model = Buffer.concat([header, json, bh, bin]);
function pngChunk(type, bytes) {
  const name = Buffer.from(type),
    length = Buffer.alloc(4),
    crc = Buffer.alloc(4);
  length.writeUInt32BE(bytes.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
  return Buffer.concat([length, name, bytes, crc]);
}
const dim = 128,
  rgba = Buffer.alloc((dim * 4 + 1) * dim);
for (let y = 0; y < dim; y++)
  for (let x = 0; x < dim; x++) {
    const u = (x - 64) / 64,
      v = (y - 64) / 64,
      r = Math.hypot(u, v),
      leaf = Math.abs(u) < 0.36 * (1 - Math.abs(v * 1.4)) && Math.abs(v) < 0.65;
    const ring = r > 0.77 && r < 0.84;
    const color = leaf ? [175, 224, 150, 255] : ring ? [174, 119, 66, 255] : [18, 35, 29, 255];
    const at = y * (dim * 4 + 1) + 1 + x * 4;
    for (let c = 0; c < 4; c++) rgba[at + c] = color[c];
  }
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(dim);
ihdr.writeUInt32BE(dim, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const icon = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk('IHDR', ihdr),
  pngChunk('IDAT', deflateSync(rgba)),
  pngChunk('IEND', Buffer.alloc(0)),
]);

const files = [
  ['manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n')],
  ['LICENSE.txt', Buffer.from(license)],
  ['model.glb', model],
  ['icon.png', icon],
];
for (const [name, bytes] of files) writeFileSync(new URL(name, folder), bytes);
const archive = makeZip(files);
writeFileSync(new URL('copperbloom.mmcosmetic', publicFolder), archive);
const sha = (b) => createHash('sha256').update(b).digest('hex');
writeFileSync(
  new URL('PROVENANCE.json', folder),
  JSON.stringify(
    {
      author: manifest.author,
      license: 'CC0-1.0',
      source: 'scripts/build-demo-cosmetic.mjs',
      tools: { node: process.versions.node, three: THREE.REVISION, zlib: process.versions.zlib },
      sourceHashes: {
        generator: sha(readFileSync(new URL(import.meta.url))),
        zipWriter: sha(readFileSync(new URL('./cosmetic-zip.mjs', import.meta.url))),
      },
      production:
        'Original mathematical geometry, palette, node rotations and raster icon; no professional skeletal rig or external asset generation claimed.',
      triangles: triangleCount,
      files: Object.fromEntries(files.map(([n, b]) => [n, { bytes: b.length, sha256: sha(b) }])),
      archive: { bytes: archive.length, sha256: sha(archive) },
    },
    null,
    2,
  ) + '\n',
);
console.log({ triangles: triangleCount, glbBytes: model.length, archiveBytes: archive.length });
