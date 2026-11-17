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
      () => window.__m01Demo
        ?.getPlayerModelInfo()?.status === 'ready',
      undefined,
      { timeout: 90000 }
    );

    const model = await page.evaluate(
      () => window.__m01Demo.getPlayerModelInfo()
    );

    assert.ok(model.clips.includes('Idle'));
    assert.ok(model.clips.includes('Walk'));
    assert.ok(model.clips.includes('Run'));
    assert.ok(model.clips.includes('JumpStart'));
    assert.ok(model.clips.includes('JumpLoop'));
    assert.ok(model.clips.includes('JumpLand'));
    assert.ok(model.clips.includes('Dodge'));
    assert.equal(model.skinned, true);

    assert.equal(model.activeClip, 'idle');

    console.log('GLB model loading: PASS', model);

    await page.bringToFront();
    await page.locator('canvas').first().click();

    await page.waitForFunction(
      () => document.pointerLockElement !== null,
      undefined,
      { timeout: 15000 }
    );

    await page.keyboard.down('w');

    await page.waitForFunction(
      () => window.__m01Demo
        .getPlayerModelInfo().activeClip === 'walk',
      undefined,
      { timeout: 90000 }
    );

    console.log('Walk animation: PASS');

    await page.keyboard.down('Shift');

    try {
    await page.waitForFunction(
        () => window.__m01Demo
        .getPlayerModelInfo().activeClip === 'run',
        undefined,
        { timeout: 15000 }
    );
    } catch (error) {
    console.log('Run diagnostics:', await page.evaluate(() => ({
        locked: document.pointerLockElement !== null,
        visibility: document.visibilityState,
        player: window.__m01Demo.getPlayerState(),
        model: window.__m01Demo.getPlayerModelInfo()
    })));

    throw error;
    }

    console.log('Run animation: PASS');

    await page.keyboard.up('w');
    await page.keyboard.up('Shift');

    await page.waitForFunction(
      () => window.__m01Demo
        .getPlayerModelInfo().activeClip === 'idle',
      undefined,
      { timeout: 90000 }
    );

    console.log('Return to idle: PASS');

    // Record animation transitions across rendered frames.
    await page.evaluate(() => {
      window.__avatarClipHistory = [];

      const sample = () => {
        const clip =
          window.__m01Demo.getPlayerModelInfo().activeClip;

        const history = window.__avatarClipHistory;

        if (clip && history.at(-1) !== clip) {
          history.push(clip);
        }

        window.__avatarClipObserver =
          requestAnimationFrame(sample);
      };

      sample();
    });

    // Verify the complete jump sequence.
    await page.keyboard.down('Space');

    await page.waitForFunction(
      () => window.__avatarClipHistory.includes('jumpstart'),
      undefined,
      { timeout: 15000 }
    );

    await page.keyboard.up('Space');

    await page.waitForFunction(
      () => {
        const history = window.__avatarClipHistory;

        return history.includes('jumpland') &&
          history.at(-1) === 'idle';
      },
      undefined,
      { timeout: 30000 }
    );

    const jumpHistory = await page.evaluate(
      () => window.__avatarClipHistory
    );

    assert.ok(
      jumpHistory.indexOf('jumpstart') <
      jumpHistory.indexOf('jumploop')
    );

    assert.ok(
      jumpHistory.indexOf('jumploop') <
      jumpHistory.indexOf('jumpland')
    );

    console.log('Jump sequence: PASS', jumpHistory);

    // Verify dodge and visual recovery.
    await page.keyboard.down('Control');

    await page.waitForFunction(
      () => window.__avatarClipHistory.includes('dodge'),
      undefined,
      { timeout: 15000 }
    );

    await page.keyboard.up('Control');

    await page.waitForFunction(
      () => window.__avatarClipHistory.at(-1) === 'idle',
      undefined,
      { timeout: 30000 }
    );

    await page.evaluate(() => {
      cancelAnimationFrame(window.__avatarClipObserver);
    });

    console.log('Dodge and recovery: PASS');

    await page.evaluate(() => {
      window.__m01Demo.dispose();
    });

    await page.close();

    // Verify loading failure fallback.
    const fallback = await browser.newPage();

    fallback.on('pageerror', error => {
      errors.push(String(error));
    });

    await fallback.route(
      '**/models/nextgen/survivor.glb',
      route => route.fulfill({
        status: 404,
        body: 'Model unavailable'
      })
    );

    await fallback.goto(url);

    await fallback.waitForFunction(
      () => window.__m01Demo
        ?.getPlayerModelInfo()?.status === 'fallback',
      undefined,
      { timeout: 90000 }
    );

    const player = await fallback.evaluate(
      () => window.__m01Demo.getPlayerState()
    );

    assert.ok(player);
    assert.equal(player.grounded, true);

    console.log('Missing-model fallback: PASS');

    await fallback.evaluate(() => {
      window.__m01Demo.dispose();
    });

    assert.deepEqual(errors, []);

    console.log('NEXTGEN avatar browser smoke: PASS');

  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});