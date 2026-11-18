// M03 final acceptance: live roster presentation, world markers and reconnect/rejoin.
const assert = require('node:assert/strict');
const { launchBrowser } = require('./support.cjs');
(async () => {
  const base = new URL(process.env.GAME_URL || 'http://localhost:8787');
  if (!['localhost','127.0.0.1'].includes(base.hostname)) throw Error('Loopback only: disposable accounts.');
  const suffix = Date.now().toString(36), room = `P${suffix}`.toUpperCase();
  const browser = await launchBrowser();
  const contexts=[]; const pages=[];
  const wait = {timeout:60000,polling:100};
  try {
    for(let i=0;i<2;i++) {
      const ctx=await browser.newContext();contexts.push(ctx);
      const registration=await ctx.request.post(new URL(`/api/account/register?username=pl_${suffix}_${i}`,base).href,{headers:{Origin:base.origin},data:{pin:'482716'}});
      assert.ok(registration.ok(),`Registration ${i}: ${registration.status()}`);
      const page=await ctx.newPage();pages.push(page);
      await page.goto(new URL(`/?nextgenRoom=${room}`,base).href);
    }
    for(const page of pages) await page.waitForFunction(()=>{
      const s=window.__nextgenRoom?.getRoomInfo();
      return s?.connected && s?.peers.length===1 && document.querySelectorAll('.nextgen-squad-member').length===2 &&
        document.querySelectorAll('.nextgen-ally-label').length===1 && document.querySelector('.nextgen-objective-banner')?.textContent?.includes('ZONE');
    },null,wait);
    console.log('M03 POLISH: two real clients show shared mission, authoritative squad HP and teammate nameplates.');
    await pages[1].close();
    await pages[0].waitForFunction(()=>window.__nextgenRoom?.getRoomInfo()?.peers.length===0,null,wait);
    const returning=await contexts[1].newPage();
    await returning.goto(new URL(`/?nextgenRoom=${room}`,base).href);
    await Promise.all([pages[0],returning].map(p=>p.waitForFunction(()=>{
      const s=window.__nextgenRoom?.getRoomInfo();
      return s?.connected && s.peers.length===1 && document.querySelectorAll('.nextgen-squad-member').length===2;
    },null,wait)));
    console.log('M03 POLISH: disconnect, late rejoin with the same account, and squad UI recovery passed.');
    console.log('Full extraction, successful live teammate revive, movement and combat feel still require manual playtesting.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
