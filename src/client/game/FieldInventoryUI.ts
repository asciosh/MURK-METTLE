import { Inventory, ITEM_DEFINITIONS, type ItemId } from './Inventory';
import { Crafting, RECIPES, type RecipeId } from './Crafting';

/** The solo backpack UI. Account-owned co-op crafting remains in CoopProgress. */
export class FieldInventoryUI {
  private readonly panel = document.querySelector<HTMLElement>('#inventory-panel');
  private readonly grid = document.querySelector<HTMLElement>('#inventory-grid');
  private readonly recipes = document.querySelector<HTMLElement>('#crafting-list');
  private readonly toggleButton = document.querySelector<HTMLButtonElement>('#inventory-button');
  private open = false;

  constructor(
    private readonly inventory: Inventory,
    private readonly crafting: Crafting,
    private readonly inRoom: () => boolean,
    private readonly onRestorative: () => void,
    private readonly announce: (message: string) => void,
  ) { this.toggleButton?.addEventListener('click', this.handleToggle); }

  private readonly handleToggle = (): void => { this.toggle(); };

  toggle(): void {
    this.open = !this.open;
    this.panel?.classList.toggle('visible', this.open);
    this.toggleButton?.setAttribute('aria-expanded', String(this.open));
    this.renderInventory();
  }

  renderInventory(): void {
    if (!this.grid) return;
    this.grid.replaceChildren();
    for (const [id, def] of Object.entries(ITEM_DEFINITIONS) as [ItemId, typeof ITEM_DEFINITIONS[ItemId]][]) {
      const row = document.createElement('div');
      row.className = 'inventory-item';
      const title = document.createElement('span');
      title.textContent = def.name;
      title.title = def.description;
      const count = document.createElement('strong');
      count.textContent = `${this.inventory.state[id]} / 20`;
      row.append(title, count);
      this.grid.append(row);
    }
  }

  renderCrafting(): void {
    if (!this.recipes) return;
    this.recipes.replaceChildren();
    for (const [id, recipe] of Object.entries(RECIPES) as [RecipeId, typeof RECIPES[RecipeId]][]) {
      const button = document.createElement('button');
      button.className = 'craft-button';
      const completed = id !== 'restorative' && this.crafting.upgrades[id];
      const cost = Object.entries(recipe.cost).map(([item, count]) => `${count} ${item}`).join(' + ');
      button.textContent = `${recipe.name} · ${recipe.description} · ${completed ? 'CRAFTED' : cost}`;
      button.disabled = this.inRoom() || !this.crafting.canCraft(id);
      if (this.inRoom()) button.title = 'Use the verified co-op crafting buttons in FIELD MENU.';
      button.addEventListener('click', () => {
        if (!this.crafting.craft(id)) return;
        if (id === 'restorative') this.onRestorative();
        this.renderInventory();
        this.renderCrafting();
        this.announce(`CRAFTED  //  ${recipe.name}`);
      });
      this.recipes.append(button);
    }
  }

  dispose(): void { this.toggleButton?.removeEventListener('click', this.handleToggle); }
}
