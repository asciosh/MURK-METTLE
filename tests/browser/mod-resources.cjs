// Called from mods.cjs after its UI fixture. Uses a textured original asset to exercise real GPU disposal.
const fs = require('node:fs');
module.exports = async function resources(page) {
  const { makeZip } = await import('../../scripts/cosmetic-zip.mjs');
  const folder = 'examples/creature-mods/copperbloom/',
    model = fs.readFileSync(folder + 'model.glb'),
    png = fs.readFileSync(folder + 'icon.png');
  const manifest = {
    ...JSON.parse(fs.readFileSync(folder + 'manifest.json')),
    id: 'asciosh-resource-test',
    name: '<img src=x onerror=window.__modXss=1>',
    textures: ['texture.png'],
  };
  const jsonLength = model.readUInt32LE(12),
    gltf = JSON.parse(model.subarray(20, 20 + jsonLength));
  gltf.images = [{ uri: 'texture.png', mimeType: 'image/png' }];
  gltf.textures = [{ source: 0 }];
  gltf.materials[0].pbrMetallicRoughness.baseColorTexture = { index: 0 };
  let json = Buffer.from(JSON.stringify(gltf));
  json = Buffer.concat([json, Buffer.alloc((4 - (json.length % 4)) % 4, 32)]);
  const header = Buffer.from(model.subarray(0, 20));
  header.writeUInt32LE(json.length, 12);
  header.writeUInt32LE(28 + json.length + model.subarray(28 + jsonLength).length, 8);
  const changed = Buffer.concat([header, json, model.subarray(20 + jsonLength)]);
  const zip = makeZip([
    ['manifest.json', Buffer.from(JSON.stringify(manifest))],
    ['model.glb', changed],
    ['icon.png', png],
    ['texture.png', png],
    ['LICENSE.txt', fs.readFileSync(folder + 'LICENSE.txt')],
  ]);
  console.log(
    'GPU lifecycle',
    await page.evaluate(async (payload) => {
      const T = await import('/node_modules/three/build/three.module.js'),
        { ModRegistry } = await import('/src/client/mods/ModRegistry.ts'),
        { Companion } = await import('/src/client/game/Companion.ts');
      const registry = new ModRegistry();
      await registry.ready;
      const scene = new T.Scene(),
        actor = new Companion(scene, 'lanternkin', registry),
        renderer = new T.WebGLRenderer({ antialias: false }),
        camera = new T.PerspectiveCamera(50, 1, 0.1, 20);
      renderer.setSize(240, 240, false);
      scene.add(new T.HemisphereLight(0xffffff, 0x445544, 3));
      camera.position.set(1, 2, -4);
      camera.lookAt(0, 1.2, 0);
      actor.updateRemote(0.1, new T.Vector3(), 0, false);
      renderer.render(scene, camera);
      const before = { ...renderer.info.memory };
      const id = await registry.import(new Blob([new Uint8Array(payload)]));
      await registry.enable(id);
      for (let i = 0; i < 100 && !actor.cosmetic; i++) await new Promise((r) => setTimeout(r, 10));
      if (!actor.cosmetic) throw Error('Textured model did not activate');
      actor.updateRemote(0.1, new T.Vector3(), 0, false);
      renderer.render(scene, camera);
      const enabled = { ...renderer.info.memory };
      if (enabled.textures <= before.textures) throw Error('Texture was not uploaded');
      const source = registry.sources.get(id);
      let bitmap = null;
      source.asset.scene.traverse((o) => {
        if (o.isMesh && o.material.map) bitmap = o.material.map.source.data;
      });
      const { ModVisual } = await import('/src/client/mods/ModVisual.ts');
      const staticVisual = new ModVisual({ ...source.asset, animations: [] }, source.mod, () => {});
      staticVisual.update(0.1, true);
      staticVisual.pulse();
      staticVisual.update(0.1, false);
      if (staticVisual.action) throw Error('Static fallback created an invalid action');
      staticVisual.dispose();
      await registry.disable(id);
      renderer.render(scene, camera);
      const disabled = { ...renderer.info.memory };
      if (
        disabled.geometries !== before.geometries ||
        disabled.textures !== before.textures ||
        registry.sources.size
      )
        throw Error('Disabled mod retained GPU resources');
      if (bitmap instanceof ImageBitmap && bitmap.width) throw Error('ImageBitmap not closed');
      await registry.enable(id);
      for (let i = 0; i < 100 && !actor.cosmetic; i++) await new Promise((r) => setTimeout(r, 10));
      const saved = registry.records.get(id);
      await registry.store.save([{ ...saved, zip: new Blob(['corrupt']), enabled: true }]);
      const missing = new ModRegistry(),
        fallback = new Companion(new T.Scene(), 'lanternkin', missing);
      await missing.ready;
      for (let i = 0; i < 300 && !missing.errors.has(id); i++) await new Promise((r) => setTimeout(r, 10));
      if (fallback.cosmetic || !fallback.visual.visible || !missing.errors.has(id))
        throw Error('Corrupt/missing cached mod did not keep official fallback');
      fallback.dispose();
      missing.dispose();
      await registry.store.save([saved]);
      const pendingVisual = registry.preview(id);
      registry.dispose();
      let rejected = false;
      try {
        await pendingVisual;
      } catch {
        rejected = true;
      }
      if (!rejected) throw Error('Late preview attached after registry disposal');
      actor.dispose();
      const cleanup = new ModRegistry();
      await cleanup.ready;
      await cleanup.remove(id);
      cleanup.dispose();
      renderer.render(scene, camera);
      const disposed = { ...renderer.info.memory };
      if (disposed.geometries || disposed.textures !== before.textures)
        throw Error(
          'Actor disposal retained GPU resources ' +
            JSON.stringify({ before, enabled, disabled, disposed, cache: registry.sources.size }),
        );
      registry.dispose();
      renderer.dispose();
      const rendererDisposed = { ...renderer.info.memory };
      if (rendererDisposed.geometries || rendererDisposed.textures)
        throw Error('Renderer teardown retained GPU resources');
      renderer.forceContextLoss();
      return { before, enabled, disabled, disposed, rendererDisposed };
    }, Array.from(zip)),
  );
  // Render malicious-looking metadata in the actual manager; it must remain plain text.
  await page.locator('#field-menu-toggle').click();
  await page.locator('#mods-open').click();
  await page
    .locator('#mods-file')
    .setInputFiles({ name: 'test.mmcosmetic', mimeType: 'application/zip', buffer: zip });
  await page.waitForFunction(() => document.querySelector('#mods-list h3')?.textContent.includes('onerror'));
  if ((await page.locator('#mods-list img').count()) || (await page.evaluate(() => window.__modXss)))
    throw Error('Metadata executed HTML');
  await page.locator('#mods-list summary').click();
  await page.waitForFunction(() =>
    document.querySelector('#mods-list pre')?.textContent.includes('CC0 1.0 Universal'),
  );
  await page.locator('#mods-list').getByRole('button', { name: 'Remove', exact: true }).click();
  await page.locator('#mods-close').click();
};
