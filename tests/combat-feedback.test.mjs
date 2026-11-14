import test from 'node:test';
import assert from 'node:assert/strict';
import { springStep, impactBudget, SOUND_CUES } from '../src/client/game/combat-feedback.mjs';

test('cosmetic spring converges without overshoot and keeps consistent response across frame rates', () => {
  const run = (rate) => {
    let p = 0,
      v = 0;
    for (let i = 0; i < rate; i++) {
      const next = springStep(p, v, 1, 1 / rate);
      assert.ok(next.position >= p && next.position <= 1);
      p = next.position;
      v = next.velocity;
    }
    return p;
  };
  assert.ok(Math.abs(run(30) - run(120)) < 0.00001);
  assert.ok(run(60) > 0.999);
});
test('camera spring retains position/velocity continuity and bounds suspension time', () => {
  const start = springStep(0, 0, 1, 0);
  assert.deepEqual(start, { position: 0, velocity: 0 });
  assert.deepEqual(springStep(0, 0, 1, 100), springStep(0, 0, 1, 0.05));
  assert.deepEqual(springStep(0, 0, 1, NaN), start);
  const moving = springStep(0, 0, 1, 0.016);
  const reversed = springStep(moving.position, moving.velocity, -1, 0.016);
  assert.ok(Number.isFinite(reversed.position) && Number.isFinite(reversed.velocity));
  assert.ok(Math.abs(reversed.position - moving.position) < 0.1);
});
test('cosmetic budgets disable Performance particles and bound Android and Cinematic effects', () => {
  assert.equal(impactBudget('low'), 0);
  assert.equal(impactBudget('mobile'), 12);
  assert.equal(impactBudget('balanced'), 40);
  assert.equal(impactBudget('cinematic'), 64);
});
test('original synthesized cues have short bounded envelopes and distinct weapon profiles', () => {
  assert.notDeepEqual(SOUND_CUES.pistol, SOUND_CUES.rifle);
  for (const cue of Object.values(SOUND_CUES)) {
    assert.ok(cue.duration > 0 && cue.duration <= 0.3);
    assert.ok(cue.gain > 0 && cue.gain <= 0.2);
    assert.ok(cue.frequency > 0 && cue.end > 0);
    assert.ok(cue.noise >= 0 && cue.noise <= 1);
  }
});
