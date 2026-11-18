import {
  SURVIVAL, newVitals, beginHealing, cancelHealing, stepVitals
} from '../../../shared/survival.mjs';
import { EquipmentInventory, WEAPONS, SWITCH_MS, ammoKind, type LootKind, type WeaponId } from './EquipmentInventory.ts';

export const COMBAT = Object.freeze({
  maxHealth: 100,
  magazineCapacity: 12,
  reserveAmmo: 48,
  reserveCapacity: 72,
  bulletDamage: 34,
  range: 35,
  fireIntervalMs: 350,
  reloadMs: 1600,
  infectedDamage: 12,
  meleeDamage: 25,
  meleeRange: 2,
  meleeWindupMs: 180,
  meleeCooldownMs: 650
});

export interface CombatInput {
  enabled: boolean;
  shoot: boolean;
  reload: boolean;
  melee?: boolean;
  bandage?: boolean;
  moving?: boolean;
  actionAllowed?: boolean;
  aiming?: boolean;
}

export class CombatController {
  private health: number = COMBAT.maxHealth;
  private readonly equipment = new EquipmentInventory();
  private switchRemainingMs = 0;
  private get ammo() { return this.equipment.current.loaded; }
  private set ammo(value: number) { this.equipment.current.loaded = value; }
  private get reserve() { return this.equipment.current.reserve; }
  private set reserve(value: number) { this.equipment.current.reserve = value; }
  get weaponId(): WeaponId { return this.equipment.active; }
  get weaponSpec() { return WEAPONS[this.weaponId]; }
  get switching(): boolean { return this.switchRemainingMs > 0; }

  private cooldown = 0;
  private reloadRemainingMs = 0;
  private damageGraceRemainingMs = 0;

  private fireIntervalMs: number = COMBAT.fireIntervalMs;
  private reloadDurationMs: number = COMBAT.reloadMs;

