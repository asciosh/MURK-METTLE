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
  const spriteMode = process.env.NEXTGEN_SPRITE_TEST === '1';
  const wait = { timeout: 45000, polling: 100 };
  try {
    const pages = await Promise.all([0, 1].map(async i => {
      const ctx = await browser.newContext();
      const registration = await ctx.request.post(new URL(`/api/account/register?username=fd_${suffix}_${i}`, base).href, { headers: { Origin: base.origin }, data: { pin: '482716' } });
      assert.ok(registration.ok(), `Registration failed: ${registration.status()}`);
      const page = await ctx.newPage();
      if (spriteMode && i === 0) {
        await page.goto(new URL('/?nextgen=lobby&tab=mods&view=packs',base).href);
        await page.locator('#ng-sprite-demo').click({timeout:60000});
        await page.getByText('Original Pixel Companions',{exact:false}).waitFor({timeout:60000});
        await page.locator('#ng-sprite-enable').click();
        await page.locator('#ng-sprite-pack[data-enabled="true"]').waitFor();
      }
      await page.addInitScript(() => {
        const Native = window.WebSocket;
        window.WebSocket = class extends Native {
          constructor(...args) { super(...args); if (new URL(args[0], location.href).pathname === '/room') window.__testRoomSocket = this; }
        };
      });
      return page;
    }));
    // Finish both clients' account/cosmetic setup BEFORE either starts the live room.
    // The horde does not wait for the other browser to import its appearance pack.
    await Promise.all(pages.map(async page => {
      await page.goto(new URL(`/?nextgenRoom=${room}`, base).href);
      await page.waitForFunction(() => { const s = window.__nextgenRoom?.getRoomInfo(); return s?.connected && s.peers.length === 1 && s.collection && s.mission && s.inventory; }, null, wait);
    }));
    const actor = pages[0];
    for (const page of pages) {
      await page.locator('.nextgen-hud[data-mode="coop"] .nextgen-health').waitFor();
      await page.locator('.nextgen-hud[data-mode="coop"] .nextgen-ability-panel').waitFor({state:'attached'});
      // The actual HUD intentionally hides abilities when downed/dead. Assert the
      // visibility contract against the real snapshot instead of waiting forever
      // for a dead survivor to become alive without sending any input.
      await page.waitForFunction(() => {
        const info=window.__nextgenRoom?.getRoomInfo();
        const panel=document.querySelector('.nextgen-hud[data-mode="coop"] .nextgen-ability-panel');
        return !!info?.self && !!panel && (getComputedStyle(panel).display!=='none')===(info.self.hp>0);
      },null,wait);
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
      let sent = false, restarting = false, restarts = 0, lastMove = 0, last = null, captureStarted=false, captureProgressSeen=false;
      let supplyVitals = false, supplyArsenal = false;
      const cleanup = () => { clearTimeout(timer); socket.removeEventListener('message', handle); };
      const done = packet => { cleanup(); resolve({ type, restarts, packet,captureStarted,captureProgressSeen }); };
      const fail = message => { cleanup(); reject(new Error(`${type}: ${message}; last=${JSON.stringify(last)}`)); };
      const timer = setTimeout(() => fail('no server acknowledgement'), type==='capture'?55000:30000);
      function handle(event) {
        let packet;
        try { packet = JSON.parse(event.data); } catch { return; }
        if (sent) {
          if (type === 'unowned-pulse' && packet.type === 'error' && /bond/i.test(packet.message)) return done(packet);
          if (type === 'unowned-strike' && packet.type === 'error' && /bond/i.test(packet.message)) return done(packet);
          if (type === 'strike' && packet.type === 'companion-strike' && packet.by === id) return done(packet);
          if (type === 'bond' && packet.type === 'collection-state' && packet.bonded && packet.collection.creatures[body.species].owned) return done(packet);
          if (type === 'capture' && packet.type === 'creature-captured') return done(packet);
          if(type==='capture'&& packet.type==='capture-state' && packet.status==='started')captureStarted=true;
          if(type==='capture'&& packet.type==='capture-state' && packet.status==='cancelled') {sent=false;lastMove=0;socket.send(JSON.stringify({type:'pulse'}));return;}
          if (type === 'auto' && packet.type === 'companion-strike' && packet.auto && packet.by === id) return done(packet);
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
        if(type==='capture'&&typeof me.captureProgress==='number'&&me.captureProgress>0&&me.captureProgress<1)captureProgressSeen=true;
        last = { hp: me.hp, x: me.x, z: me.z, stamina: me.survival?.stamina, sent };
        if (me.hp <= 0) {
          if (restarting) return;
          if (restarts >= (type==='capture'?4:2)) return fail('repeated deaths before interaction');
          sent = false; supplyVitals = supplyArsenal = false; restarting = true; restarts++;
          socket.send(JSON.stringify({ type: 'restart' })); return;
        }
        restarting = false;
        // A range/line-of-sight miss does not acknowledge a strike. Retry against a
        // fresh snapshot, not a stale target, while respecting the server cooldown.
        if (type === 'strike' && sent && performance.now() - lastMove >= 1400) sent = false;
        if (type === 'auto' && sent && performance.now()-lastMove>=2500 && !me.nativeCompanion?.targetId) sent=false;
        if (sent) return;
        if (type === 'strike' || type === 'auto') {
          const enemy = packet.horde.enemies.filter(e => e.hp > 0).sort((a,b) => Math.hypot(a.x-me.x,a.z-me.z)-Math.hypot(b.x-me.x,b.z-me.z))[0];
          if (!enemy) return;
          target = { x: enemy.x, z: enemy.z, radius: type === 'auto' ? 6 : 2.8 };
        }
        const dx = target ? target.x - me.x : 0, dz = target ? target.z - me.z : 0;
        const distance = Math.hypot(dx, dz);
        if (!target || distance <= target.radius) {
          sent = true; lastMove = performance.now();
          socket.send(JSON.stringify({ type: type === 'auto' ? 'companion-mode' : type === 'unowned-pulse' ? 'pulse' : ['strike','unowned-strike'].includes(type) ? 'companion-strike' : type, ...body })); return;
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
    if (spriteMode) {
      await pages[0].waitForFunction(id=>window.__nextgenRoom.getRoomInfo().companionViews.some(v=>v.id===id&&v.appearance==='sprite'),id,wait);
      await pages[1].waitForFunction(id=>window.__nextgenRoom.getRoomInfo().companionViews.some(v=>v.id===id&&v.appearance==='original'),id,wait);
      console.log('NEXTGEN SPRITES: same authoritative creature, sprite on installed client and original fallback on second client.');
    }
    // Real authenticated roster: bonding imports exactly one unique instance, never another player's.
    const readRoster = async page => {
      // Use the browser cookie jar and same-origin fetch, just like the real journal.
      // APIRequestContext may handle Secure cookies differently on HTTP loopback hosts.
      const response = await page.evaluate(async () => {
        const result = await fetch('/api/account/nextgen-roster', { credentials:'same-origin', cache:'no-store' });
        return { ok:result.ok, status:result.status, body:await result.text() };
      });
      assert.ok(response.ok, `Roster GET returned HTTP ${response.status}: ${response.body.slice(0,240)}`);
      return JSON.parse(response.body).roster;
    };
    const roster = await readRoster(actor);
    assert.equal(roster.instances.length, 1);
    assert.equal(roster.instances[0].familyId, 'lanternkin');
    assert.equal(roster.activeId, roster.instances[0].id);
    assert.deepEqual((await readRoster(pages[1])).instances, []);
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
    const journal = await actor.context().newPage();
    try {
      await journal.goto(new URL('/?nextgen=lobby&tab=collection', base).href);
      const card = journal.locator('#ng-creature-collection article');
      await card.waitFor();
      assert.equal(await card.getAttribute('data-creature-id'), roster.activeId);
      await journal.reload(); await card.waitFor();
      assert.equal(await card.getAttribute('data-creature-id'), roster.activeId);
    } finally { await journal.close(); }
    console.log('M04-C1: individual cloud roster identity and private journal persist across reload; account isolation confirmed.');
    if (process.env.NEXTGEN_CAPTURE_TEST === '1' || process.env.NEXTGEN_COMPANION_TEST === '1') {
      const { NATIVE_CAPTURE } = await import('../../shared/nextgen-creature-roster.mjs');
      await actor.waitForFunction(() => {const s=window.__nextgenRoom.getRoomInfo();return s.self?.captureKit===1 && s.fieldVisuals.some(m=>m.id==='capture:wild-lanternkin'&&m.kind==='wild-creature'&&m.physical);},null,wait);
      const captured = await perform('capture',{...NATIVE_CAPTURE,radius:2.35},{id:NATIVE_CAPTURE.id});
      assert.equal(captured.captureStarted,true);assert.equal(captured.captureProgressSeen,true);
      const nativeId = captured.packet.id; assert.notEqual(nativeId,roster.activeId);
      await actor.waitForFunction(id=>{const s=window.__nextgenRoom.getRoomInfo();return s.self.creatureInstanceId===id && s.self.creatureFormXp===0 && s.self.captureKit===0 && !s.fieldMarkers.includes('capture:wild-lanternkin');},nativeId,wait);
      console.log('M04-C4: visible wild creature, timed server capture and capsule consumption confirmed.');
      await pages[1].waitForFunction(id=>window.__nextgenRoom.getRoomInfo().remotePlayers.some(p=>p.creatureInstanceId===id),nativeId,wait);
      const after = await readRoster(actor); assert.equal(after.activeId,nativeId); assert.equal(after.instances.length,2);
      assert.equal(after.instances.find(c=>c.id===nativeId).origin,'native');
      assert.equal((await readRoster(pages[1])).instances.length,0);
      if (process.env.NEXTGEN_COMPANION_TEST === '1') {
        await actor.waitForFunction(()=>{const s=window.__nextgenRoom.getRoomInfo();return s.self?.nativeCompanion?.maxHp===80 && s.self.nativeCompanion.mode==='follow' && document.querySelector('.nextgen-companion-vitals')?.dataset.hp!==undefined;},null,wait);
        await perform('auto',null,{mode:'aggressive'});
        await Promise.all(pages.map(page=>page.waitForFunction(id=>{
          const s=window.__nextgenRoom.getRoomInfo(),p=s.self?.id===id?s.self:s.remotePlayers.find(p=>p.id===id);
          return s.acceptedAutoStrikes>=1 && p?.nativeCompanion?.maxHp===80 && Number.isFinite(p.nativeCompanion.x) && p.nativeCompanion.hp>=0&&p.nativeCompanion.hp<=80;
        },id,wait)));
        console.log('M04-C3: native companion HUD, replicated authoritative HP and position, and autonomous infected strike confirmed on both clients.');
      }
      const panel = await actor.context().newPage();
      try {
        await panel.goto(new URL('/?nextgen=lobby&tab=collection',base).href);
        const nativeCard=panel.locator(`article[data-creature-id="${nativeId}"]`);
        await nativeCard.waitFor(); assert.equal(await nativeCard.getByRole('button',{name:'EVOLVE'}).isDisabled(),true);
        const oldCard=panel.locator(`article[data-creature-id="${roster.activeId}"]`);
        await oldCard.getByRole('button',{name:'SELECT COMPANION'}).click();
        await nativeCard.getByRole('button',{name:'SELECT COMPANION'}).waitFor();
        assert.equal((await readRoster(panel)).activeId,roster.activeId);
        await nativeCard.getByRole('button',{name:'SELECT COMPANION'}).click();
        await oldCard.getByRole('button',{name:'SELECT COMPANION'}).waitFor();
        assert.equal((await readRoster(panel)).activeId,nativeId);
      } finally { await panel.close(); }
      console.log('M04-C2: real field capture, independent native/legacy IDs, replicated deployment, removed marker, account isolation, locked early evolution and collection selection passed.');
    }
    console.log('NEXTGEN FIELD: owned companion, rejected unowned Pulse/strike, synchronized Pulse and strike VFX, shared salvage and resupply passed. Full extraction and manual gameplay remain pending.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
