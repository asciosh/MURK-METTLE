// Browser-only launcher UX and cosmetic disconnect checks. Does not validate native WebView2.
const { chromium } = require('playwright');
const fs = require('node:fs'),
  path = require('node:path');
(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.addInitScript(() => {
    window.__launchCalls = [];
    window.__TAURI_INTERNALS__ = {
      invoke: (command, args) => {
        window.__launchCalls.push({ command, args });
        return window.__failLaunch ? Promise.reject(new Error('test unavailable')) : Promise.resolve();
      },
    };
  });
  for (const [width, height] of [
    [800, 850],
    [480, 640],
    [1200, 700],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto(process.env.LAUNCHER_URL || 'http://127.0.0.1:1420');
    await page.waitForFunction(() =>
      document.querySelector('#deployment').textContent.includes('workers.dev'),
    );
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    if (overflow) throw Error(`Horizontal overflow at ${width}`);
    await page.locator('#launch').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() =>
      document.querySelector('#status').textContent.includes('Game window opened'),
    );
    if ((await page.evaluate(() => __launchCalls.map((c) => c.command))).join() !== 'start_game')
      throw Error('Unexpected launcher commands');
    await page.evaluate(() => (window.__failLaunch = true));
    await page.locator('#launch').click();
    await page.waitForFunction(() =>
      document.querySelector('#status').textContent.includes('could not open'),
    );
    if (await page.locator('#launch').isDisabled()) throw Error('Retry disabled after failure');
  }
  const output = process.env.ARTIFACT_DIR || '/tmp/murk-desktop-check';
  fs.mkdirSync(output, { recursive: true });
  await page.setViewportSize({ width: 800, height: 850 });
  await page.reload();
  await page.screenshot({ path: path.join(output, 'launcher.png') });
  await page.addScriptTag({ path: path.resolve('desktop/src-tauri/src/network-status.js') });
  await page.context().setOffline(true);
  await page.waitForFunction(() => document.body.textContent.includes('Offline — room and cloud saving'));
  await page.context().setOffline(false);
  await page.waitForFunction(() => document.body.textContent.includes('Network available again'));
  if (errors.length) throw Error(errors.join('\n'));
  await browser.close();
  console.log(
    'Launcher keyboard/retry/layout and offline/recovery banner checks passed; native integration remains separate.',
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
