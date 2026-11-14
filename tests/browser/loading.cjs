// Run against the built Worker or Vite preview, not the source development server.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const requests = [],
    errors = [];
  let authenticated = false;
  page.on('request', (r) => requests.push(r.url()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() =>
    localStorage.setItem('murk-mettle-graphics', JSON.stringify({ quality: 'mobile', photo: false })),
  );
  await page.route('**/api/account/**', (r) =>
    r.fulfill({ json: authenticated ? { username: 'benchmark', revision: 0, data: null } : {} }),
  );
  const url = process.env.GAME_URL || 'http://localhost:8787';
  await page.goto(url + '/?perf=1');
  await page.waitForTimeout(300);
  if (requests.some((u) => /\/(Game|three-core|SceneEffects)-.*\.js/.test(u)))
    throw Error('Engine downloaded at login');
  authenticated = true;
  await page.reload();
  await page.waitForFunction(
    () => document.querySelector('#game-load-status').textContent.includes('Field ready'),
    { timeout: 90000 },
  );
  if (!requests.some((u) => /\/Game-.*\.js/.test(u)) || !requests.some((u) => /\/three-core-.*\.js/.test(u)))
    throw Error('Game chunks missing');
  if (requests.some((u) => /\/SceneEffects-.*\.js/.test(u))) throw Error('Cinematic downloaded on Mobile');
  if (await page.locator('[aria-label="Development performance statistics"]').count())
    throw Error('Profiler shipped in production');
  const cinematicResponse = page.waitForResponse((r) => /\/SceneEffects-.*\.js/.test(r.url()));
  await page.evaluate(() => {
    const select = document.querySelector('#graphics-quality');
    select.value = 'cinematic';
    select.dispatchEvent(new Event('change'));
  });
  await cinematicResponse;
  await page.waitForTimeout(250);
  if (errors.length) throw Error(errors.join('\n'));
  console.log(
    'Production: login defers engine; authenticated field loads; Cinematic loads on demand; no development panel/errors.',
  );
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
