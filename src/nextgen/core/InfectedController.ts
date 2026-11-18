export type InfectedPosition = [number, number, number];

export type InfectedAnimation =
  | 'idle'
  | 'walk'
  | 'run'
  | 'attack'
  | 'hit'
  | 'death';

export interface InfectedTerrain {
  size: number;
  heightAt(x: number, z: number): number;
}

export interface InfectedControllerOptions {
  terrain: InfectedTerrain;
  spawn: {
    x: number;
    z: number;
  };
}

export interface InfectedState {
  position: InfectedPosition;
  facing: InfectedPosition;
  animation: InfectedAnimation;
  health: number;
  maxHealth: number;
  speed: number;
  attackHit: boolean;
}

export class InfectedController {
  static readonly MAX_HEALTH = 100;
  static readonly RADIUS = 0.4;

  static readonly DETECTION_RANGE = 18;
  static readonly RUN_DISTANCE = 6;

  static readonly WALK_SPEED = 1.6;
  static readonly RUN_SPEED = 3.2;

  static readonly ATTACK_RANGE = 1.65;
  static readonly HIT_RANGE = 1.9;

  static readonly ATTACK_WINDUP_MS = 450;
  static readonly ATTACK_DURATION_MS = 1000;
  static readonly ATTACK_COOLDOWN_MS = 1350;
  static readonly HIT_DURATION_MS = 333;
  static readonly MAX_STEP_MS = 100;

  private readonly terrain: InfectedTerrain;

  private position: InfectedPosition;
  private facing: InfectedPosition = [0, 0, -1];

  private animation: InfectedAnimation = 'idle';
  private health = InfectedController.MAX_HEALTH;
  private speed = 0;

  private attackElapsedMs: number | null = null;
  private cooldownMs = 0;
  private hitRemainingMs = 0;

  constructor(options: InfectedControllerOptions) {
    this.terrain = options.terrain;

    if (
      !Number.isFinite(this.terrain.size) ||
      this.terrain.size < InfectedController.RADIUS * 2
    ) {
      throw new RangeError('Invalid infected terrain');
    }

    if (
      !Number.isFinite(options.spawn.x) ||
      !Number.isFinite(options.spawn.z)
    ) {
      throw new RangeError('Invalid infected spawn');
    }

    const x = this.clamp(options.spawn.x);
    const z = this.clamp(options.spawn.z);
    const y = this.terrain.heightAt(x, z);

    if (!Number.isFinite(y)) {
      throw new RangeError('Invalid infected spawn height');
    }

    this.position = [x, y, z];
  }

