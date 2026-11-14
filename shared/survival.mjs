import { INFECTION_TYPES } from './coop-rules.mjs';
import { OBSTACLES, WORLD_BOUNDARY, constrainPosition, obstacleDistance, shotDistance } from './expansion.mjs';

export const SURVIVAL = Object.freeze({
  stamina: 100,
  drain: 23,
  regeneration: 17,
  recoveryDelay: 1100,
  exhaustionThreshold: 25,
  walkSpeed: 4.8,
  sprintSpeed: 8,
  bandages: 2,
  healAmount: 40,
  healDuration: 2600,
  damageGrace: 650,
  waveDelay: 8000,
  maxEnemies: 6,
});
export const newVitals = () => ({
  stamina: 100,
  exhausted: false,
  regenAt: 0,
  sprinting: false,
  bandages: 2,
  healEndsAt: 0,
});
export const canSprint = (s) => !s.exhausted && s.stamina > 0 && !s.healEndsAt;
export function beginHealing(s, hp, now) {
  if (hp <= 0 || hp >= 100 || s.bandages <= 0 || s.healEndsAt) return false;
  s.bandages--;
  s.healEndsAt = now + SURVIVAL.healDuration;
  s.sprinting = false;
  return true;
}
export function cancelHealing(s) {
  const active = !!s.healEndsAt;
  s.healEndsAt = 0;
  return active;
}
export function stepVitals(s, dt, now, { moving = false, sprint = false } = {}) {
  dt = Math.max(0, Math.min(0.25, dt));
  if (moving && s.healEndsAt) cancelHealing(s);
  s.sprinting = moving && sprint && canSprint(s);
  if (s.sprinting) {
    s.stamina = Math.max(0, s.stamina - SURVIVAL.drain * dt);
    s.regenAt = now + SURVIVAL.recoveryDelay;
    if (s.stamina === 0) {
      s.exhausted = true;
      s.sprinting = false;
    }
  } else if (now >= s.regenAt) {
    s.stamina = Math.min(100, s.stamina + SURVIVAL.regeneration * dt);
    if (s.stamina >= SURVIVAL.exhaustionThreshold) s.exhausted = false;
  }
  if (s.healEndsAt && now >= s.healEndsAt) {
    s.healEndsAt = 0;
    return SURVIVAL.healAmount;
  }
  return 0;
}
export function refillVitals(s) {
  s.bandages = SURVIVAL.bandages;
}

// A bounded distance budget absorbs jitter once; tolerance does not accumulate per packet.
export function admitMovement(player, distance, sprint, now) {
  if (!Number.isFinite(distance) || distance < 0) return false;
  const elapsed = Math.max(0, Math.min(0.5, (now - (player.budgetAt ?? now)) / 1000));
  const speed = sprint && canSprint(player.survival) ? SURVIVAL.sprintSpeed : SURVIVAL.walkSpeed;
  const budget = Math.min(1.2, (player.moveBudget ?? 0.75) + speed * elapsed);
  player.moveBudget = budget;
  player.budgetAt = now;
  if (distance > budget + 0.000001) return false;
  player.moveBudget = Math.max(0, budget - distance);
  return true;
}

let routePlansRemaining = 2;
const CELL = 2,
  BUCKET = 8,
  bins = new Map();
for (const o of OBSTACLES)
  for (let x = Math.floor((o.x - o.w / 2 - 1) / BUCKET); x <= Math.floor((o.x + o.w / 2 + 1) / BUCKET); x++)
    for (let z = Math.floor((o.z - o.d / 2 - 1) / BUCKET); z <= Math.floor((o.z + o.d / 2 + 1) / BUCKET); z++) {
      const key = x + ',' + z,
        list = bins.get(key) || [];
      list.push(o);
      bins.set(key, list);
    }
const blocked = (x, z) =>
  Math.abs(x) > WORLD_BOUNDARY - 0.7 ||
  Math.abs(z) > WORLD_BOUNDARY - 0.7 ||
  (bins.get(Math.floor(x / BUCKET) + ',' + Math.floor(z / BUCKET)) || []).some(
    (o) => Math.abs(x - o.x) < o.w / 2 + 0.55 && Math.abs(z - o.z) < o.d / 2 + 0.55,
  );
