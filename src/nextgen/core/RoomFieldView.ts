import * as THREE from 'three/webgpu';
import type { FieldTarget } from './RoomFieldRules';
import { roomToScene } from './RoomIntent';
import { FieldItemArt, type FieldArtKind } from './FieldItemArt';
import { CompanionAvatar } from './CompanionAvatar';

/** Shared mission markers are derived from the last server packet, never consumed locally. */
export class RoomFieldView {
  readonly root = new THREE.Group();
  private readonly art = new FieldItemArt();
  private readonly ringGeometry = new THREE.RingGeometry(2.9, 3.3, 48);
  private readonly materials = {
    extract: new THREE.MeshBasicMaterial({ color: 0xb0efb1, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    locked: new THREE.MeshBasicMaterial({ color: 0x926f51, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    capture: new THREE.MeshBasicMaterial({color:0x8debc6,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false})
  };
  private readonly markers = new Map<string, { root: THREE.Group; ring?: THREE.Mesh; artKind?: FieldArtKind; wild?:CompanionAvatar }>();
  private time = 0;
  update(targets: readonly FieldTarget[], dt: number, captureProgress:number|null=null) {
    this.time += Math.min(100, Math.max(0, dt)) / 1000;
    const current = new Set<string>();
    for (const t of targets) {
      const key = `${t.kind}:${t.id}`; current.add(key);
      let marker = this.markers.get(key);
      if (!marker) {
        if (t.kind === 'extract') {
          const root = new THREE.Group();
          const ring = new THREE.Mesh(this.ringGeometry, this.materials.locked);
          ring.rotation.x = -Math.PI / 2; ring.position.y = .25; root.add(ring);
          marker = { root, ring };
        } else if(t.kind==='capture') {
          const root=new THREE.Group(),wild=new CompanionAvatar();root.add(wild.root);
          const ring=new THREE.Mesh(this.ringGeometry,this.materials.capture);ring.rotation.x=-Math.PI/2;ring.position.y=.12;ring.scale.setScalar(.42);root.add(ring);
          marker={root,wild,ring};
        } else {
          const artKind = t.kind === 'bond' ? 'habitat' : t.kind === 'pickup' ? 'sample' : 'resupply';
          marker = { root: this.art.create(artKind), artKind };
        }
        this.root.add(marker.root); this.markers.set(key, marker);
      }
      const [x, y, z] = roomToScene(t.x, t.z,true);
      marker.root.position.set(x, y, z);
      if(marker.wild) {
        marker.wild.update(dt,{species:'lanternkin',name:'Wild Lanternkin',position:[0,0,0],facing:[Math.sin(this.time*.3),0,-Math.cos(this.time*.3)],assist:captureProgress!==null,mode:'follow',moving:false,attackPoseMs:0,pulsePoseMs:0,pulseCooldownMs:0,pulseMaxCooldownMs:8000,pulseRange:7.5,attacks:0,pulses:0});
        marker.ring?.scale.setScalar(captureProgress===null ? .42 : .42-.20*captureProgress);
      } else if (marker.ring) marker.ring.material = t.available ? this.materials.extract : this.materials.locked;
      else {
        const icon = marker.root.getObjectByName('Loot marker ' + marker.artKind);
        if (icon) icon.rotation.y = this.time;
      }
    }
    for (const [id, marker] of this.markers) if (!current.has(id)) { marker.wild?.dispose();marker.root.removeFromParent(); this.markers.delete(id); }
  }
  info() { return [...this.markers.keys()]; }
  visualInfo() { return [...this.markers].map(([id,m]) => ({ id, kind: m.wild?'wild-creature':m.artKind ?? 'extract', physical: !!m.wild || (!!m.artKind && !!m.root.getObjectByName('Field prop ' + m.artKind)) })); }
  dispose() { for(const m of this.markers.values())m.wild?.dispose();this.root.removeFromParent(); this.root.clear(); this.markers.clear(); this.art.dispose(); this.ringGeometry.dispose(); Object.values(this.materials).forEach(m => m.dispose()); }
}
