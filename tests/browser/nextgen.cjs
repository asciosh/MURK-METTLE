// NEXTGEN M01 graphics smoke fixture. Verifies the independent nextgen renderer
// scene loads through the real Three.js backend (WebGPU when supported, WebGL 2
// otherwise), records ACTUAL frame/telemetry numbers, and exercises resource
// ownership (dispose) and resize. Runs against a local Vite dev server.
//
// Usage: GAME_URL=http://localhost:5173 node tests/browser/nextgen.cjs
const { launchBrowser } = require('./support.cjs');
const fs = require('node:fs'),
  path = require('node:path');

const destination = process.env.PERF_OUTPUT ||
  path.join(require('node:os').tmpdir(), 'murk-nextgen.json');
const url = (process.env.GAME_URL || 'http://localhost:5173') + '/tests/browser/nextgen.html';

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on('pageerror', (e) => {
  errors.push(String(e));
  console.error('PAGE ERROR:', e);
});
  page.on('console', (m) => {
    console.log('BROWSER:', m.type(), m.text());
  });

  await page.addInitScript(() => {
    localStorage.setItem(
      'murk-mettle-graphics',
      JSON.stringify({ quality: 'balanced', photo: false })
    );
  });

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(
    () => window.__m01DemoLoaded === true,
    undefined,
    { timeout: 90000 }
  );
  await page.waitForTimeout(600); // let a handful of display frames render

  const actual = await page.evaluate(async () => {
    const demo = window.__m01Demo;
    if (!demo) throw new Error('nextgen demo not exposed on window.');

    // Resize (responsive resolution + pixel ratio path).
    demo.resize(1280, 720);
    const canvas = demo.backendRenderer?.domElement;
    if (!canvas) throw new Error('no renderer canvas exposed.');

    const results = demo.getResults();
    const soonest = results && results.length ? results[0] : null;
    const latest = results && results.length ? results[results.length - 1] : null;

    return {
      backend: demo.getDeviceInfo()?.backend ?? 'unknown',
      deviceName: demo.getDeviceInfo()?.deviceName ?? '',
      webgpuAvailable: demo.getDeviceInfo()?.webgpuAvailable,
      fallbackUsed: demo.getDeviceInfo()?.fallbackUsed,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      resultFrames: results ? results.length : 0,
      firstFrameMs: soonest?.frameMs ?? 0,
      lastFrameMs: latest?.frameMs ?? 0,
      drawCalls: latest?.drawCalls ?? 0,
      triangles: latest?.triangles ?? 0,
      geometries: latest?.geometries ?? 0,
      textures: latest?.textures ?? 0,
    };
  });

  const hardware = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2');
    const ext = gl ? gl.getExtension('WEBGL_debug_renderer_info') : null;
    return {
      userAgent: navigator.userAgent,
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unavailable',
      label: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unsupported',
    };
  });

  console.log('nextgen graphics smoke');
  console.log('  backend           :', actual.backend);
  console.log('  device label      :', hardware.renderer);
  console.log('  webgpu available  :', actual.webgpuAvailable);
  console.log('  fallback to WebGL :', actual.fallbackUsed);
  console.log('  canvas px (w x h):', actual.canvasWidth + ' x ' + actual.canvasHeight);
  console.log('  frames sampled    :', actual.resultFrames);
  if (actual.resultFrames) {
    console.log('  first/frame ms    :', actual.firstFrameMs.toFixed(3));
    console.log('  last/ frame ms    :', actual.lastFrameMs.toFixed(3));
    console.log('  geometry / tri / calls:', actual.geometries + ' / ' + actual.triangles + ' / ' + actual.drawCalls);
    console.log('  textures          :', actual.textures);
  }

  const artifact = {
    hardware,
    scenario: 'isolated nextgen demo (PBR ground + instanced vegetation), render once at 1280x720, 600ms font; resource diagnostics',
    url,
    results: actual,
    errors: errors.filter((e) => /THREE/.test(e) === false),
  };
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(artifact, null, 2));

