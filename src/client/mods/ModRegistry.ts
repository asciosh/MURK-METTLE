import { LIMITS, validateManifest, type ValidatedMod } from './format.mjs';
import type { SpeciesId } from '../../../shared/expansion.mjs';
import { ModStore, type StoredMod } from './ModStore';
import { validateImport } from './ValidateImport';
import { loadValidated, disposeAsset, ModVisual } from './ModVisual';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
type Source = { mod: ValidatedMod; asset: GLTF; users: number };
export class ModRegistry {
  readonly records = new Map<string, StoredMod>();
  readonly errors = new Map<string, string>();
  private readonly listeners = new Set<() => void>();
  private readonly sources = new Map<string, Source>();
  private readonly pending = new Map<string, Promise<Source>>();
  private readonly store = new ModStore();
  private disposed = false;
  private busy = false;
  readonly ready: Promise<void>;
  constructor() {
    this.ready = this.restore();
  }
  subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  private notify(): void {
    for (const callback of this.listeners) callback();
  }
  selection(species: SpeciesId): string | undefined {
    return [...this.records.values()].find((r) => r.enabled && r.manifest.species === species)?.id;
  }
  private async restore(): Promise<void> {
    try {
      for (const row of await this.store.list()) {
        try {
          const manifest = validateManifest(row.manifest);
          if (row.id !== manifest.id || !(row.zip instanceof Blob) || row.zip.size > LIMITS.archive)
            throw Error('Invalid local cache');
          row.manifest = manifest;
          row.enabled = row.enabled === true && !this.selection(manifest.species);
          this.records.set(row.id, row);
        } catch {
          /* Untrusted/tampered cache records are never activated. */
        }
      }
      if (!this.disposed) this.notify();
    } catch (error) {
      this.errors.set('storage', String(error));
    }
  }
  private async mutate<T>(work: () => Promise<T>): Promise<T> {
    await this.ready;
    if (this.disposed) throw Error('Mods manager is closed');
    if (this.busy) throw Error('Wait for the current mod operation');
    this.busy = true;
    try {
      const result = await work();
      this.errors.delete('storage');
      return result;
    } finally {
      this.busy = false;
    }
  }
  private async source(id: string, validated?: ValidatedMod): Promise<Source> {
    if (this.disposed) throw Error('Mods manager is closed');
    const cached = this.sources.get(id);
    if (cached) return cached;
    const existing = this.pending.get(id);
    if (existing) return existing;
    const row = this.records.get(id);
    if (!row && !validated) throw Error('Mod is missing');
    const promise = (async () => {
      const mod = validated ?? (await validateImport(row!.zip));
      if (this.disposed) throw Error('Mods manager was closed during validation');
      if (mod.manifest.id !== id || (row && JSON.stringify(mod.manifest) !== JSON.stringify(row.manifest)))
        throw Error('Local package metadata mismatch');
      const asset = await loadValidated(mod);
      if (this.disposed) {
        disposeAsset(asset);
        throw Error('Mods manager was closed during loading');
      }
      const result = { mod, asset, users: 0 };
      this.sources.set(id, result);
      return result;
    })();
    this.pending.set(id, promise);
    try {
      return await promise;
    } finally {
      this.pending.delete(id);
    }
  }
  async import(blob: Blob): Promise<string> {
    return this.mutate(async () => {
      const mod = await validateImport(blob),
        id = mod.manifest.id;
      if (this.records.has(id))
        throw Error('This mod ID is already installed. Remove it before importing another version.');
      if (this.records.size >= LIMITS.storedMods)
        throw Error('Eight local mods maximum. Remove a mod first.');
      await this.source(id, mod); // Real GLTF parse before admission; never replace an active creature on import.
      const row = { id, manifest: mod.manifest, zip: blob, enabled: false };
      try {
        await this.store.save([row]);
        this.records.set(id, row);
      } catch (error) {
        this.trim();
        throw error;
      }
      this.notify();
      return id;
    });
  }
  async enable(id: string): Promise<void> {
    return this.mutate(async () => {
      const record = this.records.get(id);
      if (!record) throw Error('Mod is missing');
      await this.source(id);
      const changed = [...this.records.values()]
        .filter((r) => r.manifest.species === record.manifest.species)
        .map((r) => ({ ...r, enabled: r.id === id }));
      await this.store.save(changed);
      for (const row of changed) this.records.set(row.id, row);
      this.errors.delete(id);
      this.notify();
      this.trim();
    });
  }
  async disable(id: string): Promise<void> {
    return this.mutate(async () => {
      const record = this.records.get(id);
      if (!record) return;
      const row = { ...record, enabled: false };
      await this.store.save([row]);
      this.records.set(id, row);
      this.notify();
      this.trim();
    });
  }
  async remove(id: string): Promise<void> {
    return this.mutate(async () => {
      await this.store.save([], id);
      this.records.delete(id);
      this.errors.delete(id);
      this.notify();
      this.trim();
    });
  }
  async restoreOriginals(): Promise<void> {
    return this.mutate(async () => {
      const rows = [...this.records.values()].map((r) => ({ ...r, enabled: false }));
      await this.store.save(rows);
      for (const row of rows) this.records.set(row.id, row);
      this.notify();
      this.trim();
    });
  }
  async acquire(species: SpeciesId): Promise<ModVisual | null> {
    const id = this.selection(species);
    if (!id) return null;
    try {
      return await this.preview(id);
    } catch (error) {
      this.errors.set(
        id,
        'Cosmetic unavailable; original appearance restored. ' + String(error).slice(0, 160),
      );
      this.notify();
      return null;
    }
  }
  async preview(id: string): Promise<ModVisual> {
    const source = await this.source(id);
    if (this.disposed) throw Error('Mods manager was closed before the visual was attached');
    source.users++;
    return new ModVisual(source.asset, source.mod, () => {
      source.users--;
      this.trim();
    });
  }
  async icon(id: string): Promise<string | null> {
    const source = await this.source(id),
      icon = source.mod.manifest.icon;
    if (!icon) return null;
    return URL.createObjectURL(new Blob([source.mod.files.get(icon)!], { type: 'image/png' }));
  }
  async licenseText(id: string): Promise<string> {
    const source = await this.source(id);
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(source.mod.files.get('LICENSE.txt'));
    } finally {
      this.trim();
    }
  }
  trim(): void {
    for (const [id, source] of this.sources)
      if (!source.users && (!this.records.get(id)?.enabled || this.disposed)) {
        disposeAsset(source.asset);
        this.sources.delete(id);
      }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.listeners.clear();
    this.trim();
    void this.store.close();
  }
}
