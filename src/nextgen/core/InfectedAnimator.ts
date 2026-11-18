import * as THREE from 'three/webgpu';

import {
  InfectedController,
  type InfectedAnimation,
  type InfectedState
} from './InfectedController.ts';

const ONE_SHOT_MS: Partial<Record<InfectedAnimation, number>> = {
  attack: InfectedController.ATTACK_DURATION_MS,
  hit: InfectedController.HIT_DURATION_MS
};

export class InfectedAnimator {
  private readonly root: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;

  private readonly actions =
    new Map<string, THREE.AnimationAction>();

  private current: THREE.AnimationAction | null = null;
  private activeClip: InfectedAnimation | null = null;

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

    this.play('idle');
  }

  private play(name: InfectedAnimation): void {
    if (
      this.disposed ||
      this.activeClip === name ||
      this.activeClip === 'death'
    ) {
      return;
    }

    const next = this.actions.get(name);

    if (!next) return;

    for (const action of this.actions.values()) {
      if (action !== this.current && action !== next) {
        action.stop();
      }
    }

    next.reset();

    const duration = ONE_SHOT_MS[name];

    if (duration !== undefined || name === 'death') {
      next.setLoop(THREE.LoopOnce, 1);
      next.clampWhenFinished = true;

      next.setEffectiveTimeScale(
        duration !== undefined
          ? next.getClip().duration / (duration / 1000)
          : 1
      );
    } else {
      next.setLoop(THREE.LoopRepeat, Infinity);
      next.clampWhenFinished = false;
      next.setEffectiveTimeScale(1);
    }

    next.setEffectiveWeight(1).play();

    if (this.current && this.current !== next) {
      const combatTransition =
        name === 'attack' ||
        name === 'hit' ||
        name === 'death' ||
        this.activeClip === 'attack' ||
        this.activeClip === 'hit';

      next.crossFadeFrom(
        this.current,
        combatTransition ? 0.08 : 0.18,
        false
      );
    }

    this.current = next;
    this.activeClip = name;
  }

  update(
    deltaTimeMs: number,
    state: Pick<InfectedState, 'animation' | 'speed'>
  ): void {
    if (this.disposed) return;

    const dt = Number.isFinite(deltaTimeMs)
      ? Math.max(0, Math.min(100, deltaTimeMs))
      : 0;

    this.play(state.animation);

    if (
      this.current &&
      (this.activeClip === 'walk' ||
        this.activeClip === 'run')
    ) {
      const referenceSpeed =
        this.activeClip === 'walk'
          ? InfectedController.WALK_SPEED
          : InfectedController.RUN_SPEED;

      const speed = Number.isFinite(state.speed)
        ? state.speed
        : 0;

      this.current.setEffectiveTimeScale(
        Math.max(
          0.15,
          Math.min(1.5, speed / referenceSpeed)
        )
      );
    }

    this.mixer.update(dt / 1000);
  }

  getActiveClip(): InfectedAnimation | null {
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