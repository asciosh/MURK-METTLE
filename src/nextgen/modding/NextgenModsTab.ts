import { CREATURES } from '../../../shared/expansion.mjs';
import { nextgenModRegistry } from './NextgenModBridge';
import { mountCreatureEvolutionLab } from './CreatureEvolutionLab';
import type { ModPreview } from '../../client/mods/ModPreview';

/** Browser-local cosmetic packs only; no JS mods, server uploads or gameplay overrides. */
export function mountNextgenModsTab(host: HTMLElement): { closePreview(): void } {
  const registry = nextgenModRegistry();
  let preview: ModPreview | null = null;
  let previewGeneration = 0;
  let busy = false;
  const create = <K extends keyof HTMLElementTagNameMap>(tag: K, css = '', text = '') => {
    const node = document.createElement(tag);
    if (css) node.className = css;
    node.textContent = text;
    return node;
  };
  host.append(create('h2', '', 'Creature studio'),
    create('p', 'ng-note', 'Preview evolution rules or manage local creature appearances. Neither changes trusted co-op progression.'));
  const subnav = create('nav', 'ng-subtabs'); subnav.setAttribute('aria-label', 'Creature studio sections');
  const labTab = create('button', 'ng-subtab', 'Evolution Lab'); labTab.type = 'button';
  const packsTab = create('button', 'ng-subtab', 'Appearance Packs'); packsTab.type = 'button';
  labTab.setAttribute('aria-controls', 'nextgen-mod-evolution');
  packsTab.setAttribute('aria-controls', 'nextgen-mod-appearances');
  const labPanel = create('section'); labPanel.id = 'nextgen-mod-evolution';
  const packsPanel = create('section'); packsPanel.id = 'nextgen-mod-appearances';
  packsPanel.append(create('h3', '', 'Local appearance packs'),
    create('p', 'ng-note', 'Import original or properly licensed .mmcosmetic ZIP packs. Current packs affect appearance only; new species and saved evolution are not enabled.'));
  subnav.append(labTab, packsTab);
  host.append(subnav, labPanel, packsPanel);
  const selectSection = (section: 'lab' | 'packs') => {
    labPanel.hidden = section !== 'lab'; packsPanel.hidden = section !== 'packs';
    labTab.setAttribute('aria-selected', String(section === 'lab'));
    packsTab.setAttribute('aria-selected', String(section === 'packs'));
  };
  labTab.onclick = () => selectSection('lab');
  packsTab.onclick = () => selectSection('packs');
  const input = create('input'); input.id = 'nextgen-mod-file'; input.type = 'file'; input.accept = '.mmcosmetic,.zip'; input.hidden = true;
  const install = create('button', 'ng-button', 'IMPORT LOCAL CREATURE PACK'); install.type = 'button'; install.id = 'nextgen-mod-import';
  const demo = create('button', 'ng-button ng-secondary', 'IMPORT ORIGINAL DEMO PACK'); demo.type = 'button'; demo.id = 'nextgen-mod-demo';
  const restore = create('button', 'ng-button ng-secondary', 'RESTORE ORIGINAL APPEARANCES'); restore.type = 'button'; restore.id = 'nextgen-mod-restore';
  const status = create('p', 'ng-status', 'Loading locally installed packs…'); status.id = 'nextgen-mod-status'; status.setAttribute('role', 'status');
  const list = create('div'); list.id = 'nextgen-mod-list';
  const previewHost = create('div'); previewHost.id = 'nextgen-mod-preview';
  const pulse = create('button', 'ng-button ng-secondary', 'TEST PREVIEW PULSE'); pulse.type = 'button'; pulse.hidden = true;
  const toolbar = create('div', 'ng-mod-toolbar'); toolbar.append(install, demo, restore);
  packsPanel.append(input, toolbar, status, list, previewHost, pulse);
  mountCreatureEvolutionLab(labPanel);
  selectSection(new URLSearchParams(location.search).get('view') === 'packs' ? 'packs' : 'lab');

  const closePreview = () => {
    previewGeneration++;
    preview?.dispose(); preview = null;
    previewHost.replaceChildren(); pulse.hidden = true;
  };
  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    busy = true;
    install.disabled = demo.disabled = restore.disabled = true;
    status.textContent = 'Validating local package…';
    try { await work(); }
    catch (err) { status.textContent = (err instanceof Error ? err.message : 'Mod operation failed').slice(0, 260); }
    finally { busy = false; install.disabled = demo.disabled = restore.disabled = false; draw(); }
  };
  const openPreview = async (id: string) => {
    closePreview();
    const generation = previewGeneration;
    const visual = await registry.preview(id);
    if (generation !== previewGeneration) { visual.dispose(); return; }
    try {
      const { ModPreview } = await import('../../client/mods/ModPreview');
      if (generation !== previewGeneration) { visual.dispose(); return; }
      preview = new ModPreview(previewHost, visual);
      pulse.hidden = false;
    } catch (err) { visual.dispose(); throw err; }
  };
  const draw = () => {
    list.replaceChildren();
    if (!registry.records.size) list.append(create('p', 'ng-note', 'No packs installed. Archived originals remain available as a safe fallback.'));
    for (const row of registry.records.values()) {
      const item = create('div', 'ng-card');
      item.append(
        create('strong', '', row.manifest.name),
        create('p', 'ng-note', `${CREATURES[row.manifest.species].name} · ${row.manifest.version} · ${row.enabled ? 'ENABLED LOCALLY' : 'DISABLED'}`),
        create('p', 'ng-note', `${row.manifest.author} · ${row.manifest.license} · ${row.manifest.rights}: ${row.manifest.attribution}`)
      );
      const actions = create('div'); actions.className = 'ng-mod-actions';
      for (const [label, action] of [
        ['PREVIEW', () => openPreview(row.id)],
        [row.enabled ? 'DISABLE' : 'ENABLE', () => row.enabled ? registry.disable(row.id) : registry.enable(row.id)],
        ['REMOVE', async () => { closePreview(); await registry.remove(row.id); }],
      ] as const) {
        const button = create('button', 'ng-button ng-secondary', label); button.type = 'button';
        button.disabled = busy;
        button.onclick = () => void run(async () => {
          await action();
          status.textContent = label === 'ENABLE' ? 'Local appearance enabled in both game modes.' : `${label} completed.`;
        });
        actions.append(button);
      }
      item.append(actions); list.append(item);
    }
  };
  input.addEventListener('change', () => {
    const file = input.files?.[0]; input.value = '';
    if (file) void run(async () => {
      const id = await registry.import(file);
      status.textContent = `Validated and imported: ${id}. Preview, then enable it.`;
    });
  });
  install.onclick = () => input.click();
  demo.onclick = () => void run(async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}mod-examples/copperbloom.mmcosmetic`);
    if (!response.ok) throw Error('The original demo pack is not available.');
    const id = await registry.import(await response.blob());
    status.textContent = `Original demo imported: ${id}. Preview and enable to test.`;
  });
  restore.onclick = () => void run(async () => {
    closePreview(); await registry.restoreOriginals();
    status.textContent = 'All archived original appearances restored on this device.';
  });
  pulse.onclick = () => preview?.pulse();
  registry.subscribe(draw);
  void registry.ready.then(() => { draw(); status.textContent = 'Local cosmetics ready. Gameplay and cloud saves are unchanged.'; }).catch(() => {
    status.textContent = 'Local mod storage unavailable in this browser.';
  });
  return { closePreview };
}
