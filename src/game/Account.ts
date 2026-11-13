// Private-beta account sync. v0.13 local keys stay untouched for legacy saves.
const KEYS = [
  'murk-mettle-v04-progression', 'murk-mettle-v05-inventory',
  'murk-mettle-v06-crafting', 'murk-mettle-v07-expeditions',
  'murk-mettle-v05-bond-retreat',
] as const;
type Save = Record<(typeof KEYS)[number], string | null>;
type ApiResponse = { error?: string; ok?: boolean; username?: string; hasSave?: boolean; data?: Save | null; revision?: number; updatedAt?: number | null };
const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const panel = el<HTMLElement>('account-panel');
const state = el<HTMLElement>('account-state');
const message = el<HTMLElement>('account-message');
const username = el<HTMLInputElement>('account-username');
const pin = el<HTMLInputElement>('account-pin');
const upload = el<HTMLButtonElement>('account-upload');
const download = el<HTMLButtonElement>('account-download');
const logout = el<HTMLButtonElement>('account-logout');
const register = el<HTMLButtonElement>('account-register');
const login = el<HTMLButtonElement>('account-login');
const SYNC = 'mm-account-sync';
const OWNER = 'mm-local-owner';
const REV_PREFIX = 'mm-account-revision:';
let currentAccount = '';
let revision: number | null = null;
let saving = false;
let busy = false;
let syncPaused = true;
let identityChecked = false;
function status(text: string): void { message.textContent = text; }
function collect(): Save { return Object.fromEntries(KEYS.map(k => [k, localStorage.getItem(k)])) as Save; }
function applySave(data: Save): void {
  for (const key of KEYS) {
    const v = data[key];
    if (v !== null && typeof v !== 'string' && typeof v !== 'undefined') throw new Error('Invalid cloud data');
  }
  for (const key of KEYS) {
    const v = data[key];
    if (typeof v === 'string') localStorage.setItem(key, v);
    else localStorage.removeItem(key);
  }
}
function pauseSync(): void {
  syncPaused = true;
  localStorage.removeItem(SYNC);
}
function showAccount(value: string): void {
  if (identityChecked && value !== currentAccount) { pauseSync(); revision = null; }
  identityChecked = true;
  currentAccount = value;
  state.textContent = value ? `@${value}` : 'Guest';
  upload.hidden = !value;
  download.hidden = !value;
  logout.hidden = !value;
  login.hidden = !!value;
  register.hidden = !!value;
  username.disabled = !!value;
  pin.disabled = !!value;
}
async function api(route: string, method = 'GET', body?: unknown): Promise<ApiResponse> {
  const response = await fetch(`/api/account/${route}`, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json() as ApiResponse;
  if (!response.ok) {
    const error = new Error(payload.error || `HTTP ${response.status}`);
    (error as Error & { code?: number }).code = response.status;
    throw error;
  }
  return payload;
}
function knownRevision(name: string): number | null {
  const raw = localStorage.getItem(REV_PREFIX + name);
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) ? value : null;
}
function recordRevision(name: string, value: number): void {
  revision = value;
  localStorage.setItem(REV_PREFIX + name, String(value));
}
async function inspectCloud(name: string): Promise<ApiResponse> {
  const result = await api('save');
  if (currentAccount !== name) throw new Error('Account changed while checking save');
  return result;
}
async function authenticate(kind: 'register' | 'login'): Promise<void> {
  if (busy) return;
  const name = username.value.trim().toLowerCase();
  const secret = pin.value;
  if (!/^[a-z0-9_]{3,20}$/.test(name)) { status('Username: 3–20 letters, numbers or underscores'); return; }
  if (!/^\d{6,8}$/.test(secret)) { status('PIN must be 6–8 digits'); return; }
  busy = true;
  status('Authenticating…');
  try {
    const payload = await api(`${kind}?username=${encodeURIComponent(name)}`, 'POST', { pin: secret });
    pin.value = '';
    showAccount(payload.username || name);
    status(payload.hasSave ? 'Signed in. Choose RESTORE or REVIEW & UPLOAD. Autosync is off until you choose.' : 'Signed in. Review local progress before first upload.');
  } catch (err) { status(err instanceof Error ? err.message : 'Authentication failed'); }
  finally { busy = false; }
}
async function uploadSave(silent = false): Promise<void> {
  if (!currentAccount || saving || busy) return;
  const name = currentAccount;
  if (silent && (syncPaused || localStorage.getItem(SYNC) !== name || localStorage.getItem(OWNER) !== name || revision === null)) return;
  saving = true;
  try {
    // Explicit upload refreshes the cloud revision, and requires clear approval before overwriting.
    if (!silent) {
      const existing = await inspectCloud(name);
      const cloudRevision = existing.revision ?? 0;
      const previous = knownRevision(name);
      const owner = localStorage.getItem(OWNER);
      const warning = owner && owner !== name
        ? `This browser progress belongs to @${owner}. Uploading it to @${name} can mix accounts. Cancel and restore @${name} instead. Continue?`
        : !owner ? 'This browser progress has no account owner. Confirm it belongs to the account you are signing into. Continue?' : '';
      if (warning && !window.confirm(warning)) return;
      if ((existing.data || (previous !== null && previous !== cloudRevision)) &&
          !window.confirm(`Cloud save revision ${cloudRevision}${previous !== null ? ` (last used here: ${previous})` : ''}. Replace this account cloud save with this browser progress? Consider restoring first.`)) return;
      revision = cloudRevision;
    }
    if (revision === null) { pauseSync(); status('Review the cloud save before enabling sync.'); return; }
    if (!silent) status('Uploading save…');
    const result = await api('save', 'PUT', { revision, data: collect() });
    if (currentAccount !== name) { pauseSync(); return; }
    recordRevision(name, result.revision!);
    localStorage.setItem(OWNER, name);
    localStorage.setItem(SYNC, name);
    syncPaused = false;
    if (!silent) status('Save uploaded. Account autosync enabled (60 seconds). Legacy backup remains manual.');
  } catch (err) {
    pauseSync();
    status((err as Error & { code?: number }).code === 409
      ? 'SAVE CONFLICT: Another device changed this cloud save. Autosync paused; restore or explicitly review/upload again.'
      : err instanceof Error ? err.message : 'Cloud upload failed');
  } finally { saving = false; }
}
async function restoreSave(): Promise<void> {
  if (!currentAccount || busy || saving) return;
  busy = true;
  const name = currentAccount;
  try {
    const result = await inspectCloud(name);
    if (!result.data) { status('This account does not have a saved game yet.'); return; }
    if (!window.confirm('Replace CURRENT browser progress with this account cloud save? Copy your local data first if needed.')) return;
    applySave(result.data);
    localStorage.setItem(OWNER, name);
    recordRevision(name, result.revision ?? 0);
    localStorage.setItem(SYNC, name);
    location.reload();
  } catch (err) { status(err instanceof Error ? err.message : 'Restore failed'); }
  finally { busy = false; }
}
export function initAccount(): void {
  el<HTMLButtonElement>('account-toggle').addEventListener('click', () => { panel.hidden = !panel.hidden; });
  el<HTMLButtonElement>('account-close').addEventListener('click', () => { panel.hidden = true; });
  register.addEventListener('click', () => { void authenticate('register'); });
  login.addEventListener('click', () => { void authenticate('login'); });
  upload.addEventListener('click', () => { void uploadSave(); });
  download.addEventListener('click', () => { void restoreSave(); });
  logout.addEventListener('click', () => {
    if (busy || saving) return;
    busy = true;
    void (async () => {
      try { await api('logout', 'POST'); showAccount(''); status('Logged out. Browser progress is unchanged, cloud sync off.'); }
      catch (err) { status(err instanceof Error ? err.message : 'Logout failed'); }
      finally { busy = false; }
    })();
  });
  void api('me').then(async payload => {
    const name = payload.username || '';
    showAccount(name);
    if (!name) return;
    // Only resume after checking the last known revision and save owner.
    const before = knownRevision(name);
    const result = await inspectCloud(name);
    const cloudRevision = result.revision ?? 0;
    if (localStorage.getItem(OWNER) === name && before !== null && before === cloudRevision && localStorage.getItem(SYNC) === name) {
      revision = cloudRevision;
      syncPaused = false;
      status('Account sync active; cloud revision verified.');
    } else {
      pauseSync();
      status('Cloud sync paused. Review and restore or upload browser progress before syncing.');
    }
  }).catch(() => { pauseSync(); status('Could not verify cloud save; autosync paused.'); });
  setInterval(() => {
    if (currentAccount && document.visibilityState === 'visible' && !syncPaused) void uploadSave(true);
  }, 60000);
}
