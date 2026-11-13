import * as THREE from 'three';
import type { World } from './World';
import { ActorAnimator, type ModelEntry } from './AnimationController';

type ZombieState = 'idle' | 'chase' | 'attack' | 'dead';

/** Original mutated infection strains, not human ethnicities or licensed characters. */
export type InfectedStrain = 'runner' | 'barkhide' | 'sporeling' | 'ashwalker';

interface StrainProfile {
  name: string;
  skin: number;
  dark: number;
  eyes: number;
  spores: number;
  scale: [number, number, number];
  health: number;
  speed: number;
  damage: number;
}

const STRAINS: Record<InfectedStrain, StrainProfile> = {
  runner: { name: 'Feral Runner', skin: 0x64745a, dark: 0x29372c, eyes: 0xff8b58, spores: 0x9fb96d, scale: [0.88, 1.02, 0.88], health: 80, speed: 3.05, damage: 10 },
  barkhide: { name: 'Barkhide', skin: 0x756746, dark: 0x382b1e, eyes: 0xf2d96b, spores: 0x8f7542, scale: [1.25, 1.13, 1.20], health: 145, speed: 1.58, damage: 17 },
  sporeling: { name: 'Sporeling', skin: 0x79956b, dark: 0x405a3e, eyes: 0xa6f3ce, spores: 0xadd879, scale: [0.79, 0.83, 0.83], health: 65, speed: 2.75, damage: 8 },
  ashwalker: { name: 'Ashwalker', skin: 0x797d85, dark: 0x30333a, eyes: 0xfc6e62, spores: 0xaa746f, scale: [0.99, 1.20, 0.96], health: 110, speed: 2.08, damage: 13 },
};
const STRAIN_IDS = Object.keys(STRAINS) as InfectedStrain[];
let previousStrain: InfectedStrain | null = null;

function randomStrain(): InfectedStrain {
  // Avoid two identical consecutive encounters to make variation obvious in solo tests.
  const candidates = STRAIN_IDS.filter(id => id !== previousStrain);
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  previousStrain = selected;
  return selected;
}


/** Original procedural infected enemy for the first combat encounter. */
export class Zombie {
  readonly root = new THREE.Group();

