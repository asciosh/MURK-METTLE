const { chromium } = require('playwright');
const path = require('node:path'),
  fs = require('node:fs');
const output = process.env.ARTIFACT_DIR || path.join(require('node:os').tmpdir(), 'murk-actor-check');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  let errors = [];
  let modelRequests = 0;
  page.on('request', request => { if (request.url().endsWith('/models/survivor.glb')) modelRequests++; });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto((process.env.GAME_URL || 'http://localhost:5173') + '/tests/browser/actor-gallery.html');
  await page.waitForFunction(() => window.ready);
  await page.screenshot({ path: path.join(output, 'actors-front.png') });
  console.log('stats', await page.evaluate(() => gallery.stats()));
  console.log(
    'models',
    await page.evaluate(() => gallery.players.map((p) => p.root.getObjectByName('player-visual').userData.model)),
  );
  for (const mode of ['walk', 'run', 'aim', 'heal', 'attack', 'hit', 'death', 'pulse']) {
    await page.evaluate((m) => gallery.setMode(m), mode);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(output, `actors-${mode}.png`) });
  }
  await page.evaluate(() => {
    gallery.setMode('idle');
    gallery.camera.position.set(0, 3, 9);
    gallery.camera.lookAt(0, 1, 0);
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(output, 'actors-back.png') });
  const lifecycle = await page.evaluate(async () => {
    const { ActorAnimator, T, scene } = gallery;
    const group = new T.Group();
    scene.add(group);
    const a = new ActorAnimator(group, ['idle', 'walk', 'run', 'attack']);
    const ok = await a.load({ url: '/models/survivor.glb' });
    a.setState('walk');
    a.update(0.1);
    const clip = group.children[0];
    const pos = clip.getObjectByName('leftLeg').quaternion.toArray();
    a.dispose();
    a.dispose();
    const missing = new ActorAnimator(group, ['nonexistent']);
    const rejected = await missing.load({ url: '/models/survivor.glb' });
    missing.dispose();
    const cancelled = new ActorAnimator(group);
    const loading = cancelled.load({ url: '/models/survivor.glb' });
    cancelled.dispose();
    const late = await loading;
    return { ok, pos, rejected, late, children: group.children.length };
  });
  console.log('lifecycle', lifecycle);
  const isolated = await page.evaluate(() => {
    const [a, b] = gallery.players.map(p => p.root.getObjectByName('body'));
    return a.geometry === b.geometry && a.material !== b.material;
  });
  if (!isolated || modelRequests !== 1) throw Error('Model cache sharing or actor material isolation failed');
  if (!lifecycle.ok || lifecycle.rejected || lifecycle.late || lifecycle.children || Math.abs(lifecycle.pos[0]) < 0.001) throw Error('lifecycle regression');
  for (const species of ['lanternkin', 'emberling', 'mossback', 'stormrook', 'reedwisp'])
    for (const xp of [0, 120, 400]) {
      await page.evaluate(
        ({ species, xp }) => {
          gallery.companion.setForm(species, xp);
          gallery.companion.triggerPulse();
          gallery.companion.updateRemote(0.1, new gallery.T.Vector3(), 0, true);
          gallery.renderer.render(gallery.scene, gallery.camera);
        },
        { species, xp },
      );
    }
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => {
    gallery.renderer.setSize(innerWidth, innerHeight);
    gallery.camera.aspect = innerWidth / innerHeight;
    gallery.camera.updateProjectionMatrix();
    gallery.renderer.render(gallery.scene, gallery.camera);
  });
  await page.screenshot({
    path: path.join(output, 'actors-small-landscape.png'),
  });
  console.log('errors', errors);
  if (errors.length) throw Error(errors.join('\n'));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
