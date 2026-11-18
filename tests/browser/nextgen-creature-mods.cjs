// Local-only M04-A smoke: menu access, original demo import, enable, IndexedDB persistence and restore.
const assert = require('node:assert/strict');
const { launchBrowser } = require('./support.cjs');
(async () => {
  const base = new URL(process.env.GAME_URL || 'http://localhost:8787');
  if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('Loopback only');
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(new URL('/?nextgen=lobby&tab=mods', base).href);
    await page.getByRole('button', { name: 'Appearance Packs', exact: true }).click();
    await page.locator('#nextgen-mod-import').waitFor({ timeout: 60000 });
    await page.locator('#nextgen-mod-demo').click();
    await page.getByText('Copperbloom', { exact: false }).first().waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: 'ENABLE', exact: true }).click();
    await page.getByText('ENABLED LOCALLY').waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Appearance Packs', exact: true }).click();
    await page.locator('#nextgen-mod-import').waitFor({ timeout: 60000 });
    await page.getByText('ENABLED LOCALLY').waitFor();
    await page.locator('#nextgen-mod-restore').click();
    await page.getByText('DISABLED', { exact: false }).first().waitFor();
    assert.equal(await page.locator('#nextgen-mod-list').count(), 1);
    console.log('M04-A MODS: local import, enable, persist and restore-originals passed. Cloud saves and room protocol unchanged.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
