// Cosmetic pose state only. Damage, ammo and movement authority stay in the room rules.
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function sanitizeActorPose(value = {}) {
  if (!value || typeof value !== 'object') value = {};
  return {
    weapon: value.weapon === 'rifle' ? 'rifle' : 'pistol',
    aiming: value.aiming === true,
    sprinting: value.sprinting === true,
    pitch: typeof value.pitch === 'number' && Number.isFinite(value.pitch) ? clamp(value.pitch, -0.65, 0.95) : 0,
  };
}

/** Stable two-bone arm solution, including unreachable and coincident targets. */
export function solveArm(shoulder, requested, bend, upper = 0.32, lower = 0.3) {
  const dx = requested.x - shoulder.x,
    dy = requested.y - shoulder.y,
    dz = requested.z - shoulder.z;
  const length = Math.hypot(dx, dy, dz);
  const direction = length > 0.000001 ? { x: dx / length, y: dy / length, z: dz / length } : { x: 0, y: -1, z: 0 };
  const distance = clamp(length, Math.abs(upper - lower) + 0.001, upper + lower - 0.001);
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upper * upper - along * along));
  const projection = bend.x * direction.x + bend.y * direction.y + bend.z * direction.z;
  let bx = bend.x - direction.x * projection,
    by = bend.y - direction.y * projection,
    bz = bend.z - direction.z * projection;
  let bendLength = Math.hypot(bx, by, bz);
  if (bendLength < 0.000001) {
    const fallback = Math.abs(direction.y) < 0.9 ? { x: 0, y: -1, z: 0 } : { x: 0, y: 0, z: 1 };
    const dot = fallback.x * direction.x + fallback.y * direction.y + fallback.z * direction.z;
    bx = fallback.x - direction.x * dot;
    by = fallback.y - direction.y * dot;
    bz = fallback.z - direction.z * dot;
    bendLength = Math.hypot(bx, by, bz);
  }
  return {
    elbow: {
      x: shoulder.x + direction.x * along + (bx / bendLength) * height,
      y: shoulder.y + direction.y * along + (by / bendLength) * height,
      z: shoulder.z + direction.z * along + (bz / bendLength) * height,
    },
    wrist: {
      x: shoulder.x + direction.x * distance,
      y: shoulder.y + direction.y * distance,
      z: shoulder.z + direction.z * distance,
    },
  };
}
