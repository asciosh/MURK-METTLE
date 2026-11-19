import * as THREE from 'three/webgpu';
import { roomToScene } from './RoomIntent';
import type { SquadView } from './RoomSquadState.mjs';
import type { FieldTarget } from './RoomFieldRules';

/** Screen-space teammate labels. All health/revive states come from room snapshots. */
export class RoomSquadOverlay {
  private readonly root = document.createElement('div');
  private readonly labels = new Map<string, HTMLDivElement>();
  private readonly fieldLabels = new Map<string, HTMLDivElement>();
  private readonly point = new THREE.Vector3();

  constructor() {
    this.root.className = 'nextgen-squad-nameplates';
    this.root.style.cssText = 'position:fixed;inset:0;z-index:95;pointer-events:none;font:12px Arial,sans-serif;color:white;overflow:hidden';
    document.body.append(this.root);
  }

  update(peers: readonly SquadView[], camera: THREE.Camera, field: readonly FieldTarget[] = [], self: { x: number; z: number } | null = null): void {
    camera.updateMatrixWorld();
    const keep = new Set(peers.map(p => p.id));
    for (const [id, label] of this.labels) if (!keep.has(id)) { label.remove(); this.labels.delete(id); }
    for (const p of peers) {
      let label = this.labels.get(p.id);
      if (!label) {
        label = document.createElement('div');
        label.className = 'nextgen-ally-label';
        label.style.cssText = 'position:absolute;transform:translate(-50%,-100%);min-width:110px;text-align:center;border:1px solid #658b72;border-radius:5px;background:#101b17d9;padding:5px 9px;box-shadow:0 2px 10px #0008;white-space:nowrap';
        this.root.append(label); this.labels.set(p.id, label);
      }
      const [x,y,z] = roomToScene(p.x,p.z,true);
      this.point.set(x,y+2.3,z).project(camera);
      const visible = this.point.z >= -1 && this.point.z <= 1 && Math.abs(this.point.x) < .95 && Math.abs(this.point.y) < .91;
      label.style.display = visible ? 'block' : 'none';
      if (!visible) continue;
      label.style.left = `${(this.point.x + 1) * 50}%`;
      label.style.top = `${(1 - this.point.y) * 50}%`;
      label.textContent = p.downed ? `${p.label} · REVIVE ${p.downedSeconds}s${p.receivingRevive?' · HELP COMING':''}` : p.eliminated ? `${p.label} · OUT` : `${p.label} · ${Math.ceil(p.hp)} HP${p.reviving?' · REVIVING':''}`;
      label.style.borderColor = p.downed ? '#f4aa61' : p.eliminated ? '#e56d6d' : '#658b72';
      label.style.color = p.hp <= 0 ? '#ffbd8e' : '#e7f4dc';
    }
    const nearby=self?field.filter(t=>Math.hypot(t.x-self.x,t.z-self.z)<16).sort((a,b)=>Math.hypot(a.x-self.x,a.z-self.z)-Math.hypot(b.x-self.x,b.z-self.z)).slice(0,5):[];
    const visibleFields=new Set(nearby.map(t=>`${t.kind}:${t.id}`));
    for(const [id,label] of this.fieldLabels) if(!visibleFields.has(id)){label.remove();this.fieldLabels.delete(id);}
    for (const target of nearby) {
      const id=`${target.kind}:${target.id}`;
      let label=this.fieldLabels.get(id);
      if(!label){label=document.createElement('div');label.className='nextgen-field-label';label.style.cssText='position:absolute;transform:translate(-50%,-100%);background:#101b17d9;border-radius:5px;padding:4px 7px;color:#fff4ce;font-size:11px;text-align:center;white-space:nowrap;text-shadow:0 1px #000';this.root.append(label);this.fieldLabels.set(id,label);}
      const [x,y,z]=roomToScene(target.x,target.z,true);this.point.set(x,y+1.25,z).project(camera);
      const visible=this.point.z>=-1&&this.point.z<=1&&Math.abs(this.point.x)<.95&&Math.abs(this.point.y)<.90;
      label.style.display=visible?'block':'none';
      if(!visible)continue;
      label.style.left=`${(this.point.x+1)*50}%`;label.style.top=`${(1-this.point.y)*50}%`;
      label.textContent=target.kind==='pickup'?'SAMPLE':target.kind==='capture'?'WILD LANTERNKIN · CAPTURE':target.kind==='bond'?'CREATURE HABITAT':target.kind==='extract'?(target.available?'EXTRACT HERE':'EXTRACTION LOCKED'):'SUPPLY CACHE';
      label.style.border=`1px solid ${target.kind==='extract'?(target.available?'#85ef9b':'#987a61'):target.kind==='bond'||target.kind==='capture'?'#75cba6':target.kind==='pickup'?'#e9c477':'#9cb8e4'}`;
    }
  }

  dispose(): void { this.root.remove(); this.labels.clear(); this.fieldLabels.clear(); }
}
