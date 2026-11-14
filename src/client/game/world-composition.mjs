// Visual composition only. Shared collision/navigation/habitats remain authoritative.
export const TRAIL_SPURS = Object.freeze([
  Object.freeze({ x1: -48, z1: 0, x2: -49.5, z2: -10 }),
  Object.freeze({ x1: -49.5, z1: -10, x2: -48, z2: -16 }),
  Object.freeze({ x1: 50, z1: 0, x2: 52, z2: 20 }),
]);
export function forestZone(x, z) {
  if (Math.hypot(x + 48, z + 31) < 28) return 'wetland';
  return x > 32 || z > 28 ? 'pine' : 'broadleaf';
}
export function foliageScale(zone, layer) {
  return zone === 'pine'
    ? { width: 1.1 - layer * 0.065, height: 0.46, y: 3.8 + layer * 0.59 }
    : zone === 'wetland'
      ? { width: 1.18, height: 0.94, y: 5.2 + (layer % 4) * 0.48 }
      : { width: 1.04 + (layer % 3) * 0.08, height: 0.7 + (layer % 2) * 0.2, y: 6.2 + (layer % 4) * 0.58 };
}
export const WORLD_DECOR_BUDGET = Object.freeze({ grass: 4200, ferns: 600, pebbles: 480, lilyPads: 64 });
