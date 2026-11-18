import * as THREE from 'three/webgpu';
import type { LootKind } from './EquipmentInventory.ts';

export type FieldArtKind = LootKind | 'sample' | 'resupply' | 'habitat';

/** Presentation only: neither amounts nor ownership nor collection are stored here. */
export class FieldItemArt {
  private readonly geometry = new THREE.BoxGeometry(0.42, 0.25, 0.32);
  private readonly markerGeometry = new THREE.OctahedronGeometry(0.15, 0);
  private readonly ammoMarker = new THREE.MeshBasicMaterial({ color: 0xffc34a, toneMapped: false });
  private readonly bandageMarker = new THREE.MeshBasicMaterial({ color: 0x86ffbe, toneMapped: false });
  private readonly ammoMaterial = new THREE.MeshStandardMaterial({ color: 0xc4a044, emissive: 0x543c0b, emissiveIntensity: 0.6 });
  private readonly bandageMaterial = new THREE.MeshStandardMaterial({ color: 0xe6eedb, emissive: 0x235a39, emissiveIntensity: 0.35 });
  private readonly rifleMaterial = new THREE.MeshStandardMaterial({ color: 0x46534b, roughness: 0.85 });
  private readonly shotgunMaterial = new THREE.MeshStandardMaterial({ color: 0x79593a, roughness: 0.85 });
  private readonly supplyMaterial = new THREE.MeshStandardMaterial({ color: 0x427b8e, roughness: 0.65 });

  create(kind: FieldArtKind): THREE.Group {
    const group = new THREE.Group();
    group.name = 'Loot ' + kind;
    const weapon = kind === 'rifle' || kind === 'shotgun';
    const green = kind === 'bandage' || kind === 'habitat' || kind === 'resupply';
    const material = kind === 'bandage' || kind === 'habitat' ? this.bandageMaterial :
      kind === 'resupply' ? this.supplyMaterial :
      kind === 'rifle' || kind === 'rifle-ammo' ? this.rifleMaterial :
      kind === 'shotgun' || kind === 'shotgun-ammo' ? this.shotgunMaterial : this.ammoMaterial;
    const box = new THREE.Mesh(this.geometry, material);
    box.name = 'Field prop ' + kind;
    box.position.y = 0.13;
    if (weapon) {
      box.scale.set(0.33,0.30,kind === 'rifle' ? 2.3 : 2.6);
      const stock = new THREE.Mesh(this.geometry,material);
      stock.scale.set(.25,.32,.55); stock.position.set(0,.13,.36);
      const grip = new THREE.Mesh(this.geometry,material);
      grip.scale.set(.28,.45,.20); grip.position.set(0,.09,.04);
      group.add(stock,grip);
    } else if (kind === 'resupply') {
      box.scale.set(2.1, 2.4, 2.1); box.position.y = .30;
    } else if (kind === 'sample') {
      const vial = new THREE.Mesh(this.geometry, this.bandageMaterial);
      vial.scale.set(.32, .36, .32); vial.position.set(0,.30,0); group.add(vial);
    } else if (kind === 'habitat') {
      box.scale.set(1.3,.6,1.3); box.rotation.y = .5;
    }
    box.receiveShadow = true;
    box.castShadow = kind === 'resupply' || kind === 'sample';
    const marker = new THREE.Mesh(this.markerGeometry, green ? this.bandageMarker : this.ammoMarker);
    marker.name = 'Loot marker ' + kind;
    marker.position.y = kind === 'resupply' ? .95 : .72;
    group.add(box,marker);
    return group;
  }

  dispose(): void {
    this.geometry.dispose(); this.markerGeometry.dispose();
    [this.ammoMarker,this.bandageMarker,this.ammoMaterial,this.bandageMaterial,this.rifleMaterial,this.shotgunMaterial,this.supplyMaterial].forEach(m=>m.dispose());
  }
}
