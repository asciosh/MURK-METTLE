const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [],
    requests = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => requests.push(r.url()));
  let authenticated = false;
  await page.addInitScript(() =>
    localStorage.setItem('murk-mettle-graphics', JSON.stringify({ quality: 'mobile', photo: false })),
  );
  await page.route('**/api/account/**', (route) =>
    route.fulfill({ json: authenticated ? { username: 'benchmark', revision: 0, data: null } : {} }),
  );
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    const body = (await response.text())
      .replace(/game\s*=\s*new Game\(viewport\);?/, 'game = new Game(viewport);window.__perfGame = game;')
      .replace('game.start();', 'game.start();game.renderer.setAnimationLoop(null);');
    await route.fulfill({ response, body });
  });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(200);
  if (requests.some((u) => u.includes('/game/Game.ts'))) throw Error('Game downloaded before authentication');
  authenticated = true;
  await page.goto('http://localhost:5173/?perf=1');
  await page.waitForFunction(() => window.__perfGame, { timeout: 90000 });
  await page.waitForTimeout(100);
  const result = await page.evaluate(async () => {
    const g = __perfGame;
    g.setQuality('balanced');
    g.needsPreviewFrame = true;
    let draws = 0;
    const render = g.renderScene.bind(g);
    g.renderScene = () => {
      draws++;
      render();
    };
    for (let i = 0; i < 20; i++) g.tick();
    if (draws !== 1) throw Error('Opaque title still renders continuously');
    g.renderScene = render;
    for (const s of g.world.spatial) {
      const total = [...s.cells.values()].reduce((a, c) => a + c.count, 0);
      if (total !== s.source.count) throw Error('Cell instance loss');
      for (const c of s.cells.values())
        if (c.geometry !== s.source.geometry || c.material !== s.source.material)
          throw Error('Resources not shared');
      // Compare each exact transform/color pair, including duplicate instances.
      const values = (mesh) =>
        Array.from(
          { length: mesh.count },
          (_, i) =>
            Array.from(mesh.instanceMatrix.array.slice(i * 16, i * 16 + 16)).join(',') +
            '/' +
            (mesh.instanceColor
              ? Array.from(mesh.instanceColor.array.slice(i * 3, i * 3 + 3)).join(',')
              : 'none'),
        );
      const expected = values(s.source).sort();
      const actual = [...s.cells.values()].flatMap(values).sort();
      if (expected.some((v, i) => actual[i] !== v))
        throw Error('Spatial instances changed transforms/colors');
    }
    const full = g.world.spatial.map((s) => [s.source.count, Array.from(s.source.instanceMatrix.array)]);
    g.setQuality('mobile');
    g.setQuality('balanced');
    g.world.spatial.forEach((s, i) => {
      if (s.source.count !== full[i][0] || s.source.instanceMatrix.array.some((v, j) => v !== full[i][1][j]))
        throw Error('LOD restoration changed source instances');
    });
    let wildUpdates = 0;
    for (const w of g.wildCreatures.values()) {
      const update = w.update.bind(w);
      w.update = (...args) => {
        wildUpdates++;
        update(...args);
      };
    }
    for (let i = 0; i < 60; i++) g.updateWildCreatures(1 / 60);
    if (wildUpdates >= 300 || wildUpdates < 60) throw Error('Distant animation scheduling failed');
    g.setQuality('cinematic');
    g.setQuality('mobile');
    await new Promise((r) => setTimeout(r, 100));
    if (g.effects) throw Error('Stale compositor allocated');
    g.setQuality('cinematic');
    await new Promise((r) => setTimeout(r, 100));
    if (!g.effects) throw Error('Cinematic lazy load failed');
    g.renderScene();
    g.setQuality('mobile');
    if (g.effects) throw Error('Compositor not released');
    g.renderScene();
    return { titleDraws: draws, wildUpdates, cells: g.world.spatial.reduce((a, s) => a + s.cells.size, 0) };
  });
  await page.waitForFunction(() =>
    document.querySelector('[aria-label="Development performance statistics"]')?.textContent.includes('FPS'),
  );
  await page.keyboard.press('F8');
  if (!(await page.locator('[aria-label="Development performance statistics"]').evaluate((n) => n.hidden)))
    throw Error('Profiler toggle');
  console.log(result);
  console.log(
    'dispose',
    await page.evaluate(() => {
      const g = __perfGame;
      let resets = 0;
      g.infected.resetSolo = () => resets++;
      g.dispose();
      g.dispose();
      if (resets) throw Error('Teardown recreated simulation');
      if (g.renderer.info.memory.geometries || g.renderer.info.memory.textures)
        throw Error('GPU resources retained');
      return { ...g.renderer.info.memory };
    }),
  );
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await browser.close();
  console.log(errors);
  if (errors.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
