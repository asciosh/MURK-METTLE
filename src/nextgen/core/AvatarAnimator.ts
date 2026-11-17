import * as THREE from 'three/webgpu';
import { WeaponPoseLayer } from './WeaponPoseLayer.ts';

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
  aiming?: boolean;
  shoot?: boolean;
  reload?: boolean;
  aimPitch?: number;
}

interface AimBone {
  bone: THREE.Bone;
  target: THREE.Quaternion;
  base: THREE.Quaternion;
}

const ONE_SHOT_MS: Partial<Record<AvatarAnimation, number>> = {
  jumpstart: 350,
  jumpland: 350,
  dodge: 650
};

const AIM_BLEND_MS = 150;
const AIM_UP_LIMIT = 1.49;
const AIM_DOWN_LIMIT = 1.548;

const AIM_BONE_PATTERN =
  /^(spine_0[123]|neck_01|head|(clavicle|upperarm|lowerarm|hand)_[lr]|(thumb|index|middle|ring|pinky)_0[123]_[lr])$/i;

export class AvatarAnimator {
  private readonly root: THREE.Object3D;
  private readonly mixer: THREE.AnimationMixer;

  private readonly actions =
    new Map<string, THREE.AnimationAction>();

  private readonly aimBones: AimBone[] = [];

  private aimWeight = 0;
  private aimApplied = false;

  private aimPitch = 0;

  private readonly aimUp =
    new Map<string, THREE.Quaternion>();

  private readonly aimDown =
    new Map<string, THREE.Quaternion>();

  private readonly pitchRotation = new THREE.Quaternion();
  private readonly weaponDelta = new THREE.Quaternion();

  private readonly weaponPose: WeaponPoseLayer;

  private readonly weaponRotation =
    new THREE.Quaternion();

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
    this.weaponPose = new WeaponPoseLayer(clips);

    for (const clip of clips) {
      const name = clip.name.trim().toLowerCase();

      if (name === 'aimup' || name === 'aimdown') {
        this.preparePitchPose(
          clip,
          name === 'aimup' ? this.aimUp : this.aimDown
        );

        continue;
      }

      if (
        name === 'pistolshoot' ||
        name === 'pistolreload'
      ) {
        continue;
      }

      if (name === 'aim') {
        this.prepareAimPose(clip);
        continue;
      }

      this.actions.set(
        name,
        this.mixer.clipAction(clip)
      );
    }

