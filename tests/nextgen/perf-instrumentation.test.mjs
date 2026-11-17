import test from 'node:test';
import assert from 'node:assert/strict';
import { PerfInstrumentation } from '../../src/nextgen/core/PerfInstrumentation.ts';

test('records actual frame intervals', () => {
  const perf = new PerfInstrumentation();

  assert.equal(perf.record(100), 0);
  assert.equal(perf.record(116), 16);
  assert.equal(perf.record(133), 17);
});

test('calculates FPS and mean frame time', () => {
  const perf = new PerfInstrumentation();

  perf.record(0);

  for (let i = 1; i <= 60; i++) {
    perf.record(i * (1000 / 60));
  }

  const result = perf.summary();

  assert.equal(result.samples, 60);
  assert.ok(Math.abs(result.fps - 60) < 0.01);
  assert.ok(Math.abs(result.meanMs - 1000 / 60) < 0.01);
});

test('calculates the 95th percentile', () => {
  const perf = new PerfInstrumentation();
  let now = 0;

  perf.record(now);

  for (let i = 1; i <= 100; i++) {
    now += i;
    perf.record(now);
  }

  assert.equal(perf.summary().p95Ms, 95);
});

test('ignores suspended frames', () => {
  const perf = new PerfInstrumentation();

  perf.record(0);
  perf.record(16);

  assert.equal(perf.record(5016), 0);
  assert.equal(perf.record(5032), 16);
  assert.equal(perf.summary().samples, 2);
});

test('retains only the latest 120 samples', () => {
  const perf = new PerfInstrumentation();

  perf.record(0);
  perf.record(100);

  for (let i = 1; i <= 120; i++) {
    perf.record(100 + i * 16);
  }

  assert.equal(perf.summary().samples, 120);
  assert.equal(perf.summary().meanMs, 16);
});

test('reset clears recorded telemetry', () => {
  const perf = new PerfInstrumentation();

  perf.record(0);
  perf.record(16);
  perf.reset();

  assert.equal(perf.summary().samples, 0);
  assert.equal(perf.summary().fps, 0);
  assert.equal(perf.record(100), 0);
});

test('disposed instrumentation stops recording', () => {
  const perf = new PerfInstrumentation();

  perf.record(0);
  perf.record(16);
  perf.dispose();

  assert.equal(perf.record(32), 0);
  assert.equal(perf.summary().samples, 0);
});