import * as THREE from 'three/webgpu';

export type WeaponAction = 'shoot' | 'reload';

interface WeaponClip {
  durationMs: number;
  tracks: Map<string, THREE.KeyframeTrack>;
}

export class WeaponPoseLayer {
  private readonly clips =
    new Map<WeaponAction, WeaponClip>();

  private readonly nextRotation =
    new THREE.Quaternion();

  private active: WeaponAction | null = null;
  private elapsedMs = 0;

  constructor(clips: THREE.AnimationClip[]) {
    for (const clip of clips) {
      const name = clip.name.trim().toLowerCase();

      const action: WeaponAction | null =
        name === 'pistolshoot' ? 'shoot' :
        name === 'pistolreload' ? 'reload' :
        null;

      if (
        !action ||
        !Number.isFinite(clip.duration) ||
        clip.duration <= 0
      ) {
        continue;
      }

      const tracks = new Map<
        string,
        THREE.KeyframeTrack
      >();

      for (const track of clip.tracks) {
        if (
          track.name.endsWith('.quaternion') &&
          track.getValueSize() === 4 &&
          track.times.length > 0
        ) {
          const bone = track.name.slice(
            0,
            -'.quaternion'.length
          );

          tracks.set(bone, track);
        }
      }

      if (tracks.size > 0) {
        this.clips.set(action, {
          durationMs: clip.duration * 1000,
          tracks
        });
      }
    }
  }

  update(
    deltaTimeMs: number,
    enabled: boolean,
    shoot = false,
    reload = false
  ): void {
    if (!enabled) {
      this.cancel();
      return;
    }

    const dt = Number.isFinite(deltaTimeMs)
      ? Math.max(0, Math.min(100, deltaTimeMs))
      : 0;

    if (dt === 0) return;

    if (this.active) {
      const clip = this.clips.get(this.active)!;

      this.elapsedMs += dt;

      if (this.elapsedMs >= clip.durationMs) {
        this.cancel();
      }

      return;
    }

    const requested =
      reload ? 'reload' :
      shoot ? 'shoot' :
      null;

    if (requested && this.clips.has(requested)) {
      this.active = requested;
      this.elapsedMs = 0;
    }
  }

  sample(
    boneName: string,
    target: THREE.Quaternion
  ): boolean {
    if (!this.active) return false;

    const track = this.clips
      .get(this.active)
      ?.tracks.get(boneName);

    if (!track) return false;

    const time = this.elapsedMs / 1000;
    const times = track.times;

    let right = 1;

    while (
      right < times.length &&
      times[right] <= time
    ) {
      right++;
    }

    const left = Math.max(0, right - 1);

    this.readQuaternion(track, left, target);

    if (
      right >= times.length ||
      time <= times[left] ||
      track.getInterpolation() ===
        THREE.InterpolateDiscrete
    ) {
      return true;
    }

    this.readQuaternion(
      track,
      right,
      this.nextRotation
    );

    const alpha =
      (time - times[left]) /
      (times[right] - times[left]);

    target.slerp(
      this.nextRotation,
      Math.max(0, Math.min(1, alpha))
    );

    return true;
  }

  private readQuaternion(
    track: THREE.KeyframeTrack,
    index: number,
    target: THREE.Quaternion
  ): void {
    const i = index * 4;

    target.set(
      track.values[i],
      track.values[i + 1],
      track.values[i + 2],
      track.values[i + 3]
    ).normalize();
  }

  getActiveAction(): WeaponAction | null {
    return this.active;
  }

  cancel(): void {
    this.active = null;
    this.elapsedMs = 0;
  }
}