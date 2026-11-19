import { readArchive } from '../../client/mods/archive.mjs';
import { fail, object, path, text, LICENSES, validatePNG } from '../../client/mods/format.mjs';

// Separate NEXTGEN import format. Legacy GLB package bounds remain unchanged.
export const SPRITE_PACK_LIMITS = Object.freeze({ archive: 24 * 1024 * 1024,
  extracted: 48 * 1024 * 1024, files: 130, model: 2 * 1024 * 1024, entries: 128, pixels: 32 * 1024 * 1024 });
const states = ['idle', 'walk', 'attack', 'pulse', 'hit', 'faint'];
const integer = (n, lo, hi) => Number.isSafeInteger(n) && n >= lo && n <= hi;
const safeId = value => typeof value === 'string' && /^[a-z][a-z0-9_-]{1,63}$/.test(value) &&
  !['constructor', 'prototype', '__proto__'].includes(value);

export function validateSpriteManifest(raw) {
  const m = object(raw, ['formatVersion', 'compatibility', 'id', 'name', 'version', 'author', 'license', 'rights', 'attribution', 'entries'], 'sprite pack');
  if (m.formatVersion !== 2 || m.compatibility !== 'nextgen-sprite-pack-v2') fail('Unsupported sprite pack format');
  if (!safeId(m.id) || typeof m.version !== 'string' || !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(m.version)) fail('Invalid pack ID or version');
  text(m.name, 64, 'pack name'); text(m.author, 80, 'author'); text(m.attribution, 512, 'attribution');
  if (!LICENSES.includes(m.license) || !['original', 'licensed'].includes(m.rights)) fail('Original/licensed rights and redistribution license required');
  if (!Array.isArray(m.entries) || !integer(m.entries.length, 1, SPRITE_PACK_LIMITS.entries)) fail('Sprite pack must contain 1–128 appearances');
  const keys = new Set();
  for (const entry of m.entries) {
    object(entry, ['key', 'sprite', 'columns', 'rows', 'height', 'animations'], 'appearance');
    if (!safeId(entry.key) || keys.has(entry.key)) fail('Duplicate or invalid appearance key');
    keys.add(entry.key);
    if (!path(entry.sprite).endsWith('.png')) fail('Sprite sheet must be PNG');
    if (!integer(entry.columns, 1, 16) || !integer(entry.rows, 1, 16) || entry.columns * entry.rows > 128) fail('Invalid sprite frame grid');
    if (!Number.isFinite(entry.height) || entry.height < 0.25 || entry.height > 2.5) fail('Sprite height must be 0.25–2.5 metres');
    object(entry.animations, states, 'sprite animations');
    if (!Object.hasOwn(entry.animations, 'idle')) fail('Idle animation is required');
    for (const track of Object.values(entry.animations)) {
      object(track, ['start', 'count', 'fps'], 'sprite track');
      if (!integer(track.start, 0, entry.columns * entry.rows - 1) || !integer(track.count, 1, 64) ||
        track.start + track.count > entry.columns * entry.rows || !integer(track.fps, 1, 24)) fail('Sprite animation outside sheet or frame-rate limit');
    }
  }
  return m;
}

export async function validateSpritePack(buffer) {
  const files = await readArchive(buffer, SPRITE_PACK_LIMITS), decoder = new TextDecoder('utf-8', { fatal: true });
  const meta = files.get('manifest.json'), license = files.get('LICENSE.txt');
  if (!meta || meta.length > 131072 || !license || !license.length || license.length > 32768) fail('Bounded manifest.json and LICENSE.txt required');
  decoder.decode(license);
  const manifest = validateSpriteManifest(JSON.parse(decoder.decode(meta)));
  const images = new Set(manifest.entries.map(e => e.sprite));
  const allowed = new Set(['manifest.json', 'LICENSE.txt', ...images]);
  for (const name of files.keys()) if (!allowed.has(name)) fail('Undeclared archive file');
  let pixels = 0;
  const dimensions = new Map();
  for (const name of images) {
    const bytes = files.get(name); if (!bytes) fail('Missing declared sprite: ' + name);
    pixels += await validatePNG(bytes);
    if (pixels > SPRITE_PACK_LIMITS.pixels) fail('Sprite pack pixel budget exceeded');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    dimensions.set(name, { width: view.getUint32(16), height: view.getUint32(20) });
  }
  for (const entry of manifest.entries) {
    const { width, height } = dimensions.get(entry.sprite);
    if (width % entry.columns || height % entry.rows || width / entry.columns < 8 || height / entry.rows < 8) fail('Sprite sheet does not divide into valid frames');
  }
  return { manifest, files, dimensions, pixels };
}

// A pack can describe future keys, but only a trusted existing creature can request one.
export function spriteAppearanceKey(species, xp) {
  const stage = xp >= 400 ? 3 : xp >= 120 ? 2 : 1;
  return stage === 1 ? species : `${species}-${stage}`;
}
export function resolveSpriteEntry(manifest, species, xp = 0) {
  const exact = spriteAppearanceKey(species, xp);
  return manifest.entries.find(e => e.key === exact) ?? manifest.entries.find(e => e.key === species);
}
export function spriteFrame(entry, state, seconds, loop = true) {
  const track = entry.animations[state] ?? entry.animations.idle;
  const elapsed = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
  const frame = Math.floor(elapsed * track.fps);
  const index = track.start + (loop ? frame % track.count : Math.min(track.count - 1, frame));
  return { column: index % entry.columns, row: Math.floor(index / entry.columns) };
}
