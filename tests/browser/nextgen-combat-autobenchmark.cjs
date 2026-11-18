'use strict';

const { chromium } = require('playwright');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const WIDTH = 1920;
const HEIGHT = 1080;
const WARMUP_MS = 5000;
const MEASURE_MS = 30000;
const TICK_MS = 250;

const base = (process.env.GAME_URL || 'http://localhost:5174').replace(/\/$/, '');
const url = `${base}/tests/browser/nextgen.html?mode=playable&benchmark=1`;
const destination = process.env.PERF_OUTPUT ||
  path.join(os.tmpdir(), 'murk-nextgen-combat-auto.json');

function summarizeFrames(frames) {
  if (frames.length < 2) throw new Error('Not enough rendered frame samples.');

  const intervals = [];
  for (let i = 1; i < frames.length; i++) {
    const dt = frames[i].timestampMs - frames[i - 1].timestampMs;
    if (!Number.isFinite(dt) || dt <= 0) {
      throw new Error('Invalid rendered frame timestamp.');
    }
    intervals.push(dt);
  }

  const duration = intervals.reduce((sum, dt) => sum + dt, 0);
  if (duration < 29000) {
    throw new Error(`Capture too short: ${(duration / 1000).toFixed(2)} s.`);
  }

  const sorted = [...intervals].sort((a, b) => a - b);
  const percentile = p => sorted[Math.ceil(sorted.length * p) - 1];
  const round = n => Number(n.toFixed(2));

  return {
    durationSeconds: round(duration / 1000),
    frames: frames.length,
    averageFPS: round(intervals.length * 1000 / duration),
    meanFrameMs: round(duration / intervals.length),
    p95FrameMs: round(percentile(0.95)),
    p99FrameMs: round(percentile(0.99)),
    worstFrameMs: round(sorted.at(-1)),
    framesOver25Ms: intervals.filter(ms => ms > 25).length,
    framesOver33Ms: intervals.filter(ms => ms > 33.333).length,
    peakDrawCalls: Math.max(...frames.map(f => f.drawCalls)),
    peakTriangles: Math.max(...frames.map(f => f.triangles)),
    geometries: frames.at(-1).geometries,
    textures: frames.at(-1).textures
  };
}

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--start-maximized']
  });

  let page;
  try {
    page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1
    });

    const windowSession = await page.context().newCDPSession(page);

const { windowId } = await windowSession.send(
  'Browser.getWindowForTarget'
);

await windowSession.send('Browser.setWindowBounds', {
  windowId,
  bounds: { windowState: 'maximized' }
});

