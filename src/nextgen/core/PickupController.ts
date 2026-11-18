import type { LootKind } from './LootField.ts';

export const PICKUP = Object.freeze({
  durationMs: 1350,
  contactMs: 450,
  stowMs: 1100,
  reach: 0.95
});

// One target, one contact event. No inventory authority is held here.
// The session must re-check the target and capacity at contact.
export class PickupController {
  private targetId: number | null = null;
  private kind: LootKind | null = null;
  private elapsedMs = 0;
  private contactReached = false;
  private collected = false;

  get active(): boolean { return this.targetId !== null; }
  get heldKind(): LootKind | null {
    return this.active && this.collected && this.elapsedMs < PICKUP.stowMs ? this.kind : null;
  }

  begin(id: number, kind: LootKind): boolean {
    if (this.active || !Number.isSafeInteger(id) || id < 1 ||
        (kind !== 'ammo' && kind !== 'bandage')) return false;
    this.targetId = id;
    this.kind = kind;
    this.elapsedMs = 0;
    this.contactReached = this.collected = false;
    return true;
  }

  advance(deltaTimeMs: number): number | null {
    if (!this.active || !Number.isFinite(deltaTimeMs) || deltaTimeMs <= 0) return null;
    this.elapsedMs += Math.min(100, deltaTimeMs);
    if (!this.contactReached && this.elapsedMs >= PICKUP.contactMs) {
      this.contactReached = true;
      return this.targetId;
    }
    if (this.elapsedMs >= PICKUP.durationMs) this.cancel();
    return null;
  }

  markCollected(): boolean {
    if (!this.active || !this.contactReached || this.collected) return false;
    this.collected = true;
    return true;
  }

  getState() {
    return { active: this.active, targetId: this.targetId, kind: this.kind,
      elapsedMs: this.elapsedMs, contactReached: this.contactReached,
      collected: this.collected, heldKind: this.heldKind };
  }

  cancel(): void {
    this.targetId = null;
    this.kind = null;
    this.elapsedMs = 0;
    this.contactReached = this.collected = false;
  }
}
