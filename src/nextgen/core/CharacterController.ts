import { SURVIVAL } from '../../../shared/survival.mjs';
import { CharacterJump } from './CharacterJump.ts';
import {
  CharacterStamina,
  type CharacterStaminaState
} from './CharacterStamina.ts';

type Vec3 = [number, number, number];

export interface CharacterInput {
  forward: number;
  strafe: number;
  sprint?: boolean;
  dodge?: boolean;
  jump?: boolean;
}

export interface CameraOrientation {
  front: Vec3;
  right: Vec3;
}

export interface CharacterControllerResult
  extends CharacterStaminaState {
  position: Vec3;
  facing: Vec3;
  grounded: boolean;
  dodging: boolean;
  dodgeCooldownMs: number;
  airborne: boolean;
  verticalVelocity: number;
}

export interface CharacterControllerOptions {
  speed: number;
  radius: number;
  terrain: {
    heightAt: (x: number, z: number) => number;
    size: number;
  };
  spawn?: {
    x: number;
    z: number;
  };
}

export class CharacterController {
  static readonly MAX_STEP_MS = 100;

  static readonly DODGE_COST = 25;
  static readonly DODGE_SPEED = 10;
  static readonly DODGE_DURATION_MS = 300;
  static readonly DODGE_COOLDOWN_MS = 800;

  private readonly speed: number;
  private readonly radius: number;
  private readonly terrain: CharacterControllerOptions['terrain'];

  private position: Vec3;
  private facing: Vec3 = [0, 0, -1];
  private grounded = true;

  private readonly stamina = new CharacterStamina();
  private readonly jump = new CharacterJump();
  private jumpHeld = false;

  private dodgeHeld = false;
  private dodgeRemainingMs = 0;
  private dodgeCooldownMs = 0;
  private dodgeDirection: [number, number] = [0, -1];

  constructor(options: CharacterControllerOptions) {
    const size = options.terrain.size;

    if (!Number.isFinite(size) || size <= 0) {
      throw new RangeError('Invalid terrain size');
    }

    if (!Number.isFinite(options.speed) || options.speed < 0) {
      throw new RangeError('Invalid movement speed');
    }

    if (
      !Number.isFinite(options.radius) ||
      options.radius < 0 ||
      options.radius > size / 2
    ) {
      throw new RangeError('Invalid character radius');
    }

    this.speed = options.speed;
    this.radius = options.radius;
    this.terrain = options.terrain;

    const center = size / 2;

    const x = this.clampPosition(
      options.spawn && Number.isFinite(options.spawn.x)
        ? options.spawn.x
        : center
    );

    const z = this.clampPosition(
      options.spawn && Number.isFinite(options.spawn.z)
        ? options.spawn.z
        : center
    );

    const y = this.terrain.heightAt(x, z);

    if (!Number.isFinite(y)) {
      throw new RangeError('Invalid terrain height at spawn');
    }

    this.position = [x, y, z];
  }

  getPosition(): Vec3 {
    return [...this.position];
  }

  getFacing(): Vec3 {
    return [...this.facing];
  }

  update(
    deltaTime: number,
    input: CharacterInput,
    camera: CameraOrientation
  ): CharacterControllerResult {
    const dtMs = Number.isFinite(deltaTime)
      ? Math.max(
          0,
          Math.min(CharacterController.MAX_STEP_MS, deltaTime)
        )
      : 0;

    if (dtMs === 0) return this.snapshot();

    const movement = this.getMovement(input, camera);

    const dodgePressed =
      input.dodge === true && !this.dodgeHeld;

    this.dodgeHeld = input.dodge === true;

const jumpPressed =
  input.jump === true && !this.jumpHeld;

this.jumpHeld = input.jump === true;

  if (dodgePressed) {
    this.tryStartDodge(input, movement);
  }

  if (
    jumpPressed &&
    this.grounded &&
    this.dodgeRemainingMs === 0
  ) {
    if (this.jump.start()) {
      this.grounded = false;
    }
  }

    this.dodgeCooldownMs = Math.max(
      0,
      this.dodgeCooldownMs - dtMs
    );

    let remainingMs = dtMs;

    if (this.dodgeRemainingMs > 0) {
      const dodgeStepMs = Math.min(
        remainingMs,
        this.dodgeRemainingMs
      );

      this.advanceDodge(dodgeStepMs);

      remainingMs -= dodgeStepMs;

      if (remainingMs <= 0) {
        return this.snapshot();
      }
    }

    this.advanceMovement(
      remainingMs,
      input,
      movement
    );

    return this.snapshot();
  }

