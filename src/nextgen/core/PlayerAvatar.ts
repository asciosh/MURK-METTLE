import * as THREE from 'three/webgpu';
import type { CharacterControllerResult } from './CharacterController.ts';

export class PlayerAvatar {
  readonly root = new THREE.Group();

  private readonly geometries =
    new Set<THREE.BufferGeometry>();

  private readonly materials =
    new Set<THREE.Material>();

  private disposed = false;

  constructor() {
    this.root.name = 'NEXTGEN Player';

    const clothing = new THREE.MeshStandardMaterial({
      color: 0x52604b,
      roughness: 0.9
    });

    const equipment = new THREE.MeshStandardMaterial({
      color: 0x242b30,
      roughness: 0.8
    });

    const skin = new THREE.MeshStandardMaterial({
      color: 0xc79772,
      roughness: 0.85
    });

    // Torso
    this.addPart(
      new THREE.BoxGeometry(0.52, 0.65, 0.3),
      clothing, 0, 1.15, 0
    );

    // Head
    this.addPart(
      new THREE.SphereGeometry(0.19, 12, 8),
      skin, 0, 1.69, 0
    );

    // Legs
    for (const x of [-0.14, 0.14]) {
      this.addPart(
        new THREE.CapsuleGeometry(0.1, 0.5, 4, 8),
        equipment, x, 0.42, 0
      );

      this.addPart(
        new THREE.BoxGeometry(0.22, 0.16, 0.34),
        equipment, x, 0.08, -0.06
      );
    }

    // Arms
    for (const x of [-0.36, 0.36]) {
      this.addPart(
        new THREE.CapsuleGeometry(0.09, 0.48, 4, 8),
        clothing, x, 1.12, 0
      );
    }

    // Backpack
    this.addPart(
      new THREE.BoxGeometry(0.4, 0.48, 0.22),
      equipment, 0, 1.22, 0.23
    );
  }

  private addPart(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number
  ): void {
    this.geometries.add(geometry);
    this.materials.add(material);

    const mesh = new THREE.Mesh(geometry, material);

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.root.add(mesh);
  }

  update(
    state: Pick<
      CharacterControllerResult,
      'position' | 'facing'
    >
  ): void {
    if (this.disposed) return;

    if (state.position.every(Number.isFinite)) {
      this.root.position.set(...state.position);
    }

    if (
      state.facing.every(Number.isFinite) &&
      Math.hypot(state.facing[0], state.facing[2]) > 0.000001
    ) {
      this.root.rotation.y = Math.atan2(
        -state.facing[0],
        -state.facing[2]
      );
    }
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;

    this.root.removeFromParent();

    for (const geometry of this.geometries) {
      geometry.dispose();
    }

    for (const material of this.materials) {
      material.dispose();
    }

    this.geometries.clear();
    this.materials.clear();
    this.root.clear();
  }
}