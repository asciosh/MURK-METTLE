import { readLocalMovePack, importLocalMovePack, saveLocalMovePack, clearLocalMovePack } from './LocalMoveStore';
export function mountLocalMovePanel(host:HTMLElement):void {
  const panel=document.createElement('section');panel.id='nextgen-local-moves';panel.className='ng-appearance-advanced';
  const title=document.createElement('h3');title.textContent='Creature moves · solo';
  const note=document.createElement('p');note.className='ng-note';note.textContent='Optional local gameplay pack (.mmmoves). Matches the installed 3D appearance ID. Keys 5–8 use equipped moves; C toggles automatic slot 1. Co-op still uses verified room abilities.';
  const input=document.createElement('input');input.type='file';input.accept='.mmmoves,.json';input.hidden=true;input.id='nextgen-moves-file';
  const button=(label:string)=>{const b=document.createElement('button');b.type='button';b.className='ng-button ng-secondary';b.textContent=label;return b;};
  const load=button('IMPORT MOVE PACK'),clear=button('REMOVE MOVE PACK');load.id='nextgen-moves-import';clear.id='nextgen-moves-remove';
  const bar=document.createElement('div');bar.className='ng-mod-actions';bar.append(load,clear);
  const status=document.createElement('p');status.setAttribute('role','status');status.className='ng-status';
  const list=document.createElement('div');let pack=readLocalMovePack();
  const draw=()=>{
    list.replaceChildren();clear.disabled=!pack;
    for(const p of pack?.profiles??[]){
      const heading=document.createElement('strong');heading.textContent=p.name+' · '+p.appearanceId;list.append(heading);
      const summary=document.createElement('p');summary.className='ng-note';summary.textContent='Equipped: '+p.equipped.map((id,i)=>`${i+5}: ${p.moves.find(m=>m.id===id)?.name}`).join(' · ');list.append(summary);
      for(const m of p.moves){
        const row=document.createElement('label');row.style.cssText='display:flex;gap:8px;align-items:center;margin:5px 0';
        const check=document.createElement('input');check.type='checkbox';check.checked=p.equipped.includes(m.id);check.disabled=check.checked?p.equipped.length===1:p.equipped.length===4;
        const text=document.createElement('span');text.textContent=`${m.name} · ${m.type} · ${m.cooldownMs/1000}s`;
        check.onchange=()=>{if(!pack)return;const previous=[...p.equipped];p.equipped=check.checked?[...p.equipped,m.id]:p.equipped.filter(id=>id!==m.id);try{saveLocalMovePack(pack);status.textContent='Loadout saved locally.';}catch(e){p.equipped=previous;status.textContent=String(e);}draw();};row.append(check,text);list.append(row);
      }
    }
    if(!pack)list.textContent='No custom moves installed. Original abilities remain active.';
  };
  load.onclick=()=>input.click();clear.onclick=()=>{try{clearLocalMovePack();pack=null;status.textContent='Local move pack removed.';draw();}catch(e){status.textContent=String(e);}};
  input.onchange=async()=>{const file=input.files?.[0];input.value='';if(!file)return;load.disabled=true;try{pack=await importLocalMovePack(file);status.textContent='Move pack installed locally.';draw();}catch(e){status.textContent=String(e).slice(0,250);}finally{load.disabled=false;}};
  panel.append(title,note,input,bar,status,list);host.append(panel);draw();
}
