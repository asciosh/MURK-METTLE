import { CREATURES } from '../../../shared/expansion.mjs';
import { nextgenModRegistry } from './NextgenModBridge';
import { mountCreatureEvolutionLab } from './CreatureEvolutionLab';
import type { ModPreview } from '../../client/mods/ModPreview';
import { validateImport } from '../../client/mods/ValidateImport';
import { drawSpritePackRow } from './SpritePackPanel';
import { nextgenSpriteRegistry } from './SpritePackRegistry';

/** One local appearance library, independent of playable species and trusted progress. */
export function mountNextgenModsTab(host: HTMLElement): { closePreview(): void } {
  const registry = nextgenModRegistry(), sprites = nextgenSpriteRegistry();
  let preview: ModPreview | null = null, previewGeneration = 0, busy = true;
  const create = <K extends keyof HTMLElementTagNameMap>(tag: K, css = '', text = '') => {
    const node = document.createElement(tag); if (css) node.className = css; node.textContent = text; return node;
  };
  const button = (label:string,id='',primary=false) => {const b=create('button',primary?'ng-button':'ng-button ng-secondary',label);b.type='button';if(id)b.id=id;return b;};
  host.append(create('h2','','Creature appearances'),create('p','ng-note','Local visuals only. Your collection and combat stay unchanged.'));
  const packsPanel=create('section');packsPanel.id='nextgen-mod-appearances';
  const input=create('input');input.id='nextgen-mod-file';input.type='file';input.accept='.mmcosmetic,.mmcreatures,.zip';input.multiple=true;input.hidden=true;
  const install=button('IMPORT & ENABLE PACKS','nextgen-mod-import',true);
  const restore=button('USE ORIGINALS','nextgen-mod-restore');
  const toolbar=create('div','ng-appearance-toolbar');toolbar.append(install,restore);
  const summary=create('p','ng-appearance-summary');summary.id='nextgen-mod-summary';
  const status=create('p','ng-status');status.id='nextgen-mod-status';status.setAttribute('role','status');status.hidden=true;
  const list=create('div');list.id='nextgen-mod-list';
  const previewHost=create('div');previewHost.id='nextgen-mod-preview';previewHost.hidden=true;
  const previewActions=create('div','ng-mod-actions');previewActions.hidden=true;
  const pulse=button('TEST PULSE','nextgen-mod-pulse'), close=button('CLOSE PREVIEW','nextgen-mod-close-preview');previewActions.append(pulse,close);
  const advanced=create('details','ng-appearance-advanced');advanced.id='nextgen-mod-advanced';advanced.append(create('summary','','Advanced tools'));
  const demo=button('IMPORT 3D DEMO','nextgen-mod-demo'), spriteDemo=button('IMPORT SPRITE DEMO','ng-sprite-demo');
  const demos=create('div','ng-mod-actions');demos.append(demo,spriteDemo);
  const labPanel=create('details','ng-appearance-more');labPanel.id='nextgen-mod-evolution';labPanel.append(create('summary','','Evolution Lab'));
  const labBody=create('div');labPanel.append(labBody);mountCreatureEvolutionLab(labBody);
  advanced.append(create('p','ng-note','Optional test assets and rule previews. Import only original or appropriately licensed art.'),demos,labPanel);
  packsPanel.append(input,toolbar,summary,status,list,previewHost,previewActions,advanced);host.append(packsPanel);
  if(new URLSearchParams(location.search).get('view')==='lab'){advanced.open=true;labPanel.open=true;}

  const message=(value:string)=>{status.textContent=value;status.hidden=!value;};
  const closePreview=()=>{previewGeneration++;preview?.dispose();preview=null;previewHost.replaceChildren();previewHost.hidden=true;previewActions.hidden=true;};
  const openPreview=async(id:string)=>{
    closePreview();const generation=previewGeneration;const visual=await registry.preview(id);
    if(generation!==previewGeneration){visual.dispose();return;}
    try{const {ModPreview}=await import('../../client/mods/ModPreview');if(generation!==previewGeneration){visual.dispose();return;}
      previewHost.hidden=false;preview=new ModPreview(previewHost,visual);previewActions.hidden=false;previewHost.scrollIntoView({block:'nearest'});
    }catch(err){visual.dispose();closePreview();throw err;}
  };
  const draw=()=>{
    const opened=new Set([...list.querySelectorAll<HTMLDetailsElement>('details[open]')].map(d=>d.parentElement?.dataset.modId??d.parentElement?.id));
    const inactiveWasOpen=list.querySelector<HTMLDetailsElement>('#nextgen-mod-inactive')?.open??false;
    list.replaceChildren();
    const rows=[...registry.records.values()].sort((a,b)=>Number(b.enabled)-Number(a.enabled)||a.manifest.species.localeCompare(b.manifest.species)||(a.manifest.form??0)-(b.manifest.form??0));
    const enabled=rows.filter(r=>r.enabled).length + Number(sprites.enabled);
    const inactiveCount=rows.filter(r=>!r.enabled).length+Number(!!sprites.manifest&&!sprites.enabled);
    const inactive=create('details','ng-appearance-advanced');inactive.id='nextgen-mod-inactive';inactive.open=enabled===0||inactiveWasOpen;
    inactive.append(create('summary','','Disabled packs ('+inactiveCount+')'));
    summary.textContent=busy&&rows.length===0&&!sprites.manifest?'Loading local appearances…':enabled?enabled+' active '+(enabled===1?'pack':'packs')+(sprites.enabled?' · Sprite overrides take priority':''):'Original 3D appearances active';
    install.disabled=restore.disabled=demo.disabled=spriteDemo.disabled=busy;
    if(!rows.length&&!sprites.manifest&&!sprites.error)list.append(create('p','ng-note','No packs installed. Select one or several .mmcosmetic or .mmcreatures files.'));
    for(const row of rows){
      const item=create('article','ng-appearance-row');item.dataset.modId=row.id;item.dataset.enabled=String(row.enabled);
      const main=create('div','ng-appearance-main'), info=create('div');
      const form=row.manifest.form?CREATURES[row.manifest.species].forms[row.manifest.form-1]:CREATURES[row.manifest.species].name+' (all forms)';
      info.append(create('strong','',form),create('p','ng-note',row.manifest.name+' · 3D · '+(row.enabled?'ENABLED LOCALLY':'DISABLED')));
      const toggle=button(row.enabled?'DISABLE':'ENABLE');toggle.disabled=busy;
      toggle.onclick=()=>void run(async()=>{if(row.enabled)await registry.disable(row.id);else await registry.enable(row.id);message(row.enabled?'Appearance disabled.':'Appearance enabled.');});
      main.append(info,toggle);
      const more=create('details','ng-appearance-more');more.open=opened.has(row.id);more.append(create('summary','','Details'));
      more.append(create('p','ng-note',row.manifest.author+' · '+row.manifest.license+' · '+row.manifest.attribution));
      if(registry.errors.has(row.id))more.append(create('p','ng-note',registry.errors.get(row.id)));
      const actions=create('div','ng-mod-actions');for(const [label,action] of [['PREVIEW',()=>openPreview(row.id)],['REMOVE',async()=>{closePreview();await registry.remove(row.id);message('Pack removed.');}]] as const){
        const b=button(label);b.disabled=busy;b.onclick=()=>void run(action);actions.append(b);
      }more.append(actions);item.append(main,more);(row.enabled?list:inactive).append(item);
    }
    drawSpritePackRow(sprites.manifest&&!sprites.enabled?inactive:list,busy,run);
    if(inactiveCount)list.append(inactive);
    const spriteMore=list.querySelector<HTMLDetailsElement>('#ng-sprite-pack details');if(spriteMore)spriteMore.open=opened.has('ng-sprite-pack');
  };
  async function run(work:()=>Promise<void>){if(busy)return;busy=true;draw();message('Working…');try{await work();if(status.textContent==='Working…')message('Done.');}catch(err){message((err instanceof Error?err.message:'Local pack operation failed').slice(0,300));}finally{busy=false;draw();}}
  const importDemo=async(url:string,kind:'glb'|'sprite')=>{const response=await fetch(import.meta.env.BASE_URL+'mod-examples/'+url);if(!response.ok)throw Error('Demo unavailable');const blob=await response.blob();if(kind==='sprite')await sprites.install(blob);else await registry.import(blob);const inactive=list.querySelector<HTMLDetailsElement>('#nextgen-mod-inactive');if(inactive)inactive.open=true;message('Demo imported. Enable it in the list to test.');};
  // Raw .zip packages remain supported with the same worker validation.
  const classify=async(file:File):Promise<'glb'|'sprite'>=>{
    const name=file.name.toLowerCase();if(name.endsWith('.mmcosmetic'))return 'glb';if(name.endsWith('.mmcreatures'))return 'sprite';
    if(!name.endsWith('.zip'))throw Error('Use .mmcosmetic, .mmcreatures or a valid pack ZIP.');
    try{await validateImport(file);return 'glb';}catch{return 'sprite';}
  };
  input.onchange=()=>{const files=Array.from(input.files??[]);input.value='';if(!files.length)return;void run(async()=>{
    if(files.length>9)throw Error('Select at most eight 3D packs and one sprite pack.');
    const kinds=await Promise.all(files.map(classify));if(kinds.filter(k=>k==='sprite').length>1)throw Error('Choose just one sprite pack per import. Extract a collection ZIP first.');
    let count=0;const errors:string[]=[];
    for(let i=0;i<files.length;i++){const file=files[i];try{if(kinds[i]==='sprite'){await sprites.install(file);await sprites.setEnabled(true);}else{const id=await registry.import(file);await registry.enable(id);}count++;}catch(err){errors.push(file.name+': '+(err instanceof Error?err.message:'Import failed'));}}
    message(count+'/'+files.length+' packs imported and enabled.'+(errors.length?' '+errors.join(' | ').slice(0,600):''));
  });};
  install.onclick=()=>input.click();demo.onclick=()=>void run(()=>importDemo('copperbloom.mmcosmetic','glb'));spriteDemo.onclick=()=>void run(()=>importDemo('nextgen-sprite-demo.mmcreatures','sprite'));
  restore.onclick=()=>void run(async()=>{closePreview();await registry.restoreOriginals();await sprites.setEnabled(false);message('Original appearances restored.');});
  pulse.onclick=()=>preview?.pulse();close.onclick=closePreview;
  registry.subscribe(draw);sprites.subscribe(draw);draw();
  void Promise.all([registry.ready,sprites.ready]).then(()=>{busy=false;draw();if(registry.errors.size||sprites.error)message('Some local packs could not be restored. Check pack details.');}).catch(()=>{busy=false;draw();message('Local storage unavailable.');});
  return {closePreview};
}
