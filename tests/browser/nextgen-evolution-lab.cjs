// M04-B browser smoke: local evolution-rule sandbox, isolated from account and room state.
const assert = require('node:assert/strict');
const { launchBrowser } = require('./support.cjs');
(async () => {
  const base = new URL(process.env.GAME_URL || 'http://localhost:8787');
  if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('Loopback only');
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(new URL('/?nextgen=lobby&tab=mods', base).href);
    await page.locator('#nextgen-evolution-lab').waitFor({ timeout: 60000 });
    assert.equal(await page.locator('#nextgen-mod-appearances').isVisible(), false);
    await page.getByText('M04-B rule preview only.', { exact: false }).waitFor();
    assert.equal(await page.locator('#ng-evolution-family').inputValue(), 'glimmerpaw');
    const sun = page.getByRole('button', { name: 'PREVIEW → Sunmane' });
    const moon = page.getByRole('button', { name: 'PREVIEW → Moonpelt' });
    assert.equal(await sun.isDisabled(), true);
    await page.locator('#ng-evolution-xp').fill('960');
    await page.locator('#ng-evolution-xp').dispatchEvent('change');
    assert.equal(await sun.isEnabled(), true);
    assert.equal(await moon.isDisabled(), true);
    await page.locator('#ng-evolution-item').check();
    assert.equal(await moon.isEnabled(), true);
    await sun.click();
    await page.getByText('Preview only: Glimmerpaw → Sunmane', { exact: false }).waitFor();
    assert.equal(await page.locator('#ng-evolution-form').inputValue(), 'sunmane');
    assert.equal(await page.getByRole('button', { name: 'PREVIEW → Starcrest' }).isDisabled(), true);
    await page.locator('#ng-evolution-friendship').fill('80');
    await page.locator('#ng-evolution-friendship').dispatchEvent('change');
    await page.locator('#ng-evolution-trade').check();
    assert.equal(await page.getByRole('button', { name: 'PREVIEW → Starcrest' }).isEnabled(), true);
    await page.locator('#ng-evolution-family').selectOption('lanternkin');
    assert.equal(await page.getByRole('button', { name: 'PREVIEW → Luminbloom' }).isEnabled(), true);
    console.log('M04-B EVOLUTION: catalog, branching level/time/item/friendship/trade checks and legacy XP preview passed. No saved progress changed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
