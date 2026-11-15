// Controlled UI fixtures use production markup, styles and input/panel handlers; no game simulation.
const { launchBrowser } = require('./support.cjs');
const path = require('node:path'),
  fs = require('node:fs');
const output = process.env.ARTIFACT_DIR || path.join(require('node:os').tmpdir(), 'murk-ui-check');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const b = await launchBrowser();
  const errors = [];
  for (const [w, h, scale] of [[1920, 1080, 1], [1366, 768, 1], [960, 540, 1], [1366, 768, 1.5], [1920, 1080, 2]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.route('**/api/account/**', (r) => r.fulfill({ json: {} }));
    await p.goto(process.env.GAME_URL || 'http://localhost:5173');
    await p.waitForTimeout(250);
    await p.screenshot({ path: path.join(output, `after-login-${w}-dpi${scale}.png`) });
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
      const { FieldJournal } = await import('/src/client/ui/FieldJournal.ts');
      const { FieldInventoryUI } = await import('/src/client/game/FieldInventoryUI.ts');
      const { Inventory } = await import('/src/client/game/Inventory.ts');
      const { Crafting } = await import('/src/client/game/Crafting.ts');
      const viewport = document.querySelector('#game-viewport');
      const canvas = document.createElement('canvas');
      canvas.className = 'game-canvas';
      viewport.prepend(canvas);
      window.uiInput = new InputController(canvas, () => {});
      window.uiJournal = new FieldJournal(viewport);
      uiJournal.setActive(true);
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
    await p.screenshot({ path: path.join(output, `after-hud-${w}-dpi${scale}.png`) });
    await p.locator('.game-canvas').focus();
    await p.keyboard.down('KeyW');
    await p.keyboard.down('KeyD');
    const diagonal = await p.evaluate(() => uiInput.getMovementAxes());
    if (Math.abs(Math.hypot(diagonal.forward, diagonal.right) - 1) > 1e-10) throw Error('Diagonal keyboard speed changed');
    await p.keyboard.up('KeyW');
    if (await p.evaluate(() => uiInput.getMovementAxes().right !== 1)) throw Error('Keyboard release lost held direction');
    await p.locator('#field-menu-toggle').click();
    await p.waitForTimeout(50);
    if (await p.evaluate(() => uiInput.getMovementAxes().right !== 0)) throw Error('Held input survived overlay');
    if (await p.locator('#room-code').evaluate((n) => n !== document.activeElement)) throw Error('Menu focus missing');
    await p.keyboard.press('Space');
    if (await p.evaluate(() => uiInput.consumeAttackPressed())) throw Error('Menu triggered attack');
    await p.screenshot({ path: path.join(output, `after-menu-${w}-dpi${scale}.png`) });
    await p.keyboard.press('Escape');
    await p.locator('#journal-button').click();
    await p.locator('#journal-sheet').waitFor({ state: 'visible' });
    await p.screenshot({ path: path.join(output, `after-journal-${w}-dpi${scale}.png`) });
    await p.locator('#journal-sheet').evaluate(n => { n.tabIndex = -1; n.focus(); });
    await p.keyboard.press('Space');
    if (await p.evaluate(() => uiInput.consumeAttackPressed())) throw Error('Journal triggered melee');
    await p.locator('#journal-close').focus();
    await p.keyboard.press('Shift+Tab');
    if (!(await p.locator('#journal-sheet').evaluate(n => n.contains(document.activeElement)))) throw Error('Journal focus escaped');
    await p.keyboard.press('Escape');
    if (await p.locator('#creature-panel').evaluate((n) => !!n.closest('#journal-sheet')))
      throw Error('Journal did not restore nodes');
    await p.keyboard.press('KeyJ');
    await p.locator('#journal-sheet').waitFor({ state: 'visible' });
    await p.keyboard.press('Escape');
    await p.locator('#inventory-button').click();
    await p.locator('#inventory-close').waitFor({ state: 'visible' });
    await p.waitForTimeout(200);
    const bounds = await p.locator('#inventory-panel').boundingBox();
    if (bounds.x < 0 || bounds.x + bounds.width > w) throw Error('Backpack clipped');
    await p.screenshot({ path: path.join(output, `after-inventory-${w}-dpi${scale}.png`) });
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
    console.log('passed PC window', w, h, 'DPR', scale);
    await p.evaluate(() => {
      uiJournal.dispose();
      uiInput.dispose();
      uiInventory.dispose();
    });
    if (await p.locator('#journal-sheet').count()) throw Error('Journal was not disposed');
    if (!(await p.locator('.hud-stack-left #creature-panel').count())) throw Error('Journal lost HUD nodes');
    await ctx.close();
  }
  console.log('errors', errors);
  await b.close();
  if (errors.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
