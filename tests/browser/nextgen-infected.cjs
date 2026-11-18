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

    // Model loading.

    await page.waitForFunction(
      () => window.__m01Demo
        ?.getInfectedInfo()[0]?.status === 'ready',
      undefined,
      { timeout: 90000 }
    );

    const enemy = await page.evaluate(
      () => window.__m01Demo.getInfectedInfo()[0]
    );

    assert.equal(enemy.skinned, true);
    assert.equal(enemy.health, 100);

    assert.deepEqual(
      [...enemy.clips].sort(),
      ['Idle', 'Walk', 'Run', 'Attack', 'Hit', 'Death'].sort()
    );

    console.log('Infected model loading: PASS');

    // Automatic pursuit and attack.

    await page.waitForFunction(
      () => window.__m01Demo
        .getInfectedInfo()[0]?.activeClip === 'attack',
      undefined,
      { timeout: 90000 }
    );

    const encounter = await page.evaluate(() => ({
      player: window.__m01Demo.getPlayerState(),
      enemy: window.__m01Demo.getInfectedInfo()[0]
    }));

    const distance = Math.hypot(
      encounter.player.position[0] -
      encounter.enemy.position[0],
      encounter.player.position[2] -
      encounter.enemy.position[2]
    );

    assert.ok(distance <= 1.66);

    console.log('Infected pursuit: PASS');
    console.log('Infected attack animation: PASS');

    await page.waitForFunction(
      () => window.__m01Demo.getInfectedAttackHits() > 0,
      undefined,
      { timeout: 30000 }
    );

    console.log('Infected attack impact: PASS');

    // Non-lethal damage and hit reaction.

    const hit = await page.evaluate(() => ({
      accepted: window.__m01Demo.damageInfected(0, 25),
      enemy: window.__m01Demo.getInfectedInfo()[0]
    }));

    assert.equal(hit.accepted, true);
    assert.equal(hit.enemy.health, 75);
    assert.equal(hit.enemy.animation, 'hit');
    assert.equal(hit.enemy.activeClip, 'hit');

    console.log('Infected damage and hit reaction: PASS');

    await page.waitForFunction(
      () => window.__m01Demo
        .getInfectedInfo()[0]?.animation !== 'hit',
      undefined,
      { timeout: 30000 }
    );

    console.log('Infected hit recovery: PASS');

    // Lethal damage.

    const death = await page.evaluate(() => ({
      accepted: window.__m01Demo.damageInfected(0, 100),
      enemy: window.__m01Demo.getInfectedInfo()[0],
      hits: window.__m01Demo.getInfectedAttackHits()
    }));

    assert.equal(death.accepted, true);
    assert.equal(death.enemy.health, 0);
    assert.equal(death.enemy.animation, 'death');
    assert.equal(death.enemy.activeClip, 'death');

    console.log('Infected death animation: PASS');

    // Dead infected cannot move, attack or take further damage.

    await page.waitForTimeout(3000);

    const dead = await page.evaluate(() => ({
      enemy: window.__m01Demo.getInfectedInfo()[0],
      hits: window.__m01Demo.getInfectedAttackHits(),
      accepted: window.__m01Demo.damageInfected(0, 10)
    }));

    assert.equal(dead.enemy.health, 0);
    assert.equal(dead.enemy.animation, 'death');
    assert.equal(dead.enemy.activeClip, 'death');
    assert.deepEqual(dead.enemy.position, death.enemy.position);
    assert.equal(dead.hits, death.hits);
    assert.equal(dead.accepted, false);

    console.log('Infected terminal death state: PASS');

    // Safe disposal.

    const remaining = await page.evaluate(() => {
      window.__m01Demo.dispose();
      window.__m01Demo.dispose();

      return window.__m01Demo.getInfectedInfo();
    });

    assert.deepEqual(remaining, []);

    console.log('Infected disposal: PASS');

    await page.close();

    // Missing-model fallback.

    const fallback = await browser.newPage();

    fallback.on('pageerror', error => {
      errors.push(String(error));
    });

    let blocked = false;

    await fallback.route(
      '**/models/nextgen/infected.glb',
      async route => {
        blocked = true;

        await route.fulfill({
          status: 404,
          body: 'Infected model unavailable'
        });
      }
    );

    await fallback.goto(url);

    await fallback.waitForFunction(
      () => window.__m01Demo
        ?.getInfectedAttackHits() > 0,
      undefined,
      { timeout: 90000 }
    );

    assert.equal(blocked, true);

    const fallbackEnemy = await fallback.evaluate(
      () => window.__m01Demo.getInfectedInfo()[0]
    );

    assert.equal(fallbackEnemy.status, 'fallback');
    assert.equal(fallbackEnemy.skinned, false);
    assert.equal(fallbackEnemy.health, 100);

    console.log('Infected missing-model fallback: PASS');

    await fallback.evaluate(() => {
      window.__m01Demo.dispose();
    });

    await fallback.close();

    assert.deepEqual(errors, []);

    console.log('NEXTGEN infected browser smoke: PASS');

  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});