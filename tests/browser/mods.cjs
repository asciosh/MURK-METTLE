const { launchBrowser } = require('./support.cjs');
const fs = require('node:fs'),
  path = require('node:path');
(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } }),
    errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() =>
    localStorage.setItem('murk-mettle-graphics', JSON.stringify({ quality: 'low', photo: false })),
  );
  await page.route('**/api/account/**', (r) =>
    r.fulfill({ json: { username: 'mods_test', revision: 0, data: null } }),
  );
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(/game\s*=\s*new Game\(viewport\);?/, 'game = new Game(viewport);window.__game = game;')
      .replace(
        'game.start();',
        'game.start();game.renderer.setAnimationLoop(null);game.requestMouseCapture=()=>{};',
      );
    await route.fulfill({ response, body });
  });
  await page.goto('http://localhost:5173');
  await page.waitForFunction(() => window.__game, { timeout: 90000 });
  await page.evaluate(async () => {
    await __game.cosmetics.ready;
    await __game.cosmetics.restoreOriginals();
    for (const id of [...__game.cosmetics.records.keys()]) await __game.cosmetics.remove(id);
    __game.tick();
  });
  await page.locator('#enter-field').click();
  await page.keyboard.press('Escape');
  await page.locator('#field-menu-toggle').click();
  await page.locator('#mods-open').click();
  await page.locator('#mods-file').setInputFiles('public/mod-examples/copperbloom.mmcosmetic');
  await page.waitForFunction(
    () => document.querySelector('#mods-status').textContent.includes('Imported and validated'),
    { timeout: 30000 },
  );
  await page.waitForFunction(() => document.querySelector('#mod-preview canvas'));
  if (await page.locator('#field-menu').evaluate((n) => !n.hidden)) throw Error('Settings overlap');
  const before = await page.evaluate(() => ({
    power: { ...__game.activePower },
    collection: JSON.stringify(__game.currentCollection),
    bond: __game.wildCreatures.get('lanternkin').canBond(__game.player.getPosition()),
  }));
  await page.locator('#mods-list').getByRole('button', { name: 'Enable', exact: true }).click();
  await page.waitForFunction(() => !!__game.wildCreatures.get('lanternkin').cosmetic);
  await page.evaluate(() => {
    const g = __game;
    g.updateWildCreatures(0.1);
    g.renderScene();
  });
  const isolation = await page.evaluate(async (before) => {
    const g = __game,
      T = await import('/node_modules/three/build/three.module.js'),
      { CoopVisuals } = await import('/src/client/game/CoopVisuals.ts');
    if (g.wildCreatures.get('lanternkin').visual.visible) throw Error('Official visual did not hide');
    if (
      JSON.stringify(g.activePower) !== JSON.stringify(before.power) ||
      JSON.stringify(g.currentCollection) !== before.collection ||
      g.wildCreatures.get('lanternkin').canBond(g.player.getPosition()) !== before.bond
    )
      throw Error('Cosmetic changed official gameplay');
    const scene = new T.Scene(),
      plain = new CoopVisuals(scene),
      local = new CoopVisuals(scene, g.cosmetics),
      state = {
        id: 'peer',
        x: 0,
        z: 0,
        yaw: 0,
        hp: 100,
        species: 'lanternkin',
        creatureOwned: true,
        creatureXp: 400,
      },
      snapshot = JSON.stringify(state);
    const peers = new Map([['peer', state]]);
    plain.updatePlayers(peers, 0.016);
    local.updatePlayers(peers, 0.016);
    await new Promise((r) => setTimeout(r, 100));
    if (plain.companions.get('peer').cosmetic || !plain.companions.get('peer').visual.visible)
      throw Error('Client without mod failed official fallback');
    if (!local.companions.get('peer').cosmetic) throw Error('Local remote-companion replacement missing');
    if (JSON.stringify(state) !== snapshot || local.companions.get('peer').speciesId !== 'lanternkin')
      throw Error('Peer identity was mutated');
    const source = g.cosmetics.sources.get('asciosh-copperbloom'),
      actors = [g.companion, g.wildCreatures.get('lanternkin')];
    for (const a of actors)
      if (a.cosmetic) {
        const meshes = [];
        a.cosmetic.root.traverse((o) => {
          if (o.isMesh) meshes.push(o);
        });
        if (
          !meshes.length ||
          meshes[0].geometry !== source.asset.scene.getObjectByName('copper_bulb').geometry
        )
          throw Error('Model geometry not cached');
      }
    const mod = {
      ...source.mod,
      manifest: { ...source.mod.manifest, animations: { idle: 'Breathe', walk: 'missing' } },
    };
    const { ModVisual } = await import('/src/client/mods/ModVisual.ts');
    let released = 0;
    const fallback = new ModVisual(source.asset, mod, () => released++);
    fallback.update(0.1, true);
    if (fallback.action?.getClip().name !== 'Breathe') throw Error('Missing animation did not use idle');
    fallback.dispose();
    fallback.dispose();
    if (released !== 1) throw Error('Visual disposal not idempotent');
    plain.clear();
    local.clear();
    return { originalPower: g.activePower, sharedGeometry: true, remoteIsolation: true };
  }, before);
  console.log(isolation);
  const output = '/tmp/murk-mods-check';
  fs.mkdirSync(output, { recursive: true });
  await page.screenshot({ path: path.join(output, 'desktop-preview.png') });
  await page.setViewportSize({ width: 1920, height: 1080 });
  if (await page.locator('#mods-dialog').evaluate((n) => n.getBoundingClientRect().right > innerWidth))
    throw Error('Wide desktop overflow');
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.locator('#mod-preview-pulse').click();
  await page.locator('#mods-list').getByRole('button', { name: 'Disable', exact: true }).click();
  await page.waitForFunction(
    () =>
      !__game.wildCreatures.get('lanternkin').cosmetic &&
      __game.wildCreatures.get('lanternkin').visual.visible,
  );
  await page.locator('#mods-close').click();
  await page.waitForFunction(() => __game.cosmetics.sources.size === 0);
  await page.locator('#field-menu-toggle').click();
  await page.locator('#mods-open').click();
  await page.locator('#mods-list').getByRole('button', { name: 'Enable', exact: true }).click();
  await page.waitForFunction(() => !!__game.wildCreatures.get('lanternkin').cosmetic);
  await page.reload();
  await page.waitForFunction(() => window.__game?.wildCreatures.get('lanternkin').cosmetic, {
    timeout: 30000,
  });
  await page.locator('#enter-field').click();
  await page.keyboard.press('Escape');
  await page.locator('#field-menu-toggle').click();
  await page.locator('#mods-open').click();
  await page.locator('#mods-list').getByRole('button', { name: 'Remove', exact: true }).click();
  await page.waitForFunction(
    () => __game.cosmetics.records.size === 0 && __game.cosmetics.sources.size === 0,
  );
  await page
    .locator('#mods-file')
    .setInputFiles({ name: 'evil.zip', mimeType: 'application/zip', buffer: Buffer.from('not a package') });
  await page.waitForFunction(() => document.querySelector('#mods-status').textContent.includes('ZIP'));
  if (await page.evaluate(() => __game.cosmetics.records.size)) throw Error('Invalid import admitted');
  await page.keyboard.press('Escape');
  if (await page.locator('#mods-dialog').evaluate((n) => n.open)) throw Error('Escape failed');
  await require('./mod-resources.cjs')(page);
  await page.evaluate(() => __game.dispose());
  // Preview at the minimum supported desktop window, using desktop input.
  const compact = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const compactPage = await compact.newPage();
  compactPage.on('pageerror', (e) => errors.push(String(e)));
  await compactPage.route('**/api/account/**', (r) => r.fulfill({ json: {} }));
  await compactPage.goto(process.env.GAME_URL || 'http://localhost:5173');
  await compactPage.evaluate(async () => {
    const { ModRegistry } = await import('/src/client/mods/ModRegistry.ts');
    const { ModManager } = await import('/src/client/mods/ModManager.ts');
    window.registry = new ModRegistry();
    window.manager = new ModManager(registry);
    document.querySelector('#auth-gate').hidden = true;
    document.querySelector('#account-panel').hidden = true;
    document.querySelector('#title-screen').classList.add('is-hidden');
    document.querySelector('#mods-open').click();
  });
  await compactPage.locator('#mods-demo').click();
  await compactPage.waitForFunction(() => document.querySelector('#mod-preview canvas'), { timeout: 30000 });
  if (await compactPage.locator('#mods-dialog').evaluate((n) => {
    const r = n.getBoundingClientRect();
    return r.left < 0 || r.right > innerWidth || r.bottom > innerHeight || r.top < 0;
  })) throw Error('Compact desktop dialog outside viewport');
  await compactPage.screenshot({ path: path.join(output, 'compact-desktop-preview.png') });
  await compactPage.locator('#mods-close').click();
  await compactPage.evaluate(() => { manager.dispose(); registry.dispose(); });
  await compact.close();
  await browser.close();
  console.log('errors', errors);
  if (errors.length) throw Error(errors.join('\n'));
  console.log(
    'Mods import/preview/enable/disable/removal, persistence, fallback, resources and local multiplayer isolation passed.',
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
