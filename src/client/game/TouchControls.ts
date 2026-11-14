import { InputController, type TouchAction } from './InputController';
import { joystickAxes } from '../../../shared/touch-rules.mjs';

/** Captured pointer IDs keep movement, looking and firing independent on a phone. */
export class TouchControls {
  readonly root = document.createElement('section');
  private readonly sheet = document.createElement('section');
  private readonly media = window.matchMedia('(pointer: coarse)');
  private readonly selection = document.querySelector<HTMLSelectElement>('#control-mode');
  private readonly stick: HTMLElement;
  private readonly knob: HTMLElement;
  private stickId: number | null = null;
  private lookId: number | null = null;
  private lookX = 0;
  private lookY = 0;
  private readonly held = new Map<number, { action: TouchAction; element: HTMLElement; x: number; y: number }>();
  private readonly toggled = new Set<TouchAction>();
  private readonly movedPanels: { element: Element; placeholder: Comment }[] = [];
  private active = false;
  enabled = false;
  constructor(
    private readonly viewport: HTMLElement,
    private readonly canvas: HTMLElement,
    private readonly input: InputController,
  ) {
    this.root.id = 'touch-controls';
    this.root.setAttribute('aria-label', 'Touch game controls');
    this.root.innerHTML = `<div class="touch-context"><small id="touch-encounter"></small><strong id="touch-navigation"></strong></div><div id="touch-stick" aria-label="Movement joystick"><span class="touch-stick-label">MOVE</span><i class="touch-knob"></i></div>
    <div class="touch-main"><button type="button" data-touch="fire" class="touch-fire" aria-label="Fire and drag to aim">FIRE</button><button type="button" data-touch="aim" aria-pressed="false">AIM</button></div>
    <button type="button" data-touch="sprint" class="touch-run" aria-pressed="false">RUN</button>
    <div class="touch-tools"><button type="button" data-touch="swap">WEAPON</button><button type="button" data-touch="reload">RELOAD</button><button type="button" data-touch="heal">HEAL</button></div>
    <div class="touch-utility"><button type="button" data-touch="interact">USE</button><button type="button" data-touch="pulse">PULSE</button><button type="button" data-touch="melee">MELEE</button></div>
    <button type="button" id="touch-journal" class="touch-journal" aria-expanded="false">JOURNAL</button>`;
    this.stick = this.root.querySelector('#touch-stick')!;
    this.knob = this.root.querySelector('.touch-knob')!;
    this.sheet.id = 'touch-journal-sheet';
    this.sheet.hidden = true;
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-modal', 'true');
    this.sheet.setAttribute('aria-label', 'Field journal and map');
    this.sheet.innerHTML =
      '<button type="button" id="touch-journal-close">CLOSE JOURNAL</button><div class="touch-sheet-content"></div>';
    viewport.append(this.root, this.sheet);
    this.root.addEventListener('pointerdown', this.onDown);
    this.root.addEventListener('pointermove', this.onMove);
    this.root.addEventListener('pointerup', this.onUp);
    this.root.addEventListener('pointercancel', this.onUp);
    this.root.addEventListener('lostpointercapture', this.onUp);
    canvas.addEventListener('pointerdown', this.onLookDown);
    canvas.addEventListener('pointermove', this.onLookMove);
    canvas.addEventListener('pointerup', this.onLookUp);
    canvas.addEventListener('pointercancel', this.onLookUp);
    canvas.addEventListener('lostpointercapture', this.onLookUp);
    this.root.querySelector('#touch-journal')!.addEventListener('click', this.toggleJournal);
    this.sheet.querySelector('button')!.addEventListener('click', this.closeJournal);
    this.selection?.addEventListener('change', this.configure);
    this.media.addEventListener('change', this.configure);
    window.addEventListener('blur', this.reset);
    window.addEventListener('resize', this.reset);
    document.addEventListener('visibilitychange', this.visibility);
    document.addEventListener('pointerdown', this.onOverlay, true);
    document.addEventListener('keydown', this.onKey);
    this.configure();
  }
  private readonly configure = (): void => {
    const choice = this.selection?.value || 'auto';
    this.enabled = choice === 'touch' || (choice === 'auto' && this.media.matches && navigator.maxTouchPoints > 0);
    this.input.touchEnabled = this.enabled;
    document.body.classList.toggle('touch-mode', this.enabled);
    this.root.hidden = !this.enabled || !this.active;
    this.reset();
    if (!this.enabled) this.closeJournal();
    if (this.enabled && document.pointerLockElement) document.exitPointerLock();
  };
  setActive(value: boolean): void {
    this.active = value;
    this.root.hidden = !this.enabled || !value;
    if (!value) this.reset();
  }
  private blocked(): boolean {
    return (
      !this.enabled ||
      !this.active ||
      !this.sheet.hidden ||
      !!document.querySelector('#field-menu:not([hidden]),#account-panel:not([hidden]),#inventory-panel.visible')
    );
  }
  private readonly onDown = (e: PointerEvent): void => {
    if (this.blocked()) return;
    const target = e.target as Element;
    if (target.closest('#touch-journal')) return;
    const stick = target.closest('#touch-stick'),
      button = target.closest<HTMLElement>('[data-touch]');
    if (!stick && !button) return;
    if (button instanceof HTMLButtonElement && button.disabled) return;
    e.preventDefault();
    (stick || button)!.setPointerCapture(e.pointerId);
    if (stick) {
      if (this.stickId !== null) return;
      this.stickId = e.pointerId;
      this.updateStick(e);
      return;
    }
    const action = button!.dataset.touch as TouchAction;
    if (action === 'aim' || action === 'sprint') {
      const enabled = !this.toggled.has(action);
      enabled ? this.toggled.add(action) : this.toggled.delete(action);
      this.input.setTouchAction(action, enabled);
      button!.setAttribute('aria-pressed', String(enabled));
      return;
    }
    this.held.set(e.pointerId, { action, element: button!, x: e.clientX, y: e.clientY });
    button!.classList.add('held');
    this.input.setTouchAction(action, true);
  };
  private updateStick(e: PointerEvent): void {
    const rect = this.stick.getBoundingClientRect(),
      dx = e.clientX - rect.left - rect.width / 2,
      dy = e.clientY - rect.top - rect.height / 2,
      radius = rect.width * 0.36;
    this.input.setTouchMovement(joystickAxes(dx, dy, radius));
    const scale = Math.min(1, radius / Math.max(1, Math.hypot(dx, dy)));
    this.knob.style.transform = `translate(${dx * scale}px,${dy * scale}px)`;
  }
  private readonly onMove = (e: PointerEvent): void => {
    if (e.pointerId === this.stickId) {
      e.preventDefault();
      this.updateStick(e);
    }
    const held = this.held.get(e.pointerId);
    if (held?.action === 'fire') {
      e.preventDefault();
      this.input.addTouchLook(e.clientX - held.x, e.clientY - held.y);
      held.x = e.clientX;
      held.y = e.clientY;
    }
  };
  private readonly onUp = (e: PointerEvent): void => {
    if (e.pointerId === this.stickId) {
      this.stickId = null;
      this.input.setTouchMovement({ right: 0, forward: 0 });
      this.knob.style.transform = '';
    }
    const held = this.held.get(e.pointerId);
    if (held) {
      this.held.delete(e.pointerId);
      held.element.classList.remove('held');
      if (![...this.held.values()].some((v) => v.action === held.action)) this.input.setTouchAction(held.action, false);
    }
  };
  private readonly onLookDown = (e: PointerEvent): void => {
    if (this.blocked() || this.lookId !== null) return;
    e.preventDefault();
    this.lookId = e.pointerId;
    this.lookX = e.clientX;
    this.lookY = e.clientY;
    this.canvas.setPointerCapture(e.pointerId);
  };
  private readonly onLookMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.lookId) return;
    e.preventDefault();
    this.input.addTouchLook(e.clientX - this.lookX, e.clientY - this.lookY);
    this.lookX = e.clientX;
    this.lookY = e.clientY;
  };
  private readonly onLookUp = (e: PointerEvent): void => {
    if (e.pointerId === this.lookId) this.lookId = null;
  };
  private readonly onOverlay = (e: PointerEvent): void => {
    if (
      (e.target as Element)?.closest?.(
        '#field-menu-toggle,#field-menu,#account-toggle,#inventory-button,#touch-journal',
      )
    )
      this.reset();
  };
  private readonly visibility = (): void => {
    if (document.hidden) this.reset();
  };
  private readonly onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.closeJournal();
  };
  private readonly reset = (): void => {
    this.stickId = null;
    this.lookId = null;
    this.held.clear();
    this.toggled.clear();
    this.input.clearHeld();
    this.knob.style.transform = '';
    this.root.querySelectorAll('.held').forEach((e) => e.classList.remove('held'));
    this.root.querySelectorAll('[aria-pressed]').forEach((e) => e.setAttribute('aria-pressed', 'false'));
  };
  private readonly toggleJournal = (): void => {
    if (!this.sheet.hidden) {
      this.closeJournal();
      return;
    }
    this.reset();
    for (const selector of ['.creature-panel', '.progress-panel', '.mission-panel', '.minimap-panel']) {
      const element = this.viewport.querySelector(selector);
      if (!element) continue;
      const placeholder = document.createComment('journal panel');
      element.replaceWith(placeholder);
      this.movedPanels.push({ element, placeholder });
      this.sheet.querySelector('.touch-sheet-content')!.append(element);
    }
    this.sheet.hidden = false;
    document.body.classList.add('touch-journal-open');
    this.root.querySelector('#touch-journal')?.setAttribute('aria-expanded', 'true');
    (this.sheet.querySelector('button') as HTMLElement).focus();
  };
  private readonly closeJournal = (): void => {
    for (const { element, placeholder } of this.movedPanels) placeholder.replaceWith(element);
    this.movedPanels.length = 0;
    this.sheet.hidden = true;
    document.body.classList.remove('touch-journal-open');
    this.root.querySelector('#touch-journal')?.setAttribute('aria-expanded', 'false');
  };
  dispose(): void {
    this.reset();
    this.closeJournal();
    this.selection?.removeEventListener('change', this.configure);
    this.media.removeEventListener('change', this.configure);
    window.removeEventListener('blur', this.reset);
    window.removeEventListener('resize', this.reset);
    document.removeEventListener('visibilitychange', this.visibility);
    document.removeEventListener('pointerdown', this.onOverlay, true);
    document.removeEventListener('keydown', this.onKey);
    this.canvas.removeEventListener('pointerdown', this.onLookDown);
    this.canvas.removeEventListener('pointermove', this.onLookMove);
    this.canvas.removeEventListener('pointerup', this.onLookUp);
    this.canvas.removeEventListener('pointercancel', this.onLookUp);
    this.canvas.removeEventListener('lostpointercapture', this.onLookUp);
    this.root.remove();
    this.sheet.remove();
    document.body.classList.remove('touch-mode');
  }
}
