/** Presentation and focus behavior only; account and room APIs retain their existing handlers. */
export function initInterface(): void {
  const gate = document.querySelector<HTMLElement>('#auth-gate')!;
  const account = document.querySelector<HTMLElement>('#account-panel')!;
  const menu = document.querySelector<HTMLElement>('#field-menu')!;
  const toggle = document.querySelector<HTMLElement>('#field-menu-toggle')!;
  let previous = '';
  const activePanel = () =>
    [
      '#account-panel:not([hidden])',
      '#touch-journal-sheet:not([hidden])',
      '#inventory-panel.visible',
      '#field-menu:not([hidden])',
      '#title-screen:not(.is-hidden)',
    ]
      .map((selector) => document.querySelector<HTMLElement>(selector))
      .find(Boolean);
  const refresh = () => {
    document.body.classList.toggle('signed-out', !gate.hidden);
    const open = activePanel();
    const key = open?.id || '';
    if (key !== previous && open) {
      document.dispatchEvent(new Event('field-overlay-open'));
      if (document.pointerLockElement) document.exitPointerLock();
      if (open.id === 'title-screen') open.querySelector<HTMLElement>('#enter-field')?.focus();
      if (open === menu) menu.querySelector<HTMLElement>('input,button')?.focus();
      if (open === account && gate.hidden) {
        menu.hidden = true;
        toggle.setAttribute('aria-expanded', 'false');
        if (document.querySelector('#inventory-panel.visible'))
          document.querySelector<HTMLButtonElement>('#inventory-close')?.click();
        if (document.querySelector('#touch-journal-sheet:not([hidden])'))
          document.querySelector<HTMLButtonElement>('#touch-journal-close')?.click();
      }
      if (open === account) account.querySelector<HTMLElement>('input:not(:disabled),button')?.focus();
    }
    previous = key;
  };
  new MutationObserver(refresh).observe(document.querySelector('#app')!, {
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'class'],
  });
  refresh();
  document.addEventListener('keydown', (e) => {
    const panel = activePanel();
    if (!panel) return;
    if (e.key === 'Enter' && panel === account && (e.target as Element)?.matches('#account-pin,#account-username')) {
      e.preventDefault();
      document.querySelector<HTMLButtonElement>('#account-login')?.click();
    }
    if (e.key === 'Tab') {
      const nodes = [
        ...panel.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select,summary'),
      ].filter((n) => n.getClientRects().length);
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
    if (e.key === 'Escape' && panel === account && gate.hidden) {
      account.hidden = true;
      toggle.focus();
    }
  });
}
