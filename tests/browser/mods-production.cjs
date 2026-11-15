// Smoke the compiled worker and preview chunks against a local Worker or Vite preview.
const { launchBrowser } = require('./support.cjs');
(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } }),
    errors = [],
    requests = [];
  page.on('worker', (w) => requests.push(w.url()));
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('request', (r) => requests.push(r.url()));
  await page.addInitScript(() =>
    localStorage.setItem('murk-mettle-graphics', JSON.stringify({ quality: 'low', photo: false })),
  );
  await page.route('**/api/account/**', (r) =>
    r.fulfill({ json: { username: 'production_test', revision: 0, data: null } }),
  );
  await page.goto(process.env.GAME_URL || 'http://localhost:8787');
  await page.waitForFunction(
    () => document.querySelector('#game-load-status').textContent.includes('Field ready'),
    { timeout: 90000 },
  );
  // Keep the title scene idle in software rendering; this fixture verifies production asset/chunk delivery.
  await page.evaluate(() => {
    document.querySelector('#title-screen').classList.add('is-hidden');
  });
  await page.locator('#field-menu-toggle').click();
  await page.locator('#mods-open').click();
  await page.locator('#mods-demo').click();
  await page.waitForFunction(() => document.querySelector('#mod-preview canvas'), { timeout: 30000 });
  await page.locator('#mods-list').getByRole('button', { name: 'Enable', exact: true }).click();
  await page.waitForFunction(() =>
    document.querySelector('#mods-status').textContent.includes('enabled on this device'),
  );
  if (!requests.some((u) => /\/assets\/validate\.worker-.*\.js/.test(u)))
    throw Error('Compiled validation worker was not fetched');
  await page.locator('#mods-restore').click();
  await page.waitForFunction(() =>
    document.querySelector('#mods-status').textContent.includes('Original creature appearances restored'),
  );
  await page.locator('#mods-list').getByRole('button', { name: 'Remove', exact: true }).click();
  await page.locator('#mods-close').click();
  await browser.close();
  if (errors.length) throw Error(errors.join('\n'));
  console.log(
    'Production Worker: compiled validation/preview chunks, original demo, enable, restore and removal passed.',
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
