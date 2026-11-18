export const COMBAT = Object.freeze({
  maxHealth: 100,
  magazineCapacity: 12,
  reserveAmmo: 48,
  bulletDamage: 34,
  range: 35,
  fireIntervalMs: 350,
  reloadMs: 1600,
  infectedDamage: 12
});

export interface CombatInput {
  enabled: boolean;
  shoot: boolean;
  reload: boolean;
}

export class CombatController {
  private health: number = COMBAT.maxHealth;
  private ammo: number = COMBAT.magazineCapacity;
  private reserve: number = COMBAT.reserveAmmo;

  private cooldown = 0;
  private reloadRemainingMs = 0;
  private damageGraceRemainingMs = 0;

  private fireIntervalMs: number = COMBAT.fireIntervalMs;
  private reloadDurationMs: number = COMBAT.reloadMs;

  private shotsFired = 0;
  private shotsHit = 0;
  private kills = 0;

  get alive(): boolean {
    return this.health > 0;
  }

  configureWeapon(
    shootMs: number,
    reloadMs: number
  ): void {
    if (Number.isFinite(shootMs) && shootMs > 0) {
      this.fireIntervalMs = Math.max(
        COMBAT.fireIntervalMs,
        shootMs
      );
    }

    if (Number.isFinite(reloadMs) && reloadMs > 0) {
      this.reloadDurationMs = reloadMs;
    }
  }

  step(deltaTimeMs: number, input: CombatInput) {
    const result = {
      shot: false,
      reloadStarted: false
    };

    const dt = Number.isFinite(deltaTimeMs)
      ? Math.max(0, Math.min(100, deltaTimeMs))
      : 0;

    if (dt === 0) return result;

    this.cooldown = Math.max(0, this.cooldown - dt);

    this.damageGraceRemainingMs = Math.max(
      0,
      this.damageGraceRemainingMs - dt
    );

    if (!this.alive || !input.enabled) {
      this.reloadRemainingMs = 0;
      return result;
    }

    if (this.reloadRemainingMs > 0) {
      this.reloadRemainingMs = Math.max(
        0,
        this.reloadRemainingMs - dt
      );

      if (this.reloadRemainingMs === 0) {
        const rounds = Math.min(
          COMBAT.magazineCapacity - this.ammo,
          this.reserve
        );

        this.ammo += rounds;
        this.reserve -= rounds;
      }

      return result;
    }

    if (input.reload) {
      if (
        this.ammo < COMBAT.magazineCapacity &&
        this.reserve > 0 &&
        this.cooldown === 0
      ) {
        this.reloadRemainingMs = this.reloadDurationMs;
        result.reloadStarted = true;
      }

      return result;
    }

    if (
      input.shoot &&
      this.ammo > 0 &&
      this.cooldown === 0
    ) {
      this.ammo--;
      this.shotsFired++;
      this.cooldown = this.fireIntervalMs;
      result.shot = true;
    }

    return result;
  }

  takeDamage(amount: number, graceMs: number): boolean {
    if (
      !this.alive ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      this.damageGraceRemainingMs > 0
    ) {
      return false;
    }

    this.health = Math.max(0, this.health - amount);

    this.damageGraceRemainingMs = Number.isFinite(graceMs)
      ? Math.max(0, graceMs)
      : 0;

    if (!this.alive) {
      this.reloadRemainingMs = 0;
    }

    return true;
  }

  recordHit(killed: boolean): void {
    this.shotsHit++;

    if (killed) {
      this.kills++;
    }
  }

  getState() {
    return {
      health: this.health,
      maxHealth: COMBAT.maxHealth,
      alive: this.alive,
      ammo: this.ammo,
      magazineCapacity: COMBAT.magazineCapacity,
      reserve: this.reserve,
      reloading: this.reloadRemainingMs > 0,
      reloadRemainingMs: this.reloadRemainingMs,
      shotsFired: this.shotsFired,
      shotsHit: this.shotsHit,
      fireCooldownMs: this.cooldown,
      kills: this.kills
    };
  }
}

export type CombatState =
  ReturnType<CombatController['getState']>;