    this.setAnimation('idle');
  }

  private prepareAimPose(
    clip: THREE.AnimationClip
  ): void {
    for (const track of clip.tracks) {
      if (
        !track.name.endsWith('.quaternion') ||
        track.getValueSize() !== 4
      ) {
        continue;
      }

      const name = track.name.slice(
        0,
        -'.quaternion'.length
      );

      if (!AIM_BONE_PATTERN.test(name)) continue;

      const bone = this.root.getObjectByName(name);

      if (!(bone instanceof THREE.Bone)) continue;

      const target = new THREE.Quaternion(
        track.values[0],
        track.values[1],
        track.values[2],
        track.values[3]
      );

      if (
        !target.toArray().every(Number.isFinite) ||
        target.lengthSq() < 0.000001
      ) {
        continue;
      }

      this.aimBones.push({
        bone,
        target: target.normalize(),
        base: bone.quaternion.clone()
      });
    }
  }

  private preparePitchPose(
  clip: THREE.AnimationClip,
  poses: Map<string, THREE.Quaternion>
): void {
  for (const track of clip.tracks) {
    if (
      !track.name.endsWith('.quaternion') ||
      track.getValueSize() !== 4
    ) {
      continue;
    }

    const name = track.name.slice(
      0,
      -'.quaternion'.length
    );

    if (!AIM_BONE_PATTERN.test(name)) continue;

    const rotation = new THREE.Quaternion(
      track.values[0],
      track.values[1],
      track.values[2],
      track.values[3]
    );

    if (
      !rotation.toArray().every(Number.isFinite) ||
      rotation.lengthSq() < 0.000001
    ) {
      continue;
    }

    poses.set(name, rotation.normalize());
  }
}

  private restoreBasePose(): void {
    if (!this.aimApplied) return;

    for (const entry of this.aimBones) {
      entry.bone.quaternion.copy(entry.base);
    }

    this.aimApplied = false;
  }

  private updateAim(
  dtMs: number,
  motion: AvatarMotion
): void {
  const locomotion =
    this.activeClip === 'idle' ||
    this.activeClip === 'walk' ||
    this.activeClip === 'run';

  if (
    !locomotion ||
    motion.airborne ||
    motion.dodging ||
    this.aimBones.length === 0
  ) {
    this.aimWeight = 0;
    this.aimPitch = 0;
    this.weaponPose.cancel();
    return;
  }

  this.weaponPose.update(
    dtMs,
    motion.aiming === true,
    motion.shoot === true,
    motion.reload === true
  );

  const step = dtMs / AIM_BLEND_MS;

  this.aimWeight = motion.aiming
    ? Math.min(1, this.aimWeight + step)
    : Math.max(0, this.aimWeight - step);

  if (this.aimWeight === 0) {
    this.aimPitch = 0;
    return;
  }

  if (motion.aiming) {
    const pitch = motion.aimPitch ?? 0;

    const requested = Number.isFinite(pitch)
      ? THREE.MathUtils.clamp(
          pitch,
          -AIM_DOWN_LIMIT,
          AIM_UP_LIMIT
        )
      : 0;

    const alpha = 1 - Math.exp(-18 * dtMs / 1000);

    this.aimPitch +=
      (requested - this.aimPitch) * alpha;
  }

  for (const entry of this.aimBones) {
    entry.base.copy(entry.bone.quaternion);

    this.pitchRotation.copy(entry.target);

    const verticalPose = this.aimPitch >= 0
      ? this.aimUp.get(entry.bone.name)
      : this.aimDown.get(entry.bone.name);

    if (verticalPose) {
      const limit = this.aimPitch >= 0
        ? AIM_UP_LIMIT
        : AIM_DOWN_LIMIT;

      this.pitchRotation.slerp(
        verticalPose,
        Math.min(1, Math.abs(this.aimPitch) / limit)
      );
    }

    const animated = this.weaponPose.sample(
      entry.bone.name,
      this.weaponRotation
    );

    if (animated) {
      // Apply weapon animation relative to neutral aim.
      this.weaponDelta
        .copy(entry.target)
        .invert()
        .multiply(this.weaponRotation);

      this.pitchRotation
        .multiply(this.weaponDelta)
        .normalize();
    }

    entry.bone.quaternion.slerp(
      this.pitchRotation,
      this.aimWeight
    );
  }

  this.aimApplied = true;
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

    // Remove the previous overlay before evaluating
    // the base animation again. Prevents pose drift.
    this.restoreBasePose();

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
      (this.activeClip === 'walk' ||
        this.activeClip === 'run')
    ) {
      const referenceSpeed =
        this.activeClip === 'walk' ? 5.8 : 8.8;

      this.current.setEffectiveTimeScale(
        Math.max(
          0.15,
          Math.min(1.5, motion.speed / referenceSpeed)
        )
      );
    }

    this.mixer.update(dtMs / 1000);

    this.updateAim(dtMs, motion);

    this.elapsedMs += dtMs;
  }

  getActiveClip(): AvatarAnimation | null {
    return this.activeClip;
  }

  getAimWeight(): number {
    return this.aimWeight;
  }

  getAimPitch(): number {
  return this.aimPitch;
}

  getWeaponAction() {
  return this.weaponPose.getActiveAction();
}

  dispose(): void {
    if (this.disposed) return;

    this.restoreBasePose();

    this.disposed = true;
    this.aimWeight = 0;
    this.aimPitch = 0;
    this.aimUp.clear();
    this.aimDown.clear();
    this.weaponPose.cancel();

    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.root);

    this.aimBones.length = 0;
    this.actions.clear();
    this.current = null;
    this.activeClip = null;
  }
}