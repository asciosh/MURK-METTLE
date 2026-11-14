import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MISSION_KILLS, MISSION_SALVAGE, EXTRACTION, MAX_PLAYERS, PICKUPS, isFiniteNumber, validRoomCode, validUsername } from '../shared/coop-rules.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFile(resolve(root, path), 'utf8');

test('Cloudflare migration classes and tags are unchanged; only source path changes', async () => {
  const config = JSON.parse((await read('wrangler.jsonc')).replace(/\/\*[\s\S]*?\*\//g, ''));
  assert.equal(config.main, './server/cloudflare/index.mjs');
  assert.equal(config.name, 'murk-mettle');
  assert.deepEqual(config.durable_objects.bindings.map(b => [b.name, b.class_name]), [
    ['GAME_ROOMS', 'GameRoom'], ['PLAYER_PROFILES', 'PlayerProfile'], ['PLAYER_ACCOUNTS', 'PlayerAccount']
  ]);
  assert.deepEqual(config.migrations.map(m => m.tag), ['v1','v2','v3']);
  assert.equal(config.assets.directory, './dist');
});

test('previews provide all account and room bindings without linking production namespaces', async () => {
  const config = JSON.parse(await read('wrangler.jsonc'));
  assert.deepEqual(config.previews.durable_objects.bindings, config.durable_objects.bindings);
  for (const binding of config.previews.durable_objects.bindings) {
    assert.equal(binding.script_name, undefined);
    assert.equal(binding.environment, undefined);
    assert.ok(config.migrations.some(m => m.new_sqlite_classes?.includes(binding.class_name)));
  }
});

test('room rules reject malformed input and agree with existing solo extraction geometry', async () => {
  assert.equal(MAX_PLAYERS, 4);
  assert.equal(MISSION_KILLS, 3);
  assert.equal(MISSION_SALVAGE, 2);
  assert.equal(PICKUPS.length, 2);
  assert.equal(isFiniteNumber(Infinity), false);
  assert.equal(isFiniteNumber(1.5), true);
  assert.equal(validRoomCode('BLOOM'), true);
  assert.equal(validRoomCode('A'), false);
  assert.equal(validRoomCode('A/../B'), false);
  assert.equal(validUsername('test_user'), true);
  assert.equal(validUsername('with spaces'), false);
  const solo = await read('src/client/game/Expedition.ts');
  assert.match(solo, new RegExp(`EXTRACTION_X\\s*=\\s*${EXTRACTION.x}\\s*;`));
  assert.match(solo, new RegExp(`EXTRACTION_Z\\s*=\\s*${EXTRACTION.z}\\s*;`));
  assert.match(solo, new RegExp(`EXTRACTION_RADIUS\\s*=\\s*${EXTRACTION.radius}\\s*;`));
  assert.match(solo, new RegExp(`KILLS_REQUIRED\\s*=\\s*${MISSION_KILLS}\\s*;`));
  assert.match(solo, new RegExp(`SALVAGE_REQUIRED\\s*=\\s*${MISSION_SALVAGE}\\s*;`));
});

test('client and backend entrypoints, GLB manifest and required modules exist', async () => {
  for (const path of [
    'src/main.ts', 'src/client/game/Game.ts', 'src/client/game/CoopVisuals.ts',
    'src/client/ui/HudLayout.ts', 'src/styles.css', 'src/styles/polish.css',
    'server/cloudflare/index.mjs', 'server/cloudflare/room.mjs',
    'server/cloudflare/account.mjs', 'server/cloudflare/profile.mjs',
    'server/local/index.mjs', 'scripts/dev.mjs', 'public/models/survivor.glb'
  ]) await access(resolve(root, path));
  const dev = await read('scripts/dev.mjs');
  assert.match(dev, /spawn\(bin\('wrangler'\)/);
  assert.match(dev, /'build', '--watch'/);
  assert.match(await read('src/main.ts'), /client\/game\/Game/);
  assert.doesNotMatch(await read('src/main.ts'), /\.\/game\/Game/);
});

test('stylesheets preserve the original CSS order and remain balanced', async () => {
  const stylesheet = await read('src/styles.css');
  const ordered = [...stylesheet.matchAll(/@import '\.\/styles\/([^']+)'/g)].map(m => m[1]);
  assert.deepEqual(ordered, ['foundation.css','components.css','screens.css','polish.css','touch.css']);
  for (const file of ordered) {
    const css = await read('src/styles/' + file);
    let count = 0;
    for (const c of css) {
      if (c === '{') count++;
      if (c === '}') count--;
      assert.ok(count >= 0, `${file} closes a block too early`);
    }
    assert.equal(count, 0, `${file} has an incomplete CSS block`);
  }
});
