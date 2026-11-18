const assert = require('node:assert/strict');
const { launchBrowser } = require('./support.cjs');

const url =
  (process.env.GAME_URL || 'http://localhost:5174') +
  '/tests/browser/nextgen.html?mode=playable';

(async () => {
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 }
    });

    const errors = [];

    page.on('pageerror', error => {
      errors.push(String(error));
    });

    const combat = () => page.evaluate(
      () => window.__m01Demo.getCombatInfo()
    );

    const waitReady = () => page.waitForFunction(
      () => {
        const demo = window.__m01Demo;

        return demo.getCombatInfo().fireCooldownMs === 0 &&
          demo.getPlayerModelInfo().weaponAction === null;
      },
      undefined,
      { timeout: 30000 }
    );

    await page.goto(url + '&training=1');

    await page.waitForFunction(
      () => window.__m01Demo
        ?.getPlayerModelInfo()?.status === 'ready',
      undefined,
      { timeout: 90000 }
    );

    const initial = await combat();

    assert.equal(initial.health, 100);
    assert.equal(initial.ammo, 12);
    assert.equal(initial.reserve, 48);
    assert.equal(initial.training, true);

    console.log('Combat initial state: PASS');

    await page.bringToFront();
    await page.locator('canvas').first().click();

    await page.waitForFunction(
      () => document.pointerLockElement !== null
    );

    await page.mouse.down({ button: 'right' });

    await page.waitForFunction(
      () => window.__m01Demo
        .getPlayerModelInfo().aimWeight >= 0.99,
      undefined,
      { timeout: 15000 }
    );

    // Fire one round.

    await page.mouse.down({ button: 'left' });
    await page.mouse.up({ button: 'left' });

    await page.waitForFunction(
      () => window.__m01Demo
        .getCombatInfo().shotsFired === 1,
      undefined,
      { timeout: 15000 }
    );

    assert.equal((await combat()).ammo, 11);

    console.log('Pistol firing and ammunition: PASS');

    // Reload.

    await waitReady();

    await page.keyboard.press('r');

    await page.waitForFunction(
      () => window.__m01Demo
        .getCombatInfo().reloading === true,
      undefined,
      { timeout: 15000 }
    );

    await page.waitForFunction(
      () => {
        const state = window.__m01Demo.getCombatInfo();

        return !state.reloading && state.ammo === 12;
      },
      undefined,
      { timeout: 30000 }
    );

    assert.equal((await combat()).reserve, 47);

    console.log('Pistol reload: PASS');

    // Training mode protects the player.

    await page.waitForFunction(
      () => window.__m01Demo.getInfectedAttackHits() > 0,
      undefined,
      { timeout: 90000 }
    );

    assert.equal((await combat()).health, 100);

    console.log('Training mode protection: PASS');

    await page.mouse.up({ button: 'right' });

    await page.evaluate(() => {
      window.__m01Demo.dispose();
    });

    await page.close();

    // Real survival combat.

    const survival = await browser.newPage();

    survival.on('pageerror', error => {
      errors.push(String(error));
    });

    await survival.goto(url);

    await survival.waitForFunction(
      () => {
        const state = window.__m01Demo?.getCombatInfo();

        return state && state.health < 100;
      },
      undefined,
      { timeout: 90000 }
    );

    console.log('Infected damages player: PASS');

    await survival.waitForFunction(
      () => window.__m01Demo
        .getCombatInfo().alive === false,
      undefined,
      { timeout: 120000 }
    );

    const dead = await survival.evaluate(
      () => window.__m01Demo.getCombatInfo()
    );

    assert.equal(dead.health, 0);
    assert.equal(dead.alive, false);

    console.log('Player death: PASS');

    await survival.getByText(
      'YOU DIED',
      { exact: false }
    ).waitFor();

    console.log('Death HUD: PASS');

    await survival.evaluate(() => {
      window.__m01Demo.dispose();
    });

    await survival.close();

    assert.deepEqual(errors, []);

    console.log('NEXTGEN combat browser smoke: PASS');

  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});