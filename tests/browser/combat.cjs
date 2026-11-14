const { chromium } = require('playwright');
const path = require('node:path'),
  fs = require('node:fs');
const output = process.env.ARTIFACT_DIR || path.join(require('node:os').tmpdir(), 'murk-combat-check');
fs.mkdirSync(output, { recursive: true });
(async () => {
  const b = await chromium.launch({
    executablePath: '/usr/bin/chromium',
    headless: true,
    args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.route('**/api/account/**', (r) => r.fulfill({ json: {} }));
  await p.goto(process.env.GAME_URL || 'http://localhost:5173');
  const result = await p.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const { Game } = await import('/src/client/game/Game.ts');
    const { CombatFeedback } = await import('/src/client/game/CombatFeedback.ts');
    const { Firearms } = await import('/src/client/game/Firearms.ts');
    const { newVitals } = await import('/shared/survival.mjs');
    const scene = new T.Scene(),
      feedback = new CombatFeedback(scene),
      camera = new T.PerspectiveCamera(58, 1, 0.1, 350);
    camera.position.set(0.75, 2, 5);
    camera.lookAt(0, 1.3, 0);
    camera.updateMatrixWorld();
    const shots = [];
    let allowed = true;
    const player = {
      root: new T.Group(),
      getHealth: () => 100,
      getPosition: () => new T.Vector3(),
      triggerShot() {},
      muzzlePosition: () => new T.Vector3(0.2, 1.3, 0),
    };
    const fake = {
      camera,
      aimRay: new T.Raycaster(),
      cameraYaw: 0,
      player,
      feedback,
      firearms: { selected: 'pistol', tryFire: () => allowed, muzzle: () => player.muzzlePosition(), effect() {} },
      infected: { alive: [] },
      vitals: newVitals(),
      multiplayer: { connected: true, send: (type, body) => shots.push({ type, ...body }) },
    };
    const source = camera.matrixWorld.toArray();
    Game.prototype.handleShooting.call(fake);
    feedback.prepareCamera(camera, 0.016);
    const recoilMoved = feedback.camera.quaternion.angleTo(camera.quaternion) > 0;
    Game.prototype.handleShooting.call(fake);
    allowed = false;
    Game.prototype.handleShooting.call(fake);
    if (
      JSON.stringify(shots[0]) !== JSON.stringify(shots[1]) ||
      shots.length !== 2 ||
      JSON.stringify(source) !== JSON.stringify(camera.matrixWorld.toArray()) ||
      !recoilMoved
    )
      throw Error('Cosmetic recoil crossed gameplay boundary');
    feedback.setQuality('mobile');
    for (let i = 0; i < 30; i++) feedback.impact(new T.Vector3(0, 1, 0));
    feedback.update(0.01);
    if (feedback.geometry.drawRange.count !== 12) throw Error('Mobile particle budget');
    feedback.setQuality('low');
    feedback.update(0.01);
    if (feedback.geometry.drawRange.count !== 0) throw Error('Performance particles');
    feedback.setQuality('cinematic');
    for (let i = 0; i < 30; i++) feedback.impact(new T.Vector3(0, 1, 0));
    feedback.update(0.01);
    if (feedback.geometry.drawRange.count !== 64) throw Error('Cinematic budget');
    feedback.update(1);
    if (feedback.geometry.drawRange.count !== 0) throw Error('Particles failed cleanup');
    const gun = new Firearms(scene, player, feedback);
    gun.arsenal.pistol.magazine = 0;
    gun.update(0.01);
    if (!document.querySelector('.weapon-panel').classList.contains('empty')) throw Error('Empty state');
    gun.reload();
    gun.update(0.01);
    if (!document.querySelector('.weapon-panel').classList.contains('reloading')) throw Error('Reload state');
    window.combatHarness = { scene, feedback, camera, gun, T };
    return { outgoingShots: shots.length, recoilMoved, particles: feedback.geometry.drawRange.count };
  });
  console.log(result);
  await p.evaluate(() => {
    document.querySelector('#auth-gate').hidden = true;
    document.querySelector('#account-panel').hidden = true;
    document.querySelector('#title-screen').classList.add('is-hidden');
    document.querySelector('#field-menu').hidden = false;
  });
  await p.locator('#combat-mute').check();
  await p.locator('#combat-volume').fill('20');
  await p.locator('#combat-volume').dispatchEvent('input');
  console.log('settings', await p.evaluate(() => JSON.parse(localStorage.getItem('murk-combat-audio'))));
  await p.screenshot({ path: path.join(output, 'combat-settings.png') });
  await p.locator('#combat-mute').uncheck();
  const sound = await p.evaluate(async () => {
    const audio = combatHarness.feedback.audio;
    await audio.context?.resume();
    for (const cue of ['pistol', 'rifle', 'reload', 'ready', 'hit', 'melee', 'hurt', 'heal']) audio.play(cue);
    return {
      state: audio.context?.state,
      buffers: audio.buffers.size,
      finite: [...audio.buffers.values()].every((b) => [...b.getChannelData(0)].every(Number.isFinite)),
    };
  });
  console.log('audio graph', sound);
  if (sound.state !== 'running' || sound.buffers !== 8 || !sound.finite) throw Error('Synthesized audio graph failed');
  await p.evaluate(() => {
    const audio = combatHarness.feedback.audio;
    const create = audio.context.createBuffer;
    audio.buffers.delete('pistol');
    audio.context.createBuffer = () => { throw new Error('Simulated unavailable audio device'); };
    audio.play('pistol');
    audio.context.createBuffer = create;
  });
  await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.evaluate(() => {
    const { feedback, camera } = combatHarness;
    feedback.reset();
    feedback.shot('pistol');
    feedback.prepareCamera(camera, 0.016);
    if (feedback.camera.quaternion.angleTo(camera.quaternion) > 0.00001) throw Error('Reduced motion recoil');
  });
  await p.evaluate(() => {
    combatHarness.feedback.dispose();
    combatHarness.gun.dispose();
  });
  console.log('errors', errors);
  await b.close();
  if (errors.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
