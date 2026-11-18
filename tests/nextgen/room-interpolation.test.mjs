import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Multiplayer } from '../../src/client/game/Multiplayer.ts';

const enemy = x => Object.freeze({ id: 'e', x, z: 0, hp: 80, max: 80, strain: 'runner', state: 'chase', generation: 1 });
const packet = x => Object.freeze({ wave: 1, enemies: [enemy(x)], nextWaveAt: 0 });

// 100 ms server cadence: the older delay puts the visual position near the
// newest sample, where one late packet causes a pause. NEXTGEN stays buffered.
test('NEXTGEN uses a larger jitter buffer without changing legacy room defaults', () => {
  const now = performance.now();
  const frames = [
    { at: now - 200, players: [], horde: packet(0) },
    { at: now - 100, players: [], horde: packet(10) }
  ];
  const legacy = new Multiplayer();
  legacy.frames = frames;
  legacy.updateVisuals();
  const nextgen = new Multiplayer(190);
  nextgen.frames = frames;
  nextgen.updateVisuals();
  const oldX = legacy.horde.enemies[0].x;
  const newX = nextgen.horde.enemies[0].x;
  assert.ok(oldX > 7 && oldX < 10, `legacy x=${oldX}`);
  assert.ok(newX > 0 && newX < 3, `NEXTGEN x=${newX}`);
  assert.equal(frames[0].horde.enemies[0].x, 0);
  assert.equal(frames[1].horde.enemies[0].x, 10);
});
