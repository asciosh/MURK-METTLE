/** Ephemeral game-state cache. Persistent progression lives in the signed-in Cloudflare account. */
export const PROGRESS_KEYS = [
  'murk-mettle-v04-progression',
  'murk-mettle-v05-inventory',
  'murk-mettle-v06-crafting',
  'murk-mettle-v07-expeditions',
  'murk-mettle-v05-bond-retreat',
] as const;
export type ProgressSave = Record<(typeof PROGRESS_KEYS)[number], string | null>;
const memory = new Map<string, string>();
let dirty = false;
let generation = 0;
export const progressStore = {
  getItem(key: string): string | null { return memory.get(key) ?? null; },
  setItem(key: string, value: string): void { memory.set(key, value); dirty = true; generation++; },
  removeItem(key: string): void { memory.delete(key); dirty = true; generation++; },
};
export function loadCloudProgress(data: Partial<ProgressSave> | null): void {
  memory.clear();
  for (const key of PROGRESS_KEYS) {
    const value = data?.[key];
    if (typeof value === 'string' && value.length < 2048) memory.set(key, value);
  }
  dirty = false;
}
export function snapshotProgress(): ProgressSave {
  return Object.fromEntries(PROGRESS_KEYS.map(k => [k, memory.get(k) ?? null])) as ProgressSave;
}
export function progressGeneration(): number { return generation; }
export function progressIsDirty(): boolean { return dirty; }
export function markProgressSaved(savedGeneration: number): void { if (generation === savedGeneration) dirty = false; }
