import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulationClock } from '../../src/nextgen/core/SimulationClock.ts';
import { ResourceTracker } from '../../src/nextgen/core/ResourceTracker.ts';
import { GraphicsQuality } from '../../src/nextgen/core/GraphicsQuality.ts';
import { GraphicsDevice } from '../../src/nextgen/core/GraphicsDevice.ts';

// Node has no window/navigator. Stub what the modules touch at call time.
const origNavigator = globalThis.navigator;
const origWindow = globalThis.window;
globalThis.window = { devicePixelRatio: 1 };

test('GraphicsQuality maps shared presets and applies them to a renderer stub', (t) => {
  const quality = new GraphicsQuality();

  for (const id of ['low', 'balanced', 'cinematic']) {
    quality.set(id);
    assert.equal(quality.getId(), id);
    const profile = quality.getProfile();
    assert.ok(profile && typeof profile.pixelRatio === 'number');
  }

  // Unknown / invalid ids fall back to 'balanced'; retired 'mobile' -> 'low'.
  quality.set('bogus');
  assert.equal(quality.getId(), 'balanced');
  quality.set('mobile');
  assert.equal(quality.getId(), 'low');
  quality.set(undefined);
  assert.equal(quality.getId(), 'balanced');

  // apply() caps pixel ratio and toggles shadow map per preset.
  const stub = { setPixelRatio: (_v) => void 0, shadowMap: { enabled: false } };
  let seen = 0;
  stub.setPixelRatio = (v) => { seen += 1; };

  quality.set('low');
  quality.apply(stub);
  assert.equal(stub.shadowMap.enabled, false);

  quality.set('balanced');
  quality.apply(stub);
  assert.equal(stub.shadowMap.enabled, true);

  quality.set('cinematic');
  quality.apply(stub);
  assert.equal(stub.shadowMap.enabled, true);
  assert.ok(seen >= 3);
});

test('GraphicsQuality getProfile shape matches shared render profile', () => {
  const quality = new GraphicsQuality();
  quality.set('cinematic');
  const p = quality.getProfile();
  assert.ok('shadows' in p);
  assert.equal(p.shadows, true);
});

test('SimulationClock runs fixed steps and clamps interpolation alpha to [0,1]', () => {
  // fixedDt and delta are in milliseconds (performance.now() domain).
  const clock = new SimulationClock(1000 / 60, 250, 6);

  // First tick primes the clock.
  let step = clock.tick(0);
  assert.equal(step.steps, 0);
  assert.equal(step.tick, 0);
  assert.equal(step.alpha, 0);

  // Exactly one fixed step per 16.666 ms frame.
  step = clock.tick(1000 / 60);
  assert.equal(step.steps, 1);
  assert.equal(step.tick, 1);
  assert.equal(step.alpha, 0);

  step = clock.tick(2 * (1000 / 60));
  assert.equal(step.steps, 1);
  assert.equal(step.tick, 2);

  // Alpha stays in [0, 1] and steps stay bounded across many frames.
  let now = 2 * (1000 / 60);
  for (let i = 0; i < 10; i++) {
    now += 1000 / 60;
    const s = clock.tick(now);
    assert.ok(s.alpha >= 0 && s.alpha <= 1);
    assert.ok(s.steps >= 0 && s.steps <= 6);
  }
});

test('SimulationClock caps delta and bounds catch-up steps (no spiral after suspension)', () => {
  const clock = new SimulationClock(1000 / 60, 250, 6);
  clock.tick(0); // prime

  // A huge gap (tab suspension) is capped to maxDelta (250 ms) and catch-up
  // bounded to maxCatchUpSteps (6). 250 ms / 16.66 ms = 15 steps, capped to 6.
  const step = clock.tick(5000);
  assert.equal(step.steps, 6, 'catch-up must be bounded to maxCatchUpSteps');
  assert.equal(step.alpha, 1, 'alpha clamped to 1 when catch-up capped');
});

test('SimulationClock reset and dispose', () => {
  const clock = new SimulationClock();
  clock.tick(100);
  clock.tick(200);
  assert.ok(clock.getTick() > 0);
  clock.reset();
  assert.equal(clock.getTick(), 0);
  assert.equal(clock.getAlpha(), 0);
  clock.dispose();
  const after = clock.tick(1000);
  assert.equal(after.steps, 0);
});

test('ResourceTracker tracks, counts, and deterministically disposes', () => {
  const tracker = new ResourceTracker();
  const disposed = new Set();
  const make = (name) => ({ dispose: () => disposed.add(name) });
  const a = make('a');
  const b = make('b');
  const c = make('c');

  tracker.track(a);
  tracker.track(b);
  tracker.track(c);
  assert.equal(tracker.size, 3);
  assert.ok(tracker.has(b));

  tracker.untrack(b);
  assert.equal(tracker.size, 2);
  assert.ok(!tracker.has(b));

  tracker.disposeAll();
  assert.ok(disposed.has('a'));
  assert.ok(disposed.has('c'));
  assert.ok(!disposed.has('b'));
  assert.equal(tracker.size, 0);

  // Idempotent.
  tracker.disposeAll();
  assert.equal(tracker.size, 0);

  // Cannot track after disposal.
  assert.throws(() => tracker.track({ dispose: () => void 0 }));
});

test('GraphicsDevice.detect selects backend without creating GPU resources', () => {
  // Headless node: no navigator.gpu.
  delete globalThis.navigator;
  let d = GraphicsDevice.detect();
  assert.equal(d.backend, 'webgl2');
  assert.equal(d.webgpuAvailable, false);
  assert.equal(d.forceWebGL, false);

  // Forced WebGL.
  d = GraphicsDevice.detect({ forceWebGL: true });
  assert.equal(d.backend, 'webgl2');
  assert.equal(d.webgpuAvailable, false);
  assert.equal(d.forceWebGL, true);

  // WebGPU advertised.
  globalThis.navigator = { gpu: {} };
  d = GraphicsDevice.detect();
  assert.equal(d.backend, 'webgpu');
  assert.equal(d.webgpuAvailable, true);
  assert.equal(d.forceWebGL, false);

  globalThis.navigator = origNavigator;
});

test('GraphicsDevice construct/dispose is idempotent without a backend', () => {
  const device = new GraphicsDevice();
  assert.equal(device.info.backend, 'unknown');
  device.dispose();
  device.dispose(); // idempotent
  device.dispose();
});

test('GraphicsDevice.init() rejects gracefully with no canvas/document', async () => {
  const device = new GraphicsDevice();
  await assert.rejects(device.init(), /no canvas and no document/);
});
