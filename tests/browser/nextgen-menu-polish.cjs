// M04-B UX regression: one solo action, independent creature studio sections, compact pause controls.
const assert = require('node:assert/strict');
const { launchBrowser } = require('./support.cjs');
(async () => {
  const base = new URL(process.env.GAME_URL || 'http://localhost:8787');
  if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('Loopback only');
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(new URL('/?nextgen=lobby', base).href);
    await page.locator('#nextgen-lobby').waitFor();
    const solo = page.locator('a[href="/?nextgen=playable"]');
    assert.equal(await solo.count(), 1);
    assert.equal(await solo.isVisible(), true);
    await page.getByRole('button', { name: 'Creature Mods' }).click();
    assert.equal(await solo.isVisible(), false);
    assert.equal(await page.locator('#nextgen-evolution-lab').isVisible(), false);
    assert.equal(await page.locator('#nextgen-mod-import').isVisible(), true);
    assert.equal(await page.locator('#nextgen-mod-demo').isVisible(), false);
    assert.equal(await page.locator('#ng-sprite-demo').isVisible(), false);
    assert.equal(await page.locator('#nextgen-mod-file').getAttribute('multiple'), '');
    await page.locator('#nextgen-mod-advanced > summary').click();
    await page.locator('#nextgen-mod-evolution > summary').click();
    assert.equal(await page.locator('#nextgen-evolution-lab').isVisible(), true);
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    assert.equal(await solo.isVisible(), true);
    console.log('M04 MENU: one multi-file appearance importer, contextual solo action, hidden advanced tools and accessible evolution lab.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
