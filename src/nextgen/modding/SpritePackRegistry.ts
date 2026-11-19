import { SPRITE_PACK_LIMITS, resolveSpriteEntry, type ValidatedSpritePack, type SpriteEntry } from './sprite-pack.mjs';
import type { SpeciesId } from '../../../shared/expansion.mjs';

interface StoredPack { zip: Blob; enabled: boolean; }
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('murk-mettle-nextgen-sprites-v2', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('pack');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(Error('Local sprite storage unavailable'));
  });
}
async function readStored(): Promise<StoredPack | undefined> {
  const db = await database();
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('pack', 'readonly'), request = tx.objectStore('pack').get('current');
    request.onsuccess = () => resolve(request.result as StoredPack | undefined); request.onerror = () => reject(request.error);
  }); } finally { db.close(); }
}
async function writeStored(row: StoredPack | null): Promise<void> {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('pack', 'readwrite'), store = tx.objectStore('pack');
    if (row) store.put(row, 'current'); else store.delete('current');
    tx.oncomplete = () => resolve(); tx.onabort = tx.onerror = () => reject(Error('Could not write sprite pack to local storage'));
  }); } finally { db.close(); }
}
async function validate(blob: Blob): Promise<ValidatedSpritePack> {
  if (!(blob instanceof Blob) || blob.size > SPRITE_PACK_LIMITS.archive) throw Error('Sprite pack exceeds 24 MiB or is invalid');
  const bytes = await blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./sprite-pack.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => { clearTimeout(timer); worker.terminate(); };
    const timer = setTimeout(() => { finish(); reject(Error('Sprite pack validation timed out')); }, 30000);
    worker.onmessage = event => { finish(); if (event.data.ok) resolve(event.data.pack as ValidatedSpritePack); else reject(Error(event.data.error)); };
    worker.onerror = () => { finish(); reject(Error('Sprite validation unavailable in this browser')); };
    worker.postMessage(bytes, [bytes]);
  });
}
export interface SpriteSelection { id: string; entry: SpriteEntry; bytes: Uint8Array<ArrayBuffer>; width: number; height: number; }

/** One bounded sprite pack per device. Separate from legacy GLB mods and account saves. */
class SpritePackRegistry {
  private pack: ValidatedSpritePack | null = null;
  private row: StoredPack | null = null;
  private revision = 0;
  private busy = false;
  private readonly listeners = new Set<() => void>();
  readonly ready = this.restore();
  error = '';
  private async restore() {
    try {
      const row = await readStored();
      if (row) { const pack = await validate(row.zip); this.pack = pack; this.row = { zip: row.zip, enabled: row.enabled === true }; }
    } catch { this.error = 'Stored sprite pack could not be loaded. Original appearance retained.'; }
    finally { this.notify(); }
  }
  subscribe(callback: () => void) { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; }
  private notify() { this.revision++; for (const callback of this.listeners) callback(); }
  get manifest() { return this.pack?.manifest ?? null; }
  get enabled() { return this.row?.enabled === true; }
  private async mutate(work: () => Promise<void>) {
    await this.ready;
    if (this.busy) throw Error('Wait for the active sprite operation');
    this.busy = true;
    try { await work(); this.error = ''; this.notify(); } finally { this.busy = false; }
  }
  async install(zip: Blob) {
    await this.mutate(async () => {
      const pack = await validate(zip), row = { zip, enabled: false };
      await writeStored(row); this.pack = pack; this.row = row;
    });
  }
  async setEnabled(enabled: boolean) {
    await this.mutate(async () => {
      if (!this.row) return;
      const row = { ...this.row, enabled }; await writeStored(row); this.row = row;
    });
  }
  async remove() { await this.mutate(async () => { await writeStored(null); this.row = null; this.pack = null; }); }
  selection(species: SpeciesId, xp: number): SpriteSelection | null {
    if (!this.enabled || !this.pack) return null;
    const entry = resolveSpriteEntry(this.pack.manifest, species, xp);
    if (!entry) return null;
    const bytes = this.pack.files.get(entry.sprite), dims = this.pack.dimensions.get(entry.sprite);
    if (!bytes || !dims) return null;
    return { id: `${this.revision}:${entry.key}`, entry, bytes, ...dims };
  }
}
let registry: SpritePackRegistry | null = null;
export const nextgenSpriteRegistry = () => registry ??= new SpritePackRegistry();
