import type { WeaponId } from './expansion.mjs';
export type NextgenWeapon = WeaponId | 'shotgun';
export interface NextgenPlayerState {
  weapon: NextgenWeapon;
  shotgun: { magazine: number; reserve: number; reloadAt: number; readyAt: number };
  charge: number; resonant: boolean; transitioning: boolean; downedMs: number;
  revivingTarget: string | null; reviveProgress: number; reviveBy: string | null;
  dodging?: boolean; airborne?: boolean; jumpHeight?: number;
}
export const NEXTGEN_SHOTGUN: Readonly<{ name: string; capacity: number; reserve: number; damage: number; range: number; interval: number; reload: number; automatic: boolean }>;
export const NEXTGEN_WEAPONS: Readonly<Record<NextgenWeapon, typeof NEXTGEN_SHOTGUN>>;
export const RESONANCE_RULES: Readonly<{ capacity: number; minimum: number; rechargePerSecond: number; rechargeDelay: number; transition: number; costs: Readonly<Record<NextgenWeapon, number>> }>;
export const REVIVE_RULES: Readonly<{ downedMs: number; duration: number; range: number; health: number; grace: number }>;
export const COMPANION_STRIKE: Readonly<{ range: number; damage: number; interval: number }>;
export function isNextgenWeapon(id: unknown): id is NextgenWeapon;
export function reviveInRange(from: {x:number;z:number}, to: {x:number;z:number},map?:typeof import('./nextgen-terrain.mjs').NEXTGEN_MAP): boolean;
