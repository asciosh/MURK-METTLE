// Browser and room server share map, firearms and creature balance.
export const WORLD_BOUNDARY = 90;
export const CREATURES = Object.freeze({
  lanternkin: {
    name: 'Lanternkin',
    forms: ['Lanternkin', 'Luminbloom', 'Grovewarden'],
    color: 0x85bba0,
    glow: 0x8debc6,
    x: 4.2,
    z: -3.8,
    damage: 35,
    range: 7.5,
    cooldown: 8,
    habitat: 'Field camp',
  },
  emberling: {
    name: 'Emberling',
    forms: ['Emberling', 'Cinderhorn', 'Ashcrown'],
    color: 0x88664c,
    glow: 0xffb26e,
    x: 8,
    z: -54,
    damage: 48,
    range: 6,
    cooldown: 10,
    habitat: 'Old settlement · north',
  },
  mossback: {
    name: 'Mossback',
    forms: ['Mossback', 'Briarhide', 'Elderroot'],
    color: 0x56684d,
    glow: 0xb7c77e,
    x: 48,
    z: 38,
    damage: 62,
    range: 5,
    cooldown: 12,
    habitat: 'Southern pine ridge · southeast',
  },
  stormrook: {
    name: 'Stormrook',
    forms: ['Stormrook', 'Thundermantle', 'Tempestcrest'],
    color: 0x555e72,
    glow: 0xa8bde3,
    x: 54,
    z: -46,
    damage: 24,
    range: 13,
    cooldown: 5,
    habitat: 'Eastern relay · northeast',
  },
  reedwisp: {
    name: 'Reedwisp',
    forms: ['Reedwisp', 'Mistwing', 'Tideveil'],
    color: 0x668d99,
    glow: 0x9ed5ed,
    x: -48,
    z: -28,
    damage: 28,
    range: 11,
    cooldown: 6,
    habitat: 'Wetland · northwest',
  },
});
export const SPECIES_IDS = Object.freeze(Object.keys(CREATURES));
export const evolutionStage = (xp) => (xp >= 400 ? 2 : xp >= 120 ? 1 : 0);
export const creaturePower = (species, xp = 0) => {
  const def = CREATURES[species] || CREATURES.lanternkin;
  const stage = evolutionStage(xp);
  return {
    damage: def.damage + stage * 15,
    range: def.range + stage,
    cooldown: Math.max(4, def.cooldown - stage),
    stage,
    name: def.forms[stage],
  };
};
export const WEAPONS = Object.freeze({
  pistol: {
    name: 'M9 / SIDEARM',
    capacity: 12,
    reserve: 60,
    damage: 34,
    interval: 280,
    reload: 1400,
    range: 65,
    automatic: false,
  },
  rifle: {
    name: 'AR / CARBINE',
    capacity: 30,
    reserve: 120,
    damage: 26,
    interval: 120,
    reload: 2100,
    range: 95,
    automatic: true,
  },
});
export const newArsenal = () =>
  Object.fromEntries(
    Object.entries(WEAPONS).map(([id, w]) => [
      id,
      { magazine: w.capacity, reserve: w.reserve, readyAt: 0, reloadAt: 0 },
    ]),
  );
