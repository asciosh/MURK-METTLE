import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { qualityId, renderProfile, RENDER_PROFILES } from '../shared/render-profile.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (file) => readFile(resolve(root, file), 'utf8');
async function walk(dir) {
  const entries = await readdir(resolve(root, dir), { withFileTypes: true });
  return (await Promise.all(entries.map(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : [`${dir}/${e.name}`]))).flat();
}

test('one canonical client/Worker tree and complete local Worker command remain', async () => {
  for (const path of ['src/game', 'worker', 'server/index.mjs', 'server/local', 'src/client/game/TouchControls.ts', 'src/styles/touch.css'])
    await assert.rejects(access(resolve(root, path)), { code: 'ENOENT' });
  const pkg = JSON.parse(await read('package.json'));
  assert.equal(pkg.scripts.server, 'npm run dev:cloudflare');
  assert.match(pkg.scripts['dev:cloudflare'], /npm run build && wrangler dev/);
  assert.equal(pkg.dependencies.ws, undefined);
  assert.equal(pkg.devDependencies['@types/ws'], undefined);
  for (const file of await walk('src')) {
    if (!/\.(ts|mjs|css)$/.test(file)) continue;
    assert.doesNotMatch(await read(file), /touch-mode|touch-journal|TouchControls|setTouchAction|data-touch|control-mode/);
  }
});

test('all relative client imports and worker entry URLs resolve after consolidation', async () => {
  for (const file of await walk('src')) {
    if (!/\.(ts|mjs)$/.test(file)) continue;
    const source = await read(file);
    const refs = [...source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*|new URL\(\s*)['"](\.[^'"]+)['"]/g)].map(m => m[1]);
    for (const ref of refs) {
      const candidates = ['', '.ts', '.mjs', '.json', '.css'].map(ext => resolve(root, dirname(file), ref + ext));
      const results = await Promise.allSettled(candidates.map(p => access(p)));
      assert.ok(results.some(r => r.status === 'fulfilled'), `${file}: missing ${ref}`);
    }
  }
});

test('dynamic model, mod and desktop assets remain available with licensing', async () => {
  const manifest = JSON.parse(await read('public/models/manifest.json'));
  for (const entry of Object.values(manifest)) {
    assert.match(entry.url, /^\/models\/[^/]+\.glb$/);
    await access(resolve(root, 'public' + entry.url));
  }
  for (const file of [
    'public/models/README.md', 'public/mod-examples/copperbloom.mmcosmetic',
    'examples/creature-mods/copperbloom/model.glb', 'examples/creature-mods/copperbloom/icon.png',
    'examples/creature-mods/copperbloom/LICENSE.txt', 'examples/creature-mods/copperbloom/PROVENANCE.json',
    'src/client/mods/validate.worker.ts', 'desktop/src-tauri/src/network-status.js',
    'desktop/src-tauri/icons/icon.ico', 'desktop/src-tauri/icons/icon.png', 'desktop/art/lantern.svg',
  ]) await access(resolve(root, file));
  assert.match(await read('src/client/mods/ValidateImport.ts'), /new URL\('\.\/validate\.worker\.ts', import.meta.url\)/);
  assert.match(await read('src/client/mods/ModManager.ts'), /mod-examples\/copperbloom\.mmcosmetic/);
  const headers = await read('public/_headers');
  assert.match(headers, /\/assets\/\*[\s\S]*immutable/);
  assert.match(headers, /\/models\/\*[\s\S]*must-revalidate/);
});

test('desktop quality selection retires Mobile without breaking stored local preferences', () => {
  assert.deepEqual(Object.keys(RENDER_PROFILES).sort(), ['balanced', 'cinematic', 'low']);
  for (const id of ['low', 'balanced', 'cinematic']) assert.equal(qualityId(id), id);
  assert.equal(qualityId('mobile'), 'low');
  assert.equal(renderProfile('mobile'), renderProfile('low'));
  for (const id of [undefined, null, '', '__proto__', 'constructor', 1, {}, []]) assert.equal(qualityId(id), 'balanced');
});

test('every client runtime module is reachable from the boot or static validation worker graph', async () => {
  const visited = new Set();
  async function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const source = await read(file);
    for (const m of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*|new URL\(\s*)['"](\.[^'"]+)['"]/g)) {
      const base = resolve(root, dirname(file), m[1]);
      for (const ext of ['', '.ts', '.mjs', '.json', '.css']) {
        try {
          const resolved = base + ext;
          await access(resolved);
          const path = relative(root, resolved).split(sep).join('/');
          if (/\.(ts|mjs)$/.test(path)) await visit(path);
          break;
        } catch (error) {
          if (error.code !== 'ENOENT') throw error;
        }
      }
    }
  }
  await visit('src/main.ts');
  const files = (await walk('src')).filter(f => /\.(ts|mjs)$/.test(f) && !f.endsWith('.d.ts'));
  assert.deepEqual(files.filter(f => !visited.has(f)), []);
});

test('documentation local links resolve after archival moves', async () => {
  const files = ['README.md', ...(await walk('docs')), ...(await walk('desktop/art')), 'desktop/README.md', 'public/models/README.md', ...(await walk('examples'))].filter(f => f.endsWith('.md'));
  for (const file of files) {
    const source = await read(file);
    for (const match of source.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const url = match[1];
      if (/^(?:[a-z]+:|\/|#)/i.test(url)) continue;
      const path = url.split('#')[0];
      if (path) await assert.doesNotReject(access(resolve(root, dirname(file), path)), `${file}: ${url}`);
    }
  }
});
