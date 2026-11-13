const TOKEN_KEY = 'murk-mettle-cloud-recovery-key';
const SAVE_KEYS = [
  'murk-mettle-v04-progression', 'murk-mettle-v05-inventory',
  'murk-mettle-v06-crafting', 'murk-mettle-v07-expeditions',
  'murk-mettle-v05-bond-retreat',
] as const;
type StoredSave = Record<(typeof SAVE_KEYS)[number], string | null>;
let token = localStorage.getItem(TOKEN_KEY) || '';
function validKey(key: string): boolean { return /^[a-f0-9]{64}$/.test(key); }
function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}
function ensureToken(): string {
  if (!validKey(token)) { token = newToken(); localStorage.setItem(TOKEN_KEY, token); }
  return token;
}
async function request(method: 'GET' | 'PUT', data?: StoredSave): Promise<Record<string, unknown>> {
  const response = await fetch('/api/profile', { method,
    headers: { Authorization: `Bearer ${ensureToken()}`, ...(data ? { 'Content-Type': 'application/json' } : {}) },
    ...(data ? { body: JSON.stringify(data) } : {}), cache: 'no-store', });
  if (!response.ok) throw new Error(`Cloud save returned HTTP ${response.status}`);
  return await response.json() as Record<string, unknown>;
}
function collect(): StoredSave {
  return Object.fromEntries(SAVE_KEYS.map(key => [key, localStorage.getItem(key)])) as StoredSave;
}
const status = document.querySelector<HTMLElement>('#cloud-save-status');
const setStatus = (text: string): void => { if (status) status.textContent = text; };
let busy = false;
async function save(): Promise<void> {
  if (busy) return;
  busy = true;
  setStatus('Saving…');
  try {
    await request('PUT', collect());
    // Keep existing backup data, but no automatic legacy sync.
    setStatus('Cloud backup saved');
  } catch (error) { setStatus(error instanceof Error ? error.message : 'Cloud backup failed'); }
  finally { busy = false; }
}
async function restore(): Promise<void> {
  const key = window.prompt('Paste your 64-character recovery key. Keep it private.');
  if (!key) return;
  if (!validKey(key.trim())) { setStatus('Invalid recovery key'); return; }
  if (!window.confirm("Replace this browser's progress with the cloud backup? This cannot be undone.")) return;
  if (busy) return;
  busy = true;
  const previousToken = token;
  token = key.trim();
  try {
    const payload = await request('GET');
    const data = payload.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('No backup found for this key');
    for (const k of SAVE_KEYS) {
      const value = (data as Record<string, unknown>)[k];
      if (value !== null && typeof value !== 'string' && value !== undefined) throw new Error('Invalid backup');
    }
    for (const k of SAVE_KEYS) {
      const value = (data as Record<string, string | null>)[k];
      if (typeof value === 'string') localStorage.setItem(k, value);
      else localStorage.removeItem(k);
    }
    localStorage.setItem(TOKEN_KEY, token);
    // A legacy restore changes the local data. Require account sync review.
    localStorage.removeItem('mm-account-sync');
    localStorage.removeItem('mm-local-owner');
    // Keep existing backup data, but no automatic legacy sync.
    window.location.reload();
  } catch (error) {
    token = previousToken;
    setStatus(error instanceof Error ? error.message : 'Restore failed');
  } finally { busy = false; }
}
export function initCloudSave(): void {
  document.querySelector('#cloud-save')?.addEventListener('click', () => { void save(); });
  document.querySelector('#cloud-restore')?.addEventListener('click', () => { void restore(); });
  document.querySelector('#cloud-copy-key')?.addEventListener('click', () => {
    const key = ensureToken();
    void navigator.clipboard.writeText(key).then(
      () => setStatus('Recovery key copied — keep it private'),
      () => setStatus('Clipboard unavailable; use a secure manual backup'),
    );
  });
  // Legacy backups are manual in v0.13.1; avoid competing autosave timelines.
  // Existing keys and recovery-key restores remain supported.
}
