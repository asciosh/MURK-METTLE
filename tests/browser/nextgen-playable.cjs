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
      console.error(error);
    });

    const state = () => page.evaluate(
      () => window.__m01Demo.getPlayerState()
    );

    await page.goto(url, {
      waitUntil: 'networkidle'
    });

    await page.waitForFunction(
      () => window.__m01DemoLoaded === true,
      undefined,
      { timeout: 90000 }
    );

    const initial = await state();

    assert.ok(initial);
    assert.equal(initial.stamina, 100);
    assert.equal(initial.grounded, true);

    console.log('Player spawn: PASS');

    await page.bringToFront();
    await page.locator('canvas').first().click();

    await page.waitForFunction(
      () => document.pointerLockElement !== null,
      undefined,
      { timeout: 15000 }
    );

    console.log('Pointer lock: PASS');

    // WALK
    await page.keyboard.down('w');

    await page.waitForFunction(
      z => window.__m01Demo.getPlayerState()
        .position[2] < z - 0.2,
      initial.position[2],
      { timeout: 90000 }
    );

    await page.keyboard.up('w');

    assert.equal((await state()).stamina, 100);

    console.log('Keyboard movement: PASS');

    // DODGE
    await page.keyboard.press('Control');

    await page.waitForFunction(
      () => window.__m01Demo.getPlayerState()
        .dodging === true,
      undefined,
      { timeout: 90000 }
    );

    assert.equal((await state()).stamina, 75);

    await page.waitForFunction(
      () => window.__m01Demo.getPlayerState()
        .dodging === false,
      undefined,
      { timeout: 90000 }
    );

    console.log('Directional dodge: PASS');

    // SPRINT
    const beforeSprint = await state();

    await page.keyboard.down('Shift');
    await page.keyboard.down('w');

    await page.waitForFunction(
      stamina => {
        const s = window.__m01Demo.getPlayerState();

        return s.sprinting && s.stamina < stamina;
      },
      beforeSprint.stamina,
      { timeout: 90000 }
    );

    await page.keyboard.up('w');
    await page.keyboard.up('Shift');

    console.log('Sprint and stamina: PASS');

    // JUMP
    await page.keyboard.press('Space');

    await page.waitForFunction(
      () => window.__m01Demo.getPlayerState()
        .airborne === true,
      undefined,
      { timeout: 90000 }
    );

    await page.waitForFunction(
      () => window.__m01Demo.getPlayerState()
        .grounded === true,
      undefined,
      { timeout: 90000 }
    );

    assert.equal((await state()).verticalVelocity, 0);

    console.log('Jump and landing: PASS');

    // HUD
    assert.equal(
      await page.getByText('STAMINA', {
        exact: true
      }).count(),
      1
    );

    console.log('Stamina HUD: PASS');

    // DISPOSAL
    await page.evaluate(() => {
      window.__m01Demo.dispose();
      window.__m01Demo.dispose();
    });

    assert.equal(
      await page.getByText('STAMINA', {
        exact: true
      }).count(),
      0
    );

    assert.equal(
      await page.evaluate(
        () => window.__m01Demo.backendRenderer
      ),
      null
    );

    console.log('Playable session disposal: PASS');

    assert.deepEqual(errors, []);

    console.log('NEXTGEN playable browser smoke: PASS');

  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});