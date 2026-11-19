import type * as THREE from 'three/webgpu';
import type { SpeciesId } from '../../../shared/expansion.mjs';
import { ModRegistry } from '../../client/mods/ModRegistry';
import type { ModVisual } from '../../client/mods/ModVisual';
import { nextgenSpriteRegistry } from './SpritePackRegistry';
import { SpriteCompanionVisual } from './SpriteCompanionVisual';

// Reuse the legacy game's bounded, browser-only validator and IndexedDB store.
// Nothing here can update trusted room species, combat, rewards or account saves.
let deviceRegistry: ModRegistry | null = null;
export function nextgenModRegistry(): ModRegistry {
  return deviceRegistry ??= new ModRegistry();
}

/** A purely cosmetic local override, driven by an existing authoritative creature. */
export class NextgenModBridge {
  private visual: ModVisual | SpriteCompanionVisual | null = null;
  private selection: string | undefined;
  private xp = 0;
  private generation = 0;
  private disposed = false;
  private readonly unsubscribe: () => void;

  constructor(private readonly scene: THREE.Scene, private species: SpeciesId) {
    const registry = nextgenModRegistry(), sprites = nextgenSpriteRegistry();
    const offGLB = registry.subscribe(() => { void this.refresh(); });
    const offSprites = sprites.subscribe(() => { void this.refresh(); });
    this.unsubscribe = () => { offGLB(); offSprites(); };
    void Promise.all([registry.ready, sprites.ready]).then(() => this.refresh()).catch(() => {});
  }

  setSpecies(species: SpeciesId, xp = 0): void {
    if (this.disposed || (species === this.species && xp === this.xp)) return;
    this.species = species; this.xp = xp;
    void this.refresh(); // Actual selected form changes only when a threshold is crossed.
  }

  private async refresh(): Promise<void> {
    if (this.disposed) return;
    const registry = nextgenModRegistry();
    const sprite = nextgenSpriteRegistry().selection(this.species, this.xp);
    const glb = registry.selection(this.species);
    const id = sprite ? `sprite:${sprite.id}:${glb ?? ''}` : glb ? `glb:${glb}` : undefined;
    if (id === this.selection) return;
    this.selection = id;
    const generation = ++this.generation;
    this.visual?.dispose();
    this.visual = null;
    if (!id) return;
    let cosmetic: ModVisual | SpriteCompanionVisual | null = null;
    if (sprite) {
      try { cosmetic = await SpriteCompanionVisual.create(sprite); }
      catch (error) { console.warn('Local sprite appearance unavailable; using original/GLB fallback', error); }
    }
    if (!cosmetic && glb && generation === this.generation && !this.disposed) cosmetic = await registry.acquire(this.species);
    if (!cosmetic) return;
    if (this.disposed || generation !== this.generation) {
      cosmetic.dispose();
      return;
    }
    this.visual = cosmetic;
    this.scene.add(cosmetic.root);
  }

  /** Source transform comes from the normal creature renderer; zero gameplay authority. */
  update(source: THREE.Object3D, dtMs: number, moving: boolean, visible: boolean): boolean {
    const cosmetic = this.visual;
    if (!cosmetic) return false;
    cosmetic.root.position.copy(source.position);
    cosmetic.root.quaternion.copy(source.quaternion);
    cosmetic.root.visible = visible;
    cosmetic.update(Math.max(0, Math.min(100, dtMs)) / 1000, moving);
    return true;
  }

  pulse(): void { this.visual?.pulse(); }
  attack(): void { if (this.visual instanceof SpriteCompanionVisual) this.visual.attack(); }
  get appearanceKind(): 'sprite' | 'glb' | 'original' { return this.visual instanceof SpriteCompanionVisual ? 'sprite' : this.visual ? 'glb' : 'original'; }
  hide(): void { if (this.visual) this.visual.root.visible = false; }
  get active(): boolean { return !!this.visual; }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.generation++;
    this.visual?.dispose();
    this.visual = null;
  }
}
