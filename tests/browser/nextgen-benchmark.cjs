const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const WIDTH = 1920;
const HEIGHT = 1080;
const WARMUP_MS = 5000;
const DURATION_MS = 30000;

const url =
  (process.env.GAME_URL || 'http://localhost:5174') +
  '/tests/browser/nextgen.html';

const destination = process.env.PERF_OUTPUT ||
  path.join(os.tmpdir(), 'murk-nextgen-benchmark.json');

(async () => {
    const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--start-maximized'],
    });

  try {
    const page = await browser.newPage({
      viewport: { width: WIDTH, height: HEIGHT },
      deviceScaleFactor: 1,
    });

    const windowSession = await page.context().newCDPSession(page);

    const { windowId } = await windowSession.send(
    'Browser.getWindowForTarget'
    );

    await windowSession.send('Browser.setWindowBounds', {
    windowId,
    bounds: { windowState: 'maximized' },
    });

    await windowSession.detach(); 
    
    const errors = [];

    page.on('pageerror', error => {
      errors.push(String(error));
      console.error('PAGE ERROR:', error);
    });

    page.on('console', message => {
      if (message.type() === 'warning' ||
          message.type() === 'error') {
        console.log('BROWSER:', message.text());
      }
    });

    console.log('Starting NEXTGEN hardware benchmark...');

    await page.goto(url);

    await page.waitForFunction(
      () => window.__m01DemoLoaded === true,
      undefined,
      { timeout: 90000 }
    );

    await page.bringToFront();

    const configuration = await page.evaluate(() => {
      const demo = window.__m01Demo;

      demo.setQuality('balanced');
      demo.backendRenderer.setPixelRatio(1);
      demo.resize(1920, 1080);

      const renderer = demo.backendRenderer;
      const canvas = renderer.domElement;
      const device = demo.getDeviceInfo();

      const adapter = renderer.backend?.device?.adapterInfo;

        const gpuAdapter = adapter ? {
        vendor: adapter.vendor,
        architecture: adapter.architecture,
        device: adapter.device,
        description: adapter.description,
        isFallbackAdapter: adapter.isFallbackAdapter,
        } : null;

      window.__benchmarkHidden = false;

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          window.__benchmarkHidden = true;
        }
      });

        return {
        ...device,
        gpuAdapter,
        width: canvas.width,
        height: canvas.height,
        pixelRatio: renderer.getPixelRatio(),
        shadows: renderer.shadowMap.enabled,
        quality: 'balanced',
        browser: navigator.userAgent,
      };
    });

    if (
      configuration.width !== WIDTH ||
      configuration.height !== HEIGHT ||
      configuration.pixelRatio !== 1 ||
      !configuration.shadows
    ) {
      throw new Error('Incorrect benchmark configuration.');
    }

    const cdp = await browser.newBrowserCDPSession();
    const system = await cdp.send('SystemInfo.getInfo');
    await cdp.detach();

    console.log('Configuration:', configuration);
    console.log('GPU devices:', system.gpu.devices);
    console.log('GPU renderer:', system.gpu.auxAttributes?.glRenderer);

    console.log('Warming up for 5 seconds...');
    await page.waitForTimeout(WARMUP_MS);

    await page.evaluate(() => {
      window.__m01Demo.startBenchmarkCapture();
    });

    console.log('Measuring for 30 seconds. Keep Edge visible.');

    await page.waitForTimeout(DURATION_MS);

    const capture = await page.evaluate(() => ({
      frames: window.__m01Demo.finishBenchmarkCapture(),
      hidden: window.__benchmarkHidden || document.hidden,
      width: window.__m01Demo.backendRenderer.domElement.width,
      height: window.__m01Demo.backendRenderer.domElement.height,
    }));

    if (capture.hidden) {
      throw new Error('Benchmark invalid: browser became hidden.');
    }

    if (capture.width !== WIDTH || capture.height !== HEIGHT) {
      throw new Error('Benchmark invalid: resolution changed.');
    }

    if (errors.length) {
      throw new Error('Benchmark invalid: browser errors detected.');
    }

    const frames = capture.frames;

    if (frames.length < 2) {
      throw new Error('Insufficient frame samples.');
    }

    const intervals = [];

    for (let i = 1; i < frames.length; i++) {
      const dt = frames[i].timestampMs - frames[i - 1].timestampMs;

      if (!Number.isFinite(dt) || dt <= 0) {
        throw new Error('Invalid frame timestamp.');
      }

      intervals.push(dt);
    }

    const duration = intervals.reduce((sum, dt) => sum + dt, 0);

    if (duration < 29000) {
      throw new Error('Insufficient benchmark capture duration.');
    }

    const sorted = [...intervals].sort((a, b) => a - b);

    const percentile = p =>
      sorted[Math.ceil(sorted.length * p) - 1];

    const round = value => Number(value.toFixed(2));

    const metrics = {
      durationSeconds: round(duration / 1000),
      frames: frames.length,
      averageFPS: round(intervals.length * 1000 / duration),
      meanFrameMs: round(duration / intervals.length),
      p95FrameMs: round(percentile(0.95)),
      p99FrameMs: round(percentile(0.99)),
      worstFrameMs: round(sorted[sorted.length - 1]),
      framesOver25Ms: intervals.filter(ms => ms > 25).length,
      framesOver33Ms: intervals.filter(ms => ms > 33.333).length,
      peakDrawCalls: Math.max(...frames.map(f => f.drawCalls)),
      peakTriangles: Math.max(...frames.map(f => f.triangles)),
      geometries: frames.at(-1).geometries,
      textures: frames.at(-1).textures,
    };

    const report = {
      date: new Date().toISOString(),
      scenario: 'M01 terrain and vegetation orbit',
      configuration,
      hardware: system.gpu,
      metrics,
      frames,
      errors,
    };

    fs.writeFileSync(destination, JSON.stringify(report, null, 2));

    console.log('\nNEXTGEN BENCHMARK RESULTS');
    console.table(metrics);
    console.log('Report saved:', destination);

  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});