const key = (x, z) => x + ',' + z;
const visible = (a, b) => {
  const distance = Math.hypot(b.x - a.x, b.z - a.z);
  if (distance < 0.01) return true;
  return (
    obstacleDistance(
      { x: a.x, y: 1.15, z: a.z },
      { x: (b.x - a.x) / distance, y: 0, z: (b.z - a.z) / distance },
      distance,
    ) >=
    distance - 0.15
  );
};
export function findRoute(start, goal) {
  const sx = Math.round(start.x / CELL),
    sz = Math.round(start.z / CELL);
  let gx = Math.round(goal.x / CELL),
    gz = Math.round(goal.z / CELL);
  if (blocked(gx * CELL, gz * CELL)) {
    const ox = gx,
      oz = gz;
    let best = Infinity,
      found = false;
    for (let x = ox - 2; x <= ox + 2; x++)
      for (let z = oz - 2; z <= oz + 2; z++) {
        if (blocked(x * CELL, z * CELL)) continue;
        const d = Math.hypot(x * CELL - goal.x, z * CELL - goal.z);
        if (d < best) {
          best = d;
          gx = x;
          gz = z;
          found = true;
        }
      }
    if (!found) return [];
  }
  const first = { x: sx, z: sz, g: 0, f: Math.hypot(gx - sx, gz - sz), parent: null },
    open = [first],
    scores = new Map([[key(sx, sz), 0]]),
    closed = new Set();
  for (let iteration = 0; open.length && iteration < 500; iteration++) {
    let pick = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[pick].f) pick = i;
    const current = open.splice(pick, 1)[0],
      id = key(current.x, current.z);
    if (closed.has(id)) continue;
    closed.add(id);
    if (current.x === gx && current.z === gz) {
      const route = [];
      for (let n = current; n.parent; n = n.parent) route.push({ x: n.x * CELL, z: n.z * CELL });
      return route.reverse();
    }
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const x = current.x + dx,
        z = current.z + dz,
        next = key(x, z);
      if (closed.has(next) || blocked(x * CELL, z * CELL)) continue;
      if (
        dx &&
        dz &&
        (blocked((current.x + dx) * CELL, current.z * CELL) || blocked(current.x * CELL, (current.z + dz) * CELL))
      )
        continue;
      const g = current.g + Math.hypot(dx, dz);
      if (g >= (scores.get(next) ?? Infinity)) continue;
      scores.set(next, g);
      open.push({ x, z, g, f: g + Math.hypot(gx - x, gz - z), parent: current });
    }
  }
  return [];
}
function walk(enemy, goal, speed, dt, now) {
  let target = goal;
  if (!visible(enemy, goal)) {
    const goalKey = key(Math.round(goal.x / CELL), Math.round(goal.z / CELL));
    if ((now > enemy.routeAt || enemy.routeGoal !== goalKey) && routePlansRemaining > 0) {
      routePlansRemaining--;
      enemy.route = findRoute(enemy, goal);
      enemy.routeAt = now + 1200;
      enemy.routeGoal = goalKey;
    }
    while (enemy.route?.length && Math.hypot(enemy.route[0].x - enemy.x, enemy.route[0].z - enemy.z) < 0.65)
      enemy.route.shift();
    if (enemy.route?.length) target = enemy.route[0];
  }
  const dx = target.x - enemy.x,
    dz = target.z - enemy.z,
    distance = Math.hypot(dx, dz);
  if (distance < 0.08) return;
  const step = Math.min(speed * dt, distance),
    angle = Math.atan2(dx, dz);
  let best = null,
    bestProgress = -Infinity;
  for (const turn of [0, 0.75, -0.75, 1.4, -1.4]) {
    const candidate = constrainPosition(
      { x: enemy.x + Math.sin(angle + turn) * step, z: enemy.z + Math.cos(angle + turn) * step },
      0.43,
    );
    const travelled = Math.hypot(candidate.x - enemy.x, candidate.z - enemy.z);
    if (travelled > step * 1.6 + 0.01) continue;
    const progress = ((candidate.x - enemy.x) * dx) / distance + ((candidate.z - enemy.z) * dz) / distance;
    if (progress > bestProgress) {
      best = candidate;
      bestProgress = progress;
    }
  }
  if (best) {
    enemy.x = best.x;
    enemy.z = best.z;
  }
}
export function spawnHorde(players, wave, runId = 'field') {
  const living = players.filter((p) => p.hp > 0),
    anchor = living[0] || { x: 0, z: 0, yaw: 0 };
  const count = Math.min(SURVIVAL.maxEnemies, 2 + Math.max(1, living.length) + Math.floor((wave - 1) / 3));
  const enemies = [];
  for (let i = 0; i < count; i++) {
    let point = null,
      bestDistance = -1;
    for (let attempt = 0; attempt < 24; attempt++) {
      const angle = (anchor.yaw || 0) + (i - (count - 1) / 2) * 0.42 + attempt * Math.PI * 0.37;
      const radius = 13 + (i % 3) * 2.2;
      const candidate = constrainPosition(
        { x: anchor.x - Math.sin(angle) * radius, z: anchor.z - Math.cos(angle) * radius },
        0.5,
      );
      const nearest = living.length
        ? Math.min(...living.map((p) => Math.hypot(candidate.x - p.x, candidate.z - p.z)))
        : radius;
      if (nearest > bestDistance) {
        point = candidate;
        bestDistance = nearest;
      }
      if (nearest >= 11) break;
    }
    const type = INFECTION_TYPES[(wave + i - 1) % INFECTION_TYPES.length],
      id = `${runId}:${wave}:${i}`;
    enemies.push({
      id,
      encounterId: id,
      generation: wave,
      x: point.x,
      z: point.z,
      hp: type.hp,
      max: type.hp,
      strain: type.id,
      speed: type.speed,
      damage: type.damage,
      homeX: point.x,
      homeZ: point.z,
      state: 'idle',
      alertUntil: 0,
      investigateX: point.x,
      investigateZ: point.z,
      lastHit: 0,
      windupEndsAt: 0,
      route: [],
      routeAt: 0,
    });
  }
  return enemies;
}
export function alertHorde(enemies, source, now, radius = 38) {
  for (const enemy of enemies)
    if (enemy.hp > 0 && Math.hypot(enemy.x - source.x, enemy.z - source.z) <= radius) {
      enemy.alertUntil = now + 12000;
      enemy.investigateX = source.x;
      enemy.investigateZ = source.z;
    }
}
export function damageEnemy(enemy, damage) {
  if (!enemy || enemy.hp <= 0 || !Number.isFinite(damage) || damage <= 0) return false;
  enemy.hp = Math.max(0, enemy.hp - damage);
  if (enemy.hp === 0) {
    enemy.state = 'dead';
    enemy.windupEndsAt = 0;
    return true;
  }
  return false;
}
export function bulletTarget(enemies, origin, direction, range) {
  let nearest = null,
    distance = range;
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const hit = shotDistance(origin, direction, enemy, distance);
    if (hit !== null && hit < distance) {
      nearest = enemy;
      distance = hit;
    }
  }
  return nearest ? { enemy: nearest, distance } : null;
}
export function meleeTarget(enemies, player, range) {
  return (
    enemies
      .filter((e) => e.hp > 0 && Math.hypot(e.x - player.x, e.z - player.z) <= range && visible(player, e))
      .filter((e) => {
        const d = Math.max(0.001, Math.hypot(e.x - player.x, e.z - player.z));
        return (-Math.sin(player.yaw) * (e.x - player.x) - Math.cos(player.yaw) * (e.z - player.z)) / d >= -0.15;
      })
      .sort((a, b) => Math.hypot(a.x - player.x, a.z - player.z) - Math.hypot(b.x - player.x, b.z - player.z))[0] ||
    null
  );
}
export const pulseTargets = (enemies, player, range) =>
  enemies.filter((e) => e.hp > 0 && Math.hypot(e.x - player.x, e.z - player.z) <= range && visible(player, e));