export function settleReload(arsenal, id, now) {
  const a = arsenal[id],
    w = WEAPONS[id];
  if (!a || !w || !a.reloadAt || now < a.reloadAt) return;
  const amount = Math.min(w.capacity - a.magazine, a.reserve);
  a.magazine += amount;
  a.reserve -= amount;
  a.reloadAt = 0;
}
export function reloadWeapon(arsenal, id, now) {
  const a = arsenal[id],
    w = WEAPONS[id];
  if (!a || !w) return false;
  settleReload(arsenal, id, now);
  if (a.reloadAt || a.magazine >= w.capacity || a.reserve <= 0) return false;
  a.reloadAt = now + w.reload;
  return true;
}
export function fireWeapon(arsenal, id, now) {
  const a = arsenal[id],
    w = WEAPONS[id];
  if (!a || !w) return false;
  settleReload(arsenal, id, now);
  if (a.reloadAt || now < a.readyAt || a.magazine <= 0) return false;
  a.magazine--;
  a.readyAt = now + w.interval;
  return true;
}
export const SUPPLIES = Object.freeze([
  { id: 'camp', x: -3, z: 3 },
  { id: 'town', x: 4, z: -47 },
  { id: 'marsh', x: -43, z: -22 },
  { id: 'relay', x: 52, z: 20 },
]);
export const BUILDINGS = Object.freeze([
  { x: -14, z: -47, w: 10, d: 9, h: 5.2 },
  { x: 17, z: -43, w: 9, d: 11, h: 6.8 },
  { x: -15, z: -65, w: 12, d: 9, h: 7 },
  { x: 18, z: -65, w: 11, d: 12, h: 4.8 },
  { x: 49, z: 27, w: 9, d: 8, h: 4.5 },
]);
let seed = 98127;
const rand = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
};
export const TREES = [];
for (let i = 0; i < 900; i++) {
  const x = rand() * 186 - 93,
    z = rand() * 186 - 93,
    size = 0.75 + rand() * 0.9;
  // Clear roads, central mission area, buildings, creatures and caches.
  if (
    Math.abs(x) < 6 ||
    (Math.abs(z) < 4 && x > -55 && x < 65) ||
    Math.hypot(x, z + 8) < 22 ||
    (Math.abs(x) < 29 && z < -32 && z > -78) ||
    Math.hypot(x + 48, z + 28) < 14 ||
    Math.hypot(x - 50, z - 22) < 13 ||
    SUPPLIES.some((p) => Math.hypot(p.x - x, p.z - z) < 4)
  )
    continue;
  TREES.push({ x, z, size });
}
export const OBSTACLES = [
  ...TREES.map((t) => ({ x: t.x, z: t.z, w: 0.55 * t.size, d: 0.55 * t.size, h: 8 * t.size })),
  ...BUILDINGS,
];
export function constrainPosition(pos, radius = 0.42) {
  const limit = WORLD_BOUNDARY - radius;
  pos.x = Math.max(-limit, Math.min(limit, pos.x));
  pos.z = Math.max(-limit, Math.min(limit, pos.z));
  for (const o of OBSTACLES) {
    const dx = pos.x - o.x,
      dz = pos.z - o.z;
    const rx = o.w / 2 + radius,
      rz = o.d / 2 + radius;
    if (Math.abs(dx) >= rx || Math.abs(dz) >= rz) continue;
    if (rx - Math.abs(dx) < rz - Math.abs(dz)) pos.x = o.x + (dx >= 0 ? rx : -rx);
    else pos.z = o.z + (dz >= 0 ? rz : -rz);
  }
  return pos;
}
// Slab intersection; one source of truth for bullet obstruction and camera collision.
export function obstacleDistance(origin, direction, maxDistance) {
  let nearest = maxDistance;
  for (const o of OBSTACLES) {
    let near = 0,
      far = nearest;
    for (const [axis, low, high] of [
      ['x', o.x - o.w / 2, o.x + o.w / 2],
      ['y', 0, o.h],
      ['z', o.z - o.d / 2, o.z + o.d / 2],
    ]) {
      const component = direction[axis];
      if (Math.abs(component) < 0.000001) {
        if (origin[axis] < low || origin[axis] > high) {
          far = -1;
          break;
        }
      } else {
        const a = (low - origin[axis]) / component,
          b = (high - origin[axis]) / component;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
      }
    }
    if (far >= near && far >= 0) nearest = Math.min(nearest, near);
  }
  return nearest;
}
export function shotDistance(origin, direction, target, maxDistance) {
  // Standing infected capsule approximated with three overlapping hit spheres.
  let hit = maxDistance;
  for (const y of [0.5, 1.1, 1.7]) {
    const dx = origin.x - target.x,
      dy = origin.y - y,
      dz = origin.z - target.z;
    const b = dx * direction.x + dy * direction.y + dz * direction.z;
    const c = dx * dx + dy * dy + dz * dz - 0.46 ** 2,
      disc = b * b - c;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t >= 0) hit = Math.min(hit, t);
  }
  return hit < obstacleDistance(origin, direction, maxDistance) ? hit : null;
}
