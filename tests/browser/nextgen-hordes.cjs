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

    await page.goto(url);

    await page.waitForFunction(
      () => {
        const enemies =
          window.__m01Demo?.getInfectedInfo();

        return enemies?.length === 3 &&
          enemies.every(e => e.status === 'ready');
      },
      undefined,
      { timeout: 90000 }
    );

    const firstWave = await page.evaluate(
      () => window.__m01Demo.getHordeInfo()
    );

    assert.equal(firstWave.wave, 1);
    assert.equal(firstWave.living, 3);

    console.log('Horde spawn: PASS');

    await page.evaluate(() => {
      const demo = window.__m01Demo;

      for (let i = 0; i < 3; i++) {
        demo.damageInfected(i, 100);
      }
    });

    await page.waitForFunction(
      () => window.__m01Demo
        .getHordeInfo().intermission,
      undefined,
      { timeout: 15000 }
    );

    const cleared = await page.evaluate(
      () => window.__m01Demo.getHordeInfo()
    );

    assert.equal(cleared.living, 0);
    assert.equal(cleared.kills, 3);

    console.log('Wave clearance and intermission: PASS');

    await page.waitForFunction(
      () => {
        const demo = window.__m01Demo;
        const horde = demo.getHordeInfo();

        return horde.wave === 2 &&
          horde.living === 4 &&
          demo.getInfectedInfo().every(
            enemy => enemy.status === 'ready'
          );
      },
      undefined,
      { timeout: 90000 }
    );

    const secondWave = await page.evaluate(
      () => window.__m01Demo.getHordeInfo()
    );

    assert.equal(secondWave.kills, 3);

    console.log('Next wave progression: PASS');

    await page.waitForFunction(
      () => window.__m01Demo
        .getCombatInfo().alive === false,
      undefined,
      { timeout: 120000 }
    );

    console.log('Horde kills player: PASS');

    await page.keyboard.press('Enter');

    await page.waitForFunction(
      () => {
        const demo = window.__m01Demo;
        const combat = demo.getCombatInfo();
        const horde = demo.getHordeInfo();

        return combat.alive &&
          combat.health === 100 &&
          horde.wave === 1 &&
          horde.living === 3 &&
          horde.kills === 0;
      },
      undefined,
      { timeout: 15000 }
    );

    const reset = await page.evaluate(() => ({
      combat: window.__m01Demo.getCombatInfo(),
      enemies: window.__m01Demo.getInfectedInfo()
    }));

    assert.equal(reset.combat.ammo, 12);
    assert.equal(reset.combat.reserve, 48);
    assert.ok(reset.enemies.every(
      enemy => enemy.status === 'ready'
    ));

    console.log('In-game restart: PASS');

    await page.evaluate(() => {
      window.__m01Demo.dispose();
    });

    assert.deepEqual(errors, []);

    console.log('NEXTGEN horde browser smoke: PASS');

  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});