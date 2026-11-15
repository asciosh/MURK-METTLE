/** Reuse the live HUD panels in a keyboard-accessible journal without duplicating state. */
export class FieldJournal {
  private readonly sheet = document.createElement('section');
  private readonly button = document.querySelector<HTMLButtonElement>('#journal-button');
  private readonly movedPanels: { element: Element; placeholder: Comment }[] = [];
  private active = false;

  constructor(private readonly viewport: HTMLElement) {
    this.sheet.id = 'journal-sheet';
    this.sheet.hidden = true;
    this.sheet.setAttribute('role', 'dialog');
    this.sheet.setAttribute('aria-modal', 'true');
    this.sheet.setAttribute('aria-label', 'Field journal and map');
    this.sheet.innerHTML = '<button type="button" id="journal-close">CLOSE JOURNAL</button><div class="journal-content"></div>';
    viewport.append(this.sheet);
    this.button?.addEventListener('click', this.toggle);
    this.sheet.querySelector('button')!.addEventListener('click', this.close);
    document.addEventListener('keydown', this.onKey);
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) this.close();
  }

  private readonly onKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') this.close();
    if (event.code !== 'KeyJ' || event.repeat || !this.active) return;
    if ((event.target as Element)?.closest('input,textarea,select,summary,[contenteditable]')) return;
    if (document.querySelector('#mods-dialog[open],#account-panel:not([hidden]),#inventory-panel.visible,#field-menu:not([hidden])')) return;
    event.preventDefault();
    this.toggle();
  };

  private readonly toggle = (): void => {
    if (!this.active) return;
    if (!this.sheet.hidden) { this.close(); return; }
    if (document.pointerLockElement) document.exitPointerLock();
    document.querySelector<HTMLButtonElement>('#inventory-close')?.click();
    const menu = document.querySelector<HTMLElement>('#field-menu');
    if (menu) menu.hidden = true;
    document.querySelector('#field-menu-toggle')?.setAttribute('aria-expanded', 'false');
    document.dispatchEvent(new Event('field-overlay-open'));
    for (const selector of ['.creature-panel', '.progress-panel', '.mission-panel', '.minimap-panel']) {
      const element = this.viewport.querySelector(selector);
      if (!element) continue;
      const placeholder = document.createComment('journal panel');
      element.replaceWith(placeholder);
      this.movedPanels.push({ element, placeholder });
      this.sheet.querySelector('.journal-content')!.append(element);
    }
    this.sheet.hidden = false;
    this.button?.setAttribute('aria-expanded', 'true');
    this.sheet.querySelector<HTMLButtonElement>('button')!.focus();
  };

  private readonly close = (): void => {
    const wasOpen = !this.sheet.hidden;
    for (const { element, placeholder } of this.movedPanels) placeholder.replaceWith(element);
    this.movedPanels.length = 0;
    this.sheet.hidden = true;
    this.button?.setAttribute('aria-expanded', 'false');
    if (wasOpen) this.button?.focus();
  };

  dispose(): void {
    this.close();
    this.button?.removeEventListener('click', this.toggle);
    this.sheet.querySelector('button')?.removeEventListener('click', this.close);
    document.removeEventListener('keydown', this.onKey);
    this.sheet.remove();
  }
}
