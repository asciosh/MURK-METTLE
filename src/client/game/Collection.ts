import { CREATURES, evolutionStage, type SpeciesId } from '../../../shared/expansion.mjs';
import { progressStore } from './ProgressStore';

import { emptyCollection, normalizeCollection, type CollectionState } from '../../../shared/collection.mjs';
export { emptyCollection, type CollectionState };
const KEY = 'murk-mettle-v21-collection';
export class Collection {
  state = emptyCollection();
  constructor(legacy: { lanternkinBonded: boolean; lanternkinXp: number }) {
    const migrated = { owned: legacy.lanternkinBonded, xp: legacy.lanternkinXp };
    this.state = normalizeCollection(null, migrated);
    try {
      this.state = normalizeCollection(JSON.parse(progressStore.getItem(KEY) || 'null'), migrated);
    } catch {
      /* Invalid local data falls back to legacy progress. */
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