  private tryStartDodge(
    input: CharacterInput,
    movement: [number, number] | null
  ): void {
    if (
      !this.grounded ||
      this.dodgeRemainingMs > 0 ||
      this.dodgeCooldownMs > 0
    ) {
      return;
    }

    const hasDirectionalInput =
      this.sanitizeAxis(input.forward) !== 0 ||
      this.sanitizeAxis(input.strafe) !== 0;

    if (hasDirectionalInput && !movement) {
      return;
    }

    const direction = movement ?? [
      this.facing[0],
      this.facing[2]
    ];

    const length = Math.hypot(
      direction[0],
      direction[1]
    );

    if (length < 0.000001) return;

    if (!this.stamina.trySpend(CharacterController.DODGE_COST)) {
      return;
    }

    this.dodgeDirection = [
      direction[0] / length,
      direction[1] / length
    ];

    this.facing = [
      this.dodgeDirection[0],
      0,
      this.dodgeDirection[1]
    ];

    this.dodgeRemainingMs =
      CharacterController.DODGE_DURATION_MS;

    this.dodgeCooldownMs =
      CharacterController.DODGE_COOLDOWN_MS;
  }

  private advanceDodge(dtMs: number): void {
    const [moveX, moveZ] = this.dodgeDirection;

    const distance =
      CharacterController.DODGE_SPEED * dtMs / 1000;

    const next = this.getGroundPosition(
      moveX,
      moveZ,
      distance
    );

    if (next) {
      this.position = next;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    this.dodgeRemainingMs = Math.max(
      0,
      this.dodgeRemainingMs - dtMs
    );

    this.stamina.update(dtMs, false, false);
  }

  private advanceMovement(
  dtMs: number,
  input: CharacterInput,
  movement: [number, number] | null
): void {
  const [moveX, moveZ] = movement ?? [0, 0];

  const wantsSprint =
    movement !== null &&
    !this.jump.isAirborne() &&
    input.sprint === true &&
    this.speed > 0 &&
    this.speed < SURVIVAL.sprintSpeed &&
    this.stamina.canSprint();

  const requestedSpeed = wantsSprint
    ? SURVIVAL.sprintSpeed
    : this.speed;

  let next = this.getGroundPosition(
    moveX,
    moveZ,
    requestedSpeed * dtMs / 1000
  );

  if (!next) {
    this.grounded = false;
    this.stamina.update(dtMs, false, false);
    return;
  }

  const moving =
    next[0] !== this.position[0] ||
    next[2] !== this.position[2];

  const state = this.stamina.update(
    dtMs,
    moving,
    wantsSprint
  );

  if (wantsSprint && moving && !state.sprinting) {
    next = this.getGroundPosition(
      moveX,
      moveZ,
      this.speed * dtMs / 1000
    );

    if (!next) {
      this.grounded = false;
      return;
    }
  }

  const y = this.jump.advance(
    dtMs,
    this.position[1],
    next[1]
  );

  this.position = [next[0], y, next[2]];
  this.grounded = !this.jump.isAirborne();

  const length = Math.hypot(moveX, moveZ);

  if (length > 0.000001 && this.speed > 0) {
    this.facing = [
      moveX / length,
      0,
      moveZ / length
    ];
  }
}

  private getMovement(
    input: CharacterInput,
    camera: CameraOrientation
  ): [number, number] | null {
    const forward = this.sanitizeAxis(input.forward);
    const strafe = this.sanitizeAxis(input.strafe);

    if (forward === 0 && strafe === 0) return null;

    if (
      !camera.front.every(Number.isFinite) ||
      !camera.right.every(Number.isFinite)
    ) {
      return null;
    }

    let fx = camera.front[0];
    let fz = camera.front[2];

    let length = Math.hypot(fx, fz);

    if (length < 0.000001) {
      fx = camera.right[2];
      fz = -camera.right[0];
      length = Math.hypot(fx, fz);
    }

    if (!Number.isFinite(length) || length < 0.000001) {
      return null;
    }

    fx /= length;
    fz /= length;

    const rx = -fz;
    const rz = fx;

    const divisor = Math.max(
      1,
      Math.hypot(forward, strafe)
    );

    return [
      (forward * fx + strafe * rx) / divisor,
      (forward * fz + strafe * rz) / divisor
    ];
  }

  private getGroundPosition(
    moveX: number,
    moveZ: number,
    distance: number
  ): Vec3 | null {
    const x = this.clampPosition(
      this.position[0] + moveX * distance
    );

    const z = this.clampPosition(
      this.position[2] + moveZ * distance
    );

    const y = this.terrain.heightAt(x, z);

    return Number.isFinite(y)
      ? [x, y, z]
      : null;
  }

  private clampPosition(value: number): number {
    return Math.max(
      this.radius,
      Math.min(
        this.terrain.size - this.radius,
        value
      )
    );
  }

  private sanitizeAxis(value: number): number {
    return Number.isFinite(value)
      ? Math.max(-1, Math.min(1, value))
      : 0;
  }

private snapshot(): CharacterControllerResult {
  return {
    position: this.getPosition(),
    facing: this.getFacing(),
    grounded: this.grounded,
    dodging: this.dodgeRemainingMs > 0,
    dodgeCooldownMs: this.dodgeCooldownMs,
    airborne: this.jump.isAirborne(),
    verticalVelocity: this.jump.getVelocity(),
    ...this.stamina.getState()
  };
}
}