// Verify runtime quality switching.
const presets = [
  { id: 'low', shadows: false, resolution: 512, exposure: 1.0 },
  { id: 'balanced', shadows: true, resolution: 1024, exposure: 1.2 },
  { id: 'cinematic', shadows: true, resolution: 2048, exposure: 1.8 },
  { id: 'balanced', shadows: true, resolution: 1024, exposure: 1.2 },
];

for (const preset of presets) {
  const timestamp = await page.evaluate((id) => {
    const demo = window.__m01Demo;
    const previous = demo.getLastResult().timestampMs;

    demo.setQuality(id);

    return previous;
  }, preset.id);

  await page.waitForFunction(
    previous => window.__m01Demo.getLastResult().timestampMs > previous,
    timestamp,
    { timeout: 60000 }
  );

  const state = await page.evaluate(() => {
    const demo = window.__m01Demo;

    return {
      quality: demo.currentPreset,
      shadows: demo.backendRenderer.shadowMap.enabled,
      sunCastsShadow: demo.sun.castShadow,
      shadowResolution: demo.sun.shadow.mapSize.x,
      exposure: demo.backendRenderer.toneMappingExposure,
      bloomStrength: demo.bloomNode.strength.value,
      drawCalls: demo.getLastResult().drawCalls,
      triangles: demo.getLastResult().triangles,
    };
  });

console.log('Expected quality settings:', preset);
console.log('Actual quality settings:', state);

  if (
    state.quality !== preset.id ||
    state.shadows !== preset.shadows ||
    state.sunCastsShadow !== preset.shadows ||
    state.shadowResolution !== preset.resolution ||
    state.exposure !== preset.exposure
  ) {
    throw new Error(`Quality preset failed: ${preset.id}`);
  }

  console.log(`Quality ${preset.id}: PASS`, state);
}

// Verify that resizing updates the drawing buffer.
await page.evaluate(() => {
  const demo = window.__m01Demo;
  const renderer = demo.backendRenderer;
  const canvas = renderer.domElement;
  const ratio = renderer.getPixelRatio();

  demo.resize(960, 540);

  if (
    canvas.width !== Math.floor(960 * ratio) ||
    canvas.height !== Math.floor(540 * ratio)
  ) {
    throw new Error('Renderer resize failed.');
  }

  demo.resize(1280, 720);
});

console.log('Renderer resize: PASS');

// Trigger a real WebGL context loss.
if (actual.backend === 'webgl2') {
  const lastTimestamp = await page.evaluate(async () => {
    const demo = window.__m01Demo;
    const canvas = demo.backendRenderer.domElement;
    const gl = canvas.getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_lose_context');

    if (!extension) {
      throw new Error('WEBGL_lose_context unavailable.');
    }

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Context loss event not received.'));
      }, 5000);

      canvas.addEventListener('webglcontextlost', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });

      extension.loseContext();
    });

    return demo.getLastResult().timestampMs;
  });

  await page.waitForTimeout(2000);

  const currentTimestamp = await page.evaluate(() =>
    window.__m01Demo.getLastResult().timestampMs
  );

  if (currentTimestamp !== lastTimestamp) {
    throw new Error('Renderer continued after context loss.');
  }

  console.log('WebGL context loss: PASS');
}

// Verify idempotent disposal.
await page.evaluate(() => {
  const demo = window.__m01Demo;

  demo.dispose();
  demo.dispose();

  if (demo.backendRenderer !== null) {
    throw new Error('Renderer was not released.');
  }
});

console.log('Renderer disposal: PASS');

  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await browser.close();

  if (errors.length) {
    console.error('nextgen browser smoke: page errors', errors.join('\n'));
    process.exit(1);
  }
  console.log('nextgen browser smoke: PASS (actual results above)');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
