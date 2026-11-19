const assert=require('node:assert/strict');
const {launchBrowser}=require('./support.cjs');
(async()=>{
  const base=new URL(process.env.GAME_URL||'http://127.0.0.1:8787');
  if(!['127.0.0.1','localhost'].includes(base.hostname))throw Error('Loopback only');
  const {rigPack}=await import('../../scripts/build-rigged-cosmetic-demo.mjs');
  const browser=await launchBrowser(),wait={timeout:90000};
  try{
    const page=await browser.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(String(e)));
    const menu=new URL('/?nextgen=lobby&tab=mods&view=packs',base).href;
    const solo=new URL('/?nextgen=playable&training=1&companion=1',base).href;
    await page.goto(menu);
    await page.waitForFunction(()=>document.querySelector('#nextgen-mod-import')?.disabled===false,null,wait);
    await page.locator('#nextgen-mod-file').setInputFiles({name:'articulated-demo.mmcosmetic',mimeType:'application/zip',buffer:rigPack()});
    await page.getByText('1/1 packs imported and enabled.',{exact:false}).waitFor(wait);
    await page.reload();
    await page.locator('#nextgen-mod-list [data-mod-id="mm-articulated-demo"][data-enabled="true"]').waitFor(wait);
    await page.goto(solo);
    await page.waitForFunction(()=>{const m=window.__m01Demo?.getCombatInfo()?.companionMotion;return m?.bones===2&&m.played.includes('Idle');},null,wait);
    assert.equal(await page.evaluate(()=>window.__m01Demo.getCombatInfo().companionAppearance),'glb');
    await page.goto(menu);
    await page.locator('#nextgen-mod-list [data-mod-id="mm-articulated-demo"][data-enabled="true"]').waitFor(wait);
    await page.locator('#nextgen-mod-restore').click();
    await page.waitForFunction(()=>document.querySelectorAll('#nextgen-mod-list [data-enabled="true"]').length===0);
    await page.goto(solo);
    await page.waitForFunction(()=>window.__m01DemoLoaded&&window.__m01Demo?.getCombatInfo()?.companionAppearance==='original',null,wait);
    assert.deepEqual(errors,[]);
    console.log('M04-C9 SOLO: original two-bone model imported, persisted, idle clip bound and original fallback restored.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
