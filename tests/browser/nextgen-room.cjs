// Rendered room bootstrap against local Wrangler, with two independent authenticated accounts.
const assert = require('node:assert/strict');
const { launchBrowser } = require('./support.cjs');

(async () => {
  const base = new URL(process.env.GAME_URL || 'http://localhost:8787');
  if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('This test creates disposable accounts and is restricted to loopback.');
  const suffix = Date.now().toString(36), room = `NG${suffix}`.toUpperCase();
  const browser = await launchBrowser();
  try {
    const pages = [];
    for (let i = 0; i < 2; i++) {
      const context = await browser.newContext();
      const login = await context.request.post(new URL(`/api/account/register?username=ng_${suffix}_${i}`, base).href, { headers: { Origin: base.origin }, data: { pin: '482716' } });
      assert.ok(login.ok(), `Registration failed: ${login.status()}`);
      const page = await context.newPage();
      pages.push(page);
      await page.goto(new URL(`/?nextgenRoom=${room}`, base).href);
      await page.waitForFunction(() => window.__nextgenRoom?.getRoomInfo()?.connected, null, { timeout: 60000 });
    }
    for (const page of pages) await page.waitForFunction(() => window.__nextgenRoom.getRoomInfo()?.peers.length === 1, null, { timeout: 30000 });
    const states = await Promise.all(pages.map(page => page.evaluate(() => window.__nextgenRoom.getRoomInfo())));
    assert.notEqual(states[0].id, states[1].id);
    assert.equal(states[0].peers[0], states[1].id);
    assert.equal(states[1].peers[0], states[0].id);
    for (const state of states) { assert.equal(state.room, room); assert.ok(state.horde); assert.ok(state.arsenal); assert.ok(state.self); }
    console.log('NEXTGEN: two authenticated rendered clients, shared room roster, horde and arsenal received. Manual movement/combat acceptance still required.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
