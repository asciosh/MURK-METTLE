import { loadCloudProgress, snapshotProgress, progressIsDirty, progressGeneration, markProgressSaved, type ProgressSave } from './ProgressStore';

type ResponseData = { ok?: boolean; username?: string; error?: string; revision?: number; data?: ProgressSave | null };
const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const panel = byId<HTMLElement>('account-panel');
const message = byId<HTMLElement>('account-message');
const username = byId<HTMLInputElement>('account-username');
const pin = byId<HTMLInputElement>('account-pin');
const login = byId<HTMLButtonElement>('account-login');
const register = byId<HTMLButtonElement>('account-register');
const logout = byId<HTMLButtonElement>('account-logout');
const state = byId<HTMLElement>('account-state');
const gate = byId<HTMLElement>('auth-gate');
let currentAccount = '';
let revision = 0;
let sending = false;
let halted = false;
let beginGame: (() => void) | null = null;
let syncTimer: ReturnType<typeof setInterval> | null = null;
function status(text: string) { message.textContent = text; }
async function api(route: string, method = 'GET', body?: unknown): Promise<ResponseData> {
  const response = await fetch('/api/account/' + route, {
    method, credentials: 'same-origin', cache: 'no-store',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json() as ResponseData;
  if (!response.ok) { const error = new Error(data.error ?? `HTTP ${response.status}`); (error as Error & { code?: number }).code = response.status; throw error; }
  return data;
}
async function saveProgress(): Promise<boolean> {
  if (!currentAccount || sending || halted) return false;
  if (!progressIsDirty()) return true;
  sending = true;
  try {
    const generation = progressGeneration();
    const result = await api('save', 'PUT', { revision, data: snapshotProgress() });
    if (typeof result.revision !== 'number') throw new Error('Missing save revision');
    revision = result.revision;
    markProgressSaved(generation);
    status('Progress saved to your Cloudflare account.');
    return true;
  } catch (error) {
    // Never retry stale writes; no silent overwrites.
    halted = true;
    const conflict = (error as Error & { code?: number }).code === 409;
    status(conflict ? 'Cloud save conflict: another session updated this account. This session is read-only; reload to fetch latest cloud progress.' : 'Cloud save failed; auto-sync paused. Check your connection and reload after resolving it.');
    return false;
  } finally { sending = false; }
}
async function startAuthenticated(name: string): Promise<void> {
  const result = await api('save');
  revision = result.revision ?? 0;
  loadCloudProgress(result.data ?? null);
  currentAccount = name;
  halted = false;
  state.textContent = '@' + name;
  gate.hidden = true;
  panel.hidden = true;
  logout.hidden = false;
  byId<HTMLButtonElement>('account-save-now').hidden = false;
  username.disabled = true;
  pin.disabled = true;
  login.hidden = true;
  register.hidden = true;
  beginGame?.();
  if (syncTimer === null) syncTimer = setInterval(() => { if (document.visibilityState === 'visible') void saveProgress(); }, 12000);
  status('Signed in. Cloud account progress is active.');
}
async function authenticate(kind: 'login' | 'register'): Promise<void> {
  const name = username.value.trim().toLowerCase();
  const secret = pin.value;
  if (!/^[a-z0-9_]{3,20}$/.test(name)) { status('Use 3–20 letters, numbers or underscores.'); return; }
  if (!/^\d{6,8}$/.test(secret)) { status('PIN must be 6–8 digits.'); return; }
  login.disabled = register.disabled = true;
  try {
    const response = await api(`${kind}?username=${encodeURIComponent(name)}`, 'POST', { pin: secret });
    pin.value = '';
    await startAuthenticated(response.username ?? name);
  } catch (error) { status(error instanceof Error ? error.message : 'Sign in failed'); }
  finally { login.disabled = register.disabled = false; }
}
export async function initAccount(onReady: () => void): Promise<void> {
  beginGame = onReady;
  byId<HTMLButtonElement>('account-toggle').addEventListener('click', () => { panel.hidden = !panel.hidden; });
  byId<HTMLButtonElement>('account-close').addEventListener('click', () => { if (currentAccount) panel.hidden = true; });
  login.addEventListener('click', () => { void authenticate('login'); });
  register.addEventListener('click', () => { void authenticate('register'); });
  logout.addEventListener('click', () => { void (async () => {
    if (!window.confirm('Log out? Unsaved progress from the last few seconds may be lost.')) return;
    if (!(await saveProgress())) { status('Cannot log out until the cloud save succeeds.'); return; }
    try { await api('logout', 'POST'); window.location.reload(); }
    catch (error) { status(error instanceof Error ? error.message : 'Log out failed'); }
  })(); });
  byId<HTMLButtonElement>('account-save-now').addEventListener('click', () => { void saveProgress(); });
  window.addEventListener('pagehide', () => {
    // sendBeacon is not used for authenticated revisioned PUT requests; a regular tab close
    // may lose up to 12 seconds of progress. Use SAVE NOW before closing.
  });
  panel.hidden = false;
  gate.hidden = false;
  byId<HTMLButtonElement>('account-save-now').hidden = true;
  try {
    const result = await api('me');
    if (result.username) await startAuthenticated(result.username);
    else status('Sign in to play. Progress is stored in your Cloudflare account.');
  } catch { status('Account service unavailable. Use Cloudflare deployment (or wrangler dev) to sign in.'); }
}