await windowSession.detach();

    const errors = [];
    page.on('pageerror', err => {
      errors.push(String(err));
      console.error('PAGE ERROR:', err);
    });

    console.log('Opening automated NEXTGEN combat benchmark...');
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => {
      const demo = window.__m01Demo;
      return window.__m01DemoLoaded === true &&
        demo?.getPlayerModelInfo()?.status === 'ready' &&
        demo.getInfectedInfo().length >= 3 &&
        demo.getInfectedInfo().every(enemy => enemy.status === 'ready');
    }, undefined, { timeout: 90000 });

    await page.bringToFront();

    const configuration = await page.evaluate(() => {
      const demo = window.__m01Demo;
      demo.setQuality('balanced');
      demo.backendRenderer.setPixelRatio(1);
      demo.resize(1920, 1080);

      const renderer = demo.backendRenderer;
      const device = demo.getDeviceInfo();
      const adapter = renderer.backend?.device?.adapterInfo;
      const combat = demo.getCombatInfo();
      const horde = demo.getHordeInfo();

      window.__benchmarkHidden = document.hidden;
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) window.__benchmarkHidden = true;
      });

      return {
        ...device,
        gpuAdapter: adapter ? {
          vendor: adapter.vendor,
          architecture: adapter.architecture,
          device: adapter.device,
          description: adapter.description,
          isFallbackAdapter: adapter.isFallbackAdapter
        } : null,
        width: renderer.domElement.width,
        height: renderer.domElement.height,
        pixelRatio: renderer.getPixelRatio(),
        shadows: renderer.shadowMap.enabled,
        quality: 'balanced',
        benchmark: combat.benchmark,
        training: combat.training,
        initialEnemies: horde.total,
        browser: navigator.userAgent
      };
    });

    if (configuration.backend !== 'webgpu' ||
        configuration.fallbackUsed ||
        configuration.width !== WIDTH ||
        configuration.height !== HEIGHT ||
        configuration.pixelRatio !== 1 ||
        !configuration.shadows ||
        configuration.benchmark !== true ||
        configuration.training !== false ||
        configuration.initialEnemies < 3) {
      throw new Error('Invalid benchmark setup: ' + JSON.stringify(configuration));
    }

    const cdp = await browser.newBrowserCDPSession();
    const gpu = await cdp.send('SystemInfo.getInfo');
    await cdp.detach();

    console.log('Configuration:', configuration);
    console.log('Detected GPUs:', gpu.gpu.devices);

    await page.locator('canvas').first().click();
    await page.waitForFunction(
      () => document.pointerLockElement !== null,
      undefined,
      { timeout: 15000 }
    );
    await page.mouse.down({ button: 'right' });
    await page.waitForFunction(
      () => window.__m01Demo.getPlayerState().aiming === true,
      undefined,
      { timeout: 15000 }
    );

    const input = { direction: null, sprinting: false, lastShotAt: 0 };
    const movementKeys = ['w', 'd', 's', 'a'];
    const samples = [];

    async function drive(durationMs, record) {
      const started = Date.now();
      let lastSampleAt = -Infinity;

      while (Date.now() - started < durationMs) {
        const elapsed = Date.now() - started;
        const direction = movementKeys[Math.floor(elapsed / 1750) % 4];
        if (direction !== input.direction) {
          if (input.direction) await page.keyboard.up(input.direction);
          await page.keyboard.down(direction);
          input.direction = direction;
        }

        // Intermittent sprint tests the high-speed locomotion and animation paths.
        const sprint = Math.floor(elapsed / 2000) % 3 === 0;
        if (sprint !== input.sprinting) {
          if (sprint) await page.keyboard.down('Shift');
          else await page.keyboard.up('Shift');
          input.sprinting = sprint;
        }

        const state = await page.evaluate(() => {
          const demo = window.__m01Demo;
          return {
            combat: demo.getCombatInfo(),
            horde: demo.getHordeInfo(),
            player: demo.getPlayerState(),
            animation: demo.getPlayerModelInfo()?.activeClip,
            visible: document.visibilityState === 'visible'
          };
        });

        if (!state.combat.alive || state.combat.health !== 100) {
          throw new Error('Benchmark damage protection is not active.');
        }
        if (!state.visible) throw new Error('Browser was backgrounded.');

        if (state.combat.ammo <= 3 &&
            state.combat.reserve > 0 &&
            !state.combat.reloading &&
            !state.combat.fireCooldownMs) {
          await page.keyboard.press('r');
        } else if (!state.combat.reloading &&
                   Date.now() - input.lastShotAt >= 600) {
          await page.mouse.down({ button: 'left' });
          await page.mouse.up({ button: 'left' });
          input.lastShotAt = Date.now();
        }

        if (record && elapsed - lastSampleAt >= 1000) {
          samples.push({ elapsedMs: elapsed, ...state });
          lastSampleAt = elapsed;
        }
        await page.waitForTimeout(TICK_MS);
      }
    }

    console.log('Warming up for 5 seconds (automatic movement and firing)...');
    await drive(WARMUP_MS, false);

    await page.evaluate(() => window.__m01Demo.startBenchmarkCapture());
    console.log('Measuring for 30 seconds. Leave Edge in the foreground; no controls needed.');
    await drive(MEASURE_MS, true);

    const capture = await page.evaluate(() => ({
      frames: window.__m01Demo.finishBenchmarkCapture(),
      hidden: window.__benchmarkHidden || document.hidden,
      width: window.__m01Demo.backendRenderer.domElement.width,
      height: window.__m01Demo.backendRenderer.domElement.height,
      combat: window.__m01Demo.getCombatInfo(),
      horde: window.__m01Demo.getHordeInfo()
    }));

    if (capture.hidden) throw new Error('Benchmark invalid: Edge was hidden.');
    if (capture.width !== WIDTH || capture.height !== HEIGHT) {
      throw new Error('Benchmark invalid: resolution changed.');
    }
    if (errors.length) throw new Error('Benchmark invalid: JavaScript errors.');
    if (capture.combat.shotsFired === 0) {
      throw new Error('Benchmark invalid: automated firing never occurred.');
    }

    const metrics = summarizeFrames(capture.frames);
    const report = {
      date: new Date().toISOString(),
      scenario: 'M02 automated 3-6 infected horde; player invulnerable in dev benchmark only',
      configuration,
      hardware: gpu.gpu,
      metrics,
      combat: {
        shotsFired: capture.combat.shotsFired,
        shotsHit: capture.combat.shotsHit,
        kills: capture.combat.kills,
        wave: capture.horde.wave,
        activeEnemySamples: samples.filter(s => s.horde.living > 0).length,
        totalSamples: samples.length
      },
      samples,
      frames: capture.frames,
      errors
    };

    fs.writeFileSync(destination, JSON.stringify(report, null, 2));
    console.log('\nNEXTGEN AUTOMATED COMBAT BENCHMARK');
    console.table(metrics);
    console.log('Gameplay:', report.combat);
    console.log('Saved:', destination);
  } finally {
    if (page && !page.isClosed()) {
      try {
        await page.keyboard.up('w');
        await page.keyboard.up('a');
        await page.keyboard.up('s');
        await page.keyboard.up('d');
        await page.keyboard.up('Shift');
        await page.mouse.up({ button: 'right' });
      } catch { /* Browser may already be closed. */ }
    }
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
