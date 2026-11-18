import './NextgenMenu.css';
import { mountNextgenModsTab } from '../modding/NextgenModsTab';
import { SimpleDemo } from './SimpleDemo';
import { validateRoomCode } from '../core/RoomIntent';
import { NEXTGEN_CONTROLS, QUALITY_OPTIONS, savedNextgenQuality, saveNextgenQuality } from '../core/NextgenOptions';

type MenuTab = 'play' | 'coop' | 'settings' | 'controls' | 'mods';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', content = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content) node.textContent = content;
  return node;
}

/** Only approved control labels are rendered here; this is not a gameplay authority. */
export function renderControls(mode: 'solo' | 'coop' | 'both' = 'both'): HTMLElement {
  const wrap = element('div');
  const lines = [
    ...NEXTGEN_CONTROLS.shared,
    ...(mode !== 'coop' ? NEXTGEN_CONTROLS.solo : []),
    ...(mode !== 'solo' ? NEXTGEN_CONTROLS.coop : []),
  ];
  const title = element('p', 'ng-note', mode === 'both'
    ? 'Shared controls first. Solo and co-op have distinct companion and movement actions.'
    : mode === 'solo' ? 'Solo practice uses local combat and inventory.' : 'Co-op uses the room server for combat, movement actions, rewards and revives.');
  const grid = element('div', 'ng-controls');
  for (const [key, description] of lines) {
    grid.append(element('span', 'ng-key', key), element('span', '', description));
  }
  wrap.append(title, grid);
  return wrap;
}

export async function mountPlayable() {
  const demo = new SimpleDemo(true);
  try {
    await demo.mount();
    Object.assign(window, { __m01Demo: demo, __m01DemoLoaded: true });
    window.addEventListener('beforeunload', () => demo.dispose(), { once: true });
  } catch (error) { demo.dispose(); throw error; }
}

