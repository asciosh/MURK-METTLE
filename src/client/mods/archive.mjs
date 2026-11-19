import { LIMITS, path, fail, crc32, inflateBounded, validateManifest, validatePNG } from './format.mjs';
import { validateGLB } from './glb.mjs';
const decoder = new TextDecoder('utf-8', { fatal: true });
export async function readArchive(buffer, limits = LIMITS) {
  const b = new Uint8Array(buffer);
  if (b.length > limits.archive || b.length < 22) fail(`Archive exceeds ${limits.archive / 1024 / 1024} MiB or is not a ZIP`);
  const v = new DataView(buffer);
  const end = b.length - 22;
  if (
    v.getUint32(end, true) !== 0x06054b50 ||
    v.getUint16(end + 20, true) ||
    v.getUint16(end + 4, true) ||
    v.getUint16(end + 6, true)
  )
    fail('Unsupported ZIP structure');
  const count = v.getUint16(end + 10, true),
    start = v.getUint32(end + 16, true),
    size = v.getUint32(end + 12, true);
  if (!count || count > limits.files || count !== v.getUint16(end + 8, true) || start + size !== end)
    fail('Archive file count or directory exceeds limits');
  let at = start,
    total = 0,
    localEnd = 0;
  const entries = [],
    seen = new Set();
  for (let i = 0; i < count; i++) {
    if (at + 46 > end || v.getUint32(at, true) !== 0x02014b50) fail('Invalid ZIP directory');
    const flags = v.getUint16(at + 8, true),
      method = v.getUint16(at + 10, true),
      compressed = v.getUint32(at + 20, true),
      expanded = v.getUint32(at + 24, true),
      nl = v.getUint16(at + 28, true),
      el = v.getUint16(at + 30, true),
      cl = v.getUint16(at + 32, true),
      offset = v.getUint32(at + 42, true),
      crc = v.getUint32(at + 16, true),
      mode = v.getUint32(at + 38, true) >>> 16;
    if (
      at + 46 + nl + el + cl > end ||
      !nl ||
      nl > 120 ||
      v.getUint16(at + 34, true) ||
      flags & ~0x800 ||
      ![0, 8].includes(method) ||
      el ||
      cl
    )
      fail('Unsupported ZIP flags, compression or metadata');
    const name = path(decoder.decode(b.subarray(at + 46, at + 46 + nl)));
    if (seen.has(name.toLowerCase())) fail('Duplicate archive path');
    seen.add(name.toLowerCase());
    if (mode & 0xf000 && (mode & 0xf000) !== 0x8000)
      fail('Symlinks, directories and special files are forbidden');
    if (!/\.(glb|png|json|txt)$/.test(name)) fail('Unsupported archive file type');
    total += expanded;
    if (
      total > limits.extracted ||
      expanded > limits.model ||
      compressed > limits.archive ||
      (method === 0 && compressed !== expanded) ||
      (compressed === 0 && expanded)
    )
      fail('Excessive archive expansion or file size');
    if (offset !== localEnd || offset + 30 > start || v.getUint32(offset, true) !== 0x04034b50)
      fail('Overlapping or unsafe ZIP entries');
    const ln = v.getUint16(offset + 26, true),
      le = v.getUint16(offset + 28, true),
      data = offset + 30 + ln + le;
    if (
      le ||
      ln !== nl ||
      data + compressed > start ||
      v.getUint16(offset + 6, true) !== flags ||
      v.getUint16(offset + 8, true) !== method ||
      v.getUint32(offset + 14, true) !== crc ||
      v.getUint32(offset + 18, true) !== compressed ||
      v.getUint32(offset + 22, true) !== expanded ||
      decoder.decode(b.subarray(offset + 30, offset + 30 + ln)) !== name
    )
      fail('ZIP local/directory disagreement');
    entries.push({ name, method, compressed, expanded, crc, data });
    localEnd = data + compressed;
    at += 46 + nl + el + cl;
  }
  if (at !== end || localEnd !== start) fail('ZIP has unused or trailing content');
  const files = new Map();
  for (const e of entries) {
    const source = b.subarray(e.data, e.data + e.compressed),
      content = e.method === 0 ? source.slice() : await inflateBounded(source, 'deflate-raw', e.expanded);
    if (content.length !== e.expanded || crc32(content) !== e.crc) fail('ZIP size or CRC mismatch');
    files.set(e.name, content);
  }
  return files;
}
export async function validatePackage(buffer) {
  const files = await readArchive(buffer),
    manifestBytes = files.get('manifest.json'),
    license = files.get('LICENSE.txt');
  if (!manifestBytes || manifestBytes.length > 16384) fail('A bounded manifest.json is required');
  const manifest = validateManifest(JSON.parse(decoder.decode(manifestBytes)));
  if (!license || !license.length || license.length > 32768) fail('LICENSE.txt is required');
  decoder.decode(license);
  const allowed = new Set([
    'manifest.json',
    'LICENSE.txt',
    manifest.model,
    ...(manifest.textures || []),
    ...(manifest.icon ? [manifest.icon] : []),
  ]);
  for (const name of files.keys()) if (!allowed.has(name)) fail('Undeclared archive file');
  for (const name of allowed) if (!files.has(name)) fail(`Missing declared file: ${name}`);
  let pixels = 0;
  for (const name of new Set([...(manifest.textures || []), ...(manifest.icon ? [manifest.icon] : [])])) {
    pixels += await validatePNG(files.get(name), name === manifest.icon);
  }
  const model = await validateGLB(files.get(manifest.model), manifest, files);
  if (pixels + model.embeddedPixels > LIMITS.pixels) fail('Texture pixel budget exceeded');
  return {
    manifest,
    files,
    stats: { triangles: model.triangles, radius: model.radius, pixels: pixels + model.embeddedPixels },
  };
}
