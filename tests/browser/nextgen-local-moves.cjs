const assert=require('node:assert/strict');
const {launchBrowser}=require('./support.cjs');
(async()=>{
  const base=new URL(process.env.GAME_URL||'http://127.0.0.1:8787');
  if(!['127.0.0.1','localhost'].includes(base.hostname))throw Error('Loopback only');
  const {rigPack}=await import('../../scripts/build-rigged-cosmetic-demo.mjs');
  const browser=await launchBrowser(),wait={timeout:90000};
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(String(e)));
    const menu=new URL('/?nextgen=lobby&tab=mods&view=packs',base).href,solo=new URL('/?nextgen=playable&training=1&companion=1',base).href;
    await page.goto(menu);await page.waitForFunction(()=>document.querySelector('#nextgen-mod-import')?.disabled===false,null,wait);
    await page.locator('#nextgen-mod-file').setInputFiles({name:'original-rig.mmcosmetic',mimeType:'application/zip',buffer:rigPack()});
    await page.getByText('1/1 packs imported and enabled.',{exact:false}).waitFor(wait);
    const move={id:'bud-strike',name:'Bud Strike',type:'neutral',effect:'impact',pose:'attack',damage:18,range:4,targets:1,cooldownMs:4000,windupMs:0,statusMs:0,healPercent:0};
    const pack={format:'mm-local-moves-v1',profiles:[{appearanceId:'mm-articulated-demo',name:'Test sprout',moves:[move],equipped:[move.id]}]};
    await page.locator('#nextgen-moves-file').setInputFiles({name:'original.mmmoves',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pack))});
    await page.getByText('Move pack installed locally.').waitFor(wait);
    await page.reload();await page.getByText('Equipped: 5: Bud Strike').waitFor(wait);
    await page.goto(solo);await page.waitForFunction(()=>window.__m01Demo?.getCombatInfo()?.companionMoves?.[0]?.name==='Bud Strike',null,wait);
    await page.bringToFront();await page.locator('canvas').first().click();await page.waitForFunction(()=>document.pointerLockElement!==null,null,wait);
    await page.waitForFunction(()=>{const d=window.__m01Demo,c=d.getCombatInfo().companion,e=d.getInfectedInfo()[0];return e?.health>0&&Math.hypot(...e.position.map((x,i)=>x-c.position[i]))<3.9&&d.session.companion.visible(e.position,d.session.companionHeight);},null,wait);
    const before=await page.evaluate(()=>window.__m01Demo.getInfectedInfo()[0].health);
    await page.keyboard.press('5');await page.waitForFunction(()=>window.__m01Demo.getCombatInfo().companionMoves[0].remaining>0,null,wait);
    assert.equal(await page.evaluate(()=>window.__m01Demo.getInfectedInfo()[0].health),before-18);
    await page.waitForFunction(()=>window.__m01Demo.getCombatInfo().companionMotion.played.includes('Strike'),null,wait);
    await page.keyboard.press('5');assert.equal(await page.evaluate(()=>window.__m01Demo.getInfectedInfo()[0].health),before-18);
    await page.goto(menu);await page.locator('#nextgen-mod-restore').click();await page.waitForFunction(()=>document.querySelectorAll('#nextgen-mod-list [data-enabled="true"]').length===0);
    await page.goto(solo);await page.waitForFunction(()=>window.__m01DemoLoaded&&window.__m01Demo?.getCombatInfo()?.companionAppearance==='original',null,wait);
    assert.equal(await page.evaluate(()=>window.__m01Demo.getCombatInfo().companionMoves),null);
    assert.deepEqual(errors,[]);console.log('LOCAL MOVES: imported, persisted, named HUD, confirmed damage and animation, cooldown and original fallback.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