/** Single public entry for NEXTGEN; legacy v0.27 has a separate explicit route. */
export function mountLobby(roomCode = '') {
  const ui = element('main', 'ng-shell'); ui.id = 'nextgen-lobby';
  ui.setAttribute('aria-label', 'Murk and Mettle 2.0 main menu');
  const panel = element('section', 'ng-panel');
  panel.append(element('p', 'ng-eyebrow', 'Survival expedition · NEXTGEN'), element('h1', '', 'MURK & METTLE 2.0'), element('p', 'ng-subtitle', 'One world. Choose a solo field run or a private co-op room.'));

  const tabs = element('nav', 'ng-tabs'); tabs.setAttribute('aria-label', 'Main menu');
  const tabNames: { id: MenuTab; label: string }[] = [
    { id: 'play', label: 'Play' }, { id: 'coop', label: 'Co-op' },
    { id: 'settings', label: 'Settings' }, { id: 'controls', label: 'Controls' },
    { id: 'mods', label: 'Creature Mods' },
  ];
  const tabButtons = new Map<MenuTab, HTMLButtonElement>();
  const sections = new Map<MenuTab, HTMLElement>();
  for (const { id, label } of tabNames) {
    const tab = element('button', 'ng-tab', label); tab.type = 'button';
    tab.setAttribute('aria-controls', `ng-tab-${id}`);
    tabButtons.set(id, tab); tabs.append(tab);
    const section = element('section', 'ng-section'); section.id = `ng-tab-${id}`;
    sections.set(id, section);
  }
  let closeModPreview: (() => void) | undefined;
  const activate = (id: MenuTab) => {
    if (id !== 'mods') closeModPreview?.();
    for (const [name, section] of sections) section.hidden = name !== id;
    for (const [name, button] of tabButtons) button.setAttribute('aria-selected', String(name === id));
  };
  for (const [id, button] of tabButtons) button.addEventListener('click', () => activate(id));
  panel.append(tabs);

  const play = sections.get('play')!;
  play.append(element('h2', '', 'Choose your expedition'), element('p', '', 'Both modes use the same terrain, characters, lighting and HUD. The gameplay rules below are mode-specific.'));
  const solo = element('a', 'ng-button', 'PLAY SOLO'); solo.href = '/?nextgen=playable';
  play.append(solo,
    element('p', 'ng-note', 'Solo: local survival waves, pickups, jump/dodge and Lanternkin training. No cloud account XP.'),
    element('p', 'ng-note', 'For friends, open the Co-op tab above to sign in and join a private room.'));

  const coop = sections.get('coop')!;
  const form = element('form'); form.autocomplete = 'off';
  const roomLabel = element('label', '', 'Private room code');
  const room = element('input'); room.name = 'room'; room.required = true; room.maxLength = 12; room.autocomplete = 'off'; room.placeholder = 'Room code, e.g. BLOOM'; room.value = validateRoomCode(roomCode) ?? 'BLOOM';
  roomLabel.append(room);
  const userLabel = element('label', '', 'Account username');
  const username = element('input'); username.name = 'username'; username.maxLength = 20; username.autocomplete = 'username'; username.placeholder = '3–20 letters, numbers or _'; userLabel.append(username);
  const pinLabel = element('label', '', 'Private-beta PIN');
  const pin = element('input'); pin.name = 'pin'; pin.type = 'password'; pin.inputMode = 'numeric'; pin.maxLength = 8; pin.autocomplete = 'current-password'; pin.placeholder = '6–8 digits'; pinLabel.append(pin);
  const join = element('button', 'ng-button', 'SIGN IN & ENTER ROOM'); join.type = 'submit';
  const register = element('button', 'ng-button ng-secondary', 'REGISTER & ENTER ROOM'); register.type = 'button';
  const logout = element('button', 'ng-button ng-secondary', 'LOG OUT'); logout.type = 'button'; logout.hidden = true;
  const status = element('p', 'ng-status', 'Checking account session…'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  form.append(roomLabel, userLabel, pinLabel, join, register, logout, status);
  coop.append(element('h2', '', 'Private co-op room'), element('p', 'ng-note', 'Use the same room code on every PC. Each player signs in with a different account.'), form);
  let authenticated = false, busy = false;
  const enter = () => {
    const code = validateRoomCode(room.value);
    if (!code) { status.textContent = 'Room must contain 3–12 letters or numbers.'; room.focus(); return; }
    location.assign('/?nextgenRoom=' + encodeURIComponent(code));
  };
  const setAccount = (name: string) => {
    authenticated = true; userLabel.hidden = true; pinLabel.hidden = true; register.hidden = true;
    logout.hidden = false; join.textContent = 'ENTER CO-OP ROOM'; status.textContent = `Signed in as @${name}.`;
  };
  const clearAccount = () => {
    authenticated = false; userLabel.hidden = false; pinLabel.hidden = false; register.hidden = false;
    logout.hidden = true; join.textContent = 'SIGN IN & ENTER ROOM'; pin.value = ''; status.textContent = 'Sign in to join a room.';
  };
  const auth = async (kind: 'login' | 'register') => {
    if (busy) return;
    if (authenticated) { enter(); return; }
    if (!validateRoomCode(room.value)) { status.textContent = 'Invalid room code.'; return; }
    const name = username.value.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,20}$/.test(name) || !/^\d{6,8}$/.test(pin.value)) {
      status.textContent = 'Username: 3–20 letters, numbers or _. PIN: 6–8 digits.'; return;
    }
    busy = true; join.disabled = register.disabled = true;
    try {
      const response = await fetch(`/api/account/${kind}?username=${encodeURIComponent(name)}`, {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin: pin.value })
      });
      const data = await response.json();
      if (!response.ok) throw Error(typeof data.error === 'string' ? data.error : 'Could not authenticate.');
      pin.value = ''; setAccount(data.username ?? name); enter();
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'Cloud account unavailable.'; }
    finally { busy = false; join.disabled = register.disabled = false; }
  };
  form.addEventListener('submit', e => { e.preventDefault(); if (authenticated) enter(); else void auth('login'); });
  register.onclick = () => void auth('register');
  logout.onclick = () => void (async () => {
    if (busy) return;
    busy = true; logout.disabled = true;
    try {
      const response = await fetch('/api/account/logout', { method: 'POST', credentials: 'same-origin' });
      if (!response.ok) throw Error('Log out failed.');
      clearAccount();
    } catch { status.textContent = 'Could not log out. Check your connection.'; }
    finally { busy = false; logout.disabled = false; }
  })();

  const settings = sections.get('settings')!;
  settings.append(element('h2', '', 'Display settings'), element('p', 'ng-note', 'Graphics preference applies to both solo and co-op on this device. It does not affect Cloudflare saves.'));
  const qualityLabel = element('label', '', 'Graphics quality');
  const quality = element('select'); quality.id = 'nextgen-quality';
  for (const profile of QUALITY_OPTIONS) {
    const option = element('option', '', profile.label + ' — ' + profile.description); option.value = profile.id; quality.append(option);
  }
  quality.value = savedNextgenQuality(window.localStorage);
  qualityLabel.append(quality); settings.append(qualityLabel);
  const settingStatus = element('p', 'ng-note', 'Changes are saved automatically.'); settings.append(settingStatus);

  const controls = sections.get('controls')!;
  controls.append(element('h2', '', 'Controls'), renderControls('both'));
  const mods = sections.get('mods')!;
  closeModPreview = mountNextgenModsTab(mods).closePreview;
  for (const section of sections.values()) panel.append(section);
  ui.append(panel);
  // The UI intentionally sits in front of an ambient NEXTGEN world preview.
  document.body.replaceChildren(ui);
  const backdrop = new SimpleDemo(false);
  void backdrop.mount().catch(error => { backdrop.dispose(); console.warn('NEXTGEN menu backdrop unavailable', error); });
  quality.addEventListener('change', () => {
    const value = saveNextgenQuality(window.localStorage, quality.value);
    backdrop.setQuality(value); settingStatus.textContent = `Saved: ${QUALITY_OPTIONS.find(o => o.id === value)?.label}.`;
  });
  activate(roomCode ? 'coop' : new URLSearchParams(location.search).get('tab') === 'mods' ? 'mods' : 'play');
  window.addEventListener('beforeunload', () => backdrop.dispose(), { once: true });
  void fetch('/api/account/me', { credentials: 'same-origin', cache: 'no-store' }).then(async response => {
    if (response.ok) {
      const data = await response.json();
      if (typeof data.username === 'string' && data.username) { setAccount(data.username); return; }
    }
    clearAccount();
  }).catch(() => { status.textContent = 'Co-op requires the local Cloudflare Worker (port 8787). Solo works without signing in.'; });
}
