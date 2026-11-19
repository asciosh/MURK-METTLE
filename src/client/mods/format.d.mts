import type { SpeciesId } from '../../../shared/expansion.mjs';
export interface ModManifest {
  formatVersion: 1;
  id: string;
  name: string;
  version: string;
  author: string;
  license: 'CC0-1.0' | 'CC-BY-4.0' | 'MIT' | 'Apache-2.0';
  attribution: string;
  rights: 'original' | 'licensed';
  compatibility: 'creature-cosmetics-v1';
  species: SpeciesId;
  form?: 1 | 2 | 3;
  model: string;
  textures?: string[];
  icon?: string;
  animations?: Partial<Record<'idle' | 'walk' | 'run' | 'pulse' | 'hit' | 'attack' | 'cast' | 'charge' | 'heal', string>>;
  effects?: { type: 'pulse-glow'; strength: number }[];
}
export interface ValidatedMod {
  manifest: ModManifest;
  files: Map<string, Uint8Array<ArrayBuffer>>;
  stats: { triangles: number; radius: number; pixels: number };
}
export const LIMITS: Readonly<{
  archive: number;
  extracted: number;
  files: number;
  model: number;
  image: number;
  dimension: number;
  pixels: number;
  triangles: number;
  vertices: number;
  nodes: number;
  primitives: number;
  materials: number;
  clips: number;
  keys: number;
  storedMods: number;
}>;
export const LICENSES: readonly string[];
export const STATES: readonly string[];
export function validateManifest(raw: unknown): ModManifest;
export function sameCosmeticSlot(a: ModManifest, b: ModManifest): boolean;
export function resolveCosmeticId(records: Iterable<{id: string; enabled: boolean; manifest: ModManifest}>, species: SpeciesId, formXP?: number): string | undefined;
