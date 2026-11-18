import * as THREE from 'three/webgpu';
import { SurvivorModel } from './SurvivorModel.ts';
import type { CharacterControllerResult } from './CharacterController.ts';
import { PistolProp } from './PistolProp.ts';
import type { LootKind } from './LootField.ts';
import {
  AvatarAnimator,
  type AvatarMotion
} from './AvatarAnimator.ts';

export class PlayerAvatar {
  readonly root = new THREE.Group();

  private readonly geometries =
    new Set<THREE.BufferGeometry>();

  private readonly materials =
    new Set<THREE.Material>();

  private disposed = false;

  private readonly model = new SurvivorModel();
  private animator: AvatarAnimator | null = null;
  private weapon: PistolProp | null = null;
  private heldAmmo: THREE.Mesh | null = null;
  private heldBandage: THREE.Mesh | null = null;

    private modelStatus:
    'placeholder' | 'loading' | 'ready' | 'fallback'
    = 'placeholder';

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

    async loadModel(url: string): Promise<boolean> {
    if (this.disposed) return false;

    if (this.model.loaded) return true;

    if (this.modelStatus === 'loading') {
        return false;
    }

    this.modelStatus = 'loading';

    const loaded = await this.model.load(url);

    if (this.disposed) return false;

    if (!loaded) {
        this.modelStatus = 'fallback';
        return false;
    }

    // Hide the procedural placeholder.
    for (const part of this.root.children) {
        part.visible = false;
    }

    this.root.add(this.model.root);

    this.animator = new AvatarAnimator(
    this.model.root,
    this.model.getClips()
    );

    const hand = this.model.root.getObjectByName('hand_r');

    if (hand instanceof THREE.Bone) {
      this.weapon = new PistolProp(hand);
      this.createHeldLoot(hand);
    }

    this.modelStatus = 'ready';

    return true;
    }

    getWeaponTiming() {
  const clips = this.model.getClips();

  const duration = (name: string): number =>
    (clips.find(
      clip => clip.name.toLowerCase() === name
    )?.duration ?? 0) * 1000;

  return {
    shootMs: duration('pistolshoot'),
    reloadMs: duration('pistolreload')
  };
}

getWeaponAction() {
  return this.animator?.getWeaponAction() ?? null;
}

private createHeldLoot(hand: THREE.Bone): void {
  const ammoGeometry = new THREE.BoxGeometry(0.09, 0.105, 0.052);
  const ammoMaterial = new THREE.MeshStandardMaterial({
    color: 0xb08b43, roughness: 0.85
  });
  const bandageGeometry = new THREE.CylinderGeometry(0.035, 0.035, 0.095, 10);
  const bandageMaterial = new THREE.MeshStandardMaterial({
    color: 0xdeddd0, roughness: 0.95
  });
  this.geometries.add(ammoGeometry); this.geometries.add(bandageGeometry);
  this.materials.add(ammoMaterial); this.materials.add(bandageMaterial);
  this.heldAmmo = new THREE.Mesh(ammoGeometry, ammoMaterial);
  this.heldBandage = new THREE.Mesh(bandageGeometry, bandageMaterial);
  this.heldAmmo.name = 'Held loot ammo';
  this.heldBandage.name = 'Held loot bandage';
  this.heldAmmo.position.set(0, .065, .013);
  this.heldBandage.position.copy(this.heldAmmo.position);
  this.heldBandage.rotation.z = Math.PI / 2;
  hand.add(this.heldAmmo, this.heldBandage);
  this.setHeldLoot(null);
}

setHeldLoot(kind: LootKind | null): void {
  if (this.heldAmmo) this.heldAmmo.visible = kind === 'ammo';
  if (this.heldBandage) this.heldBandage.visible = kind === 'bandage';
}

getMuzzlePosition(target: THREE.Vector3): boolean {
  if (this.disposed || !this.weapon?.root.visible) return false;
  this.weapon.getMuzzlePosition(target);
  return true;
}

getActiveClip() {
  return this.animator?.getActiveClip() ?? null;
}

    getModelInfo() {
      return {
        status: this.modelStatus,
        clips: this.model.getClips().map(clip => clip.name),
        skinned: this.model.hasSkeleton,
        activeClip: this.animator?.getActiveClip() ?? null,
        aimWeight: this.animator?.getAimWeight() ?? 0,
        aimPitch: this.animator?.getAimPitch() ?? 0,
        weaponAttached: this.weapon !== null,
        backpackAttached: !!this.model.root.getObjectByName('SurvivalBackpack'),
        heldLoot: this.heldAmmo?.visible ? 'ammo' : this.heldBandage?.visible ? 'bandage' : null,
        weaponVisible: this.weapon?.root.visible ?? false,
        weaponAction: this.animator?.getWeaponAction() ?? null
      };
    }

    animate(
      deltaTimeMs: number,
      motion: AvatarMotion
    ): void {
      this.animator?.update(deltaTimeMs, motion);

      this.weapon?.update(
        this.animator?.getAimWeight() ?? 0
      );
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
    this.animator?.dispose();
    this.animator = null;

    this.weapon?.dispose();
    this.weapon = null;

    this.heldAmmo?.removeFromParent();
    this.heldBandage?.removeFromParent();
    this.heldAmmo = this.heldBandage = null;
    this.model.dispose();

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