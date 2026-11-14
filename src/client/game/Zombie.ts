import { solveLeg, footCycle } from '../../../shared/actor-motion.mjs';
import * as THREE from 'three';
import type { World } from './World';
import { ActorAnimator, type ModelEntry } from './AnimationController';
import { acquireActorSurfaces, releaseActorSurfaces } from './SurfaceMaterials';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

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
  runner: {
    name: 'Feral Runner',
    skin: 0x64745a,
    dark: 0x29372c,
    eyes: 0xff8b58,
    spores: 0x9fb96d,
    scale: [0.88, 1.02, 0.88],
    health: 80,
    speed: 3.05,
    damage: 10,
  },
  barkhide: {
    name: 'Barkhide',
    skin: 0x756746,
    dark: 0x382b1e,
    eyes: 0xf2d96b,
    spores: 0x8f7542,
    scale: [1.25, 1.13, 1.2],
    health: 145,
    speed: 1.58,
    damage: 17,
  },
  sporeling: {
    name: 'Sporeling',
    skin: 0x79956b,
    dark: 0x405a3e,
    eyes: 0xa6f3ce,
    spores: 0xadd879,
    scale: [0.79, 0.83, 0.83],
    health: 65,
    speed: 2.75,
    damage: 8,
  },
  ashwalker: {
    name: 'Ashwalker',
    skin: 0x797d85,
    dark: 0x30333a,
    eyes: 0xfc6e62,
    spores: 0xaa746f,
    scale: [0.99, 1.2, 0.96],
    health: 110,
    speed: 2.08,
    damage: 13,
  },
};
const STRAIN_IDS = Object.keys(STRAINS) as InfectedStrain[];
let previousStrain: InfectedStrain | null = null;

function randomStrain(): InfectedStrain {
  // Avoid two identical consecutive encounters to make variation obvious in solo tests.
  const candidates = STRAIN_IDS.filter((id) => id !== previousStrain);
  const selected = candidates[Math.floor(Math.random() * candidates.length)];
  previousStrain = selected;
  return selected;
}

/** Original procedural infected enemy for the first combat encounter. */
export class Zombie {
  readonly root = new THREE.Group();

