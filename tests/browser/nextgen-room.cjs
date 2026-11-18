// Rendered room + authoritative protocol checks against local Wrangler.
const assert = require('node:assert/strict');
const { launchBrowser } = require('./support.cjs');

(async () => {
  const base = new URL(process.env.GAME_URL || 'http://localhost:8787');
  if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('This test creates disposable accounts and is restricted to loopback.');
  const suffix = Date.now().toString(36), room = `NG${suffix}`.toUpperCase();
  const clients = Number(process.env.ROOM_CLIENTS || 4);
  assert.ok([2, 4].includes(clients), 'ROOM_CLIENTS must be 2 or 4');
  const browser = await launchBrowser();
  try {
    const pages = await Promise.all(Array.from({ length: clients }, async (_, i) => {
      const context = await browser.newContext();
      const login = await context.request.post(new URL(`/api/account/register?username=ng_${suffix}_${i}`, base).href, { headers: { Origin: base.origin }, data: { pin: '482716' } });
      assert.ok(login.ok(), `Registration failed: ${login.status()}`);
      const page = await context.newPage();
      // Instrument only the test page's native room socket. The app continues to process real packets.
      await page.addInitScript(() => {
        const Native = window.WebSocket;
        window.WebSocket = class extends Native {
          constructor(...args) {
            super(...args);
            if (new URL(args[0], location.href).pathname === '/room') window.__testRoomSocket = this;
          }
        };
      });
      await page.goto(new URL(`/?nextgenRoom=${room}`, base).href);
      await page.waitForFunction(() => window.__nextgenRoom?.getRoomInfo()?.connected, null, { timeout: 90000, polling: 100 });
      return page;
    }));
    const wait = { timeout: 60000, polling: 100 };
    await Promise.all(pages.map(page => page.waitForFunction(n => window.__nextgenRoom.getRoomInfo()?.peers.length === n - 1, clients, wait)));
    const states = await Promise.all(pages.map(page => page.evaluate(() => window.__nextgenRoom.getRoomInfo())));
    const ids = new Set(states.map(s => s.id));
    assert.equal(ids.size, clients);
    for (const state of states) { assert.equal(state.room, room); assert.deepEqual(new Set(state.peers), new Set([...ids].filter(id => id !== state.id))); assert.ok(state.horde); assert.ok(state.arsenal); assert.ok(state.self); }
    await Promise.all(pages.map(page => page.waitForFunction(() => window.__nextgenRoom.getRoomInfo().infectedViews.some(v => v.rigged), null, wait)));
    const actor = pages[0];
    const read = () => actor.evaluate(() => window.__nextgenRoom.getRoomInfo());
    const send = packet => actor.evaluate(p => window.__testRoomSocket.send(JSON.stringify(p)), packet);
    let before = await read();
    if (before.self.hp <= 0) {
      await send({ type: 'restart' });
      await actor.waitForFunction(() => window.__nextgenRoom.getRoomInfo().self.hp > 0, null, wait);
      before = await read();
    }
    const { constrainPosition } = await import('../../shared/expansion.mjs');
    const start = before.self;
    const destination = constrainPosition({ x: start.x + 0.25, z: start.z });
    assert.ok(Math.hypot(destination.x - start.x, destination.z - start.z) > 0.15);
    await send({ type: 'move', ...destination, yaw: 0, pitch: 0, weapon: 'pistol', aiming: false, sprinting: false });
    await actor.waitForFunction(p => { const q = window.__nextgenRoom.getRoomInfo().self; return Math.hypot(q.x - p.x, q.z - p.z) < 0.05; }, destination, wait);
    await Promise.all(pages.slice(1).map(page => page.waitForFunction(({ id, destination }) => { const peer = window.__nextgenRoom.getRoomInfo().remotePlayers.find(p => p.id === id); return peer && Math.hypot(peer.x - destination.x, peer.z - destination.z) < 0.08; }, { id: start.id, destination }, wait)));
    console.log(`NEXTGEN: ${clients} clients joined, rigged infected and synchronized movement confirmed.`);

    // In a live horde, a player can die while four software-rendered pages are waiting.
    // Send once from a fresh living snapshot, wait for the real wire acknowledgement,
    // and only retry if that snapshot proves the player died before acceptance.
    const combat = async (page, action) => page.evaluate(action => new Promise((resolve, reject) => {
      const socket = window.__testRoomSocket;
      const info = () => window.__nextgenRoom.getRoomInfo();
      const id = info().id;
      let sent = false, restarting = false, attempts = 0, restarts = 0, before = null, lastHp = null;
      const recent = [];
      const cleanup = () => { clearTimeout(timer); socket.removeEventListener('message', onMessage); };
      const fail = reason => { cleanup(); reject(new Error(`${action}: ${reason}; ${JSON.stringify({ attempts, restarts, before, lastHp, recent, state: { hp: info().self?.hp, shots: info().acceptedShots, effects: info().shotEffects, actions: info().acceptedActions } })}`)); };
      const timer = setTimeout(() => fail('no authoritative acknowledgement'), 15000);
      function onMessage(event) {
        let packet;
        try { packet = JSON.parse(event.data); } catch { return; }
        if (packet.type !== 'snapshot') { recent.push(packet.type + (packet.type === 'error' ? ':' + packet.message : '')); if (recent.length > 12) recent.shift(); }
        if (action === 'shoot' && packet.type === 'shot' && packet.by === id) { cleanup(); resolve({ before, hit: packet.hit, distance: packet.distance, restarts }); return; }
        if (action === 'attack' && packet.type === 'action' && packet.by === id && packet.action === 'melee') { cleanup(); resolve({ before, restarts }); return; }
        if (packet.type !== 'snapshot') return;
        const me = packet.players.find(p => p.id === id);
        if (!me) return;
        lastHp = me.hp;
        if (me.hp <= 0) {
          if (restarting) return;
          if (restarts >= 2) return fail('player repeatedly died before action');
          if (sent) { sent = false; }
          // A dead snapshot may repeat while restart is in flight; wait for its response.
          restarts++; restarting = true; socket.send(JSON.stringify({ type: 'restart' }));
          return;
        }
        restarting = false;
        if (sent) return;
        if (attempts >= 3) return fail('too many attempts');
        const magazine = info().arsenal?.pistol?.magazine;
        if (action === 'shoot' && (!Number.isInteger(magazine) || magazine <= 0)) return fail('no loaded pistol ammunition');
        before = { hp: me.hp, magazine, x: me.x, z: me.z };
        sent = true; attempts++;
        if (action === 'shoot') {
          const enemy = packet.horde.enemies.find(e => e.hp > 0 && Math.hypot(e.x - me.x, e.z - me.z) > 0.01);
          const dx = enemy ? enemy.x - me.x : 0, dz = enemy ? enemy.z - me.z : -1;
          const length = Math.hypot(dx, dz);
          socket.send(JSON.stringify({ type: 'shoot', weapon: 'pistol', direction: { x: dx / length, y: 0, z: dz / length } }));
        } else socket.send(JSON.stringify({ type: 'attack' }));
      }
      socket.addEventListener('message', onMessage);
    }), action);

    const combatStates = await Promise.all(pages.map(page => page.evaluate(() => window.__nextgenRoom.getRoomInfo())));
    const shooterIndex = combatStates.reduce((best, state, i) => state.self.hp > combatStates[best].self.hp ? i : best, 0);
    const shooter = pages[shooterIndex];
    const shot = await combat(shooter, 'shoot');
    console.log('Server shot acknowledgement:', JSON.stringify(shot));
    try {
      await Promise.all(pages.map(page => page.waitForFunction(() => { const s = window.__nextgenRoom.getRoomInfo(); return s.acceptedShots >= 1 && s.shotEffects >= 1; }, null, { timeout: 15000, polling: 100 })));
      await shooter.waitForFunction(mag => window.__nextgenRoom.getRoomInfo().arsenal.pistol.magazine === mag - 1, shot.before.magazine, { timeout: 15000, polling: 100 });
    } catch (error) {
      const diagnostics = await Promise.all(pages.map(page => page.evaluate(() => { const s = window.__nextgenRoom.getRoomInfo(); return { hp: s.self?.hp, shots: s.acceptedShots, effects: s.shotEffects, magazine: s.arsenal?.pistol.magazine }; })));
      console.error('Client shot/effects diagnostics:', JSON.stringify(diagnostics)); throw error;
    }
    const melee = await combat(shooter, 'attack');
    console.log('Server melee acknowledgement:', JSON.stringify(melee));
    await Promise.all(pages.map(page => page.waitForFunction(() => window.__nextgenRoom.getRoomInfo().acceptedActions >= 1, null, wait)));
    console.log(`NEXTGEN: ${clients} authenticated rendered clients, rigged infected, synchronized movement, server-confirmed shot/effects and ammo decrement, accepted melee broadcast. Confirmed hit: ${shot.hit}. Manual input/feel and full expedition still pending.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
