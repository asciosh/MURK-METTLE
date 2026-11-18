export type EvolutionRule = { kind: 'xp' | 'level' | 'friendship'; value: number }
  | { kind: 'item' | 'time'; value: string }
  | { kind: 'trade'; value: true };
export interface EvolutionFamilyInput { id: string; name: string; archive?: boolean;
  forms: { id: string; name: string }[];
  evolutions: { from: string; to: string; all: EvolutionRule[] }[]; }
export interface EvolutionForm { id: string; name: string; familyId: string; }
export interface EvolutionFamily { id: string; name: string; archive: boolean;
  forms: readonly EvolutionForm[];
  evolutions: readonly { from: string; to: string; all: readonly EvolutionRule[] }[]; }
export interface EvolutionCatalog { families: Readonly<Record<string, EvolutionFamily>>;
  forms: Readonly<Record<string, EvolutionForm>>; familyIds: readonly string[]; }
export interface EvolutionContext { xp?: number; friendship?: number; items?: Record<string, number>;
  trustedTrade?: boolean; timeOfDay?: 'day' | 'night'; }
export interface EvolutionChoice { from: string; to: string; targetName: string; ready: boolean;
  missing: readonly string[]; consumes: readonly { itemId: string; count: number }[]; }
export function createEvolutionCatalog(entries: EvolutionFamilyInput[]): EvolutionCatalog;
export function levelFromXP(xp: number): number;
export function availableEvolutions(catalog: EvolutionCatalog, familyId: string, formId: string,
  context?: EvolutionContext): EvolutionChoice[];
export function planEvolution(catalog: EvolutionCatalog, familyId: string, formId: string, targetId: string,
  context: EvolutionContext): { ok: false; reason: string } | { ok: true; familyId: string; from: string; to: string; consumes: EvolutionChoice['consumes'] };
export function legacyEvolutionPreview(rawCollection: unknown): readonly { species: string; owned: boolean; xp: number; formId: string }[];
export const EVOLUTION_DEMO_CATALOG: EvolutionCatalog;