  private shotsFired = 0;
  private shotsHit = 0;
  private kills = 0;
  private readonly vitals = newVitals();
  private clockMs = 0;
  private meleeRemainingMs = 0;
  private meleeCooldown = 0;
  private meleeAttacks = 0;
  private meleeHits = 0;

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
      reloadStarted: false,
      meleeStarted: false,
      meleeHit: false,
      healStarted: false,
      healed: 0
    };

    const dt = Number.isFinite(deltaTimeMs)
      ? Math.max(0, Math.min(100, deltaTimeMs))
      : 0;

    if (dt === 0) return result;

    this.clockMs += dt;
    this.switchRemainingMs = Math.max(0, this.switchRemainingMs - dt);
    this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);

    this.damageGraceRemainingMs = Math.max(
      0,
      this.damageGraceRemainingMs - dt
    );

    if (!this.alive) {
      cancelHealing(this.vitals);
      this.meleeRemainingMs = 0;
      this.reloadRemainingMs = 0;
      return result;
    }
    if (this.switching) return result;

    const allowed = input.actionAllowed !== false;
    const interruptHeal = !allowed || input.moving || input.aiming ||
      input.shoot || input.reload || input.melee;

    if (interruptHeal) cancelHealing(this.vitals);

    if (input.bandage && !interruptHeal &&
        !this.meleeRemainingMs && !this.meleeCooldown && !this.reloadRemainingMs) {
      result.healStarted = beginHealing(this.vitals, this.health, this.clockMs);
    }

    // Reuse the authoritative shared heal timer with simulation time, not wall time.
    const heal = stepVitals(this.vitals, dt / 1000, this.clockMs,
      { moving: input.moving === true });
    if (heal > 0) {
      const before = this.health;
      this.health = Math.min(COMBAT.maxHealth, this.health + heal);
      result.healed = this.health - before;
    }
    if (this.vitals.healEndsAt || result.healed > 0) {
      this.reloadRemainingMs = 0;
      return result;
    }

    if (this.meleeRemainingMs > 0) {
      if (!allowed) {
        this.meleeRemainingMs = 0;
      } else {
        this.meleeRemainingMs = Math.max(0, this.meleeRemainingMs - dt);
        result.meleeHit = this.meleeRemainingMs === 0;
      }
      return result;
    }

    if (input.melee && allowed && this.meleeCooldown === 0 &&
        this.cooldown === 0 && this.reloadRemainingMs === 0) {
      this.meleeRemainingMs = COMBAT.meleeWindupMs;
      this.meleeCooldown = COMBAT.meleeCooldownMs;
      this.meleeAttacks++;
      result.meleeStarted = true;
      return result;
    }

    if (!input.enabled || !allowed || this.meleeCooldown > 0) {
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
          this.weaponSpec.magazine - this.ammo,
          this.reserve
        );

        this.ammo += rounds;
        this.reserve -= rounds;
      }

      return result;
    }

    if (input.reload) {
      if (
        this.ammo < this.weaponSpec.magazine &&
        this.reserve > 0 &&
        this.cooldown === 0
      ) {
        this.reloadRemainingMs = this.weaponId === 'pistol' ? this.reloadDurationMs : this.weaponSpec.reloadMs;
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
      this.cooldown = this.weaponId === 'pistol' ? this.fireIntervalMs : this.weaponSpec.intervalMs;
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

    cancelHealing(this.vitals);
    this.meleeRemainingMs = 0;
    this.reloadRemainingMs = 0;
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

  recordShotHits(kills: number): void {
    this.shotsHit++;
    this.kills += Math.max(0, Math.trunc(kills));
  }

  recordMeleeHit(killed: boolean): void {
    this.meleeHits++;
    if (killed) this.kills++;
  }

  interruptActions(): void {
    cancelHealing(this.vitals);
    this.meleeRemainingMs = 0;
    this.reloadRemainingMs = 0;
  }

  selectWeapon(id: WeaponId): boolean {
    if (!this.alive || this.switching || this.cooldown > 0 || this.reloadRemainingMs > 0 ||
        this.meleeCooldown > 0 || this.vitals.healEndsAt) return false;
    if (!this.equipment.switchTo(id)) return false;
    this.switchRemainingMs = SWITCH_MS;
    return true;
  }

  dropItem(kind: LootKind, amount: number, place: (kind: LootKind, amount: number, loadedRounds?: number) => boolean): boolean {
    if (!this.alive || this.switching || this.reloadRemainingMs > 0 || this.vitals.healEndsAt ||
        this.cooldown > 0 || this.meleeCooldown > 0 || !Number.isSafeInteger(amount) || amount <= 0) return false;
    if (kind === 'bandage') {
      const n = Math.min(amount,this.vitals.bandages);
      if (!n || !place(kind,n)) return false;
      this.vitals.bandages -= n; return true;
    }
    const old = this.weaponId;
    const dropped = this.equipment.drop(kind,amount,place);
    if (dropped && old !== this.weaponId) this.switchRemainingMs = SWITCH_MS;
    return dropped;
  }

  pickupCapacity(kind: LootKind): number {
    if (!this.alive) return 0;
    return kind === 'bandage' ? Math.max(0, SURVIVAL.bandages - this.vitals.bandages) : this.equipment.capacity(kind);
  }

  collectLoot(kind: LootKind, amount: number, loadedRounds?: number): number {
    if (!this.alive) return 0;
    return kind === 'bandage' ? this.addBandages(amount) : this.equipment.collect(kind,amount,loadedRounds);
  }

  addReserveAmmo(amount: number): number {
    return this.collectLoot(ammoKind(this.weaponId),amount);
  }

  addBandages(amount: number): number {
    if (!this.alive || !Number.isSafeInteger(amount) || amount <= 0) return 0;
    const accepted = Math.min(amount, this.pickupCapacity('bandage'));
    this.vitals.bandages += accepted;
    return accepted;
  }

  rewardWave(): void {
  if (!this.alive) return;

  this.health = Math.min(
    COMBAT.maxHealth,
    this.health + 20
  );

  this.equipment.rewardPistol();
}

  getState() {
    return {
      health: this.health,
      maxHealth: COMBAT.maxHealth,
      alive: this.alive,
      ammo: this.ammo,
      magazineCapacity: this.weaponSpec.magazine,
      reserve: this.reserve,
      reserveCapacity: this.weaponSpec.reserve,
      weapon: this.weaponId,
      weaponName: this.weaponSpec.label,
      switching: this.switching,
      switchRemainingMs: this.switchRemainingMs,
      equipment: this.equipment.getState(),
      reloading: this.reloadRemainingMs > 0,
      reloadRemainingMs: this.reloadRemainingMs,
      shotsFired: this.shotsFired,
      shotsHit: this.shotsHit,
      fireCooldownMs: this.cooldown,
      kills: this.kills,
      bandages: this.vitals.bandages,
      maxBandages: SURVIVAL.bandages,
      healing: this.vitals.healEndsAt > 0,
      healRemainingMs: Math.max(0, this.vitals.healEndsAt - this.clockMs),
      meleeAttacks: this.meleeAttacks,
      meleeHits: this.meleeHits,
      meleeRemainingMs: this.meleeRemainingMs,
      meleeCooldownMs: this.meleeCooldown
    };
  }
}

export type CombatState =
  ReturnType<CombatController['getState']>;
