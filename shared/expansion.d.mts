export type SpeciesId = 'lanternkin' | 'emberling' | 'reedwisp' | 'mossback' | 'stormrook';
export type WeaponId = 'pistol' | 'rifle';
export type Arsenal = Record<WeaponId, { magazine: number; reserve: number; readyAt: number; reloadAt: number }>;
export interface CreatureDefinition {
  name: string;
  forms: string[];
  color: number;
  glow: number;
  x: number;
  z: number;
  damage: number;
  range: number;
  cooldown: number;
  habitat: string;
}
export const CREATURES: Record<SpeciesId, CreatureDefinition>;
export const SPECIES_IDS: readonly SpeciesId[];
export const WORLD_BOUNDARY: number;
export const WEAPONS: Record<
  WeaponId,
  {
    name: string;
    capacity: number;
    reserve: number;
    damage: number;
    interval: number;
    reload: number;
    range: number;
    automatic: boolean;
  }
>;
export const SUPPLIES: readonly { id: string; x: number; z: number }[];
export const BUILDINGS: readonly { x: number; z: number; w: number; d: number; h: number }[];
export const TREES: readonly { x: number; z: number; size: number }[];
export const OBSTACLES: readonly { x: number; z: number; w: number; d: number; h: number }[];
export function evolutionStage(xp: number): number;
export function creaturePower(
  species: SpeciesId,
  xp?: number,
): { damage: number; range: number; cooldown: number; stage: number; name: string };
export function newArsenal(): Arsenal;
export function settleReload(arsenal: Arsenal, id: WeaponId, now: number): void;
export function reloadWeapon(arsenal: Arsenal, id: WeaponId, now: number): boolean;
export function fireWeapon(arsenal: Arsenal, id: WeaponId, now: number): boolean;
export function constrainPosition<T extends { x: number; z: number }>(pos: T, radius?: number): T;
export function obstacleDistance(
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  maxDistance: number,
): number;
export function shotDistance(
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  target: { x: number; z: number },
  maxDistance: number,
): number | null;
