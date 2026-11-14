const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Two segments bend forward at the knee while keeping their authored lengths. */
export function solveLeg(y, z, upper = 0.34, lower = 0.33) {
  const requested = Math.hypot(y, z),
    distance = clamp(requested, Math.abs(upper - lower) + 0.0001, upper + lower - 0.0001);
  const base = Math.atan2(-z, -y),
    hip =
      base + Math.acos(clamp((upper * upper + distance * distance - lower * lower) / (2 * upper * distance), -1, 1));
  const knee = -(
    Math.PI - Math.acos(clamp((upper * upper + lower * lower - distance * distance) / (2 * upper * lower), -1, 1))
  );
  return { hip, knee, foot: -hip - knee };
}
/** A longer stance and raised swing give walking/running a readable weight transfer. */
export function footCycle(phase, sprint = 0) {
  const cycle = (((phase / (Math.PI * 2)) % 1) + 1) % 1,
    stance = 0.58,
    stride = 0.24 + clamp(sprint, 0, 1) * 0.085;
  if (cycle < stance) return { z: ((cycle / stance) * 2 - 1) * stride, lift: 0, stance: true };
  const t = (cycle - stance) / (1 - stance),
    smooth = t * t * (3 - 2 * t);
  return { z: (1 - 2 * smooth) * stride, lift: Math.sin(t * Math.PI) * (0.12 + sprint * 0.09), stance: false };
}
