const assert = require('node:assert/strict');
const { launchBrowser } = require('./support.cjs');
const url = (process.env.GAME_URL || 'http://localhost:5174') + '/tests/browser/nextgen.html?mode=playable&training=1';

(async()=>{
  const browser=await launchBrowser();
  try {
    const page=await browser.newPage({viewport:{width:1280,height:720}});
    const errors=[];page.on('pageerror',error=>errors.push(String(error)));
    const options={timeout:30000};
    await page.goto(url);
    await page.waitForFunction(()=>window.__m01DemoLoaded&&window.__m01Demo?.getPlayerModelInfo()?.status==='ready',undefined,{timeout:90000});
    await page.bringToFront();await page.locator('canvas').first().click();
    await page.waitForFunction(()=>document.pointerLockElement!==null,undefined,options);
    const state=()=>page.evaluate(()=>window.__m01Demo.getCombatInfo());
    const seed=(kind,amount,loadedRounds)=>page.evaluate(({kind,amount,loadedRounds})=>{
      const d=window.__m01Demo;d.session.loot.clear();return d.session.loot.spawn(kind,amount,d.getPlayerState().position,loadedRounds);
    },{kind,amount,loadedRounds});
    const collect=async(kind,amount,loadedRounds)=>{
      assert.equal(await seed(kind,amount,loadedRounds),true);
      await page.keyboard.press('e');
      await page.waitForFunction(()=>window.__m01Demo.getLootInfo().length===0&&!window.__m01Demo.getPickupInfo()?.active,undefined,options);
    };
    const select=async(key,id)=>{
      await page.keyboard.press(key);
      await page.waitForFunction(id=>{
        const d=window.__m01Demo,c=d.getCombatInfo();return c.weapon===id&&!c.switching&&d.getPlayerModelInfo().equippedWeapon===id;
      },id,options);
    };
    const ready=()=>page.waitForFunction(()=>{
      const d=window.__m01Demo,c=d.getCombatInfo();return !c.switching&&!c.reloading&&!c.fireCooldownMs&&d.getPlayerModelInfo().weaponAction===null;
    },undefined,options);
    const aim=async()=>{
      await page.mouse.down({button:'right'});
      await page.waitForFunction(()=>window.__m01Demo.getPlayerModelInfo().aimWeight>=.99&&window.__m01Demo.getPlayerModelInfo().weaponVisible,undefined,options);
    };
    assert.equal((await state()).equipment.primary,null);
    await collect('rifle',1,8);await collect('rifle-ammo',20);
    assert.equal((await state()).equipment.rifle.loaded,8);assert.equal((await state()).equipment.rifle.reserve,20);
    assert.equal((await state()).equipment.pistol.reserve,48);
    await page.waitForFunction(()=>window.__m01Demo.getPlayerModelInfo().holsteredPrimary==='rifle',undefined,options);
    console.log('Weapon pickup, back attachment and independent ammo: PASS');
    await select('2','rifle');await aim();
    const first=(await state()).shotsFired;
    await page.mouse.down({button:'left'});
    try {await page.waitForFunction(n=>window.__m01Demo.getCombatInfo().shotsFired>=n+3,first,options);}
    finally {await page.mouse.up({button:'left'});}
    await ready();assert.ok((await state()).ammo<=5);
    await page.keyboard.press('r');
    await page.waitForFunction(()=>window.__m01Demo.getCombatInfo().reloading,undefined,options);
    await ready();assert.ok((await state()).ammo>5);
    assert.equal((await state()).equipment.pistol.reserve,48);
    await page.mouse.up({button:'right'});
    await page.waitForFunction(()=>window.__m01Demo.getPlayerModelInfo().aimWeight===0,undefined,options);
    console.log('Rifle switching, held fire and reload: PASS');
    const loaded=(await state()).ammo;
    await page.keyboard.press('i');
    await page.locator('.nextgen-inventory-panel').waitFor({state:'visible',timeout:30000});
    await page.keyboard.press('g');
    await page.waitForFunction(()=>window.__m01Demo.getCombatInfo().equipment.primary===null,undefined,options);
    assert.equal((await state()).weapon,'pistol');
    const drops=await page.evaluate(()=>window.__m01Demo.getLootInfo());
    assert.equal(drops.length,1);assert.equal(drops[0].kind,'rifle');assert.equal(drops[0].loadedRounds,loaded);
    await page.keyboard.press('i');await ready();
    await page.locator('.nextgen-inventory-panel').waitFor({state:'hidden',timeout:30000});
    console.log('Inventory and loaded weapon drop: PASS');
    await collect('shotgun',1,3);await collect('shotgun-ammo',8);
    await select('2','shotgun');await aim();
    const shots=(await state()).shotsFired;
    await page.mouse.click(640,360,{button:'left'});
    await page.waitForFunction(n=>window.__m01Demo.getCombatInfo().shotsFired===n+1,shots,options);
    assert.equal((await state()).ammo,2);await ready();
    await page.mouse.up({button:'right'});
    await select('1','pistol');assert.equal((await state()).ammo,12);
    assert.equal((await state()).equipment.shotgun.loaded,2);
    console.log('Shotgun firing, secondary recovery and preserved magazines: PASS');
    await page.evaluate(()=>window.__m01Demo.dispose());assert.deepEqual(errors,[]);
    console.log('NEXTGEN equipment browser smoke: PASS');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
