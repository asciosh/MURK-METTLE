import * as THREE from 'three';
import { ITEM_DEFINITIONS, type ItemId } from './Inventory';

/** Simple ground loot drop using original procedural geometry. */
export class Loot {
  readonly root = new THREE.Group();
  private time = 0;
  constructor(scene: THREE.Scene, public readonly id: ItemId, position: THREE.Vector3) {
    const base = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.30, 0),
      new THREE.MeshStandardMaterial({ color: ITEM_DEFINITIONS[id].color, roughness: 0.37, metalness: 0.1, emissive: ITEM_DEFINITIONS[id].color, emissiveIntensity: 0.22 }),
    );
    base.castShadow = true;
    this.root.add(base);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.34, 0.42, 28),
      new THREE.MeshBasicMaterial({ color: ITEM_DEFINITIONS[id].color, side: THREE.DoubleSide, transparent: true, opacity: 0.75 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = -0.3;
    this.root.add(ring);
    this.root.position.copy(position);
    this.root.position.y = 0.55;
    scene.add(this.root);
  }
  update(dt: number): void {
    this.time += dt;
    this.root.rotation.y += dt * 1.2;
    this.root.position.y = 0.55 + Math.sin(this.time * 2.8) * 0.11;
  }
  canPickUp(player: THREE.Vector3): boolean {
    const dx = this.root.position.x - player.x;
    const dz = this.root.position.z - player.z;
    return dx * dx + dz * dz <= 2.4 ** 2;
  }
  dispose(scene: THREE.Scene): void {
    scene.remove(this.root);
    this.root.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      node.geometry.dispose();
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach(m => m.dispose());
    });
  }
}
