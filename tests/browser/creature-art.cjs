const assert = require('node:assert/strict');
const { launchBrowser } = require('./support.cjs');
(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto((process.env.GAME_URL || 'http://localhost:5173') + '/tests/browser/actor-gallery.html?freeze=1');
  await page.waitForFunction(() => window.ready);
  const result = await page.evaluate(async () => {
    const { CREATURES } = await import('/shared/expansion.mjs');
    const { companion: c, T, scene, renderer, camera, players, zombies } = gallery;
    players.forEach(p => p.root.visible = false);
    zombies.forEach(z => z.root.visible = false);
    camera.position.set(1.9, 2.3, -4.2); camera.lookAt(0, 1.15, 0);
    const forms = [], counts = [];
    for (let round = 0; round < 3; round++) {
      for (const species of ['lanternkin', 'emberling', 'mossback', 'stormrook', 'reedwisp']) {
        const signatures = new Set();
        for (const xp of [0, 120, 400]) {
          c.setForm(species, xp); c.elapsed = 0; c.pulseTime = 0;
          const home = CREATURES[species];
          if (!c.canBond(new T.Vector3(home.x + 2.69, 0, home.z)) || c.canBond(new T.Vector3(home.x + 2.71, 0, home.z)))
            throw Error('Art changed bonding distance');
          c.updateRemote(0, new T.Vector3(), 0, false);
          if (c.eyes.length !== 2) throw Error('Missing expressive eyes: ' + species);
          let triangles = 0;
          c.visual.traverse(o => {
            if (!o.isMesh) return;
            const g = o.geometry;
            for (const key of ['position', 'normal'])
              if (!Array.from(g.attributes[key].array).every(Number.isFinite)) throw Error('Non-finite mesh ' + species);
            triangles += (g.index?.count || g.attributes.position.count) / 3;
          });
          if (triangles > 18000) throw Error('Creature geometry budget: ' + species + ' ' + triangles);
          signatures.add(triangles);
          c.root.updateMatrixWorld(true);
          const bounds = new T.Box3().setFromObject(c.visual);
          if (bounds.min.y < -0.035) throw Error('Ground clipping: ' + species + ' ' + xp + ' ' + bounds.min.y);
          if (bounds.getSize(new T.Vector3()).length() > 5) throw Error('Creature scale exceeded ' + species);
          c.elapsed = 4.68; c.updateRemote(0.1, new T.Vector3(), 0, false);
          const blink = c.eyes[0].scale.y;
          c.updateRemote(0.3, new T.Vector3(), 0, true);
          if (!(blink < 0.25 && c.eyes[0].scale.y > 0.9)) throw Error('Blink did not recover');
          c.triggerPulse(); c.updateRemote(0.2, new T.Vector3(), 0, true);
          c.root.updateMatrixWorld(true);
          if (new T.Box3().setFromObject(c.visual).min.y < -0.035) throw Error('Pulse clipped through ground');
          c.updateRemote(0.7, new T.Vector3(), 0, false);
          renderer.render(scene, camera);
          if (!round) forms.push({ species, xp, triangles });
        }
        if (signatures.size !== 3) throw Error('Evolution forms have identical geometry: ' + species);
        const home = CREATURES[species];
        c.root.position.set(home.x, 1.25, home.z); c.root.rotation.y = 0;
        for (let frame = 0; frame < 60; frame++)
          c.update(1 / 60, new T.Vector3(home.x, 0, home.z + 2), 0, { constrainActorPosition() {} });
        if (Math.abs(c.root.rotation.y) < 3 || c.root.position.x !== home.x || c.root.position.z !== home.z)
          throw Error('Wild creature attention moved its habitat anchor');
      }
      counts.push({ ...renderer.info.memory });
    }
    if (counts[2].geometries !== counts[1].geometries || counts[2].textures !== counts[1].textures)
      throw Error('Evolution/resource leak');
    c.dispose(); c.dispose(); renderer.render(scene, camera);
    return { forms, counts, remaining: { ...renderer.info.memory } };
  });
  assert.equal(result.forms.length, 15);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
