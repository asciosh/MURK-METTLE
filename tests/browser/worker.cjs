// Real local Durable Object/session transport smoke; does not render four game clients.
const { launchBrowser } = require('./support.cjs');
const assert = require('node:assert/strict');
(async () => {
  const url = new URL(process.env.GAME_URL || 'http://localhost:8787');
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) throw Error('Worker smoke is restricted to loopback; never creates production accounts.');
  const browser = await launchBrowser();
  try {
    const contexts = [], pages = [];
    const suffix = Date.now().toString(36);
    for (let i = 0; i < 4; i++) {
      const context = await browser.newContext();
      contexts.push(context);
      const page = await context.newPage();
      pages.push(page);
      // Fetch the real local document so Chromium retains its private network address space.
      // Suppress only the application boot script; do not change browser security flags.
      await page.route('**/assets/index-*.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
      await page.goto(url.href);
      const session = await page.evaluate(async (username) => {
        const response = await fetch(`/api/account/register?username=${username}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: '482716' }),
        });
        if (!response.ok) throw Error(`Register: ${response.status}`);
        return (await fetch('/api/account/me')).json();
      }, `clean_${suffix}_${i}`);
      assert.equal(session.username, `clean_${suffix}_${i}`);
      await page.evaluate((room) => {
        window.packets = [];
        const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/room?code=${room}`);
        window.socket = ws;
        ws.onmessage = event => packets.push(JSON.parse(event.data));
        ws.onerror = () => packets.push({type:'socket-error'});
        ws.onclose = event => packets.push({type:'socket-close',code:event.code});
      }, `C${suffix}`.toUpperCase());
      await page.waitForFunction(() => packets.some(p => p.type === 'welcome' || p.type === 'socket-error'), { timeout: 30000 });
      assert.ok(await page.evaluate(() => packets.some(p => p.type === 'welcome')), JSON.stringify(await page.evaluate(() => packets)));
    }
    const ids = new Set();
    for (const page of pages) {
      await page.waitForFunction(() => packets.some(p => p.type === 'snapshot' && p.players.length === 4), { timeout: 30000 });
      const state = await page.evaluate(() => ({
        id: packets.find(p => p.type === 'welcome').id,
        roster: packets.filter(p => p.type === 'snapshot').at(-1).players,
        collection: packets.find(p => p.type === 'collection-state'),
        errors: packets.filter(p => p.type === 'error'),
      }));
      ids.add(state.id);
      assert.equal(new Set(state.roster.map(p => p.id)).size, 4);
      assert.ok(state.collection);
      assert.deepEqual(state.errors, []);
    }
    assert.equal(ids.size, 4);
    const blocked = await contexts[0].request.post(new URL('/api/account/logout', url).href, { headers: { Origin: 'https://untrusted.example' } });
    assert.equal(blocked.status(), 403);
    for (const page of pages) await page.evaluate(() => socket.close());
    for (const context of contexts) await context.close();
    console.log('Local Worker: four distinct authenticated sessions, same-room snapshots, collection bootstrap and cross-origin rejection passed. This is transport smoke, not a four-player gameplay test.');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