  private readonly bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0x64745a,
    roughness: 0.96,
  });
  private readonly darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x29372c,
    roughness: 1,
  });
  private readonly eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff8b58 });
  private readonly modelVisual = new THREE.Group();
  private readonly animator = new ActorAnimator(this.root);
  private leftLeg!: THREE.Group;
  private rightLeg!: THREE.Group;
  private readonly leftArm = new THREE.Group();
  private readonly rightArm = new THREE.Group();
  readonly strain: InfectedStrain;
  readonly maxHealth: number;
  readonly displayName: string;
  readonly damage: number;
  private readonly movementSpeed: number;
  private health: number;
  private state: ZombieState = 'idle';
  private attackCooldown = 0.6;
  private animationClock = 0;
  private hitFlashTime = 0;

  constructor(private readonly scene: THREE.Scene, position: THREE.Vector3, forcedStrain?: InfectedStrain, mutationSeed?: number) {
    this.strain = forcedStrain && STRAINS[forcedStrain] ? forcedStrain : randomStrain();
    const profile = STRAINS[this.strain];
    this.displayName = profile.name;
    this.maxHealth = profile.health;
    this.health = profile.health;
    this.movementSpeed = profile.speed;
    this.damage = profile.damage;
    this.bodyMaterial.color.setHex(profile.skin);
    this.darkMaterial.color.setHex(profile.dark);
    this.eyeMaterial.color.setHex(profile.eyes);
    this.root.name = `infected-${this.strain}`;
    this.root.scale.set(...profile.scale);
    this.root.position.copy(position);
    this.root.add(this.modelVisual);
    this.createModel();
    this.addMutationDetails(mutationSeed);
    this.scene.add(this.root);
  }

  private createModel(): void {
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.39, 0.76, 5, 10), this.bodyMaterial);
    torso.position.y = 1.02;
    torso.rotation.z = -0.11;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.modelVisual.add(torso);

    const chestPatch = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), this.darkMaterial);
    chestPatch.position.set(0.18, 1.19, -0.29);
    chestPatch.scale.set(1.1, 0.75, 0.35);
    chestPatch.castShadow = true;
    this.modelVisual.add(chestPatch);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), this.bodyMaterial);
    head.position.set(0.04, 1.91, -0.11);
    head.rotation.z = -0.18;
    head.castShadow = true;
    this.modelVisual.add(head);

    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.13, 0.22), this.darkMaterial);
    jaw.position.set(0.04, 1.72, -0.35);
    jaw.rotation.x = -0.16;
    this.modelVisual.add(jaw);

    for (const x of [-0.105, 0.105]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), this.eyeMaterial);
      eye.position.set(x + 0.04, 1.94, -0.39);
      this.modelVisual.add(eye);
    }

    this.leftArm.position.set(-0.43, 1.38, -0.08);
    this.rightArm.position.set(0.43, 1.38, -0.08);
    this.leftArm.rotation.z = -0.22;
    this.rightArm.rotation.z = 0.22;
    const armGeometry = new THREE.CapsuleGeometry(0.13, 0.57, 4, 8);
    const leftArmMesh = new THREE.Mesh(armGeometry, this.bodyMaterial);
    const rightArmMesh = new THREE.Mesh(armGeometry, this.bodyMaterial);
    leftArmMesh.position.y = -0.31;
    rightArmMesh.position.y = -0.31;
    leftArmMesh.rotation.x = -0.6;
    rightArmMesh.rotation.x = -0.6;
    leftArmMesh.castShadow = true;
    rightArmMesh.castShadow = true;
    this.leftArm.add(leftArmMesh);
    this.rightArm.add(rightArmMesh);
    this.modelVisual.add(this.leftArm, this.rightArm);

    const legGeometry = new THREE.CapsuleGeometry(0.145, 0.46, 4, 8);
    this.leftLeg = new THREE.Group(); this.rightLeg = new THREE.Group();
    for (const [i, pivot] of [this.leftLeg, this.rightLeg].entries()) {
      pivot.position.set(i === 0 ? -0.19 : 0.19, 0.76, 0.025);
      const leg = new THREE.Mesh(legGeometry, this.darkMaterial);
      leg.position.y = -0.38;
      leg.castShadow = true;
      pivot.add(leg);
      this.modelVisual.add(pivot);
    }

    const spore = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshStandardMaterial({ color: STRAINS[this.strain].spores, emissive: 0x3c5520, emissiveIntensity: 0.7 }),
    );
    spore.position.set(-0.26, 1.52, 0.25);
    spore.scale.set(1, 0.75, 1);
    spore.castShadow = true;
    this.modelVisual.add(spore);
  }

  private addMutationDetails(seed?: number): void {
    const variant = seed === undefined ? Math.floor(Math.random() * 2) : seed % 2;
    const color = STRAINS[this.strain].spores;
    if (variant === 0) {
      // Fungal crown: an asymmetrical silhouette, without copied creature artwork.
      for (let i = 0; i < 3; i++) {
        const stalk = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.52 + i * 0.09, 6),
          new THREE.MeshStandardMaterial({ color, roughness: 0.92 }));
        stalk.position.set(-0.19 + i * 0.17, 2.20 + i * 0.07, 0.02);
        stalk.rotation.z = (i - 1) * 0.35;
        this.root.add(stalk);
      }
    } else {
      // Spore armor: crystal-like fungal colonies over the shoulders.
      for (let i = 0; i < 4; i++) {
        const colony = new THREE.Mesh(new THREE.OctahedronGeometry(0.19 + i * 0.035, 0),
          new THREE.MeshStandardMaterial({ color, roughness: 0.5, emissive: color, emissiveIntensity: 0.16 }));
        colony.position.set(i % 2 ? 0.35 : -0.35, 1.05 + i * 0.21, i % 2 ? 0.04 : 0.20);
        this.root.add(colony);
      }
    }
  }

  /** Returns true when the zombie lands a melee hit this frame. */
  update(playerPosition: THREE.Vector3, deltaSeconds: number, world: World): boolean {
    if (this.state === 'dead') return false;

    this.animationClock += deltaSeconds;
    this.animator.update(deltaSeconds);
    this.modelVisual.visible = !this.animator.installed;
    this.attackCooldown -= deltaSeconds;
    this.hitFlashTime = Math.max(0, this.hitFlashTime - deltaSeconds);
    this.bodyMaterial.emissive.setHex(this.hitFlashTime > 0 ? 0x492018 : 0x000000);
    this.bodyMaterial.emissiveIntensity = this.hitFlashTime > 0 ? 0.8 : 0;

    const toPlayer = new THREE.Vector3(
      playerPosition.x - this.root.position.x,
      0,
      playerPosition.z - this.root.position.z,
    );
    const distance = toPlayer.length();

    if (distance <= 1.62) {
      this.state = 'attack';
      this.animator.setState('attack');
      if (distance > 0.001) this.faceDirection(toPlayer);
      const swing = Math.sin(this.animationClock * 9) * 0.35;
      this.leftArm.rotation.x = -0.85 - swing;
      this.rightArm.rotation.x = -0.85 + swing;
      this.root.position.y = Math.abs(Math.sin(this.animationClock * 7)) * 0.025;
      if (this.attackCooldown <= 0) {
        this.attackCooldown = 1.35;
        return true;
      }
      return false;
    }

    if (distance <= 18) {
      this.state = 'chase';
      this.animator.setState('run');
      if (distance > 0.001) {
        toPlayer.normalize();
        this.faceDirection(toPlayer);
        this.root.position.addScaledVector(toPlayer, this.movementSpeed * deltaSeconds);
        world.constrainActorPosition(this.root.position, 0.43);
      }
      const gait = Math.sin(this.animationClock * 8.5);
      this.leftLeg.rotation.x = gait * 0.52;
      this.rightLeg.rotation.x = -gait * 0.52;
      this.leftArm.rotation.x = -0.48 + gait * 0.28;
      this.rightArm.rotation.x = -0.48 - gait * 0.28;
      this.root.position.y = Math.abs(gait) * 0.035;
    } else {
      this.state = 'idle';
      this.animator.setState('idle');
      this.leftLeg.rotation.x = 0; this.rightLeg.rotation.x = 0;
      this.leftArm.rotation.x = -0.3;
      this.rightArm.rotation.x = -0.3;
      this.root.position.y = Math.sin(this.animationClock * 1.6) * 0.018;
    }

    return false;
  }

  private faceDirection(direction: THREE.Vector3): void {
    const targetYaw = Math.atan2(-direction.x, -direction.z);
    const difference = THREE.MathUtils.euclideanModulo(
      targetYaw - this.root.rotation.y + Math.PI,
      Math.PI * 2,
    ) - Math.PI;
    this.root.rotation.y += difference * 0.18;
  }

  /** Returns true if this hit killed the zombie. */
  takeDamage(amount: number): boolean {
    if (this.state === 'dead') return false;
    this.health = Math.max(0, this.health - Math.max(0, amount));
    this.hitFlashTime = 0.16;
    if (this.health <= 0) {
      this.state = 'dead';
      this.animator.setState('death');
      this.root.visible = false;
      return true;
    }
    return false;
  }

  getMaxHealth(): number { return this.maxHealth; }

  getHealth(): number {
    return this.health;
  }

  getPosition(): THREE.Vector3 {
    return this.root.position;
  }

  isDead(): boolean {
    return this.state === 'dead';
  }

  async installModel(entry: ModelEntry): Promise<void> {
    if (await this.animator.load(entry)) this.modelVisual.visible = false;
  }

  dispose(): void {
    this.animator.dispose();
    this.scene.remove(this.root);
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
  }
}
