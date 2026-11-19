import { nextgenSpriteRegistry } from './SpritePackRegistry';
import { SPECIES_IDS } from '../../../shared/expansion.mjs';
import { resolveSpriteEntry } from './sprite-pack.mjs';

/** A compact row in the same local appearance list as GLB packs. */
export function drawSpritePackRow(host: HTMLElement, busy: boolean, run: (work: () => Promise<void>) => Promise<void>) {
  const registry = nextgenSpriteRegistry(), manifest = registry.manifest;
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', css = '') => {
    const node = document.createElement(tag); node.textContent = text; node.className = css; return node;
  };
  const row = make('article', '', 'ng-appearance-row'); row.id = 'ng-sprite-pack';
  row.dataset.enabled = String(registry.enabled); row.hidden = !manifest && !registry.error;
  if (!manifest) {
    if (registry.error) {
      row.append(make('p', registry.error, 'ng-note'));
      const remove = make('button','REMOVE BROKEN PACK','ng-button ng-secondary');remove.type='button';remove.disabled=busy;
      remove.onclick=()=>void run(()=>registry.remove());row.append(remove);
    }
    host.append(row); return;
  }
  const usable = SPECIES_IDS.flatMap(species => [0,120,400].map(xp => resolveSpriteEntry(manifest,species,xp))).filter(Boolean).length;
  const main = make('div','','ng-appearance-main'), info=make('div');
  info.append(make('strong',manifest.name),make('p','2.5D · '+usable+'/15 forms · '+(registry.enabled?'ENABLED LOCALLY':'DISABLED'),'ng-note'));
  const enable = make('button',registry.enabled?'DISABLE':'ENABLE','ng-button ng-secondary');enable.type='button';enable.id='ng-sprite-enable';enable.disabled=busy;
  enable.setAttribute('aria-label',registry.enabled?'Disable sprite pack':'Enable sprite pack');
  enable.onclick=()=>void run(()=>registry.setEnabled(!registry.enabled));
  main.append(info,enable);
  const more = make('details','','ng-appearance-more'); more.append(make('summary','Details'));
  more.append(make('p',manifest.author+' · '+manifest.license+' · '+manifest.attribution,'ng-note'));
  const remove=make('button','REMOVE','ng-button ng-secondary');remove.type='button';remove.id='ng-sprite-remove';remove.disabled=busy;
  remove.onclick=()=>void run(()=>registry.remove());more.append(remove);
  row.append(main,more);host.append(row);
}
