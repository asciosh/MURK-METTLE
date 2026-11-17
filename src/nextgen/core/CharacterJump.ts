export class CharacterJump {
  static readonly JUMP_SPEED = 5.2;
  static readonly GRAVITY = 9.81;
  static readonly MAX_STEP_MS = 100;

  private airborne = false;
  private velocity = 0;

  isAirborne(): boolean {
    return this.airborne;
  }

  getVelocity(): number {
    return this.velocity;
  }

  start(): boolean {
    if (this.airborne) return false;

    this.airborne = true;
    this.velocity = CharacterJump.JUMP_SPEED;

    return true;
  }

  advance(
    deltaTimeMs: number,
    currentY: number,
    groundY: number
  ): number {
    if (
      !Number.isFinite(deltaTimeMs) ||
      deltaTimeMs <= 0 ||
      !Number.isFinite(currentY) ||
      !Number.isFinite(groundY)
    ) {
      return currentY;
    }

    const dt = Math.min(
      deltaTimeMs,
      CharacterJump.MAX_STEP_MS
    ) / 1000;

    if (!this.airborne) {
      this.velocity = 0;
      return groundY;
    }

    const nextY =
      currentY +
      this.velocity * dt -
      0.5 * CharacterJump.GRAVITY * dt * dt;

    this.velocity -= CharacterJump.GRAVITY * dt;

    if (nextY <= groundY) {
      this.airborne = false;
      this.velocity = 0;

      return groundY;
    }

    return nextY;
  }
}