import * as THREE from 'three/webgpu';

export type AvatarAnimation = 'idle' | 'walk' | 'run';

export interface AvatarMotion {
  speed: number;
  sprinting: boolean;
  airborne: boolean;
  dodging: boolean;
}

export class AvatarAnimator {
  private readonly root: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;

  private readonly actions =
    new Map<string, THREE.AnimationAction>();

  private current: THREE.AnimationAction | null = null;
  private activeClip: AvatarAnimation | null = null;
  private disposed = false;

  constructor(
    root: THREE.Object3D,
    clips: THREE.AnimationClip[]
  ) {
    this.root = root;
    this.mixer = new THREE.AnimationMixer(root);

    for (const clip of clips) {
      this.actions.set(
        clip.name.trim().toLowerCase(),
        this.mixer.clipAction(clip)
      );
    }

    this.setAnimation('idle');
  }

  private setAnimation(name: AvatarAnimation): void {
    if (this.disposed || this.activeClip === name) {
      return;
    }

    const next = this.actions.get(name);

    if (!next) return;

    for (const action of this.actions.values()) {
      if (action !== this.current && action !== next) {
        action.stop();
      }
    }

    next
      .reset()
      .setEffectiveTimeScale(1)
      .setEffectiveWeight(1)
      .play();

    if (this.current && this.current !== next) {
      next.crossFadeFrom(
        this.current,
        0.18,
        false
      );
    }

    this.current = next;
    this.activeClip = name;
  }

  update(
    deltaTimeMs: number,
    motion: AvatarMotion
  ): void {
    if (this.disposed) return;

    if (motion.airborne || motion.dodging) {
      // Temporary fallback until dedicated clips exist.
      this.setAnimation('idle');
    } else if (
      !Number.isFinite(motion.speed) ||
      motion.speed < 0.05
    ) {
      this.setAnimation('idle');
    } else if (motion.sprinting) {
      this.setAnimation('run');
    } else {
      this.setAnimation('walk');
    }

    const dt = Number.isFinite(deltaTimeMs)
      ? Math.max(0, Math.min(100, deltaTimeMs)) / 1000
      : 0;

    this.mixer.update(dt);
  }

  getActiveClip(): AvatarAnimation | null {
    return this.activeClip;
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;

    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);

    this.actions.clear();
    this.current = null;
    this.activeClip = null;
  }
}