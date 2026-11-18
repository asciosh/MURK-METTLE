// The new NEXTGEN entry works on the built Worker, without booting legacy gameplay.
const assert=require('node:assert/strict');
const {launchBrowser}=require('./support.cjs');
(async()=>{
  const base=new URL(process.env.GAME_URL||'http://localhost:8787');
  if(!['localhost','127.0.0.1'].includes(base.hostname))throw Error('Loopback only');
  const browser=await launchBrowser();
  try{
    const ctx=await browser.newContext(), page=await ctx.newPage();
    await page.goto(new URL('/?nextgen=lobby',base).href);
    await page.locator('#nextgen-lobby').waitFor();
    assert.equal(await page.locator('#game-viewport').count(),0);
    await page.goto(new URL('/?nextgenRoom=BLOOM',base).href);
    await page.locator('#nextgen-lobby').waitFor();
    assert.equal(await page.locator('input[name=room]').inputValue(),'BLOOM');
    await page.locator('a[href="/?nextgen=playable"]').click();
    await page.waitForFunction(()=>window.__m01DemoLoaded&&!!window.__m01Demo?.getPlayerState(),null,{timeout:90000});
    assert.equal(await page.locator('#game-viewport').count(),0);
    console.log('NEXTGEN ENTRY: dedicated lobby, unauthenticated room gate, production-built solo prototype passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
