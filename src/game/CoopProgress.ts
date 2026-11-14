import type { RecipeId } from './Crafting';

type Materials = { scrap: number; fiber: number; spore: number };
type Upgrades = { sharpened: boolean; balanced: boolean };
export interface TrustedCoopState {
  stats: { xp: number; kills: number; creatureXp: number };
  inventory: Materials;
  upgrades: Upgrades;
}
const costs: Record<RecipeId, Partial<Materials>> = {
  sharpened: { scrap: 3, fiber: 1 },
  balanced: { scrap: 2, fiber: 2 },
  restorative: { spore: 2, fiber: 1 },
};
const initial = (): TrustedCoopState => ({ stats: { xp: 0, kills: 0, creatureXp: 0 },
  inventory: { scrap: 0, fiber: 0, spore: 0 }, upgrades: { sharpened: false, balanced: false } });
export class CoopProgress {
  private state = initial();
  private ready = false;
  private busy = false;
  private readonly label = document.getElementById('coop-account-state');
  private readonly buttons: Record<RecipeId, HTMLButtonElement | null> = {
    sharpened: document.querySelector('#coop-craft-sharpened'),
    balanced: document.querySelector('#coop-craft-balanced'),
    restorative: document.querySelector('#coop-craft-restorative'),
  };
  constructor(private readonly onCraft: (recipe: RecipeId) => void) {
    for (const recipe of Object.keys(this.buttons) as RecipeId[]) {
      this.buttons[recipe]?.addEventListener('click', () => { void this.craft(recipe); });
    }
    this.render();
  }
  async refresh(): Promise<void> {
    try {
      const response = await fetch('/api/account/coop-state', { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error(`Account unavailable (HTTP ${response.status})`);
      this.state = await response.json() as TrustedCoopState;
      this.ready = true;
      this.render();
    } catch { this.ready = false; this.render('Unable to load verified co-op account progress.'); }
  }
  private async craft(recipe: RecipeId): Promise<void> {
    if (this.busy || !this.ready) return;
    this.busy = true; this.render('Crafting with verified materials…');
    try {
      const response = await fetch('/api/account/coop-craft', { method: 'POST',
        credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe }) });
      const body = await response.json() as TrustedCoopState & { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Craft failed');
      this.state = body;
      this.onCraft(recipe);
      this.render('Co-op item crafted successfully.');
    } catch (error) { this.render(error instanceof Error ? error.message : 'Craft failed'); }
    finally { this.busy = false; this.render(); }
  }
  private render(message?: string): void {
    if (this.label) this.label.textContent = message ?? (this.ready
      ? `${this.state.stats.kills} verified kills · ${this.state.stats.xp} XP · Lanternkin ${this.state.stats.creatureXp} XP | Scrap ${this.state.inventory.scrap} · Fiber ${this.state.inventory.fiber} · Spore ${this.state.inventory.spore}`
      : 'Verified co-op progression unavailable until account login.');
    for (const recipe of Object.keys(this.buttons) as RecipeId[]) {
      const button = this.buttons[recipe]; if (!button) continue;
      const cost = costs[recipe];
      button.disabled = !this.ready || this.busy || (recipe !== 'restorative' && this.state.upgrades[recipe]) ||
        Object.entries(cost).some(([id, count]) => this.state.inventory[id as keyof Materials] < count);
      button.title = Object.entries(cost).map(([id, count]) => `${count} ${id}`).join(', ');
      button.textContent = recipe !== 'restorative' && this.state.upgrades[recipe]
        ? `${recipe.toUpperCase()} ✓` : `CO-OP ${recipe.toUpperCase()}`;
    }
  }
}
