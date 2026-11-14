// Same static actual-Game workload before/after. Timings are synchronized software-WebGL wall time, not device FPS.
const { chromium } = require('playwright');
const fs = require('node:fs'),
  path = require('node:path');
const destination = process.env.PERF_OUTPUT || path.join(require('node:os').tmpdir(), 'murk-performance.json');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error' && m.text().includes('THREE')) errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem('murk-mettle-graphics', JSON.stringify({ quality: 'mobile', photo: false })),
  );
  await page.route('**/api/account/**', (r) => r.fulfill({ json: { username: 'benchmark', revision: 0, data: null } }));
  await page.route('**/src/main.ts*', async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    body = body
      .replace(/game\s*=\s*new Game\(viewport\);?/, 'game = new Game(viewport);window.__perfGame = game;')
      .replace('game.start();', 'game.start();game.renderer.setAnimationLoop(null);');
    await route.fulfill({ response, body });
  });
  await page.goto(process.env.GAME_URL || 'http://localhost:5173');
  await page.waitForFunction(() => window.__perfGame, { timeout: 90000 });
  await page.waitForTimeout(300);
  const hardware = await page.evaluate(() => {
    const gl = __perfGame.renderer.getContext();
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      userAgent: navigator.userAgent,
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable',
      viewport: [innerWidth, innerHeight],
      pixelRatio: devicePixelRatio,
    };
  });
  const cases = [];
  for (const preset of ['mobile', 'balanced'])
    for (const scene of ['camp', 'haven']) {
      const sample = await page.evaluate(
        async ({ preset, scene }) => {
          const g = window.__perfGame;
          g.renderer.setAnimationLoop(null);
          g.setQuality(preset);
          const z = scene === 'camp' ? 0 : -38;
          g.player.root.position.set(0, 0, z);
          g.cameraYaw = 0;
          g.cameraPitch = 0.2;
          g.updateCamera(1);
          g.feedback.reset();
          g.renderDelta = 1 / 60;
          const gl = g.renderer.getContext();
          for (let i = 0; i < 2; i++) {
            g.renderScene();
            gl.finish();
          }
          const times = [];
          for (let i = 0; i < 5; i++) {
            const start = performance.now();
            g.renderScene();
            gl.finish();
            times.push(performance.now() - start);
          }
          const sorted = [...times].sort((a, b) => a - b);
          return {
            preset,
            scene,
            timesMs: times,
            medianMs: sorted[2],
            calls: g.renderer.info.render.calls,
            triangles: g.renderer.info.render.triangles,
            geometries: g.renderer.info.memory.geometries,
            textures: g.renderer.info.memory.textures,
          };
        },
        { preset, scene },
      );
      cases.push(sample);
      console.log(sample);
    }
  const hud = await page.evaluate(() => {
    const g = __perfGame;
    const observer = new MutationObserver(() => {});
    observer.observe(document.querySelector('#app'), {
      subtree: true,
      attributes: true,
      childList: true,
      characterData: true,
    });
    const start = performance.now();
    for (let i = 0; i < 120; i++) {
      g.updateHud(0.1);
      g.firearms.update(0);
    }
    const ms = performance.now() - start;
    const mutations = observer.takeRecords().length;
    observer.disconnect();
    return { iterations: 120, mutations, ms };
  });
  console.log('hud', hud);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(
    destination,
    JSON.stringify(
      {
        hardware,
        scenario:
          'actual Game stationary camp/haven, no simulation/network, photo off; 2 warmups + 5 gl.finish samples',
        cases,
        hud,
        errors,
      },
      null,
      2,
    ),
  );
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await browser.close();
  if (errors.length) throw Error(errors.join('\n'));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
