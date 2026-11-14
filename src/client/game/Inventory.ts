import { progressStore } from './ProgressStore';
/** Local single-player inventory; multiplayer will validate pickups on the server. */
export const ITEM_DEFINITIONS = {
  spore: { name: 'Spore Sample', color: 0x95da92, description: 'A sealed trace of the Bloom.' },
  scrap: { name: 'Salvaged Parts', color: 0xe6b979, description: 'Useful parts from old field equipment.' },
  fiber: { name: 'Root Fiber', color: 0x86bad0, description: 'Tough botanical crafting material.' },
} as const;
export type ItemId = keyof typeof ITEM_DEFINITIONS;
export type InventoryState = Record<ItemId, number>;
const STORAGE_KEY = 'murk-mettle-v05-inventory';
const SLOT_CAP = 20;
const ids = Object.keys(ITEM_DEFINITIONS) as ItemId[];
const fresh = (): InventoryState => ({ spore: 0, scrap: 0, fiber: 0 });
export class Inventory {
  readonly state: InventoryState = fresh();
  constructor() {
    try {
      const raw: unknown = JSON.parse(progressStore.getItem(STORAGE_KEY) || 'null');
      if (raw && typeof raw === 'object') {
        for (const id of ids) {
          const count = (raw as Record<string, unknown>)[id];
          if (typeof count === 'number' && Number.isFinite(count)) this.state[id] = Math.min(SLOT_CAP, Math.max(0, Math.floor(count)));
        }
      }
    } catch { /* Invalid save or disabled storage: continue without persistent inventory. */ }
  }
  canAdd(id: ItemId): boolean { return this.state[id] < SLOT_CAP; }
  add(id: ItemId): boolean {
    if (!this.canAdd(id)) return false;
    this.state[id]++;
    this.save();
    return true;
  }
  has(cost: Partial<Record<ItemId, number>>): boolean {
    return (Object.entries(cost) as [ItemId, number][]).every(([id, count]) => Number.isInteger(count) && count >= 0 && this.state[id] >= count);
  }
  consume(cost: Partial<Record<ItemId, number>>): boolean {
    if (!this.has(cost)) return false;
    for (const [id, count] of Object.entries(cost) as [ItemId, number][]) this.state[id] -= count;
    this.save();
    return true;
  }
  private save(): void {
    try { progressStore.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch { /* Storage unavailable. */ }
  }
}
