// Private-beta username + PIN account synchronization. Existing v0.12 recovery-key backups remain intact.
const KEYS = [
  'murk-mettle-v04-progression', 'murk-mettle-v05-inventory',
  'murk-mettle-v06-crafting', 'murk-mettle-v07-expeditions',
  'murk-mettle-v05-bond-retreat',
] as const;
type Save = Record<(typeof KEYS)[number], string | null>;
type ApiResponse = { error?: string; ok?: boolean; username?: string; hasSave?: boolean; data?: Save | null };
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
let currentAccount = '';
let saving = false;
let busy = false;
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
function showAccount(value: string): void {
  currentAccount = value;
  state.textContent = value ? `@${value}` : 'Guest';
  upload.hidden = !value;
  download.hidden = !value;
  logout.hidden = !value;
  login.hidden = !!value;
  register.hidden = !!value;
  username.disabled = !!value;
  pin.disabled = !!value;
  if (!value) localStorage.removeItem('mm-account-sync');
}
async function api(route: string, method = 'GET', body?: unknown): Promise<ApiResponse> {
  const response = await fetch(`/api/account/${route}`, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json() as ApiResponse;
  if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
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
    status(payload.hasSave ? 'Account ready. Choose RESTORE ACCOUNT SAVE or UPLOAD LOCAL SAVE.' : 'New account. Use UPLOAD LOCAL SAVE to start cloud sync.');
  } catch (err) { status(err instanceof Error ? err.message : 'Authentication failed'); }
  finally { busy = false; }
}
async function uploadSave(silent = false): Promise<void> {
  if (!currentAccount || saving) return;
  if (!silent) {
    try {
      const existing = await api('save');
      if (existing.data && !confirm('Replace the CURRENT account cloud save with this browser\'s local progress?')) return;
    } catch (err) { status(err instanceof Error ? err.message : 'Could not check account save'); return; }
  }
  saving = true;
  if (!silent) status('Uploading save…');
  try {
    await api('save', 'PUT', collect());
    localStorage.setItem('mm-account-sync', currentAccount);
    if (!silent) status('Account save uploaded. Auto-sync active (60 seconds).');
  } catch (err) { status(err instanceof Error ? err.message : 'Cloud upload failed'); }
  finally { saving = false; }
}
async function restoreSave(): Promise<void> {
  if (!currentAccount || busy || saving) return;
  busy = true;
  try {
    const result = await api('save');
    if (!result.data) { status('This account does not have a saved game yet.'); return; }
    if (!confirm('Replace your CURRENT browser progress with this account save? This cannot be undone.')) return;
    applySave(result.data);
    localStorage.setItem('mm-account-sync', currentAccount);
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
    void (async () => {
      try { await api('logout', 'POST'); showAccount(''); status('Logged out. Local progress is still on this browser.'); }
      catch (err) { status(err instanceof Error ? err.message : 'Logout failed'); }
    })();
  });
  void api('me').then(payload => {
    showAccount(payload.username || '');
    if (payload.username) status('Signed in. Use RESTORE ACCOUNT SAVE to load cloud progress.');
  }).catch(() => showAccount(''));
  setInterval(() => {
    if (currentAccount && document.visibilityState === 'visible' && localStorage.getItem('mm-account-sync') === currentAccount) void uploadSave(true);
  }, 60000);
}
