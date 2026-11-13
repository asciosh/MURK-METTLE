/** Versioned single-player progression; server authority will replace local saves in multiplayer. */
export interface ProgressState {
  version: 1;
  playerXp: number;
  lanternkinXp: number;
  lanternkinBonded: boolean;
  totalKills: number;
}

export const PLAYER_XP_PER_KILL = 50;
export const CREATURE_XP_PER_PULSE_KILL = 40;
export const CREATURE_XP_PER_PULSE_HIT = 10;
export const BOND_PLAYER_XP = 25;
const KEY = 'murk-mettle-v04-progression';
const LEGACY_KEY = 'murk-mettle-v03-creatures';

export function levelFromXp(xp: number): number {
  // Total required XP for level L = 100 * (L - 1)^2.
  return Math.min(50, 1 + Math.floor(Math.sqrt(Math.max(0, xp) / 100)));
}
export function xpInLevel(xp: number): { current: number; required: number; ratio: number } {
  const level = levelFromXp(xp);
  if (level >= 50) return { current: 0, required: 0, ratio: 1 };
  const start = 100 * (level - 1) ** 2;
  const required = 100 * (level * level - (level - 1) ** 2);
  const current = Math.max(0, xp - start);
  return { current, required, ratio: Math.min(1, current / required) };
}
function safeXp(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(250000, Math.floor(value))) : 0;
}
export class Progression {
  readonly state: ProgressState;
  constructor() {
    let saved: unknown;
    let legacyBonded = false;
    try {
      saved = JSON.parse(localStorage.getItem(KEY) || 'null') as unknown;
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null') as { lanternkin?: unknown } | null;
      legacyBonded = legacy?.lanternkin === true;
    } catch { /* Storage unavailable or corrupted; start clean. */ }
    const raw = saved && typeof saved === 'object' ? saved as Partial<ProgressState> : {};
    this.state = {
      version: 1,
      playerXp: safeXp(raw.playerXp),
      lanternkinXp: safeXp(raw.lanternkinXp),
      lanternkinBonded: raw.lanternkinBonded === true || legacyBonded,
      totalKills: safeXp(raw.totalKills),
    };
  }
  grantPlayerXp(amount: number): boolean {
    const previous = levelFromXp(this.state.playerXp);
    this.state.playerXp = safeXp(this.state.playerXp + amount);
    this.save();
    return levelFromXp(this.state.playerXp) > previous;
  }
  grantCreatureXp(amount: number): boolean {
    if (!this.state.lanternkinBonded) return false;
    const previous = levelFromXp(this.state.lanternkinXp);
    this.state.lanternkinXp = safeXp(this.state.lanternkinXp + amount);
    this.save();
    return levelFromXp(this.state.lanternkinXp) > previous;
  }
  bondLanternkin(): void {
    if (this.state.lanternkinBonded) return;
    this.state.lanternkinBonded = true;
    this.grantPlayerXp(BOND_PLAYER_XP);
    this.save();
  }
  recordKill(): boolean {
    this.state.totalKills += 1;
    return this.grantPlayerXp(PLAYER_XP_PER_KILL);
  }
  private save(): void {
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); }
    catch { /* Private browsing or disabled storage; game remains playable. */ }
  }
}
