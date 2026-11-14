// Desktop-only presentation. No Tauri API, account data, gameplay or transport interception.
(() => {
  const attach = () => {
    const banner = document.createElement('div');
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.style.cssText = 'position:fixed;z-index:20000;top:0;left:0;right:0;padding:10px 18px;background:#392a1b;color:#fff0d1;font:14px/1.5 system-ui;text-align:center;pointer-events:none';
    banner.hidden = true;
    document.body.append(banner);
    let wasOffline = false;
    const offline = () => {
      wasOffline = true;
      banner.textContent = 'Offline — room and cloud saving are unavailable. Restore your connection; Game → Connection & help has recovery steps.';
      banner.hidden = false;
    };
    window.addEventListener('offline', offline);
    window.addEventListener('online', () => {
      if (!wasOffline) return;
      banner.textContent = 'Network available again. Rejoin your room. If cloud saving paused, check Account and reload after resolving the error.';
      setTimeout(() => { if (navigator.onLine) banner.hidden = true; }, 12000);
    });
    if (!navigator.onLine) offline();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', attach, { once: true });
  else attach();
})();
