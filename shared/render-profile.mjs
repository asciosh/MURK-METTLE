// Explicit quality limits, independent of gameplay and server simulation.
export const RENDER_PROFILES = Object.freeze({
  mobile: {
    pixelRatio: 1,
    shadows: false,
    pointLights: false,
    foliage: 0.5,
    grass: 0.32,
    undergrowth: 0.4,
    particles: 12,
    cloudLayers: 3,
  },
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
export const renderProfile = (id) => RENDER_PROFILES[id] || RENDER_PROFILES.balanced;
