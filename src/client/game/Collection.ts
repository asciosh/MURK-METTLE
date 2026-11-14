import { CREATURES, SPECIES_IDS, evolutionStage, type SpeciesId } from '../../../shared/expansion.mjs';
import { progressStore } from './ProgressStore';

export interface CollectionState {
  active: SpeciesId;
  creatures: Record<SpeciesId, { owned: boolean; xp: number }>;
}
export const emptyCollection = (): CollectionState => ({
  active: 'lanternkin',
  creatures: {
    lanternkin: { owned: false, xp: 0 },
    emberling: { owned: false, xp: 0 },
    reedwisp: { owned: false, xp: 0 },
  },
});
const KEY = 'murk-mettle-v21-collection';
export class Collection {
  state = emptyCollection();
  constructor(legacy: { lanternkinBonded: boolean; lanternkinXp: number }) {
    this.state.creatures.lanternkin = { owned: legacy.lanternkinBonded, xp: legacy.lanternkinXp };
    try {
      const raw = JSON.parse(progressStore.getItem(KEY) || 'null') as CollectionState | null;
      if (raw) {
        for (const id of SPECIES_IDS) {
          const entry = raw.creatures?.[id];
          if (entry)
            this.state.creatures[id] = {
              owned: entry.owned === true,
              xp: Number.isFinite(entry.xp) ? Math.max(0, Math.min(250000, Math.floor(entry.xp))) : 0,
            };
        }
        if (SPECIES_IDS.includes(raw.active) && this.state.creatures[raw.active].owned) this.state.active = raw.active;
      }
    } catch {
      /* Existing saves migrate from Lanternkin progression. */
    }
  }
  bond(id: SpeciesId): void {
    this.state.creatures[id].owned = true;
    this.state.active = id;
    this.save();
  }
  select(id: SpeciesId): boolean {
    if (!this.state.creatures[id].owned) return false;
    this.state.active = id;
    this.save();
    return true;
  }
  grant(xp: number): string | null {
    const entry = this.state.creatures[this.state.active];
    if (!entry.owned) return null;
    const before = evolutionStage(entry.xp);
    entry.xp = Math.min(250000, entry.xp + xp);
    this.save();
    const stage = evolutionStage(entry.xp);
    return stage > before ? CREATURES[this.state.active].forms[stage] : null;
  }
  private save(): void {
    progressStore.setItem(KEY, JSON.stringify(this.state));
  }
}
