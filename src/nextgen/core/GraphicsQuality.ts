import {
  qualityId,
  renderProfile,
  RENDER_PROFILES,
} from '../../../shared/render-profile.mjs';

/**
 * Shape of a shared render-profile preset. Kept in sync with
 * shared/render-profile.mjs (single source of truth for quality limits).
 */
export type RenderProfile = typeof RENDER_PROFILES[keyof typeof RENDER_PROFILES];

/**
 * Adapts the shared render-profile quality presets (low/balanced/cinematic) to
 * the nextgen renderer. Quality preferences are device-local and never persisted
 * to the account/profile schema (configurable graphics quality, requirement).
 */

interface ApplyTarget {
  setPixelRatio(v: number): void;
  shadowMap: { enabled: boolean };
}

export class GraphicsQuality {
  private id = 'balanced';
  private disposed = false;

  set(id: string): void {
    if (this.disposed) return;
    this.id = qualityId(id);
  }

  getId(): string {
    return this.id;
  }

  getProfile(): RenderProfile {
    return renderProfile(this.id);
  }

  /** Apply the preset to a Three renderer (pixel ratio cap + shadow map flag). */
  apply(target: ApplyTarget): void {
    if (this.disposed) return;
    const profile = this.getProfile();
    const devicePixelRatio =
      typeof window !== 'undefined' && window.devicePixelRatio
        ? window.devicePixelRatio
        : 1;
    target.setPixelRatio(Math.min(devicePixelRatio, profile.pixelRatio));
    target.shadowMap.enabled = profile.shadows === true;
  }

  dispose(): void {
    this.disposed = true;
  }
}
