const assert = require('node:assert/strict');
const { launchBrowser } = require('./support.cjs');
const url = (process.env.GAME_URL || 'http://localhost:5174') +
  '/tests/browser/nextgen.html?mode=playable&training=1';

(async () => {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(url);
    await page.waitForFunction(() => window.__m01DemoLoaded === true &&
      window.__m01Demo?.getPlayerModelInfo()?.status === 'ready',
      undefined, { timeout: 90000 });
    await page.bringToFront();
    await page.locator('canvas').first().click();
    await page.waitForFunction(() => document.pointerLockElement !== null,
      undefined, { timeout: 15000 });
    const state = () => page.evaluate(() => window.__m01Demo.getCombatInfo());
    // Seed real LootField drops only in the test page, without adding a runtime
    // debug API or bypassing the keyboard pickup handler.
    const seed = (kind, amount, clear = false) => page.evaluate(({ kind, amount, clear }) => {
      const demo = window.__m01Demo;
      const field = demo.session.loot;
      if (clear) field.clear();
      return field.spawn(kind, amount, demo.getPlayerState().position);
    }, { kind, amount, clear });
    const collect = async (reserve, message) => {
      await page.keyboard.press('e');
      if (message.startsWith('+')) {
        await page.waitForFunction(() => window.__m01Demo.getPickupInfo()?.active &&
          window.__m01Demo.getPlayerModelInfo().activeClip === 'pickup' &&
          !window.__m01Demo.getPlayerModelInfo().weaponVisible,
          undefined, { timeout: 30000 });
      }
      await page.waitForFunction(({ reserve, message }) =>
        window.__m01Demo.getCombatInfo().reserve === reserve &&
        document.querySelector('.nextgen-loot-toast')?.textContent === message &&
        document.querySelector('.nextgen-loot-toast')?.style.display === 'block' &&
        (!message.startsWith('+') ||
          window.__m01Demo.getPlayerModelInfo().heldLoot ===
            (message.includes('BANDAGE') ? 'bandage' : 'ammo')),
        { reserve, message }, { timeout: 30000 });
      await page.waitForFunction(() => !window.__m01Demo.getPickupInfo()?.active &&
        window.__m01Demo.getPlayerModelInfo().heldLoot === null,
        undefined, { timeout: 45000 });
    };
    assert.equal(await page.evaluate(() => window.__m01Demo.getPlayerModelInfo().backpackAttached), true);
    assert.equal((await state()).reserve, 48);
    assert.equal((await state()).reserveCapacity, 72);
    assert.equal(await seed('ammo', 12), true);
    await page.keyboard.press('e');
    await page.waitForFunction(() => window.__m01Demo.getPickupInfo()?.active &&
      !window.__m01Demo.getPickupInfo().contactReached,
      undefined, { timeout: 30000 });
    await page.keyboard.down('w');
    try {
      await page.waitForFunction(() => !window.__m01Demo.getPickupInfo()?.active,
        undefined, { timeout: 15000 });
    } finally {
      await page.keyboard.up('w');
    }
    assert.equal((await state()).reserve, 48);
    assert.equal(await page.evaluate(() => window.__m01Demo.getLootInfo().length), 1);
    console.log('Movement cancels pickup before hand contact: PASS');
    await collect(60, '+12 AMMO');
    assert.equal(await page.evaluate(() => window.__m01Demo.getLootInfo().length), 0);
    console.log('Keyboard ammo pickup and feedback: PASS');
    assert.equal(await seed('ammo', 20), true);
    await collect(72, '+12 AMMO');
    assert.equal(await page.evaluate(() => window.__m01Demo.getLootInfo()[0].amount), 8);
    await collect(72, 'AMMO RESERVE FULL');
    assert.equal(await page.evaluate(() => window.__m01Demo.getLootInfo()[0].amount), 8);
    console.log('Partial and full ammo pickup: PASS');
    assert.equal(await seed('bandage', 1, true), true);
    await collect(72, 'BANDAGES FULL');
    assert.equal((await state()).bandages, 2);
    console.log('Full bandage feedback: PASS');
    // Use a controlled injury in training to exercise the real H and E
    // handlers, the bandage animation, and the remaining loot pickup.
    await page.evaluate(() => window.__m01Demo.session.combat.takeDamage(12, 0));
    await page.keyboard.press('h');
    await page.waitForFunction(() => window.__m01Demo.getCombatInfo().healing &&
      window.__m01Demo.getPlayerModelInfo().activeClip === 'bandage',
      undefined, { timeout: 15000 });
 try {
  await page.waitForFunction(() => 
    !window.__m01Demo.getCombatInfo().healing &&
    window.__m01Demo.getCombatInfo().health === 100 &&
    window.__m01Demo.getCombatInfo().bandages === 1,
    undefined, { timeout: 45000 });
} catch (error) {
  console.log('Healing diagnostics:', await page.evaluate(() => ({
    combat: window.__m01Demo.getCombatInfo(),
    player: window.__m01Demo.getPlayerState(),
    model: window.__m01Demo.getPlayerModelInfo(),
    locked: document.pointerLockElement !== null,
    visibility: document.visibilityState
  })));
  throw error;
}
    await collect(72, '+1 BANDAGE');
    assert.equal((await state()).bandages, 2);
    assert.equal(await page.evaluate(() => window.__m01Demo.getLootInfo().length), 0);
    console.log('Bandage animation, healing and pickup: PASS');
    await page.evaluate(() => window.__m01Demo.session.loot.clear());
    await collect(72, 'NO LOOT NEARBY');
    console.log('Out-of-range feedback: PASS');
    await page.evaluate(() => window.__m01Demo.dispose());
    assert.deepEqual(errors, []);
    console.log('NEXTGEN loot browser smoke: PASS');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
