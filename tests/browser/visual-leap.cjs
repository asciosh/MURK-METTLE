// Repeatable captures of the shipped Game/FieldGraphics, not a replacement lighting scene.
// Artifacts deliberately stay outside Git. No production accounts or network rooms are used.
const { launchBrowser } = require('./support.cjs');
const fs = require('node:fs');
const path = require('node:path');
const output = process.env.ARTIFACT_DIR || path.join(require('node:os').tmpdir(), 'murk-visual-leap');
const base = process.env.GAME_URL || 'http://localhost:5173';
const views = {
  forest: { eye: [0, 2.7, 7], target: [0, 1.7, -18], player: [0, 0, 1] },
  settlement: { eye: [0, 2.7, -39], target: [0, 2, -65], player: [0, 0, -45] },
  wetland: { eye: [-41, 2.7, -21], target: [-48, 1, -31], player: [-44, 0, -25] },
};
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  // The fixture uses system fonts; external font availability must not affect a graphics capture.
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.addInitScript(() => {
    localStorage.setItem('murk-mettle-graphics', JSON.stringify({ quality: 'balanced', photo: false }));
    let seed = 27027;
    Math.random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
  });
  await page.route('**/api/account/**', route => route.fulfill({ json: { username: 'visual-fixture', revision: 0, data: null } }));
  await page.route('**/src/main.ts*', async route => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(/game\s*=\s*new Game\(viewport\);?/, 'game = new Game(viewport);window.__visualGame = game;')
      .replace('game.start();', 'game.start();game.renderer.setAnimationLoop(null);');
    await route.fulfill({ response, body });
  });
  await page.goto(base);
  await page.waitForFunction(() => window.__visualGame?.player?.root.getObjectByName('body'), { timeout: 90000 });
  await page.addStyleTag({ content: '#game-viewport > :not(canvas) { visibility: hidden !important; } #title-screen, #account-screen, .topbar { display: none !important; }' });
  const report = { viewport: '1366x768', dpr: 1, quality: 'balanced', photos: false, views: {}, actors: {} };
  for (const [name, view] of Object.entries(views)) {
    report.views[name] = await page.evaluate(v => {
      const g = __visualGame;
      g.renderer.setAnimationLoop(null);
      g.player.root.position.set(...v.player);
      g.player.root.rotation.y = 0;
      g.graphics.followShadow(g.player.root.position);
      g.feedback.camera.position.set(...v.eye);
      g.feedback.camera.lookAt(...v.target);
      g.feedback.camera.aspect = innerWidth / innerHeight;
      g.feedback.camera.updateProjectionMatrix();
      for (const w of g.wildCreatures.values()) { w.elapsed = 0; w.pulseTime = 0; w.update(0, g.player.root.position, 0, g.world); }
      g.renderer.info.reset();
      g.graphics.render();
      return { ...g.renderer.info.render, memory: { ...g.renderer.info.memory } };
    }, view);
    await page.locator('.game-canvas').screenshot({ path: path.join(output, `${name}.png`) });
  }
  // Freeze the real actor gallery's animation scheduling for identical poses.
  await page.goto(base + '/tests/browser/actor-gallery.html?freeze=1');
  await page.waitForFunction(() => window.ready);
  for (const species of ['lanternkin', 'emberling', 'mossback', 'stormrook', 'reedwisp']) {
    for (const xp of [0, 120, 400]) {
      report.actors[`${species}-${xp}`] = await page.evaluate(({ species, xp }) => {
        const { companion: c, players, zombies, camera, scene, renderer, T } = gallery;
        players.forEach(p => p.root.visible = false);
        zombies.forEach(z => z.root.visible = false);
        c.setForm(species, xp);
        c.elapsed = 0;
        c.pulseTime = 0;
        c.updateRemote(0, new T.Vector3(), 0, false);
        camera.position.set(1.9, 2.3, -4.2);
        camera.lookAt(0, 1.15, 0);
        renderer.render(scene, camera);
        return gallery.stats();
      }, { species, xp });
      await page.screenshot({ path: path.join(output, `${species}-${xp}.png`) });
    }
  }
  await page.evaluate(() => {
    const { players, zombies, companion, camera, scene, renderer } = gallery;
    players.forEach(p => p.root.visible = true);
    zombies.forEach(z => z.root.visible = true);
    companion.root.visible = false;
    camera.position.set(-3, 2.4, -5.5);
    camera.lookAt(-1, 1.1, 0);
    renderer.render(scene, camera);
  });
  await page.screenshot({ path: path.join(output, 'survivors-infected.png') });
  fs.writeFileSync(path.join(output, 'metrics.json'), JSON.stringify(report, null, 2) + '\n');
  await browser.close();
  if (errors.length) throw Error(errors.join('\n'));
  console.log('Visual captures and renderer counters:', output);
})().catch(e => { console.error(e); process.exit(1); });
