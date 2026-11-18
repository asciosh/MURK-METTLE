// Unified NEXTGEN menu + graphics preferences + in-game navigation. Local Worker or Vite with fallback.
const assert = require('node:assert/strict');
const { launchBrowser } = require('./support.cjs');
(async () => {
  const base = new URL(process.env.GAME_URL || 'http://localhost:8787');
  if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('Loopback only');
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(new URL('/?nextgen=lobby', base).href);
    await page.locator('#nextgen-lobby').waitFor();
    assert.equal(await page.locator('a[href="/?nextgen=playable"]').count(), 1);
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.locator('#nextgen-quality').selectOption('low');
    assert.equal(await page.evaluate(() => localStorage.getItem('mm-nextgen-quality-v1')), 'low');
    await page.reload();
    await page.locator('#nextgen-lobby').waitFor();
    await page.getByRole('button', { name: 'Settings' }).click();
    assert.equal(await page.locator('#nextgen-quality').inputValue(), 'low');
    await page.getByRole('button', { name: 'Controls' }).click();
    assert.ok(await page.getByText('Revive nearby teammate').count());
    assert.ok(await page.getByText('Dodge').count());
    await page.locator('a[href="/?nextgen=playable"]').click();
    await page.waitForFunction(() => window.__m01DemoLoaded && !!window.__m01Demo?.getPlayerState(), null, { timeout: 90000 });
    await page.locator('#nextgen-pause-toggle').click();
    await page.locator('#nextgen-pause:visible').waitFor();
    assert.equal(await page.locator('#nextgen-in-game-quality').inputValue(), 'low');
    await page.locator('#nextgen-in-game-quality').selectOption('balanced');
    assert.equal(await page.evaluate(() => localStorage.getItem('mm-nextgen-quality-v1')), 'balanced');
    await page.getByRole('link', { name: 'MAIN MENU' }).last().click();
    await page.locator('#nextgen-lobby').waitFor();
    console.log('NEXTGEN UNIFIED: shared main menu, controls, persistent graphics preferences, in-game pause and main menu return passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
