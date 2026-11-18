import './NextgenMenu.css';
import { NEXTGEN_CONTROLS, QUALITY_OPTIONS, savedNextgenQuality, saveNextgenQuality, nextgenQuality, type NextgenQuality } from '../core/NextgenOptions';

/** A single pause/settings/controls shell in both modes. In co-op the room continues server-side. */
export class NextgenPauseMenu {
  private readonly toggle = document.createElement('button');
  private readonly root = document.createElement('div');
  private readonly abort = new AbortController();
  private readonly previousFocus: { current: Element | null } = { current: null };
  private disposed = false;
  private open = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    mode: 'solo' | 'coop',
    private readonly setQuality: (value: NextgenQuality) => void
  ) {
    const signal = this.abort.signal;
    this.toggle.id = 'nextgen-pause-toggle';
    this.toggle.type = 'button';
    this.toggle.textContent = '☰ MENU';
    this.toggle.setAttribute('aria-controls', 'nextgen-pause');
    this.toggle.setAttribute('aria-expanded', 'false');
    this.root.id = 'nextgen-pause';
    this.root.className = 'ng-shell';
    this.root.hidden = true;
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', 'Nextgen game menu');
    const panel = document.createElement('section'); panel.className = 'ng-panel';
    const top = document.createElement('p'); top.className = 'ng-eyebrow'; top.textContent = mode === 'coop' ? 'Private co-op expedition' : 'Solo expedition';
    const title = document.createElement('h2'); title.textContent = 'GAME MENU';
    const message = document.createElement('p'); message.className = 'ng-note';
    message.textContent = mode === 'coop'
      ? 'The server continues to simulate your room while this menu is open. Find a safe spot first.'
      : 'Local gameplay pauses input while this menu is open. Infected continue moving in the scene.';
    const resume = document.createElement('button'); resume.type = 'button'; resume.className = 'ng-button'; resume.textContent = 'RESUME GAME';
    resume.onclick = () => this.resume();
    const qualityLabel = document.createElement('label'); qualityLabel.textContent = 'Graphics quality';
    const quality = document.createElement('select'); quality.id = 'nextgen-in-game-quality';
    for (const option of QUALITY_OPTIONS) {
      const choice = document.createElement('option'); choice.value = option.id; choice.textContent = `${option.label} — ${option.description}`;
      quality.append(choice);
    }
    quality.value = new URLSearchParams(location.search).has('quality')
      ? nextgenQuality(new URLSearchParams(location.search).get('quality'))
      : savedNextgenQuality(window.localStorage);
    qualityLabel.append(quality);
    quality.addEventListener('change', () => {
      const saved = saveNextgenQuality(window.localStorage, quality.value);
      this.setQuality(saved);
    }, { signal });
    const controlsTitle = document.createElement('h3'); controlsTitle.textContent = 'CONTROLS';
    const controlsHint = document.createElement('p'); controlsHint.className = 'ng-note';
    controlsHint.textContent = mode === 'coop'
      ? 'Dodge, jump, revive, extraction and rewards are validated by the room server.'
      : 'Solo has jump, dodge and local loot. Cloud rewards require co-op.';
    const controls = document.createElement('div'); controls.className = 'ng-controls';
    for (const [key, value] of [...NEXTGEN_CONTROLS.shared, ...NEXTGEN_CONTROLS[mode]]) {
      const label = document.createElement('span'); label.className = 'ng-key'; label.textContent = key;
      const content = document.createElement('span'); content.textContent = value;
      controls.append(label, content);
    }
    const back = document.createElement('a'); back.className = 'ng-button ng-secondary'; back.href = '/?nextgen=lobby';
    back.textContent = mode === 'coop' ? 'LEAVE ROOM · MAIN MENU' : 'MAIN MENU';
    panel.append(top, title, message, resume, qualityLabel, controlsTitle, controlsHint, controls, back);
    this.root.append(panel);
    document.body.append(this.toggle, this.root);
    this.toggle.addEventListener('click', () => this.show(), { signal });
    window.addEventListener('keydown', (event) => {
      if (event.code !== 'Escape' || event.repeat || this.disposed) return;
      event.preventDefault();
      if (this.open) this.hide(); else this.show();
    }, { signal, capture: true });
    this.root.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const focusable = [...this.root.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],select')];
      if (!focusable.length) return;
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }, { signal });
  }

  show(): void {
    if (this.disposed || this.open) return;
    this.open = true;
    this.previousFocus.current = document.activeElement;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.root.hidden = false;
    this.toggle.setAttribute('aria-expanded', 'true');
    this.root.querySelector<HTMLButtonElement>('button')?.focus();
  }
  hide(): void {
    if (!this.open) return;
    this.open = false;
    this.root.hidden = true;
    this.toggle.setAttribute('aria-expanded', 'false');
    if (this.previousFocus.current instanceof HTMLElement) this.previousFocus.current.focus();
  }
  private resume(): void {
    this.hide();
    try { void Promise.resolve(this.canvas.requestPointerLock()).catch(() => {}); } catch { /* Browser gesture restriction; click field to play. */ }
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.root.remove();
    this.toggle.remove();
  }
}
