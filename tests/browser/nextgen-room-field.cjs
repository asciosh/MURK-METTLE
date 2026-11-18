// Real local room, account-owned creatures, Pulse and shared mission markers.
const assert = require('node:assert/strict');
const { launchBrowser } = require('./support.cjs');

(async () => {
  const base = new URL(process.env.GAME_URL || 'http://localhost:8787');
  if (!['localhost', '127.0.0.1'].includes(base.hostname)) throw Error('This test registers disposable accounts and is restricted to loopback.');
  const { CREATURES, SUPPLIES } = await import('../../shared/expansion.mjs');
  const { PICKUPS } = await import('../../shared/coop-rules.mjs');
  const suffix = Date.now().toString(36), room = `FD${suffix}`.toUpperCase();
  const browser = await launchBrowser();
  const wait = { timeout: 45000, polling: 100 };
  try {
    const pages = await Promise.all([0, 1].map(async i => {
      const ctx = await browser.newContext();
      const registration = await ctx.request.post(new URL(`/api/account/register?username=fd_${suffix}_${i}`, base).href, { headers: { Origin: base.origin }, data: { pin: '482716' } });
      assert.ok(registration.ok(), `Registration failed: ${registration.status()}`);
      const page = await ctx.newPage();
      await page.addInitScript(() => {
        const Native = window.WebSocket;
        window.WebSocket = class extends Native {
          constructor(...args) { super(...args); if (new URL(args[0], location.href).pathname === '/room') window.__testRoomSocket = this; }
        };
      });
      await page.goto(new URL(`/?nextgenRoom=${room}`, base).href);
      await page.waitForFunction(() => { const s = window.__nextgenRoom?.getRoomInfo(); return s?.connected && s.peers.length === 1 && s.collection && s.mission && s.inventory; }, null, wait);
      return page;
    }));
    const actor = pages[0];
    for (const page of pages) {
      await page.locator('.nextgen-hud[data-mode="coop"] .nextgen-health').waitFor();
      await page.locator('.nextgen-hud[data-mode="coop"] .nextgen-ability-panel').waitFor();
      await page.waitForFunction(() => {
        const markers = window.__nextgenRoom?.getRoomInfo()?.fieldVisuals ?? [];
        return markers.some(m => m.kind === 'resupply' && m.physical) &&
          markers.some(m => m.kind === 'habitat' && m.physical) &&
          markers.some(m => m.kind === 'sample' && m.physical);
      }, null, wait);
    }
    console.log('Solo/co-op shared HUD and physical supply, habitat and sample art confirmed.');
    const id = await actor.evaluate(() => window.__nextgenRoom.getRoomInfo().id);
    console.log('Two field clients ready; server collection, mission and inventory received.');

    // Use actual wire snapshots to walk at legal speed and send the interaction from a fresh living state.
    const perform = (type, target, body) => actor.evaluate(({ type, target, body }) => new Promise((resolve, reject) => {
      const socket = window.__testRoomSocket;
      const id = window.__nextgenRoom.getRoomInfo().id;
      let sent = false, restarting = false, restarts = 0, lastMove = 0, last = null;
      let supplyVitals = false, supplyArsenal = false;
      const cleanup = () => { clearTimeout(timer); socket.removeEventListener('message', handle); };
      const done = packet => { cleanup(); resolve({ type, restarts, packet }); };
      const fail = message => { cleanup(); reject(new Error(`${type}: ${message}; last=${JSON.stringify(last)}`)); };
      const timer = setTimeout(() => fail('no server acknowledgement'), 30000);
      function handle(event) {
        let packet;
        try { packet = JSON.parse(event.data); } catch { return; }
        if (sent) {
          if (type === 'unowned-pulse' && packet.type === 'error' && /bond/i.test(packet.message)) return done(packet);
          if (type === 'unowned-strike' && packet.type === 'error' && /bond/i.test(packet.message)) return done(packet);
          if (type === 'strike' && packet.type === 'companion-strike' && packet.by === id) return done(packet);
          if (type === 'bond' && packet.type === 'collection-state' && packet.bonded && packet.collection.creatures[body.species].owned) return done(packet);
          if (type === 'pulse' && packet.type === 'action' && packet.action === 'pulse' && packet.by === id) return done(packet);
          if (type === 'pickup' && packet.type === 'mission-state' && !packet.pickups.some(p => p.id === body.id)) return done(packet);
          if (type === 'resupply') {
            if (packet.type === 'survival') supplyVitals = packet.survival.bandages === 2;
            if (packet.type === 'arsenal') supplyArsenal = packet.arsenal.pistol.reserve === 60 && packet.arsenal.rifle.reserve === 120;
            if (supplyVitals && supplyArsenal) return done({ type: 'resupply-confirmed' });
          }
          if (packet.type === 'error') return fail(packet.message);
        }
        if (packet.type !== 'snapshot') return;
        const me = packet.players.find(p => p.id === id); if (!me) return;
        last = { hp: me.hp, x: me.x, z: me.z, stamina: me.survival?.stamina, sent };
        if (me.hp <= 0) {
          if (restarting) return;
          if (restarts >= 2) return fail('repeated deaths before interaction');
          sent = false; supplyVitals = supplyArsenal = false; restarting = true; restarts++;
          socket.send(JSON.stringify({ type: 'restart' })); return;
        }
        restarting = false;
        // A range/line-of-sight miss does not acknowledge a strike. Retry against a
        // fresh snapshot, not a stale target, while respecting the server cooldown.
        if (type === 'strike' && sent && performance.now() - lastMove >= 1400) sent = false;
        if (sent) return;
        if (type === 'strike') {
          const enemy = packet.horde.enemies.filter(e => e.hp > 0).sort((a,b) => Math.hypot(a.x-me.x,a.z-me.z)-Math.hypot(b.x-me.x,b.z-me.z))[0];
          if (!enemy) return;
          target = { x: enemy.x, z: enemy.z, radius: 2.8 };
        }
        const dx = target ? target.x - me.x : 0, dz = target ? target.z - me.z : 0;
        const distance = Math.hypot(dx, dz);
        if (!target || distance <= target.radius) {
          sent = true; lastMove = performance.now();
          socket.send(JSON.stringify({ type: type === 'unowned-pulse' ? 'pulse' : ['strike','unowned-strike'].includes(type) ? 'companion-strike' : type, ...body })); return;
        }
        const now = performance.now(); if (now - lastMove < 90) return; lastMove = now;
        const sprint = !!me.survival && !me.survival.exhausted && me.survival.stamina > 5;
        const step = Math.min(distance - target.radius + 0.05, sprint ? 0.55 : 0.32);
        socket.send(JSON.stringify({ type: 'move', x: me.x + dx / distance * step, z: me.z + dz / distance * step, yaw: Math.atan2(-dx, -dz), sprinting: sprint, aiming: false, pitch: 0, weapon: 'pistol' }));
      }
      socket.addEventListener('message', handle);
    }), { type, target, body });

    await perform('unowned-pulse', null, {});
    await perform('unowned-strike', null, {});
    assert.equal(await actor.evaluate(() => window.__nextgenRoom.getRoomInfo().acceptedPulses), 0);
    console.log('Unowned Pulse rejected by the server.');
    await perform('bond', { ...CREATURES.lanternkin, radius: 2.35 }, { species: 'lanternkin' });
    await Promise.all(pages.map(page => page.waitForFunction(id => window.__nextgenRoom.getRoomInfo().companionViews.some(v => v.id === id && v.species === 'lanternkin'), id, wait)));
    await actor.waitForFunction(() => !window.__nextgenRoom.getRoomInfo().fieldMarkers.includes('bond:lanternkin'), null, wait);
    console.log('Server-owned Lanternkin bonded; both clients render the companion.');
    await perform('pulse', null, {});
    await Promise.all(pages.map(page => page.waitForFunction(id => { const s = window.__nextgenRoom.getRoomInfo(); return s.acceptedPulses >= 1 && s.companionViews.some(v => v.id === id && v.pulseCount >= 1); }, id, wait)));
    console.log('Server-confirmed Pulse broadcast and visual received on both clients.');
    await perform('pickup', { ...PICKUPS[0], radius: 2.35 }, { id: PICKUPS[0].id });
    await Promise.all(pages.map(page => page.waitForFunction(id => { const s = window.__nextgenRoom.getRoomInfo(); return s.mission.salvage >= 1 && !s.fieldMarkers.includes(`pickup:${id}`); }, PICKUPS[0].id, wait)));
    console.log('Shared salvage marker removed only after server confirmation.');
    await perform('resupply', { ...SUPPLIES[0], radius: 2.4 }, { id: SUPPLIES[0].id });
    console.log('Server confirmed reserve ammo and bandage resupply.');
    await perform('strike', null, {});
    await Promise.all(pages.map(page => page.waitForFunction(id => { const s = window.__nextgenRoom.getRoomInfo(); return s.acceptedStrikes >= 1 && s.companionViews.some(v => v.id === id && v.strikeCount >= 1); }, id, wait)));
    console.log('NEXTGEN FIELD: owned companion, rejected unowned Pulse/strike, synchronized Pulse and strike VFX, shared salvage and resupply passed. Full extraction and manual gameplay remain pending.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
