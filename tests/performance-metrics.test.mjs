import test from 'node:test';
import assert from 'node:assert/strict';
import { FrameWindow, SnapshotArrivals } from '../src/client/debug/performance-metrics.mjs';
test('frame telemetry reports rendered cadence and ignores tab suspension', () => {
  const window = new FrameWindow();
  for (let i = 0; i < 180; i++) window.record((i * 1000) / 30);
  assert.ok(Math.abs(window.summary().fps - 30) < 0.001);
  const before = window.summary();
  window.record(100000);
  assert.deepEqual(window.summary(), before);
});
test('snapshot telemetry observes arrival age and jitter without inventing RTT', () => {
  const metrics = new SnapshotArrivals();
  assert.equal(metrics.summary(100).ageMs, null);
  metrics.observe(100);
  metrics.observe(200);
  assert.equal(metrics.summary(225).ageMs, 25);
  assert.equal(metrics.summary(225).intervalMs, 100);
  assert.equal(metrics.summary(225).jitterMs, 0);
  metrics.observe(360);
  assert.ok(metrics.summary(400).jitterMs > 0);
  metrics.reset();
  assert.equal(metrics.summary(1000).snapshots, 0);
  assert.equal(metrics.summary(1000).ageMs, null);
});