  private readonly surfaces = acquireActorSurfaces();
  private readonly bodyMaterial = this.surfaces.material('skin');
  private readonly shirtMaterial = this.surfaces.material('fabric', 0x85877e, 3);
  private readonly darkMaterial = this.surfaces.material('fabric', 0x62635d, 3);
  private readonly eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x9a9b83, roughness: 0.35 });
  private readonly modelVisual = new THREE.Group();
  private readonly animator = new ActorAnimator(this.root);
  private leftLeg!: THREE.Group;
  private rightLeg!: THREE.Group;
  private readonly knees: THREE.Group[] = [];
  private readonly feet: THREE.Group[] = [];
  private visualMove = 0;
  private strikeBlend = 0;
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
  private readonly warningRing: THREE.Mesh;

  constructor(
    private readonly scene: THREE.Scene,
    position: THREE.Vector3,
    forcedStrain?: InfectedStrain,
    mutationSeed?: number,
  ) {
    this.strain = forcedStrain && STRAINS[forcedStrain] ? forcedStrain : randomStrain();
    const profile = STRAINS[this.strain];
    this.displayName = profile.name;
    this.maxHealth = profile.health;
    this.health = profile.health;
    this.movementSpeed = profile.speed;
    this.damage = profile.damage;
    this.bodyMaterial.color.setHex(profile.skin).lerp(new THREE.Color(0xddd2ba), 0.8);
    this.darkMaterial.color.setHex(profile.dark);
    this.eyeMaterial.color.setHex(0x999784);
    this.root.name = `infected-${this.strain}`;
    this.root.scale.set(...profile.scale);
    this.root.position.copy(position);
    this.root.add(this.modelVisual);
    this.createModel();
    this.addMutationDetails(mutationSeed);

    this.warningRing = new THREE.Mesh(
      new THREE.RingGeometry(0.68, 0.76, 32),
      new THREE.MeshBasicMaterial({
        color: 0xd68b64,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.warningRing.rotation.x = -Math.PI / 2;
    this.warningRing.position.y = 0.035;
    this.warningRing.visible = false;
    this.root.add(this.warningRing);
    this.scene.add(this.root);
  }

  private createModel(): void {
    const add = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      parent: THREE.Object3D = this.modelVisual,
    ) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const profile = [
      new THREE.Vector2(0.18, -0.34),
      new THREE.Vector2(0.21, -0.25),
      new THREE.Vector2(0.22, 0.0),
      new THREE.Vector2(0.26, 0.22),
      new THREE.Vector2(0.19, 0.34),
      new THREE.Vector2(0.09, 0.36),
    ];
    const torso = add(new THREE.LatheGeometry(profile, 20), this.shirtMaterial, 0, 1.15, 0.035);
    torso.scale.z = 0.72;
    torso.rotation.x = 0.16;
    torso.rotation.z = -0.07;
    add(new THREE.CylinderGeometry(0.075, 0.09, 0.2, 12), this.bodyMaterial, 0.02, 1.57, -0.045);
    const head = add(new THREE.SphereGeometry(0.2, 24, 18), this.bodyMaterial, 0.035, 1.82, -0.14);
    head.scale.set(0.8, 1.12, 0.86);
    head.rotation.z = -0.13;
    const jaw = add(new RoundedBoxGeometry(0.23, 0.18, 0.19, 2, 0.04), this.bodyMaterial, 0.035, 1.69, -0.2);
    jaw.rotation.x = 0.12;
    const nose = add(new THREE.ConeGeometry(0.044, 0.12, 12), this.bodyMaterial, 0.035, 1.81, -0.321);
    nose.rotation.x = -Math.PI / 2;
    const mouth = add(new THREE.SphereGeometry(0.065, 14, 10), this.darkMaterial, 0.035, 1.685, -0.3);
    mouth.scale.set(1, 0.2, 0.17);
    for (const side of [-1, 1]) {
      const socket = add(
        new THREE.SphereGeometry(0.046, 14, 10),
        this.darkMaterial,
        0.035 + side * 0.069,
        1.85,
        -0.286,
      );
      socket.scale.set(1, 0.63, 0.42);
      const eye = add(new THREE.SphereGeometry(0.019, 12, 8), this.eyeMaterial, 0.035 + side * 0.069, 1.85, -0.303);
      eye.scale.z = 0.4;
      const brow = add(
        new THREE.CapsuleGeometry(0.023, 0.055, 4, 10),
        this.bodyMaterial,
        0.035 + side * 0.07,
        1.89,
        -0.277,
      );
      brow.rotation.z = side * 0.9;
      brow.rotation.x = -0.2;
      const ear = add(new THREE.SphereGeometry(0.043, 12, 10), this.bodyMaterial, 0.035 + side * 0.16, 1.81, -0.12);
      ear.scale.set(0.45, 1.1, 0.7);
      const cheek = add(new THREE.SphereGeometry(0.063, 14, 10), this.bodyMaterial, 0.035 + side * 0.09, 1.77, -0.267);
      cheek.scale.set(0.75, 0.6, 0.45);
    }
    const hair = add(
      new THREE.SphereGeometry(0.202, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.39),
      this.darkMaterial,
      0.035,
      1.83,
      -0.13,
    );
    hair.scale.set(0.81, 1.12, 0.85);
    hair.rotation.z = -0.13;
    for (const [side, pivot] of [
      [-1, this.leftArm],
      [1, this.rightArm],
    ] as const) {
      pivot.position.set(side * 0.265, 1.42, -0.025);
      pivot.rotation.z = side * 0.09;
      const sleeve = add(new THREE.CapsuleGeometry(0.084, 0.2, 6, 12), this.shirtMaterial, 0, -0.16, 0, pivot);
      sleeve.rotation.x = -0.13;
      const arm = add(new THREE.CapsuleGeometry(0.062, 0.23, 6, 12), this.bodyMaterial, 0, -0.43, -0.05, pivot);
      arm.rotation.x = 0.1;
      add(new RoundedBoxGeometry(0.09, 0.14, 0.065, 2, 0.018), this.bodyMaterial, 0, -0.63, -0.055, pivot);
      for (let finger = 0; finger < 3; finger++)
        add(
          new THREE.CapsuleGeometry(0.01, 0.06, 3, 6),
          this.bodyMaterial,
          -0.028 + finger * 0.024,
          -0.73,
          -0.065,
          pivot,
        );
      this.modelVisual.add(pivot);
    }
    this.leftLeg = new THREE.Group();
    this.rightLeg = new THREE.Group();
    for (const [i, pivot] of [this.leftLeg, this.rightLeg].entries()) {
      pivot.position.set(i === 0 ? -0.125 : 0.125, 0.81, 0.025);
      add(new THREE.CapsuleGeometry(0.105, 0.21, 6, 12), this.darkMaterial, 0, -0.18, 0, pivot);
      const knee = new THREE.Group();
      knee.position.y = -0.34;
      pivot.add(knee);
      this.knees.push(knee);
      add(new THREE.CapsuleGeometry(0.079, 0.2, 6, 12), this.darkMaterial, 0, -0.17, 0.015, knee);
      const foot = new THREE.Group();
      foot.position.set(0, -0.33, 0);
      knee.add(foot);
      this.feet.push(foot);
      add(new RoundedBoxGeometry(0.17, 0.15, 0.29, 2, 0.025), this.darkMaterial, 0, -0.055, -0.06, foot);
      this.modelVisual.add(pivot);
    }
    // Shirt collar, torn hem and worn buttons retain a recognizable human outline.
    for (const side of [-1, 1]) {
      const collar = add(new THREE.BoxGeometry(0.09, 0.13, 0.035), this.shirtMaterial, side * 0.065, 1.45, -0.16);
      collar.rotation.z = side * 0.36;
      for (let k = 0; k < 3; k++) {
        const tear = add(
          new THREE.BoxGeometry(0.045, 0.13 + (k % 2) * 0.06, 0.025),
          this.shirtMaterial,
          side * (0.065 + k * 0.05),
          0.82,
          -0.09,
        );
        tear.rotation.z = side * 0.15;
      }
    }
    for (let k = 0; k < 4; k++)
      add(new THREE.SphereGeometry(0.012, 8, 6), this.darkMaterial, 0, 1.32 - k * 0.12, -0.128);
  }

  private addMutationDetails(seed = 0): void {
    if (this.strain !== 'barkhide' && this.strain !== 'sporeling') return;
    const growth = new THREE.MeshStandardMaterial({ color: STRAINS[this.strain].spores, roughness: 0.98 });
    for (let i = 0; i < 4; i++) {
      const plate = new THREE.Mesh(new THREE.SphereGeometry(0.055 + (i % 2) * 0.025, 12, 8), growth);
      plate.position.set((i % 2 ? 1 : -1) * 0.23, 1.24 + i * 0.075, 0.03 + Math.sin(seed + i) * 0.09);
      plate.scale.set(1, 0.55, 0.7);
      plate.castShadow = true;
      this.modelVisual.add(plate);
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
      this.modelVisual.rotation.z = Math.sin(this.animationClock * 7) * 0.065;
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
      this.modelVisual.rotation.z = gait * 0.065;
      this.modelVisual.rotation.x = 0.09;
    } else {
      this.state = 'idle';
      this.animator.setState('idle');
      this.leftLeg.rotation.x = 0;
      this.rightLeg.rotation.x = 0;
      this.leftArm.rotation.x = -0.3;
      this.rightArm.rotation.x = -0.3;
      this.root.position.y = Math.sin(this.animationClock * 1.6) * 0.018;
      this.modelVisual.rotation.z = Math.sin(this.animationClock * 1.2) * 0.028;
      this.modelVisual.rotation.x = 0;
    }

    return false;
  }

  updateNetworkVisual(dt: number, direction: THREE.Vector3, encounterState = 'idle'): void {
    this.hitFlashTime = Math.max(0, this.hitFlashTime - dt);
    this.bodyMaterial.emissive.setHex(this.hitFlashTime > 0 ? 0x492018 : 0x000000);
    this.bodyMaterial.emissiveIntensity = this.hitFlashTime > 0 ? 0.8 : 0;
    this.animationClock += dt;
    this.animator.update(dt);
    this.modelVisual.visible = !this.animator.installed;
    const moving = direction.lengthSq() > 0.00001;
    this.animator.setState(this.isDead() ? 'death' : encounterState === 'windup' ? 'attack' : moving ? 'run' : 'idle');
    this.warningRing.visible = encounterState === 'windup';
    (this.warningRing.material as THREE.MeshBasicMaterial).opacity = 0.35 + Math.sin(this.animationClock * 16) * 0.15;
    if (moving) this.faceDirection(direction);
    this.visualMove = THREE.MathUtils.damp(this.visualMove, moving ? 1 : 0, 8, dt);
    this.strikeBlend = THREE.MathUtils.damp(this.strikeBlend, encounterState === 'windup' ? 1 : 0, 13, dt);
    const phase = this.animationClock * (this.strain === 'runner' ? 12 : 8),
      bob = Math.abs(Math.sin(phase)) * 0.018 * this.visualMove;
    this.modelVisual.position.y = bob - this.strikeBlend * 0.045;
    this.modelVisual.rotation.x = 0.05 + this.visualMove * 0.06 + this.strikeBlend * 0.11;
    this.modelVisual.rotation.z =
      Math.sin(phase) * 0.025 * this.visualMove + Math.sin(this.animationClock * 1.3) * 0.012;
    for (const [i, leg] of [this.leftLeg, this.rightLeg].entries()) {
      const cycle = footCycle(phase + i * Math.PI, 0.2);
      leg.position.y = 0.81 - this.visualMove * 0.07;
      const pose = solveLeg(0.15 - leg.position.y - bob + cycle.lift * this.visualMove, cycle.z * this.visualMove);
      leg.rotation.x = pose.hip * this.visualMove;
      this.knees[i].rotation.x = pose.knee * this.visualMove;
      this.feet[i].rotation.x = pose.foot * this.visualMove;
    }
    const reach = this.strikeBlend;
    this.leftArm.rotation.x = -0.35 - reach * 1.15 + Math.sin(phase + 0.4) * 0.18 * this.visualMove;
    this.rightArm.rotation.x = -0.45 - reach * 0.9 - Math.sin(phase) * 0.2 * this.visualMove;
    this.leftArm.rotation.z = -0.08 - reach * 0.12;
    this.rightArm.rotation.z = 0.08 + reach * 0.12;
  }
  renderDeath(dt: number, progress: number): void {
    this.root.visible = true;
    this.warningRing.visible = false;
    this.animator.setState('death');
    this.animator.update(dt);
    const fall = THREE.MathUtils.smoothstep(progress, 0, 0.8);
    this.modelVisual.rotation.z = -fall * 1.38;
    this.modelVisual.rotation.x = fall * 0.14;
    this.modelVisual.position.y = -fall * 0.04;
    this.modelVisual.position.x = fall * 0.38;
    const opacity = 1 - THREE.MathUtils.smoothstep(progress, 0.72, 1);
    this.root.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        for (const m of materials) {
          if (!m.transparent) {
            m.transparent = true;
            m.needsUpdate = true;
          }
          m.opacity = opacity;
        }
      }
    });
  }

  private faceDirection(direction: THREE.Vector3): void {
    const targetYaw = Math.atan2(-direction.x, -direction.z);
    const difference =
      THREE.MathUtils.euclideanModulo(targetYaw - this.root.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
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
      this.root.visible = true;
      return true;
    }
    return false;
  }

  getMaxHealth(): number {
    return this.maxHealth;
  }

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
    releaseActorSurfaces();
    this.scene.remove(this.root);
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
  }
}