  update(
    deltaTimeMs: number,
    target: InfectedPosition | null
  ): InfectedState {
    const dt = Number.isFinite(deltaTimeMs)
      ? Math.max(
          0,
          Math.min(InfectedController.MAX_STEP_MS, deltaTimeMs)
        )
      : 0;

    if (dt === 0 || this.health === 0) {
      return this.getState();
    }

    this.speed = 0;

    this.cooldownMs = Math.max(0, this.cooldownMs - dt);

    const validTarget =
      target !== null && target.every(Number.isFinite)
        ? target
        : null;

    // Hit reaction interrupts other actions.
    if (this.hitRemainingMs > 0) {
      this.hitRemainingMs = Math.max(
        0,
        this.hitRemainingMs - dt
      );

      this.animation =
        this.hitRemainingMs > 0 ? 'hit' : 'idle';

      return this.getState();
    }

    // Complete an existing attack before moving again.
    if (this.attackElapsedMs !== null) {
      const previous = this.attackElapsedMs;

      this.attackElapsedMs += dt;

      const impact =
        previous < InfectedController.ATTACK_WINDUP_MS &&
        this.attackElapsedMs >=
          InfectedController.ATTACK_WINDUP_MS;

      const attackHit =
        impact &&
        validTarget !== null &&
        this.canHit(validTarget);

      if (
        this.attackElapsedMs >=
        InfectedController.ATTACK_DURATION_MS
      ) {
        this.attackElapsedMs = null;
        this.animation = 'idle';
      }

      return this.snapshot(attackHit);
    }

    this.animation = 'idle';

    if (!validTarget) {
      return this.getState();
    }

    const dx = validTarget[0] - this.position[0];
    const dz = validTarget[2] - this.position[2];

    const distance = Math.hypot(dx, dz);

    if (distance > InfectedController.DETECTION_RANGE) {
      return this.getState();
    }

    if (distance > 0.000001) {
      this.facing = [
        dx / distance,
        0,
        dz / distance
      ];
    }

    // Stop at melee distance.
    if (distance <= InfectedController.ATTACK_RANGE + 0.000001) {
      if (
        this.cooldownMs === 0 &&
        this.canHit(validTarget)
      ) {
        this.attackElapsedMs = 0;

        this.cooldownMs =
          InfectedController.ATTACK_WINDUP_MS +
          InfectedController.ATTACK_COOLDOWN_MS;

        this.animation = 'attack';
      }

      return this.getState();
    }

    const running =
      distance > InfectedController.RUN_DISTANCE;

    const speed = running
      ? InfectedController.RUN_SPEED
      : InfectedController.WALK_SPEED;

    const step = Math.min(
      speed * dt / 1000,
      distance - InfectedController.ATTACK_RANGE
    );

    const x = this.clamp(
      this.position[0] + this.facing[0] * step
    );

    const z = this.clamp(
      this.position[2] + this.facing[2] * step
    );

    const y = this.terrain.heightAt(x, z);

    if (!Number.isFinite(y)) {
      return this.getState();
    }

    const travelled = Math.hypot(
      x - this.position[0],
      z - this.position[2]
    );

    this.position = [x, y, z];

    if (travelled > 0.000001) {
      this.speed = travelled / (dt / 1000);
      this.animation = running ? 'run' : 'walk';
    }

    return this.getState();
  }

  separate(dx: number, dz: number): boolean {
  if (
    this.health <= 0 ||
    !Number.isFinite(dx) ||
    !Number.isFinite(dz)
  ) {
    return false;
  }

  const distance = Math.hypot(dx, dz);

  if (distance < 0.000001) return false;

  const scale = Math.min(1, 0.12 / distance);

  const x = this.clamp(this.position[0] + dx * scale);
  const z = this.clamp(this.position[2] + dz * scale);
  const y = this.terrain.heightAt(x, z);

  if (!Number.isFinite(y)) return false;

  this.position = [x, y, z];

  return true;
}

  damage(amount: number): boolean {
    if (
      this.health === 0 ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return false;
    }

    this.health = Math.max(0, this.health - amount);

    this.speed = 0;
    this.attackElapsedMs = null;

    if (this.health === 0) {
      this.animation = 'death';
      this.hitRemainingMs = 0;
    } else {
      this.animation = 'hit';

      this.hitRemainingMs =
        InfectedController.HIT_DURATION_MS;
    }

    return true;
  }

  getState(): InfectedState {
    return this.snapshot(false);
  }

  private canHit(target: InfectedPosition): boolean {
    const dx = target[0] - this.position[0];
    const dz = target[2] - this.position[2];

    const distance = Math.hypot(dx, dz);

    if (
      distance > InfectedController.HIT_RANGE ||
      Math.abs(target[1] - this.position[1]) > 1.25
    ) {
      return false;
    }

    if (distance < 0.000001) return true;

    const dot =
      (dx * this.facing[0] + dz * this.facing[2]) /
      distance;

    return dot >= 0.25;
  }

  private clamp(value: number): number {
    return Math.max(
      InfectedController.RADIUS,
      Math.min(
        this.terrain.size - InfectedController.RADIUS,
        value
      )
    );
  }

  private snapshot(attackHit: boolean): InfectedState {
    return {
      position: [...this.position],
      facing: [...this.facing],
      animation: this.animation,
      health: this.health,
      maxHealth: InfectedController.MAX_HEALTH,
      speed: this.speed,
      attackHit
    };
  }
}