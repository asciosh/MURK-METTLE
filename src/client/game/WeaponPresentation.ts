import * as THREE from 'three';
import type { WeaponId } from '../../../shared/expansion.mjs';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Shared local/remote gun models. Owns no ammunition, input or networking. */
export class WeaponPresentation {
  readonly root = new THREE.Group();
  private readonly pistol = new THREE.Group();
  private readonly rifle = new THREE.Group();
  private readonly slide = new THREE.Group();
  private readonly bolt = new THREE.Group();
  private readonly magazine = new THREE.Group();
  private readonly muzzle: THREE.Mesh;
  private readonly light = new THREE.PointLight(0xffb572, 0, 5);
  private flashTime = 0;
  private recoil = 0;
  private weapon: WeaponId = 'pistol';
  constructor(private readonly socket: THREE.Object3D) {
    this.root.name = 'held-firearm';
    socket.add(this.root);
    this.root.add(this.pistol, this.rifle);
    this.pistol.name = 'pistol';
    this.rifle.name = 'carbine';
    const steel = new THREE.MeshStandardMaterial({ color: 0x333739, metalness: 0.78, roughness: 0.4 });
    const edge = new THREE.MeshStandardMaterial({ color: 0x636965, metalness: 0.7, roughness: 0.32 });
    const polymer = new THREE.MeshStandardMaterial({ color: 0x31382f, roughness: 0.88 });
    const rubber = new THREE.MeshStandardMaterial({ color: 0x1e2422, roughness: 0.95 });
    const box = (
      parent: THREE.Object3D,
      material: THREE.Material,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
    ) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const barrel = (parent: THREE.Object3D, radius: number, length: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 12), steel);
      mesh.rotation.x = Math.PI / 2;
      mesh.position.set(0, 0.035, z);
      mesh.castShadow = true;
      parent.add(mesh);
      const opening = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.65, 12), rubber);
      opening.rotation.y = Math.PI;
      opening.position.set(0, 0.035, z - length / 2 - 0.001);
      parent.add(opening);
    };
    this.pistol.add(this.slide);
    box(this.slide, steel, 0.078, 0.09, 0.29, 0, 0.055, -0.09);
    box(this.slide, edge, 0.014, 0.018, 0.045, 0, 0.11, -0.2);
    box(this.slide, edge, 0.018, 0.018, 0.035, 0, 0.11, 0.035);
    box(this.pistol, polymer, 0.072, 0.055, 0.23, 0, -0.015, -0.07);
    const grip = box(this.pistol, polymer, 0.072, 0.18, 0.095, 0, -0.125, 0.025);
    grip.rotation.x = -0.2;
    box(this.pistol, rubber, 0.08, 0.015, 0.1, 0, -0.215, 0.04);
    box(this.pistol, steel, 0.018, 0.05, 0.012, 0, -0.06, -0.07);
    box(this.pistol, steel, 0.065, 0.012, 0.1, 0, -0.09, -0.08);
    barrel(this.pistol, 0.019, 0.1, -0.24);
    for (const side of [-1, 1])
      for (let i = 0; i < 6; i++) box(this.slide, edge, 0.002, 0.055, 0.006, side * 0.04, 0.05, 0.005 + i * 0.009);
    this.rifle.add(this.bolt, this.magazine);
    box(this.rifle, steel, 0.09, 0.13, 0.32, 0, 0.025, -0.07);
    box(this.bolt, edge, 0.01, 0.045, 0.09, 0.05, 0.03, -0.03);
    box(this.rifle, polymer, 0.085, 0.065, 0.32, 0, 0.015, -0.38);
    box(this.rifle, steel, 0.055, 0.018, 0.52, 0, 0.1, -0.23);
    for (let i = 0; i < 15; i++) box(this.rifle, edge, 0.06, 0.012, 0.008, 0, 0.113, 0.005 - i * 0.032);
    for (const side of [-1, 1])
      for (let i = 0; i < 7; i++) box(this.rifle, rubber, 0.005, 0.035, 0.015, side * 0.045, 0.02, -0.29 - i * 0.03);
    barrel(this.rifle, 0.018, 0.3, -0.66);
    box(this.rifle, polymer, 0.08, 0.16, 0.09, 0, -0.13, 0.04).rotation.x = -0.18;
    box(this.magazine, rubber, 0.065, 0.22, 0.095, 0, -0.15, -0.12).rotation.x = 0.1;
    box(this.rifle, steel, 0.04, 0.04, 0.19, 0, 0.03, 0.18);
    box(this.rifle, polymer, 0.065, 0.13, 0.16, 0, -0.005, 0.29);
    box(this.rifle, rubber, 0.075, 0.15, 0.025, 0, -0.005, 0.38);
    // Compact optic and front sight give the rifle a distinct silhouette.
    box(this.rifle, steel, 0.065, 0.07, 0.09, 0, 0.15, -0.025);
    box(this.rifle, rubber, 0.04, 0.045, 0.004, 0, 0.15, 0.023);
    box(this.rifle, steel, 0.018, 0.07, 0.025, 0, 0.12, -0.57);
    for (const group of [this.pistol, this.rifle, this.slide, this.bolt, this.magazine]) {
      const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
      for (const child of [...group.children]) {
        if (!(child instanceof THREE.Mesh) || Array.isArray(child.material)) continue;
        child.updateMatrix();
        const geometry = child.geometry.clone().applyMatrix4(child.matrix);
        const list = batches.get(child.material) || [];
        list.push(geometry);
        batches.set(child.material, list);
        group.remove(child);
        child.geometry.dispose();
      }
      for (const [material, list] of batches) {
        const geometry = mergeGeometries(list);
        for (const item of list) item.dispose();
        if (geometry) {
          const mesh = new THREE.Mesh(geometry, material);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
        }
      }
    }
    this.muzzle = new THREE.Mesh(
      new THREE.ConeGeometry(0.085, 0.22, 7),
      new THREE.MeshBasicMaterial({
        color: 0xffdfad,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.muzzle.rotation.x = -Math.PI / 2;
    this.root.add(this.muzzle, this.light);
    this.muzzle.visible = false;
    this.update(0, 'pistol', 0);
  }
  setLightsEnabled(enabled: boolean): void {
    this.light.visible = enabled;
  }
  fire(): void {
    this.flashTime = 0.055;
    this.recoil = 1;
  }
  muzzlePosition(): THREE.Vector3 {
    this.root.updateWorldMatrix(true, false);
    return this.root.localToWorld(new THREE.Vector3(0, 0.035, this.weapon === 'rifle' ? -0.82 : -0.3));
  }
  update(dt: number, weapon: WeaponId, reloadProgress: number): void {
    this.weapon = weapon;
    this.pistol.visible = weapon === 'pistol';
    this.rifle.visible = weapon === 'rifle';
    this.flashTime = Math.max(0, this.flashTime - dt);
    this.recoil = THREE.MathUtils.damp(this.recoil, 0, 23, dt);
    this.slide.position.z = this.recoil * 0.045;
    this.bolt.position.z = this.recoil * 0.025;
    this.root.position.z = this.recoil * 0.025;
    this.magazine.position.y =
      reloadProgress > 0.12 && reloadProgress < 0.72 ? -Math.sin(((reloadProgress - 0.12) / 0.6) * Math.PI) * 0.24 : 0;
    this.muzzle.visible = this.flashTime > 0;
    this.muzzle.scale.setScalar(weapon === 'rifle' ? 1.15 : 0.8);
    (this.muzzle.material as THREE.MeshBasicMaterial).opacity = Math.min(0.9, this.flashTime / 0.055);
    this.muzzle.position.set(0, 0.035, weapon === 'rifle' ? -0.87 : -0.36);
    this.muzzle.rotation.z += dt * 93;
    this.light.position.copy(this.muzzle.position);
    this.light.intensity = this.flashTime > 0 ? 7 : 0;
  }
  dispose(): void {
    this.socket.remove(this.root);
    const geometry = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>();
    this.root.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        geometry.add(node.geometry);
        const list = Array.isArray(node.material) ? node.material : [node.material];
        for (const mat of list) materials.add(mat);
      }
    });
    for (const item of geometry) item.dispose();
    for (const item of materials) item.dispose();
    this.light.dispose();
  }
}
