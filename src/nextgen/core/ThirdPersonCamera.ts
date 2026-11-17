import type { CameraOrientation } from './CharacterController.ts';

type Vec3 = [number, number, number];

export interface CameraPose {
  position: Vec3;
  target: Vec3;
  fov: number;
}

interface CameraTerrain {
  heightAt(x: number, z: number): number;
}

export class ThirdPersonCamera {
  static readonly DISTANCE = 5.5;
  static readonly TARGET_HEIGHT = 1.35;
  static readonly SENSITIVITY = 0.0025;
  static readonly FOLLOW_SPEED = 12;
  static readonly MIN_PITCH = 0.1;
  static readonly MAX_PITCH = 1.2;
  static readonly CLEARANCE = 0.3;
  static readonly FOV = 58;
  static readonly AIM_FOV = 45;
  static readonly AIM_DISTANCE = 3;
  static readonly AIM_SHOULDER = 0.75;
  static readonly ZOOM_SPEED = 8;

  private yaw = 0;
  private pitch = 0.35;
  private target: Vec3 | null = null;
  private distance = ThirdPersonCamera.DISTANCE;
  private fov = ThirdPersonCamera.FOV;
  private shoulder = 0;

  rotate(deltaX: number, deltaY: number): void {
    const dx = Number.isFinite(deltaX)
      ? Math.max(-1000, Math.min(1000, deltaX))
      : 0;

    const dy = Number.isFinite(deltaY)
      ? Math.max(-1000, Math.min(1000, deltaY))
      : 0;

    this.yaw =
      (this.yaw + dx * ThirdPersonCamera.SENSITIVITY) %
      (Math.PI * 2);

    this.pitch = Math.max(
      ThirdPersonCamera.MIN_PITCH,
      Math.min(
        ThirdPersonCamera.MAX_PITCH,
        this.pitch + dy * ThirdPersonCamera.SENSITIVITY
      )
    );
  }

  getOrientation(): CameraOrientation {
    return {
      front: [
        Math.sin(this.yaw),
        0,
        -Math.cos(this.yaw)
      ],
      right: [
        Math.cos(this.yaw),
        0,
        Math.sin(this.yaw)
      ]
    };
  }

update(
  deltaTimeMs: number,
  characterPosition: Vec3,
  terrain: CameraTerrain,
  aiming = false
): CameraPose {
    const dt = Number.isFinite(deltaTimeMs)
      ? Math.max(0, Math.min(100, deltaTimeMs)) / 1000
      : 0;

      const targetDistance = aiming
  ? ThirdPersonCamera.AIM_DISTANCE
  : ThirdPersonCamera.DISTANCE;

const targetFov = aiming
  ? ThirdPersonCamera.AIM_FOV
  : ThirdPersonCamera.FOV;

const zoomAlpha =
  1 - Math.exp(-ThirdPersonCamera.ZOOM_SPEED * dt);

this.distance +=
  (targetDistance - this.distance) * zoomAlpha;

this.fov +=
  (targetFov - this.fov) * zoomAlpha;
  this.shoulder +=
  ((aiming ? ThirdPersonCamera.AIM_SHOULDER : 0)
    - this.shoulder) * zoomAlpha;

    const desiredTarget: Vec3 =
      characterPosition.every(Number.isFinite)
        ? [
            characterPosition[0],
            characterPosition[1] +
              ThirdPersonCamera.TARGET_HEIGHT,
            characterPosition[2]
          ]
        : this.target ?? [0, 1.35, 0];

    if (!this.target) {
      this.target = [...desiredTarget];
    } else {
      const alpha =
        1 - Math.exp(-ThirdPersonCamera.FOLLOW_SPEED * dt);

      for (let i = 0; i < 3; i++) {
        this.target[i] +=
          (desiredTarget[i] - this.target[i]) * alpha;
      }
    }

    const targetGround = terrain.heightAt(
      this.target[0],
      this.target[2]
    );

    if (Number.isFinite(targetGround)) {
      this.target[1] = Math.max(
        this.target[1],
        targetGround + ThirdPersonCamera.TARGET_HEIGHT
      );
    }

const horizontalDistance =
  Math.cos(this.pitch) * this.distance;

    const offset: Vec3 = [
      -Math.sin(this.yaw) * horizontalDistance,
      Math.sin(this.pitch) * this.distance,
      Math.cos(this.yaw) * horizontalDistance
    ];

    const shoulderOffset: Vec3 = [
  Math.cos(this.yaw) * this.shoulder,
  0,
  Math.sin(this.yaw) * this.shoulder
];

const viewTarget = this.shoulder > 0.00001
  ? this.resolveTerrainCollision(
      this.target,
      shoulderOffset,
      terrain
    )
  : this.target;

const position = this.resolveTerrainCollision(
  viewTarget,
  offset,
  terrain
);

return {
  position,
  target: [...viewTarget],
  fov: this.fov
};
  }

  private resolveTerrainCollision(
  target: Vec3,
  offset: Vec3,
  terrain: CameraTerrain
): Vec3 {
  const steps = 24;
  let safeFraction = 1;

  for (let i = 1; i <= steps; i++) {
    const fraction = i / steps;

    const x = target[0] + offset[0] * fraction;
    const y = target[1] + offset[1] * fraction;
    const z = target[2] + offset[2] * fraction;

    const ground = terrain.heightAt(x, z);

    if (
      Number.isFinite(ground) &&
      y < ground + ThirdPersonCamera.CLEARANCE
    ) {
      safeFraction = Math.max(
        0.01,
        (i - 1) / steps
      );

      break;
    }
  }

  const position: Vec3 = [
    target[0] + offset[0] * safeFraction,
    target[1] + offset[1] * safeFraction,
    target[2] + offset[2] * safeFraction
  ];

  const ground = terrain.heightAt(
    position[0],
    position[2]
  );

  if (Number.isFinite(ground)) {
    position[1] = Math.max(
      position[1],
      ground + ThirdPersonCamera.CLEARANCE
    );
  }

  return position;
}
}