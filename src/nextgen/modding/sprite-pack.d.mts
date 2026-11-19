export type SpriteState = 'idle' | 'walk' | 'attack' | 'pulse' | 'hit' | 'faint';
export interface SpriteTrack { start: number; count: number; fps: number; }
export interface SpriteEntry { key: string; sprite: string; columns: number; rows: number; height: number;
  animations: Partial<Record<SpriteState, SpriteTrack>> & { idle: SpriteTrack }; }
export interface SpriteManifest { formatVersion: 2; compatibility: 'nextgen-sprite-pack-v2'; id: string; name: string; version: string;
  author: string; license: string; rights: 'original' | 'licensed'; attribution: string; entries: SpriteEntry[]; }
export interface ValidatedSpritePack { manifest: SpriteManifest; files: Map<string, Uint8Array<ArrayBuffer>>;
  dimensions: Map<string, { width: number; height: number }>; pixels: number; }
export const SPRITE_PACK_LIMITS: Readonly<{ archive: number; extracted: number; files: number; model: number; entries: number; pixels: number }>;
export function validateSpriteManifest(raw: unknown): SpriteManifest;
export function validateSpritePack(buffer: ArrayBuffer): Promise<ValidatedSpritePack>;
export function spriteAppearanceKey(species: string, xp: number): string;
export function resolveSpriteEntry(manifest: SpriteManifest, species: string, xp?: number): SpriteEntry | undefined;
export function spriteFrame(entry: SpriteEntry, state: SpriteState, seconds: number, loop?: boolean): { column: number; row: number };
