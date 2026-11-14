import { SPECIES_IDS } from '../../../shared/expansion.mjs';
export const LIMITS = Object.freeze({
  archive: 8 * 1024 * 1024,
  extracted: 16 * 1024 * 1024,
  files: 16,
  model: 6 * 1024 * 1024,
  image: 2 * 1024 * 1024,
  dimension: 1024,
  pixels: 4 * 1024 * 1024,
  triangles: 12000,
  vertices: 24000,
  nodes: 64,
  primitives: 24,
  materials: 16,
  clips: 12,
  keys: 2048,
  storedMods: 8,
});
export const LICENSES = Object.freeze(['CC0-1.0', 'CC-BY-4.0', 'MIT', 'Apache-2.0']);
export const STATES = Object.freeze(['idle', 'walk', 'run', 'pulse', 'hit']);
export function fail(message) {
  throw new Error(message);
}
export function object(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`Invalid ${label}`);
  for (const k of Object.keys(value))
    if (!keys.includes(k)) fail(`Unsupported ${label} field: ${k.slice(0, 48)}`);
  return value;
}
export function text(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f]/.test(value))
    fail(`Invalid ${label}`);
  return value;
}
export function path(value) {
  if (
    typeof value !== 'string' ||
    value.length > 120 ||
    !value ||
    !/^[a-zA-Z0-9_./-]+$/.test(value) ||
    value.startsWith('/') ||
    value.split('/').some((p) => !p || p === '.' || p === '..')
  )
    fail('Unsafe archive path');
  if (
    value.split('/').some((p) => /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p) || p.endsWith('.'))
  )
    fail('Unsafe Windows path');
  return value;
}
export function validateManifest(raw) {
  const m = object(
    raw,
    [
      'formatVersion',
      'id',
      'name',
      'version',
      'author',
      'license',
      'attribution',
      'rights',
      'compatibility',
      'species',
      'model',
      'textures',
      'icon',
      'animations',
      'effects',
    ],
    'manifest',
  );
  if (m.formatVersion !== 1 || m.compatibility !== 'creature-cosmetics-v1')
    fail('Unsupported cosmetic format or compatibility version');
  if (
    typeof m.id !== 'string' ||
    !/^[-a-z0-9]{3,64}$/.test(m.id) ||
    ['__proto__', 'constructor', 'prototype'].includes(m.id)
  )
    fail('Invalid mod ID');
  text(m.name, 64, 'name');
  text(m.author, 80, 'author');
  text(m.attribution, 512, 'attribution');
  if (typeof m.version !== 'string' || !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(m.version))
    fail('Invalid mod version');
  if (!LICENSES.includes(m.license) || !['original', 'licensed'].includes(m.rights))
    fail('Identify original/licensed rights and a supported redistribution license');
  if (!SPECIES_IDS.includes(m.species)) fail('Unknown official creature species');
  if (!path(m.model).endsWith('.glb')) fail('Model must be a GLB');
  if (m.textures !== undefined && (!Array.isArray(m.textures) || m.textures.length > 4))
    fail('At most four PNG textures');
  if (m.textures && new Set(m.textures).size !== m.textures.length) fail('Duplicate texture paths');
  for (const image of [...(m.textures || []), ...(m.icon ? [m.icon] : [])])
    if (!path(image).endsWith('.png')) fail('Images must be PNG');
  if (m.icon !== undefined) path(m.icon);
  if (m.animations !== undefined) {
    object(m.animations, STATES, 'animation mapping');
    for (const name of Object.values(m.animations)) text(name, 48, 'animation clip name');
  }
  if (m.effects !== undefined) {
    if (!Array.isArray(m.effects) || m.effects.length > 1) fail('At most one cosmetic effect');
    for (const effect of m.effects) {
      object(effect, ['type', 'strength'], 'effect');
      if (
        effect.type !== 'pulse-glow' ||
        !Number.isFinite(effect.strength) ||
        effect.strength < 0 ||
        effect.strength > 1
      )
        fail('Unsupported cosmetic effect');
    }
  }
  return m;
}
export const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
};
export async function inflateBounded(bytes, format, maximum) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  const reader = stream.getReader(),
    parts = [];
  let count = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      count += value.length;
      if (count > maximum) fail('Excessive archive/image expansion');
      parts.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const result = new Uint8Array(count);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}
export async function validatePNG(bytes, icon = false) {
  if (
    bytes.length > (icon ? 256 * 1024 : LIMITS.image) ||
    bytes.length < 45 ||
    [137, 80, 78, 71, 13, 10, 26, 10].some((b, i) => bytes[i] !== b)
  )
    fail('Invalid or oversized PNG');
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let at = 8,
    width = 0,
    height = 0,
    channels = 0,
    ended = false;
  const data = [];
  const ancillary = new Set();
  while (at < bytes.length) {
    if (at + 12 > bytes.length) fail('Truncated PNG');
    const n = v.getUint32(at),
      type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    if (n > LIMITS.image || at + 12 + n > bytes.length) fail('Invalid PNG chunk');
    if (crc32(bytes.subarray(at + 4, at + 8 + n)) !== v.getUint32(at + 8 + n)) fail('PNG CRC mismatch');
    if (at === 8 && type !== 'IHDR') fail('PNG header missing');
    if (type === 'IHDR') {
      if (at !== 8 || n !== 13) fail('Invalid PNG header');
      width = v.getUint32(at + 8);
      height = v.getUint32(at + 12);
      const color = bytes[at + 17];
      channels = color === 6 ? 4 : color === 2 ? 3 : 0;
      const max = icon ? 256 : LIMITS.dimension;
      if (
        !width ||
        !height ||
        width > max ||
        height > max ||
        !channels ||
        bytes[at + 16] !== 8 ||
        bytes[at + 18] ||
        bytes[at + 19] ||
        bytes[at + 20]
      )
        fail('PNG must be bounded, 8-bit RGB/RGBA and non-interlaced');
    } else if (type === 'IDAT') {
      data.push(bytes.subarray(at + 8, at + 8 + n));
    } else if (type === 'IEND') {
      if (n || !data.length) fail('Invalid PNG end');
      ended = true;
      at += 12;
      break;
    } else {
      if (!['sRGB', 'gAMA', 'cHRM', 'pHYs'].includes(type)) fail('Unsupported PNG chunk');
      if (data.length || ancillary.has(type)) fail('Invalid PNG ancillary order');
      ancillary.add(type);
      if (
        (type === 'sRGB' && (n !== 1 || bytes[at + 8] > 3)) ||
        (type === 'gAMA' && (n !== 4 || !v.getUint32(at + 8))) ||
        (type === 'cHRM' && n !== 32) ||
        (type === 'pHYs' && (n !== 9 || bytes[at + 16] > 1))
      )
        fail('Invalid PNG ancillary data');
    }
    at += n + 12;
  }
  if (!ended || at !== bytes.length) fail('PNG has trailing or missing data');
  const compressed = new Uint8Array(data.reduce((s, b) => s + b.length, 0));
  let offset = 0;
  for (const b of data) {
    compressed.set(b, offset);
    offset += b.length;
  }
  const row = width * channels + 1,
    decoded = await inflateBounded(compressed, 'deflate', row * height);
  if (decoded.length !== row * height) fail('Malformed PNG pixel data');
  for (let y = 0; y < height; y++) if (decoded[y * row] > 4) fail('Invalid PNG filter');
  return width * height;
}