export function stepHorde(enemies, players, dt, now) {
  routePlansRemaining = 2;
  const hits = [],
    living = players.filter((p) => p.hp > 0);
  if (!living.length) return hits;
  dt = Math.max(0, Math.min(0.25, dt));
  for (const enemy of enemies) {
    if (enemy.hp <= 0) {
      enemy.state = 'dead';
      continue;
    }
    const sorted = [...living]
      .filter((p) => p.hp > 0)
      .sort((a, b) => Math.hypot(a.x - enemy.x, a.z - enemy.z) - Math.hypot(b.x - enemy.x, b.z - enemy.z));
    const target = sorted.find((p) => {
      const d = Math.hypot(p.x - enemy.x, p.z - enemy.z);
      return d < 18 && visible(enemy, p);
    });
    if (target) {
      enemy.investigateX = target.x;
      enemy.investigateZ = target.z;
      enemy.alertUntil = now + 4500;
    } else {
      const loud = sorted.find((p) => p.sprinting && Math.hypot(p.x - enemy.x, p.z - enemy.z) < 13);
      if (loud) {
        enemy.investigateX = loud.x;
        enemy.investigateZ = loud.z;
        enemy.alertUntil = now + 4500;
      }
    }
    const distance = target ? Math.hypot(target.x - enemy.x, target.z - enemy.z) : Infinity;
    if (enemy.windupEndsAt) {
      if (now >= enemy.windupEndsAt) {
        enemy.windupEndsAt = 0;
        enemy.lastHit = now;
        if (target && distance <= 1.9 && now >= (target.hurtUntil || 0)) {
          const damage = Math.min(target.hp, enemy.damage);
          target.hp -= damage;
          target.hurtUntil = now + SURVIVAL.damageGrace;
          hits.push({ playerId: target.id, enemyId: enemy.id, damage, hp: target.hp });
        }
      } else {
        enemy.state = 'windup';
        continue;
      }
    }
    if (target && distance <= 1.65) {
      enemy.state = 'attack';
      if (now - enemy.lastHit >= 1350) {
        enemy.windupEndsAt = now + 450;
        enemy.state = 'windup';
      }
      continue;
    }
    if (now < enemy.alertUntil) {
      enemy.state = target ? 'chase' : 'investigate';
      walk(enemy, { x: enemy.investigateX, z: enemy.investigateZ }, enemy.speed, dt, now);
    } else {
      enemy.state = 'idle';
      const phase = now * 0.00017 + (enemy.generation || 0) * 2 + enemy.homeX * 0.4;
      walk(
        enemy,
        { x: enemy.homeX + Math.sin(phase) * 1.8, z: enemy.homeZ + Math.cos(phase) * 1.8 },
        enemy.speed * 0.22,
        dt,
        now,
      );
    }
  }
  // Separate nearby bodies so a group cannot collapse into a single stacked mesh.
  for (let i = 0; i < enemies.length; i++)
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i],
        b = enemies[j];
      if (a.hp <= 0 || b.hp <= 0) continue;
      const dx = b.x - a.x,
        dz = b.z - a.z,
        d = Math.hypot(dx, dz);
      if (d >= 0.9) continue;
      const push = Math.min(0.9 - d, dt * 1.8) * 0.5,
        nx = d > 0.001 ? dx / d : 1,
        nz = d > 0.001 ? dz / d : 0;
      a.x -= nx * push;
      a.z -= nz * push;
      b.x += nx * push;
      b.z += nz * push;
      constrainPosition(a, 0.43);
      constrainPosition(b, 0.43);
    }
  return hits;
}
export class HordeSimulation {
  enemies = [];
  wave = 0;
  nextWaveAt = 0;
  runId = crypto.randomUUID();
  relocateAt = 0;
  reset(players = []) {
    this.runId = crypto.randomUUID();
    this.wave = 0;
    this.nextWaveAt = 0;
    this.enemies = [];
    this.relocateAt = 0;
    if (players.some((p) => p.hp > 0)) this.spawn(players);
  }
  spawn(players) {
    this.wave++;
    this.enemies = spawnHorde(players, this.wave, this.runId);
    this.nextWaveAt = 0;
  }
  step(players, dt, now) {
    const living = players.filter((p) => p.hp > 0);
    if (!living.length) return [];
    if (!this.enemies.length) this.spawn(living);
    const alive = this.enemies.filter((e) => e.hp > 0);
    if (!alive.length) {
      if (!this.nextWaveAt) this.nextWaveAt = now + SURVIVAL.waveDelay;
      if (now >= this.nextWaveAt) this.spawn(living);
      return [];
    }
    const distant = alive.every((e) => living.every((p) => Math.hypot(e.x - p.x, e.z - p.z) > 58));
    if (distant) {
      if (!this.relocateAt) this.relocateAt = now + 5000;
      if (now >= this.relocateAt) {
        this.spawn(living);
        this.relocateAt = 0;
      }
    } else this.relocateAt = 0;
    return stepHorde(this.enemies, players, dt, now);
  }
  packet() {
    return {
      wave: this.wave,
      nextWaveAt: this.nextWaveAt,
      enemies: this.enemies.map(({ id, x, z, hp, max, strain, generation, state }) => ({
        id,
        x,
        z,
        hp,
        max,
        strain,
        generation,
        state,
      })),
    };
  }
}
