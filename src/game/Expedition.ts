/** Solo-only expedition objectives; co-op authority comes in a later milestone. */
const SAVE_KEY = 'murk-mettle-v07-expeditions';
export const KILLS_REQUIRED = 3;
export const SALVAGE_REQUIRED = 2;
export const EXTRACTION_X = 0;
export const EXTRACTION_Z = -18;
export const EXTRACTION_RADIUS = 3.3;
export class Expedition {
  kills = 0;
  salvage = 0;
  completed = 0;
  constructor() {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (typeof saved === 'number' && Number.isSafeInteger(saved) && saved >= 0) this.completed = Math.min(99999, saved);
    } catch { /* Storage disabled or corrupted. */ }
  }
  get ready(): boolean { return this.kills >= KILLS_REQUIRED && this.salvage >= SALVAGE_REQUIRED; }
  recordKill(): void { this.kills = Math.min(KILLS_REQUIRED, this.kills + 1); }
  recordSalvage(): void { this.salvage = Math.min(SALVAGE_REQUIRED, this.salvage + 1); }
  extract(): boolean {
    if (!this.ready) return false;
    this.completed++;
    this.kills = 0;
    this.salvage = 0;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.completed)); } catch { /* Storage disabled. */ }
    return true;
  }
  resetMission(): void { this.kills = 0; this.salvage = 0; }
}
