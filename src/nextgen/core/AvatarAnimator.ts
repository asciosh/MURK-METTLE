import * as THREE from 'three/webgpu';

export type AvatarAnimation =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jumpstart'
  | 'jumploop'
  | 'jumpland'
  | 'dodge';

export interface AvatarMotion {
  speed: number;
  sprinting: boolean;
  airborne: boolean;
  dodging: boolean;
}

const ONE_SHOT_MS: Partial<Record<AvatarAnimation, number>> = {
  jumpstart: 350,
  jumpland: 350,
  dodge: 650
};

export class AvatarAnimator {
  private readonly root: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;

  private readonly actions =
    new Map<string, THREE.AnimationAction>();

  private current: THREE.AnimationAction | null = null;
  private activeClip: AvatarAnimation | null = null;

  private elapsedMs = 0;
  private wasAirborne = false;
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

    const duration = ONE_SHOT_MS[name];

    next.reset();

    if (duration !== undefined) {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;

      next.setEffectiveTimeScale(
        next.getClip().duration / (duration / 1000)
      );
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = false;
      next.setEffectiveTimeScale(1);
    }

    next.setEffectiveWeight(1).play();

    if (this.current && this.current !== next) {
      const actionTransition =
        duration !== undefined ||
        (this.activeClip !== null &&
          ONE_SHOT_MS[this.activeClip] !== undefined);

      next.crossFadeFrom(
        this.current,
        actionTransition ? 0.08 : 0.18,
        false
      );
    }

    this.current = next;
    this.activeClip = name;
    this.elapsedMs = 0;
  }

  private locomotion(motion: AvatarMotion): AvatarAnimation {
    if (
      !Number.isFinite(motion.speed) ||
      motion.speed < 0.05
    ) {
      return 'idle';
    }

    return motion.sprinting ? 'run' : 'walk';
  }

  update(
    deltaTimeMs: number,
    motion: AvatarMotion
  ): void {
    if (this.disposed) return;

    const dtMs = Number.isFinite(deltaTimeMs)
      ? Math.max(0, Math.min(100, deltaTimeMs))
      : 0;

    if (
      motion.dodging ||
      (
        !motion.airborne &&
        this.activeClip === 'dodge' &&
        this.elapsedMs < 650
      )
    ) {
      this.setAnimation(
        this.actions.has('dodge') ? 'dodge' : 'idle'
      );
    } else if (motion.airborne) {
      const startingJump =
        !this.wasAirborne ||
        (
          this.activeClip === 'jumpstart' &&
          this.elapsedMs < 350
        );

      if (startingJump && this.actions.has('jumpstart')) {
        this.setAnimation('jumpstart');
      } else {
        this.setAnimation(
          this.actions.has('jumploop')
            ? 'jumploop'
            : 'idle'
        );
      }
    } else if (
      this.actions.has('jumpland') &&
      (
        this.wasAirborne ||
        (
          this.activeClip === 'jumpland' &&
          this.elapsedMs < 350
        )
      )
    ) {
      this.setAnimation('jumpland');
    } else {
      this.setAnimation(this.locomotion(motion));
    }

    this.wasAirborne = motion.airborne;

  if (
    this.current &&
    (this.activeClip === 'walk' || this.activeClip === 'run')
  ) {
    const referenceSpeed =
      this.activeClip === 'walk' ? 5.8 : 8.8;

    this.current.setEffectiveTimeScale(
      Math.max(0.15, Math.min(1.5, motion.speed / referenceSpeed))
    );
  }

    this.mixer.update(dtMs / 1000);
    this.elapsedMs += dtMs;
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