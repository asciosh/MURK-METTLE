import * as THREE from 'three/webgpu';
import type { FieldTarget } from './RoomFieldRules';
import { roomToScene } from './RoomIntent';

/** Shared mission markers are derived from the last server packet, never consumed locally. */
export class RoomFieldView {
  readonly root = new THREE.Group();
  private readonly markerGeometry = new THREE.OctahedronGeometry(0.48, 0);
  private readonly cacheGeometry = new THREE.BoxGeometry(0.92, 0.65, 0.7);
  private readonly ringGeometry = new THREE.RingGeometry(2.9, 3.3, 48);
  private readonly materials = {
    bond: new THREE.MeshStandardMaterial({ color: 0x8be5b0, emissive: 0x326947, emissiveIntensity: 0.8 }),
    pickup: new THREE.MeshStandardMaterial({ color: 0xf0cf7d, emissive: 0x8d5c1e, emissiveIntensity: 0.85 }),
    resupply: new THREE.MeshStandardMaterial({ color: 0x427b8e, roughness: 0.65, emissive: 0x163842 }),
    extract: new THREE.MeshBasicMaterial({ color: 0xb0efb1, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false }),
    locked: new THREE.MeshBasicMaterial({ color: 0x926f51, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
  };
  private readonly markers = new Map<string, { mesh: THREE.Mesh; kind: FieldTarget['kind'] }>();
  private time = 0;
  update(targets: readonly FieldTarget[], dt: number) {
    this.time += Math.min(100, Math.max(0, dt)) / 1000;
    const current = new Set<string>();
    for (const t of targets) {
      const key = `${t.kind}:${t.id}`; current.add(key);
      let marker = this.markers.get(key);
      if (!marker) {
        const geometry = t.kind === 'resupply' ? this.cacheGeometry : t.kind === 'extract' ? this.ringGeometry : this.markerGeometry;
        const mesh = new THREE.Mesh(geometry, this.materials[t.kind]);
        marker = { mesh, kind: t.kind }; this.root.add(mesh); this.markers.set(key, marker);
        if (t.kind === 'extract') mesh.rotation.x = -Math.PI / 2;
        if (t.kind === 'resupply') mesh.castShadow = true;
      }
      const [x, y, z] = roomToScene(t.x, t.z,true);
      marker.mesh.position.set(x, y+(t.kind === 'extract' ? 0.25 : t.kind === 'resupply' ? 0.325 : 0.9 + Math.sin(this.time * 2.2) * 0.12), z);
      if (t.kind === 'extract') marker.mesh.material = t.available ? this.materials.extract : this.materials.locked;
      else if (t.kind !== 'resupply') marker.mesh.rotation.y = this.time;
    }
    for (const [id, marker] of this.markers) if (!current.has(id)) { marker.mesh.removeFromParent(); this.markers.delete(id); }
  }
  info() { return [...this.markers.keys()]; }
  dispose() { this.root.removeFromParent(); this.root.clear(); this.markers.clear(); this.markerGeometry.dispose(); this.cacheGeometry.dispose(); this.ringGeometry.dispose(); Object.values(this.materials).forEach(m => m.dispose()); }
}
