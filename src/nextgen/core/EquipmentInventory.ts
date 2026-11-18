// NEXTGEN local expedition equipment; does not change shared/server contracts.
export const WEAPONS = Object.freeze({
  pistol:  { label: 'Pistol',        magazine: 12, reserve: 72, damage: 34, range: 35, intervalMs: 350, reloadMs: 1600, automatic: false },
  rifle:   { label: 'Assault rifle', magazine: 24, reserve: 96, damage: 24, range: 50, intervalMs: 140, reloadMs: 2100, automatic: true },
  shotgun: { label: 'Shotgun',       magazine:  5, reserve: 30, damage: 72, range: 18, intervalMs: 850, reloadMs: 2400, automatic: false }
});
export type WeaponId = keyof typeof WEAPONS;
export type PrimaryWeapon = Exclude<WeaponId, 'pistol'>;
export type LootKind = 'ammo' | 'bandage' | 'rifle-ammo' | 'shotgun-ammo' | PrimaryWeapon;
export const LOOT_KINDS: readonly LootKind[] = ['ammo','rifle-ammo','shotgun-ammo','bandage','rifle','shotgun'];
export const SWITCH_MS = 420;
export const ammoKind = (id: WeaponId): LootKind => id === 'pistol' ? 'ammo' : id === 'rifle' ? 'rifle-ammo' : 'shotgun-ammo';
export const ammoWeapon = (kind: LootKind): WeaponId | null => kind === 'ammo' ? 'pistol' : kind === 'rifle-ammo' ? 'rifle' : kind === 'shotgun-ammo' ? 'shotgun' : null;
export function lootLabel(kind: LootKind, amount = 1): string {
  switch(kind) {
    case 'ammo': return 'AMMO';
    case 'rifle-ammo': return 'RIFLE ROUNDS';
    case 'shotgun-ammo': return 'SHELLS';
    case 'bandage': return amount === 1 ? 'BANDAGE' : 'BANDAGES';
    case 'rifle': return 'ASSAULT RIFLE';
    case 'shotgun': return 'SHOTGUN';
  }
}
export function fullLootNotice(kind: LootKind): string {
  if (kind === 'ammo') return 'AMMO RESERVE FULL';
  if (kind === 'bandage') return 'BANDAGES FULL';
  if (kind === 'rifle' || kind === 'shotgun') return 'PRIMARY SLOT FULL — DROP WEAPON FIRST';
  return lootLabel(kind) + ' FULL';
}
export interface WeaponStack { loaded: number; reserve: number; }
export const INVENTORY_ROWS = ['primary','ammo','rifle-ammo','shotgun-ammo','bandage'] as const;
export function inventoryDropKind(index: number, primary: PrimaryWeapon | null): LootKind | null {
  const row = INVENTORY_ROWS[index];
  return row === 'primary' ? primary : row ?? null;
}
export class EquipmentInventory {
  private primary: PrimaryWeapon | null = null;
  private equipped: WeaponId = 'pistol';
  private readonly stacks: Record<WeaponId, WeaponStack> = {
    pistol:{loaded:12,reserve:48}, rifle:{loaded:0,reserve:0}, shotgun:{loaded:0,reserve:0}
  };
  get active(): WeaponId { return this.equipped; }
  get primaryWeapon(): PrimaryWeapon | null { return this.primary; }
  get current(): WeaponStack { return this.stacks[this.equipped]; }
  switchTo(id: WeaponId): boolean {
    if (id === this.equipped || (id !== 'pistol' && id !== this.primary)) return false;
    this.equipped = id; return true;
  }
  capacity(kind: LootKind): number {
    const id = ammoWeapon(kind);
    if (id) return WEAPONS[id].reserve - this.stacks[id].reserve;
    if (kind === 'rifle' || kind === 'shotgun') return this.primary === null ? 1 : 0;
    return 0;
  }
  collect(kind: LootKind, amount: number, loadedRounds?: number): number {
    if (!Number.isSafeInteger(amount) || amount <= 0) return 0;
    const count = Math.min(amount,this.capacity(kind));
    if (count <= 0) return 0;
    const id = ammoWeapon(kind);
    if (id) { this.stacks[id].reserve += count; return count; }
    if (kind === 'rifle' || kind === 'shotgun') {
      const loaded = loadedRounds ?? WEAPONS[kind].magazine;
      if (amount !== 1 || !Number.isSafeInteger(loaded) || loaded < 0 || loaded > WEAPONS[kind].magazine) return 0;
      this.primary = kind; this.stacks[kind].loaded = loaded; return 1;
    }
    return 0;
  }
  // Place the drop first. A full loot field must never destroy inventory.
  drop(kind: LootKind, amount: number, place: (kind: LootKind, amount: number, loadedRounds?: number) => boolean): boolean {
    if (!Number.isSafeInteger(amount) || amount <= 0) return false;
    const id = ammoWeapon(kind);
    if (id) {
      const count = Math.min(amount,this.stacks[id].reserve);
      if (!count || !place(kind,count)) return false;
      this.stacks[id].reserve -= count; return true;
    }
    if ((kind === 'rifle' || kind === 'shotgun') && this.primary === kind) {
      if (!place(kind,1,this.stacks[kind].loaded)) return false;
      this.stacks[kind].loaded = 0; this.primary = null;
      if (this.equipped === kind) this.equipped = 'pistol';
      return true;
    }
    return false;
  }
  rewardPistol(): void { this.stacks.pistol.reserve = Math.max(this.stacks.pistol.reserve, Math.min(48,this.stacks.pistol.reserve+24)); }
  getState() {
    return { active: this.equipped, primary: this.primary, secondary: 'pistol' as const,
      pistol: {...this.stacks.pistol}, rifle: {...this.stacks.rifle}, shotgun: {...this.stacks.shotgun} };
  }
}
