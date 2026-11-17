type Vec3 = [number, number, number];

export interface CharacterInput {
  forward: number;
  strafe: number;
}

export interface CameraOrientation {
  front: Vec3;
  right: Vec3;
}

export interface CharacterControllerResult {
  position: Vec3;
  facing: Vec3;
  grounded: boolean;
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

  private readonly speed: number;
  private readonly radius: number;
  private readonly terrain: CharacterControllerOptions['terrain'];

  private position: Vec3;
  private facing: Vec3 = [0, 0, -1];
  private grounded = true;

  constructor(options: CharacterControllerOptions) {
    const size = options.terrain.size;

    if (!Number.isFinite(size) || size <= 0) {
      throw new RangeError('Invalid terrain size.');
    }

    if (!Number.isFinite(options.speed) || options.speed < 0) {
      throw new RangeError('Invalid movement speed.');
    }

    if (
      !Number.isFinite(options.radius) ||
      options.radius < 0 ||
      options.radius > size / 2
    ) {
      throw new RangeError('Invalid character radius.');
    }

    this.speed = options.speed;
    this.radius = options.radius;
    this.terrain = options.terrain;

    const center = size / 2;

    const x = this.clampPosition(
      Number.isFinite(options.spawn?.x)
        ? options.spawn!.x
        : center
    );

    const z = this.clampPosition(
      Number.isFinite(options.spawn?.z)
        ? options.spawn!.z
        : center
    );

    const y = this.terrain.heightAt(x, z);

    if (!Number.isFinite(y)) {
      throw new RangeError('Invalid terrain spawn height.');
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
    const dt = Number.isFinite(deltaTime)
      ? Math.max(0, Math.min(
          CharacterController.MAX_STEP_MS,
          deltaTime
        )) / 1000
      : 0;

    if (dt === 0 || this.speed === 0) {
      return this.snapshot();
    }

    const forward = this.sanitizeAxis(input.forward);
    const strafe = this.sanitizeAxis(input.strafe);

    if (forward === 0 && strafe === 0) {
      return this.snapshot();
    }

    // Reject invalid camera vectors.
    if (
      !camera.front.every(Number.isFinite) ||
      !camera.right.every(Number.isFinite)
    ) {
      return this.snapshot();
    }

    // Project camera forward onto the horizontal plane.
    let fx = camera.front[0];
    let fz = camera.front[2];
    let length = Math.hypot(fx, fz);

    // Looking straight up or down: recover yaw using camera right.
    if (length < 0.000001) {
      fx = camera.right[2];
      fz = -camera.right[0];
      length = Math.hypot(fx, fz);
    }

    if (!Number.isFinite(length) || length < 0.000001) {
      return this.snapshot();
    }

    fx /= length;
    fz /= length;

    // Construct an orthogonal horizontal right vector.
    const rx = -fz;
    const rz = fx;

    // Preserve analog input while limiting diagonal speed.
    const divisor = Math.max(
      1,
      Math.hypot(forward, strafe)
    );

    const moveX = (forward * fx + strafe * rx) / divisor;
    const moveZ = (forward * fz + strafe * rz) / divisor;

    const distance = this.speed * dt;

    const x = this.clampPosition(
      this.position[0] + moveX * distance
    );

    const z = this.clampPosition(
      this.position[2] + moveZ * distance
    );

    const y = this.terrain.heightAt(x, z);

    // Preserve the last valid position if terrain sampling fails.
    if (!Number.isFinite(y)) {
      this.grounded = false;
      return this.snapshot();
    }

    this.position = [x, y, z];
    this.grounded = true;

    const movementLength = Math.hypot(moveX, moveZ);

    if (movementLength > 0.000001) {
      this.facing = [
        moveX / movementLength,
        0,
        moveZ / movementLength,
      ];
    }

    return this.snapshot();
  }

  private clampPosition(value: number): number {
    return Math.max(
      this.radius,
      Math.min(this.terrain.size - this.radius, value)
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
    };
  }
}