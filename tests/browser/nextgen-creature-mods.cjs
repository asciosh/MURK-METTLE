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
    await page.locator('#nextgen-mod-import').waitFor({ timeout: 60000 });
    await page.locator('#nextgen-mod-advanced > summary').click();
    await page.locator('#nextgen-mod-demo').click();
    await page.getByText('Copperbloom', { exact: false }).first().waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: 'ENABLE', exact: true }).click();
    await page.getByText('ENABLED LOCALLY').waitFor();
    await page.reload();
    await page.locator('#nextgen-mod-import').waitFor({ timeout: 60000 });
    await page.getByText('ENABLED LOCALLY').waitFor();
    await page.locator('#nextgen-mod-restore').click();
    await page.getByText('DISABLED', { exact: false }).first().waitFor();
    assert.equal(await page.locator('#nextgen-mod-list').count(), 1);
    // Regular imports now share one file chooser and enable on success.
    const { retargetLocal3dPack }=await import('../../scripts/retarget-local-3d-pack.mjs');
    const fs=require('node:fs'),path=require('node:path');
    const model=fs.readFileSync(path.join(__dirname,'../../public/mod-examples/copperbloom.mmcosmetic'));
    const entries=await Promise.all([1,2,3].map(async form=>({name:`form-${form}.mmcosmetic`,mimeType:'application/zip',buffer:(await retargetLocal3dPack(model,form)).zip})));
    entries.push({name:'sprites.mmcreatures',mimeType:'application/zip',buffer:fs.readFileSync(path.join(__dirname,'../../public/mod-examples/nextgen-sprite-demo.mmcreatures'))});
    await page.waitForFunction(()=>document.querySelector('#nextgen-mod-import')?.disabled===false);
    await page.locator('#nextgen-mod-file').setInputFiles(entries);
    await page.getByText('4/4 packs imported and enabled.',{exact:false}).waitFor({timeout:90000});
    assert.equal(await page.locator('#nextgen-mod-list [data-mod-id][data-enabled="true"]').count(),3);
    await page.locator('#ng-sprite-pack[data-enabled="true"]').waitFor();
    await page.reload();
    await page.waitForFunction(()=>document.querySelectorAll('#nextgen-mod-list [data-mod-id][data-enabled="true"]').length===3 && document.querySelector('#ng-sprite-pack')?.dataset.enabled==='true');
    await page.locator('#nextgen-mod-restore').click();
    await page.waitForFunction(()=>document.querySelectorAll('#nextgen-mod-list [data-enabled="true"]').length===0);
    console.log('M04-C8: mixed batch import enabled all three 3D forms and sprite pack; persisted and restored originals.');
    console.log('M04-A MODS: local import, enable, persist and restore-originals passed. Cloud saves and room protocol unchanged.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
