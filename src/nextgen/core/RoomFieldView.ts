import * as THREE from 'three/webgpu';
import type { FieldTarget } from './RoomFieldRules';
import { roomToScene } from './RoomIntent';
import { FieldItemArt, type FieldArtKind } from './FieldItemArt';

/** Shared mission markers are derived from the last server packet, never consumed locally. */
export class RoomFieldView {
  readonly root = new THREE.Group();
  private readonly art = new FieldItemArt();
  private readonly ringGeometry = new THREE.RingGeometry(2.9, 3.3, 48);
  private readonly materials = {
    extract: new THREE.MeshBasicMaterial({ color: 0xb0efb1, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    locked: new THREE.MeshBasicMaterial({ color: 0x926f51, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
  };
  private readonly markers = new Map<string, { root: THREE.Group; ring?: THREE.Mesh; artKind?: FieldArtKind }>();
  private time = 0;
  update(targets: readonly FieldTarget[], dt: number) {
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
        } else {
          const artKind = t.kind === 'bond' ? 'habitat' : t.kind === 'pickup' ? 'sample' : 'resupply';
          marker = { root: this.art.create(artKind), artKind };
        }
        this.root.add(marker.root); this.markers.set(key, marker);
      }
      const [x, y, z] = roomToScene(t.x, t.z,true);
      marker.root.position.set(x, y, z);
      if (marker.ring) marker.ring.material = t.available ? this.materials.extract : this.materials.locked;
      else {
        const icon = marker.root.getObjectByName('Loot marker ' + marker.artKind);
        if (icon) icon.rotation.y = this.time;
      }
    }
    for (const [id, marker] of this.markers) if (!current.has(id)) { marker.root.removeFromParent(); this.markers.delete(id); }
  }
  info() { return [...this.markers.keys()]; }
  visualInfo() { return [...this.markers].map(([id,m]) => ({ id, kind: m.artKind ?? 'extract', physical: !!m.artKind && !!m.root.getObjectByName('Field prop ' + m.artKind) })); }
  dispose() { this.root.removeFromParent(); this.root.clear(); this.markers.clear(); this.art.dispose(); this.ringGeometry.dispose(); Object.values(this.materials).forEach(m => m.dispose()); }
}
