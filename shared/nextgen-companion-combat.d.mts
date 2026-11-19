export type CompanionMode = 'follow' | 'defend' | 'aggressive';
export const COMPANION_MODES: readonly CompanionMode[];
export interface NativeCompanionSnapshot {
  mode: CompanionMode; hp:number; maxHp:number; x:number; z:number; yaw:number; targetId:string|null;
}
import type { CreatureInstance } from './nextgen-creature-roster.mjs';
export function nativeCompanionStats(record: CreatureInstance): { maxHp: number; damage: number; stage: number };
