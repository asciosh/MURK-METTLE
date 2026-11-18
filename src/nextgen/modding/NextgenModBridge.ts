import type * as THREE from 'three/webgpu';
import type { SpeciesId } from '../../../shared/expansion.mjs';
import { ModRegistry } from '../../client/mods/ModRegistry';
import type { ModVisual } from '../../client/mods/ModVisual';

// Reuse the legacy game's bounded, browser-only validator and IndexedDB store.
// Nothing here can update trusted room species, combat, rewards or account saves.
let deviceRegistry: ModRegistry | null = null;
export function nextgenModRegistry(): ModRegistry {
  return deviceRegistry ??= new ModRegistry();
}

/** A purely cosmetic local override, driven by an existing authoritative creature. */
export class NextgenModBridge {
  private visual: ModVisual | null = null;
  private selection: string | undefined;
  private generation = 0;
  private disposed = false;
  private readonly unsubscribe: () => void;

  constructor(private readonly scene: THREE.Scene, private species: SpeciesId) {
    const registry = nextgenModRegistry();
    this.unsubscribe = registry.subscribe(() => { void this.refresh(); });
    void registry.ready.then(() => this.refresh()).catch(() => {});
  }

  setSpecies(species: SpeciesId): void {
    if (this.disposed || species === this.species) return;
    this.species = species;
    this.selection = undefined;
    this.generation++;
    this.visual?.dispose();
    this.visual = null;
    void this.refresh();
  }

  private async refresh(): Promise<void> {
    if (this.disposed) return;
    const registry = nextgenModRegistry();
    const id = registry.selection(this.species);
    if (id === this.selection) return;
    this.selection = id;
    const generation = ++this.generation;
    this.visual?.dispose();
    this.visual = null;
    if (!id) return;
    const cosmetic = await registry.acquire(this.species);
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
