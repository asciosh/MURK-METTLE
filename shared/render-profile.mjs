// Explicit quality limits, independent of gameplay and server simulation.
export const RENDER_PROFILES = Object.freeze({
  low: {
    pixelRatio: 1,
    shadows: false,
    pointLights: false,
    foliage: 0.5,
    grass: 0.4,
    undergrowth: 0.5,
    particles: 0,
    cloudLayers: 3,
  },
  balanced: {
    pixelRatio: 1.5,
    shadows: true,
    pointLights: true,
    foliage: 1,
    grass: 1,
    undergrowth: 1,
    particles: 40,
    cloudLayers: 5,
  },
  cinematic: {
    pixelRatio: 1.5,
    shadows: true,
    pointLights: true,
    foliage: 1,
    grass: 1,
    undergrowth: 1,
    particles: 64,
    cloudLayers: 5,
  },
});
// Graphics preferences are device-local, independent of account/progression saves.
export function qualityId(id) {
  if (typeof id !== 'string') return 'balanced';
  if (id === 'mobile') return 'low'; // Retired preference from the Android build.
  return Object.hasOwn(RENDER_PROFILES, id) ? id : 'balanced';
}
export const renderProfile = (id) => RENDER_PROFILES[qualityId(id)];
