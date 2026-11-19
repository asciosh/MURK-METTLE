import { nextgenSpriteRegistry } from './SpritePackRegistry';
import { SPECIES_IDS } from '../../../shared/expansion.mjs';
import { resolveSpriteEntry } from './sprite-pack.mjs';

export function mountSpritePackPanel(host: HTMLElement) {
  const registry = nextgenSpriteRegistry();
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', css = '') => {
    const node = document.createElement(tag); node.textContent = text; node.className = css; return node;
  };
  const section = make('section'); section.id = 'ng-sprite-pack';
  const file = make('input'); file.type = 'file'; file.accept = '.mmcreatures,.zip'; file.hidden = true;
  const status = make('p', 'Checking sprite-pack storage…', 'ng-status'); status.setAttribute('role', 'status'); status.id = 'ng-sprite-status';
  const summary = make('p', '', 'ng-note'); summary.id = 'ng-sprite-summary';
  const toolbar = make('div', '', 'ng-mod-toolbar');
  const button = (label: string, id: string) => { const node = make('button', label, 'ng-button ng-secondary'); node.type = 'button'; node.id = id; toolbar.append(node); return node; };
  const install = button('IMPORT SPRITE PACK', 'ng-sprite-import');
  const demo = button('IMPORT ORIGINAL SPRITE DEMO', 'ng-sprite-demo');
  const enable = button('ENABLE SPRITE PACK', 'ng-sprite-enable');
  const remove = button('REMOVE SPRITE PACK', 'ng-sprite-remove');
  section.append(make('h3', 'Multi-creature 2.5D sprite packs'),
    make('p', 'One local pack, up to 128 appearance keys. Import another to replace this sprite pack; existing GLB packs stay installed. Only original or properly licensed assets are allowed.', 'ng-note'),
    file, toolbar, summary, status);
  host.append(section);
  let busy = true;
  const draw = () => {
    const manifest = registry.manifest;
    const usable = manifest ? SPECIES_IDS.flatMap(species => [0, 120, 400].map(xp => resolveSpriteEntry(manifest, species, xp))).filter(Boolean).length : 0;
    summary.textContent = manifest ? `${manifest.name} · ${manifest.entries.length} appearance entries · ${usable}/15 current official form slots covered · ${manifest.author} · ${manifest.license} · ${manifest.attribution}` : 'No sprite pack installed. Original creatures / GLB cosmetics remain available.';
    enable.textContent = registry.enabled ? 'DISABLE SPRITE PACK' : 'ENABLE SPRITE PACK';
    install.disabled = demo.disabled = busy;
    enable.disabled = busy || !manifest; remove.disabled = busy || (!manifest && !registry.error);
    section.dataset.enabled = String(registry.enabled);
  };
  const run = async (work: () => Promise<void>, success: string) => {
    if (busy) return; busy = true; draw(); status.textContent = 'Validating / saving local pack…';
    try { await work(); status.textContent = success; } catch (error) { status.textContent = error instanceof Error ? error.message : 'Sprite pack unavailable'; }
    finally { busy = false; draw(); }
  };
  install.onclick = () => file.click();
  file.onchange = () => { const zip = file.files?.[0]; file.value = ''; if (zip) void run(() => registry.install(zip), 'Sprite pack imported. Enable it to use local appearances.'); };
  demo.onclick = () => void run(async () => {
    const response = await fetch(`${import.meta.env.BASE_URL}mod-examples/nextgen-sprite-demo.mmcreatures`);
    if (!response.ok) throw Error('Original sprite demo unavailable');
    await registry.install(await response.blob());
  }, 'Original sprite demo imported. Enable it to use local appearances.');
  enable.onclick = () => { const next = !registry.enabled; void run(() => registry.setEnabled(next), next ? 'Sprite appearances enabled locally.' : 'Sprite appearances disabled.'); };
  remove.onclick = () => void run(() => registry.remove(), 'Sprite pack removed.');
  registry.subscribe(draw); draw();
  void registry.ready.then(() => { busy = false; draw(); status.textContent = registry.error || 'Sprite pack storage ready.'; });
}
