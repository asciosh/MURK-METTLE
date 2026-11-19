// Real production-built menu, local persistence and rendered solo companion.
const assert = require('node:assert/strict');
const { launchBrowser } = require('./support.cjs');
(async () => {
  const base = new URL(process.env.GAME_URL || 'http://localhost:8787');
  if (!['localhost','127.0.0.1'].includes(base.hostname)) throw Error('Loopback only');
  const browser = await launchBrowser();
  const menu = new URL('/?nextgen=lobby&tab=mods&view=packs',base).href;
  const solo = new URL('/?nextgen=playable&training=1&companion=1',base).href;
  try {
    const context = await browser.newContext(), page = await context.newPage();
    await page.goto(menu);
    await page.locator('#ng-sprite-demo').click({ timeout: 60000 });
    await page.getByText('Original Pixel Companions', {exact:false}).waitFor({ timeout: 60000 });
    await page.locator('#ng-sprite-enable').click();
    await page.locator('#ng-sprite-pack[data-enabled="true"]').waitFor();
    await page.reload();
    await page.locator('#ng-sprite-pack[data-enabled="true"]').waitFor({ timeout: 60000 });
    await page.goto(solo);
    await page.waitForFunction(()=>window.__m01Demo?.getCombatInfo()?.companionAppearance==='sprite',null,{timeout:90000});
    assert.equal(await page.evaluate(()=>window.__m01Demo.getCombatInfo().companion.species),'lanternkin');
    await page.goto(menu); await page.locator('#ng-sprite-pack[data-enabled="true"]').waitFor();
    await page.locator('#nextgen-mod-restore').click();
    await page.locator('#ng-sprite-pack[data-enabled="false"]').waitFor();
    await page.goto(solo);
    await page.waitForFunction(()=>window.__m01DemoLoaded&&window.__m01Demo?.getCombatInfo()?.companionAppearance==='original',null,{timeout:90000});
    console.log('NEXTGEN SPRITES: imported original pack, persisted enable, rendered sprite companion in solo, restored original. No account writes.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
