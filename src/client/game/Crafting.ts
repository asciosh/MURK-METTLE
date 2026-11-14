import { progressStore } from './ProgressStore';
import { Inventory, type ItemId } from './Inventory';
export type RecipeId = 'sharpened' | 'balanced' | 'restorative';
export const RECIPES: Record<RecipeId, { name: string; description: string; cost: Partial<Record<ItemId, number>> }> = {
  sharpened: { name: 'Sharpened Blade', description: 'Melee damage +15', cost: { scrap: 3, fiber: 1 } },
  balanced: { name: 'Balanced Grip', description: 'Melee reach +0.7m', cost: { scrap: 2, fiber: 2 } },
  restorative: { name: 'Bloom Antidote', description: 'Relieve 60 companion strain; recover a retreating companion by bonding again', cost: { spore: 2, fiber: 1 } },
};
const KEY = 'murk-mettle-v06-crafting';
export class Crafting {
  readonly upgrades: Record<'sharpened' | 'balanced', boolean> = { sharpened: false, balanced: false };
  constructor(private readonly inventory: Inventory) {
    try {
      const saved = JSON.parse(progressStore.getItem(KEY) || 'null') as Partial<typeof this.upgrades> | null;
      if (saved) { this.upgrades.sharpened = saved.sharpened === true; this.upgrades.balanced = saved.balanced === true; }
    } catch { /* corrupted saves should not break play */ }
  }
  craft(id: RecipeId): boolean {
    if (id !== 'restorative' && this.upgrades[id]) return false;
    const cost = RECIPES[id].cost;
    if (!this.inventory.consume(cost)) return false;
    if (id !== 'restorative') {
      this.upgrades[id] = true;
      try { progressStore.setItem(KEY, JSON.stringify(this.upgrades)); } catch { /* no storage */ }
    }
    return true;
  }
  canCraft(id: RecipeId): boolean {
    return (id === 'restorative' || !this.upgrades[id]) && this.inventory.has(RECIPES[id].cost);
  }
}
