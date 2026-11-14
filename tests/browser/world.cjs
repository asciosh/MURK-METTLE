const { chromium } = require('playwright');
const path = require('node:path'),
  fs = require('node:fs');
const output = process.env.ARTIFACT_DIR || path.join(require('node:os').tmpdir(), 'murk-world-check');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const b = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await p.goto((process.env.GAME_URL || 'http://localhost:5173') + '/tests/browser/world.html');
  await p.waitForFunction(() => window.ready, { timeout: 90000 });
  for (const view of [
    'camp',
    'haven',
    'wetland',
    'relay',
    'pines',
    'lanternkin',
    'emberling',
    'mossback',
    'stormrook',
    'reedwisp',
  ]) {
    console.log(view, await p.evaluate((v) => worldView.capture(v), view));
    await p.screenshot({ path: path.join(output, `${view}.png`) });
  }
  console.log(
    'structure',
    await p.evaluate(async () => {
      const { scene, world, THREE } = worldView;
      const { TREES, CREATURES, SUPPLIES, BUILDINGS } = await import('/shared/expansion.mjs');
      const { renderProfile } = await import('/shared/render-profile.mjs');
      const ground = scene.getObjectByName('flat-playable-ground');
      if (!ground) throw Error('Playable floor missing');
      const points = ground.geometry.getAttribute('position');
      for (let i = 0; i < points.count; i++)
        if (Math.abs(points.getY(i) + ground.position.y + 0.025) > 0.00001) throw Error('Playable terrain displaced');
      const crowns = world.spatial.map(s => s.source).filter(n => ['broadleaf-and-willow-crowns', 'southern-pine-crowns'].includes(n.name));
      const before = crowns.map((m) => new Float32Array(m.instanceMatrix.array));
      const full = crowns.reduce((a, m) => a + m.count, 0);
      if (full !== TREES.length * 10) throw Error('Tree crowns do not match collision tree list');
      world.setQuality(renderProfile('mobile'));
      if (crowns.reduce((a, m) => a + m.count, 0) !== TREES.length * 5) throw Error('Mobile crown distribution');
      world.setQuality(renderProfile('balanced'));
      crowns.forEach((m, i) => {
        if (m.instanceMatrix.array.some((v, k) => v !== before[i][k])) throw Error('Preset switch lost crown matrices');
      });
      for (const point of [...Object.values(CREATURES), ...SUPPLIES]) {
        const p = new THREE.Vector3(point.x, 0, point.z);
        world.constrainPlayerPosition(p);
        if (p.distanceTo(new THREE.Vector3(point.x, 0, point.z)) > 0.00001) throw Error('Gameplay anchor obstructed');
      }
      const { TRAIL_SPURS } = await import('/src/client/game/world-composition.mjs');
      for (const s of TRAIL_SPURS)
        for (let i = 0; i <= 100; i++) {
          const p = new THREE.Vector3(s.x1 + ((s.x2 - s.x1) * i) / 100, 0, s.z1 + ((s.z2 - s.z1) * i) / 100);
          const q = p.clone();
          world.constrainPlayerPosition(q);
          if (p.distanceTo(q) > 0.01) throw Error('Trail crosses collision');
        }
      for (const [id, home] of Object.entries(CREATURES)) {
        const anchor = scene.getObjectByName('habitat-anchor-' + id);
        if (!anchor || anchor.position.x !== home.x || anchor.position.z !== home.z || !anchor.userData.visualOnly)
          throw Error('Habitat anchor changed');
      }
      return {
        flatFloor: true,
        trees: TREES.length,
        crownCards: full,
        habitats: Object.keys(CREATURES).length,
        supplies: SUPPLIES.length,
        buildings: BUILDINGS.length,
      };
    }),
  );
  for (const quality of ['mobile', 'low', 'cinematic']) {
    console.log(quality, await p.evaluate((q) => worldView.capture('wetland', q), quality));
    await p.screenshot({ path: path.join(output, `wetland-${quality}.png`) });
  }
  console.log('errors', errors);
  await b.close();
  if (errors.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
