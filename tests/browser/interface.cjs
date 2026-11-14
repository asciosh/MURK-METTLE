// Controlled UI fixtures use production markup, styles and input/panel handlers; no game simulation.
const { chromium, devices } = require('playwright');
const path = require('node:path'),
  fs = require('node:fs');
const output = process.env.ARTIFACT_DIR || path.join(require('node:os').tmpdir(), 'murk-ui-check');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const errors = [];
  for (const [w, h, mobile] of [
    [1920, 1080, false],
    [1366, 768, false],
    [390, 844, true],
    [844, 390, true],
  ]) {
    const ctx = await b.newContext(
      mobile ? { ...devices['Pixel 7'], viewport: { width: w, height: h } } : { viewport: { width: w, height: h } },
    );
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.route('**/api/account/**', (r) => r.fulfill({ json: {} }));
    await p.goto(process.env.GAME_URL || 'http://localhost:5173');
    await p.waitForTimeout(250);
    await p.screenshot({ path: path.join(output, `after-login-${w}.png`) });
    await p.locator('#account-username').fill('ui_test');
    await p.locator('#account-pin').fill('12');
    await p.locator('#account-pin').press('Enter');
    if (!(await p.locator('#account-message').textContent()).includes('PIN'))
      throw Error('Keyboard login validation failed');
    await p.evaluate(async () => {
      document.querySelector('#auth-gate').hidden = true;
      document.querySelector('#account-panel').hidden = true;
      document.querySelector('#title-screen').classList.add('is-hidden');
      const { InputController } = await import('/src/client/game/InputController.ts');
      const { TouchControls } = await import('/src/client/game/TouchControls.ts');
      const { FieldInventoryUI } = await import('/src/client/game/FieldInventoryUI.ts');
      const { Inventory } = await import('/src/client/game/Inventory.ts');
      const { Crafting } = await import('/src/client/game/Crafting.ts');
      const viewport = document.querySelector('#game-viewport');
      const canvas = document.createElement('canvas');
      canvas.className = 'game-canvas';
      viewport.prepend(canvas);
      window.uiInput = new InputController(canvas, () => {});
      window.uiTouch = new TouchControls(viewport, canvas, uiInput);
      uiTouch.setActive(true);
      const inventory = new Inventory();
      window.uiInventory = new FieldInventoryUI(
        inventory,
        new Crafting(inventory),
        () => false,
        () => {},
        () => {},
      );
      uiInventory.renderInventory();
      uiInventory.renderCrafting();
      document.querySelector('#enemy-panel').classList.add('visible');
      document.querySelector('#room-status').textContent = 'Room BLOOM · 4/4 players';
      document.querySelector('#creature-roster').innerHTML =
        '<button>Lanternkin · ACTIVE<small>Grovewarden · 400 XP</small></button><button>Emberling<small>Track habitat · Old settlement</small></button>';
    });
    await p.waitForTimeout(500);
    await p.screenshot({ path: path.join(output, `after-hud-${w}.png`) });
    await p.evaluate(() => uiInput.setTouchMovement({ right: 1, forward: 0 }));
    await p.locator('#field-menu-toggle').click();
    await p.waitForTimeout(50);
    if (await p.evaluate(() => uiInput.getMovementAxes().right !== 0)) throw Error('Held input survived overlay');
    if (await p.locator('#room-code').evaluate((n) => n !== document.activeElement)) throw Error('Menu focus missing');
    await p.keyboard.press('Space');
    if (await p.evaluate(() => uiInput.consumeAttackPressed())) throw Error('Menu triggered attack');
    await p.screenshot({ path: path.join(output, `after-menu-${w}.png`) });
    await p.keyboard.press('Escape');
    await p.locator(mobile ? '#touch-journal' : '#journal-button').click();
    await p.locator('#touch-journal-sheet').waitFor({ state: 'visible' });
    await p.screenshot({ path: path.join(output, `after-journal-${w}.png`) });
    await p.keyboard.press('Escape');
    if (await p.locator('#creature-panel').evaluate((n) => !!n.closest('#touch-journal-sheet')))
      throw Error('Journal did not restore nodes');
    await p.keyboard.press('KeyJ');
    await p.locator('#touch-journal-sheet').waitFor({ state: 'visible' });
    await p.keyboard.press('Escape');
    await p.locator('#inventory-button').click();
    await p.locator('#inventory-close').waitFor({ state: 'visible' });
    await p.waitForTimeout(200);
    const bounds = await p.locator('#inventory-panel').boundingBox();
    if (bounds.x < 0 || bounds.x + bounds.width > w) throw Error('Backpack clipped');
    await p.screenshot({ path: path.join(output, `after-inventory-${w}.png`) });
    await p.locator('#inventory-close').click();
    if (!(await p.locator('#inventory-panel').evaluate((n) => n.inert)))
      throw Error('Closed inventory remains focusable');
    const overflow = await p.evaluate(() =>
      [...document.querySelectorAll('#field-menu-toggle,#inventory-button,.player-status,.weapon-panel')]
        .filter((n) => n.getClientRects().length)
        .map((n) => ({ id: n.id || n.className, rect: n.getBoundingClientRect().toJSON() }))
        .filter(({ rect: r }) => r.x < 0 || r.right > innerWidth || r.y < 0 || r.bottom > innerHeight),
    );
    if (overflow.length) throw Error(JSON.stringify(overflow));
    const vitalFits = await p.evaluate(() => document.querySelector('#player-health-text').getBoundingClientRect().right <= document.querySelector('.player-status').getBoundingClientRect().right);
    if (!vitalFits) throw Error('Vital numbers overflow panel');
    await p.emulateMedia({ reducedMotion: 'reduce' });
    if (await p.locator('.title-screen').evaluate(n => getComputedStyle(n).transitionDuration !== '0s')) throw Error('Reduced motion missing');
    console.log('passed', w, h, mobile);
    await ctx.close();
  }
  console.log('errors', errors);
  await b.close();
  if (errors.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
