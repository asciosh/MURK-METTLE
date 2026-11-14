import type { SpeciesId } from './expansion.mjs';
export interface CollectionState {
  active: SpeciesId;
  creatures: Record<SpeciesId, { owned: boolean; xp: number }>;
}
export function emptyCollection(): CollectionState;
export function normalizeCollection(raw: unknown, legacy?: { owned?: boolean; xp?: number }): CollectionState;
export function evolutionProgress(xp: number): {
  stage: number;
  next: number | null;
  remaining: number;
  fraction: number;
};
export function journalEntry(
  id: SpeciesId,
  xp: number,
): ReturnType<typeof evolutionProgress> & {
  power: { damage: number; range: number; cooldown: number; stage: number; name: string };
  forms: { name: string; threshold: number; unlocked: boolean }[];
};
