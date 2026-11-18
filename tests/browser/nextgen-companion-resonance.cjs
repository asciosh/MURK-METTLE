const assert=require('node:assert/strict');
const {launchBrowser}=require('./support.cjs');
const url=(process.env.GAME_URL||'http://localhost:5174')+'/tests/browser/nextgen.html?mode=playable&training=1&companion=1';
(async()=>{
  const browser=await launchBrowser();
  try {
    const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    const opts={timeout:45000};
    await page.goto(url);await page.waitForFunction(()=>window.__m01DemoLoaded&&window.__m01Demo?.getPlayerModelInfo()?.status==='ready',undefined,{timeout:90000});
    await page.bringToFront();await page.locator('canvas').first().click();await page.waitForFunction(()=>document.pointerLockElement!==null,undefined,opts);
    const state=()=>page.evaluate(()=>window.__m01Demo.getCombatInfo());
    assert.equal((await state()).companion.name,'Lanternkin');assert.equal((await state()).companion.assist,false);
    assert.equal((await state()).resonance.charge,100);
    await page.keyboard.press('q');
    await page.waitForFunction(()=>{const d=window.__m01Demo,c=d.getCombatInfo();return c.resonance.active&&!c.resonance.transitioning&&d.getPlayerModelInfo().resonanceVisible;},undefined,opts);
    await page.mouse.down({button:'right'});
    await page.waitForFunction(()=>window.__m01Demo.getPlayerModelInfo().aimWeight>=.99,undefined,opts);
    // Aim well above the infected so its health remains available for the companion checks.
    await page.evaluate(()=>document.dispatchEvent(new MouseEvent('mousemove',{movementY:-1000})));
    await page.waitForFunction(()=>window.__m01Demo.getPlayerModelInfo().aimPitch>.3,undefined,opts);
    await page.mouse.down({button:'left'});await page.mouse.up({button:'left'});
    await page.waitForFunction(()=>window.__m01Demo.getCombatInfo().resonance.empoweredShots===1,undefined,opts);
    assert.equal((await state()).ammo,11);assert.equal((await state()).resonance.charge,75);
    await page.mouse.up({button:'right'});
    await page.waitForFunction(()=>{const d=window.__m01Demo;return !d.getCombatInfo().fireCooldownMs&&d.getPlayerModelInfo().weaponAction===null;},undefined,opts);
    await page.keyboard.press('q');await page.waitForFunction(()=>!window.__m01Demo.getCombatInfo().resonance.active&&!window.__m01Demo.getCombatInfo().resonance.transitioning,undefined,opts);
    console.log('Weapon transformation, visual form, ammunition and charge: PASS');
    // The normal training infected pursues the stationary player. Wait for the
    // real ability's range and terrain LOS conditions, without modifying health.
    await page.waitForFunction(()=>{
      const d=window.__m01Demo,c=d.getCombatInfo().companion,e=d.getInfectedInfo()[0];
      return e?.health>0&&Math.hypot(...e.position.map((x,i)=>x-c.position[i]))<c.pulseRange-.1&&d.session.companion.visible(e.position,d.session.companionHeight);
    },undefined,opts);
    const before=await page.evaluate(()=>window.__m01Demo.getInfectedInfo()[0].health);
    await page.keyboard.press('x');
    await page.waitForFunction(()=>window.__m01Demo.getCombatInfo().companion.pulses===1,undefined,opts);
    assert.equal(await page.evaluate(()=>window.__m01Demo.getInfectedInfo()[0].health),before-35);
    assert.ok((await state()).companion.pulseCooldownMs>0);
    await page.keyboard.press('x');assert.equal((await state()).companion.pulses,1);
    console.log('Lumen Pulse damage and cooldown: PASS');
    await page.keyboard.press('c');
    await page.waitForFunction(()=>window.__m01Demo.getCombatInfo().companion.attacks>0,undefined,opts);
    await page.waitForFunction(()=>window.__m01Demo.getCombatInfo().kills===1,undefined,opts);
    assert.equal((await state()).shotsFired,1);
    assert.ok((await state()).companionHits>1);assert.equal((await state()).health,100);
    assert.ok(await page.evaluate(()=>window.__m01Demo.getLootInfo().length>0));
    await page.keyboard.press('c');await page.waitForFunction(()=>!window.__m01Demo.getCombatInfo().companion.assist,undefined,opts);
    console.log('Companion assist, kill credit, loot and recall: PASS');
    await page.evaluate(()=>window.__m01Demo.dispose());assert.deepEqual(errors,[]);
    console.log('NEXTGEN companion and resonance browser smoke: PASS');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
