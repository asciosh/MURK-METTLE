export type QualityId = 'mobile' | 'low' | 'balanced' | 'cinematic';
export interface RenderProfile {
  pixelRatio: number;
  shadows: boolean;
  pointLights: boolean;
  foliage: number;
  grass: number;
  undergrowth: number;
  particles: number;
  cloudLayers: number;
}
export const RENDER_PROFILES: Readonly<Record<QualityId, RenderProfile>>;
export function renderProfile(id: string): RenderProfile;
