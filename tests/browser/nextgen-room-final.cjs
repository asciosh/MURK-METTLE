// Real local Worker: additive room negotiation, resonant shotgun, ammo and VFX.
const assert = require('node:assert/strict');
const { launchBrowser } = require('./support.cjs');

(async () => {
  const base = new URL(process.env.GAME_URL || 'http://localhost:8787');
  if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('Loopback only: disposable test accounts.');
  const suffix = Date.now().toString(36), room = `FNL${suffix}`.toUpperCase();
  const browser = await launchBrowser(), wait = { timeout: 60000, polling: 100 };
  try {
    const pages = await Promise.all([0, 1].map(async i => {
      const ctx = await browser.newContext();
      const registration = await ctx.request.post(new URL(`/api/account/register?username=fn_${suffix}_${i}`, base).href, { headers: { Origin: base.origin }, data: { pin: '482716' } });
      assert.ok(registration.ok(), `Registration failed: ${registration.status()}`);
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        const Native = window.WebSocket;
        window.WebSocket = class extends Native {
          constructor(...args) { super(...args); if (new URL(args[0], location.href).pathname === '/room') window.__testRoomSocket = this; }
        };
      });
      await page.goto(new URL(`/?nextgenRoom=${room}`, base).href);
      await page.waitForFunction(() => { const s = window.__nextgenRoom?.getRoomInfo(); return s?.connected && s.self?.nextgen && s.peers.length === 1 && s.arsenal; }, null, wait);
      return page;
    }));
    const states = await Promise.all(pages.map(p => p.evaluate(() => window.__nextgenRoom.getRoomInfo())));
    const actor = pages[states[0].self.hp >= states[1].self.hp ? 0 : 1];
    // No fake snapshots, damage, or ammo: all intents use the active room socket.
    // The whole transaction is driven by fresh server snapshots, not slow page polling.
    const result = await actor.evaluate(() => new Promise((resolve, reject) => {
      const socket = window.__testRoomSocket, id = window.__nextgenRoom.getRoomInfo().id;
      let phase = 'equip', restarts = 0, last = null, start = null, shot = null, after = null;
      const send = p => socket.send(JSON.stringify(p));
      const cleanup = () => { clearTimeout(timer); socket.removeEventListener('message', handle); };
      const fail = message => { cleanup(); reject(Error(`${message}; phase=${phase}; snapshot=${JSON.stringify(last)}`)); };
      const timer = setTimeout(() => fail('Final combat acknowledgement timed out'), 35000);
      function handle(event) {
        let p; try { p = JSON.parse(event.data); } catch { return; }
        if (p.type === 'shot' && p.by === id && phase === 'fire') { shot = p; phase = 'shot-ack'; return; }
        if (p.type === 'error' && phase === 'invalid-revive' && /revive/i.test(p.message)) { cleanup(); resolve({ start, shot, after, restarts, invalidRevive: true }); return; }
        if (p.type !== 'snapshot') return;
        const me = p.players.find(q => q.id === id); if (!me?.nextgen) return;
        const n = me.nextgen; last = { hp: me.hp, ...n };
        if (me.hp <= 0 && ['equip','equipped','shift','fire','restart'].includes(phase)) {
          if (phase !== 'restart') { if (++restarts > 2) return fail('Repeated deaths before shot'); phase = 'restart'; send({ type: 'restart' }); }
          return;
        }
        if (phase === 'restart') phase = 'equip';
        if (phase === 'equip') { phase = 'equipped'; send({ type: 'nextgen-equip', weapon: 'shotgun' }); return; }
        if (phase === 'equipped' && n.weapon === 'shotgun') {
          start = { magazine: n.shotgun.magazine, reserve: n.shotgun.reserve, charge: n.charge, bandages: me.survival.bandages, rifle: window.__nextgenRoom.getRoomInfo().arsenal.rifle.magazine };
          phase = 'shift'; send({ type: 'nextgen-resonance' }); return;
        }
        if (phase === 'shift' && n.resonant && !n.transitioning) {
          const enemy = p.horde.enemies.find(e => e.hp > 0 && Math.hypot(e.x-me.x,e.z-me.z) > 0.01);
          const dx = enemy ? enemy.x-me.x : 0, dz = enemy ? enemy.z-me.z : -1;
          const height=(x,z)=>window.__nextgenRoom.getRoomHeight(x,z),dy=enemy?height(enemy.x,enemy.z)+1.1-height(me.x,me.z)-1.32:0,l=Math.hypot(dx,dy,dz);
          phase = 'fire'; send({ type: 'shoot', weapon: 'shotgun', direction: { x: dx/l, y: dy/l, z: dz/l } }); return;
        }
        if (phase === 'shot-ack') {
          after = { magazine: n.shotgun.magazine, reserve: n.shotgun.reserve, charge: n.charge, rifle: window.__nextgenRoom.getRoomInfo().arsenal.rifle.magazine, bandages: me.survival.bandages, hp: me.hp };
          // Self-revive is invalid regardless of health. It must not consume a bandage.
          phase = 'invalid-revive'; send({ type: 'revive', target: id });
        }
      }
      socket.addEventListener('message', handle);
    }));
    assert.equal(result.shot.weapon, 'rifle'); // compatibility field
    assert.equal(result.shot.nextgenWeapon, 'shotgun');
    assert.equal(result.shot.resonant, true);
    assert.equal(result.shot.pellets.length, 5);
    assert.equal(result.after.magazine, result.start.magazine - 1);
    assert.equal(result.after.reserve, result.start.reserve);
    assert.equal(result.after.rifle, result.start.rifle);
    assert.equal(result.after.charge, result.start.charge - 30);
    assert.ok(result.invalidRevive);
    await Promise.all(pages.map(p => p.waitForFunction(() => { const s = window.__nextgenRoom.getRoomInfo(); return s.acceptedShotgunShots >= 1 && s.acceptedResonantShots >= 1 && s.shotEffects >= 5; }, null, wait)));
    assert.equal(await actor.evaluate(() => window.__nextgenRoom.getRoomInfo().self.survival.bandages), result.after.bandages);
    console.log('NEXTGEN FINAL: negotiated 2 clients, resonant shotgun, five replicated pellet effects, authoritative charge and independent ammo; invalid self-revive rejected.');
    console.log('Shot:', JSON.stringify({ hit: result.shot.hit, before: result.start, after: result.after, restarts: result.restarts }));
    console.log('Revive completion/cancellation and shotgun reload are covered by real room unit tests; successful live teammate revival and control feel require the manual checklist.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
