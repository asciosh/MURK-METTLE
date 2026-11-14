import { LIMITS, type ModManifest } from './format.mjs';
export interface StoredMod {
  id: string;
  manifest: ModManifest;
  zip: Blob;
  enabled: boolean;
}
/** Device/profile-local cosmetics only. This DB is never added to ProgressStore or account saves. */
export class ModStore {
  private database: Promise<IDBDatabase> | null = null;
  private db(): Promise<IDBDatabase> {
    return (this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open('murk-mettle-cosmetics', 1);
      let failed = false;
      request.onupgradeneeded = () => request.result.createObjectStore('packs', { keyPath: 'id' });
      request.onsuccess = () => {
        if (failed) {
          request.result.close();
          return;
        }
        request.result.onversionchange = () => {
          request.result.close();
          this.database = null;
        };
        resolve(request.result);
      };
      const unavailable = (message: string) => {
        failed = true;
        this.database = null;
        reject(Error(message));
      };
      request.onerror = () => unavailable('Local mod storage is unavailable');
      request.onblocked = () => unavailable('Close another Mods manager tab and retry');
    }));
  }
  async list(): Promise<StoredMod[]> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('packs', 'readonly'),
        request = transaction.objectStore('packs').openCursor();
      const rows: StoredMod[] = [];
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && rows.length < LIMITS.storedMods) {
          rows.push(cursor.value as StoredMod);
          cursor.continue();
        } else resolve(rows);
      };
      request.onerror = () => reject(request.error);
    });
  }
  async save(rows: StoredMod[], remove?: string): Promise<void> {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('packs', 'readwrite'),
        store = tx.objectStore('packs');
      // Enforce the count atomically even when two tabs import concurrently.
      const keys = store.getAllKeys(undefined, LIMITS.storedMods + 1);
      let abortReason = 'Local mod storage write was aborted';
      keys.onsuccess = () => {
        const existing = new Set(keys.result);
        const combined = new Set(keys.result);
        for (const row of rows) combined.add(row.id);
        if (remove) combined.delete(remove);
        if (combined.size > LIMITS.storedMods && rows.some((row) => !existing.has(row.id))) {
          abortReason = 'Eight local mods maximum. Remove a mod before importing.';
          tx.abort();
          return;
        }
        for (const row of rows) store.put(row);
        if (remove) store.delete(remove);
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(Error('Could not save local mods (storage quota or browser policy)'));
      tx.onabort = () => reject(Error(abortReason));
    });
  }
  async close(): Promise<void> {
    try {
      const db = await this.database;
      db?.close();
    } catch {
      /* Opening may have been blocked by browser policy. */
    }
    this.database = null;
  }
}
