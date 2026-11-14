// Presentation-only math. No combat rules, clock, player state or network access.
export function springStep(position, velocity, target, dt, frequency = 14) {
  const t = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.05));
  const displacement = position - target,
    decay = Math.exp(-frequency * t);
  const offset = (velocity + frequency * displacement) * t;
  return { position: target + (displacement + offset) * decay, velocity: (velocity - frequency * offset) * decay };
}
export function impactBudget(quality) {
  return quality === 'low' ? 0 : quality === 'mobile' ? 12 : quality === 'cinematic' ? 64 : 40;
}
export const SOUND_CUES = Object.freeze({
  pistol: { frequency: 145, end: 48, duration: 0.13, noise: 0.7, gain: 0.18 },
  rifle: { frequency: 110, end: 42, duration: 0.095, noise: 0.85, gain: 0.14 },
  reload: { frequency: 720, end: 240, duration: 0.12, noise: 0.45, gain: 0.07 },
  ready: { frequency: 440, end: 880, duration: 0.09, noise: 0.08, gain: 0.045 },
  hit: { frequency: 880, end: 300, duration: 0.065, noise: 0.25, gain: 0.07 },
  melee: { frequency: 240, end: 75, duration: 0.17, noise: 0.8, gain: 0.06 },
  hurt: { frequency: 110, end: 50, duration: 0.2, noise: 0.35, gain: 0.1 },
  heal: { frequency: 340, end: 680, duration: 0.28, noise: 0.03, gain: 0.045 },
});
