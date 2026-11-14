import * as THREE from 'three';
import type { World } from './World';
import { ActorAnimator, type ModelEntry } from './AnimationController';

/** Temporary procedural survivor model. Replace with an original rigged GLB later. */
export class Player {
  readonly root = new THREE.Group();

  private readonly visual = new THREE.Group();
  private readonly animator = new ActorAnimator(this.visual, ['idle', 'walk', 'run', 'attack']);
  private leftArm!: THREE.Mesh;
  private leftLeg!: THREE.Group;
  private rightLeg!: THREE.Group;
  private fallbackModel!: THREE.Group;
  private rightArm!: THREE.Mesh;
  private walkClock = 0;
  private isMoving = false;
  private movementBlend = 0;
  private sprintBlend = 0;
  private idleClock = 0;
  private attackTime = 0;
  private clothTexture: THREE.CanvasTexture | null = null;
  private health = 100;
  aiming = false;
  aimYaw = 0;

  constructor(private readonly scene: THREE.Scene) {
    this.root.name = 'player';
    this.visual.name = 'player-visual';
    this.root.add(this.visual);
    this.createModel();
    this.scene.add(this.root);
  }

  private createModel(): void {
    this.fallbackModel = new THREE.Group();
    this.visual.add(this.fallbackModel);
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const context=canvas.getContext('2d')!;
    context.fillStyle='#989b90';context.fillRect(0,0,128,128);
    for(let y=0;y<128;y+=2)for(let x=0;x<128;x+=2){const value=110+((x*17+y*31)%60);context.fillStyle=`rgb(${value},${value},${value})`;context.fillRect(x,y,1,2);}
    this.clothTexture=new THREE.CanvasTexture(canvas);this.clothTexture.wrapS=this.clothTexture.wrapT=THREE.RepeatWrapping;this.clothTexture.repeat.set(4,4);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x484e42, map:this.clothTexture,bumpMap:this.clothTexture,bumpScale:.015,roughness: 0.96 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x262c28, roughness: 0.92 });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xd5b89a, roughness: 0.9 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0x796e58, roughness: 0.72 });
    const visorMaterial = new THREE.MeshStandardMaterial({ color: 0x17231e, roughness: 0.3, metalness: 0.15 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.255, 0.58, 7, 14), bodyMaterial);
    torso.position.y = 1.03;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.fallbackModel.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.205, 20, 16), skinMaterial);
    head.position.set(0, 1.88, -0.015);
    head.castShadow = true;
    this.fallbackModel.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.105, 0.075), visorMaterial);
    visor.position.set(0, 1.91, -0.266);
    visor.castShadow = true;
    this.fallbackModel.add(visor);

    const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.13, 0.3), accentMaterial);
    scarf.position.set(0, 1.55, -0.015);
    scarf.castShadow = true;
    this.fallbackModel.add(scarf);

    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.55, 0.24), darkMaterial);
    backpack.position.set(0, 1.08, 0.34);
    backpack.castShadow = true;
    this.fallbackModel.add(backpack);

    const armGeometry = new THREE.CapsuleGeometry(0.115, 0.47, 4, 8);
    this.leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
    this.rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
    this.leftArm.position.set(-0.32, 1.14, -0.01);
    this.rightArm.position.set(0.32, 1.14, -0.01);
    this.leftArm.rotation.z = -0.12;
    this.rightArm.rotation.z = 0.12;
    this.leftArm.castShadow = true;
    this.rightArm.castShadow = true;
    this.fallbackModel.add(this.leftArm, this.rightArm);

    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.045, 6, 16), darkMaterial);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.73;
    this.fallbackModel.add(belt);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x384b3e, roughness: 0.94 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x1e2723, roughness: 0.93 });
    this.leftLeg = new THREE.Group(); this.rightLeg = new THREE.Group();
    for (const [i, leg] of [this.leftLeg, this.rightLeg].entries()) {
      leg.position.set(i === 0 ? -0.17 : 0.17, 0.77, 0);
      const trouser = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.37, 4, 8), legMat);
      trouser.position.y = -0.29; trouser.castShadow = true;
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.19, 0.34), bootMat);
      boot.position.set(0, -0.63, -0.08); boot.castShadow = true;
      leg.add(trouser, boot);
      this.fallbackModel.add(leg);
    }
    this.addExpeditionEquipment();
  }

  /** Original meshes, built at runtime with no external model/IP dependency. */
  private addExpeditionEquipment(): void {
    const coat = new THREE.MeshStandardMaterial({ color: 0x434b43, roughness: 0.93, flatShading: false });
    const trim = new THREE.MeshStandardMaterial({ color: 0x8c826b, roughness: 0.8 });
    const rust = new THREE.MeshStandardMaterial({ color: 0x796958, roughness: 0.79 });
    const charcoal = new THREE.MeshStandardMaterial({ color: 0x182c2a, roughness: 0.82 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x6b7971, emissive: 0x17211b, emissiveIntensity: 0.04, metalness: 0.15, roughness: 0.3 });
    const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.fallbackModel): THREE.Mesh => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };
    // Expedition hood and segmented visor: face looks intentional from frontal and rear angles.
    const hood = add(new THREE.SphereGeometry(0.231, 20, 16), coat, 0, 1.925, 0.03);
    hood.scale.set(1.13, 1.04, 1.08);
    const mask = add(new THREE.BoxGeometry(0.27, 0.14, 0.08), charcoal, 0, 1.785, -0.29);
    mask.rotation.x = -0.14;
    add(new THREE.BoxGeometry(0.30, 0.06, 0.035), glass, 0, 1.915, -0.338);
    for (const side of [-1, 1]) {
      // Utility pouch, armband and buckles.
      add(new THREE.BoxGeometry(0.19, 0.25, 0.18), charcoal, side * 0.36, 0.79, 0.11);
      add(new THREE.BoxGeometry(0.14, 0.04, 0.2), trim, side * 0.36, 0.91, 0.11);
      add(new THREE.BoxGeometry(0.15, 0.11, 0.02), rust, side * 0.43, 1.2, -0.06);
      const kneepad = add(new THREE.IcosahedronGeometry(0.14, 1), charcoal, 0, -0.41, -0.145, side < 0 ? this.leftLeg : this.rightLeg);
      kneepad.scale.set(1.05, 0.82, 0.52);
    }
    // Field radio transmitter: unmistakable back silhouette.
    add(new THREE.CylinderGeometry(0.018, 0.026, 0.5, 6), charcoal, 0.24, 1.75, 0.45);
    add(new THREE.SphereGeometry(0.055, 8, 6), glass, 0.24, 2.03, 0.45);
    add(new THREE.BoxGeometry(0.46, 0.22, 0.11), coat, 0, 1.48, 0.54);
    add(new THREE.BoxGeometry(0.37, 0.055, 0.12), trim, 0, 1.48, 0.61);
  }

  update(direction: THREE.Vector3, deltaSeconds: number, sprinting: boolean, world: World): void {
    this.isMoving = direction.lengthSq() > 0.0001 && this.health > 0;

    if (this.isMoving) {
      direction.normalize();
      const speed = sprinting ? 8.0 : 4.8;
      this.root.position.addScaledVector(direction, speed * deltaSeconds);
      world.constrainPlayerPosition(this.root.position);

      const targetYaw = this.aiming ? this.aimYaw : Math.atan2(-direction.x, -direction.z);
      const angleDifference = THREE.MathUtils.euclideanModulo(
        targetYaw - this.root.rotation.y + Math.PI,
        Math.PI * 2,
      ) - Math.PI;
      this.root.rotation.y += angleDifference * Math.min(1, deltaSeconds * 13);
    }

    if (this.aiming) this.root.rotation.y = this.aimYaw;
    this.movementBlend = THREE.MathUtils.damp(this.movementBlend, this.isMoving ? 1 : 0, 10, deltaSeconds);
    this.sprintBlend = THREE.MathUtils.damp(this.sprintBlend, this.isMoving && sprinting ? 1 : 0, 9, deltaSeconds);
    this.idleClock += deltaSeconds;
    this.animator.setState(this.attackTime > 0 ? 'attack' : this.isMoving ? (sprinting ? 'run' : 'walk') : 'idle');
    this.animator.update(deltaSeconds);
    this.walkClock += deltaSeconds * (sprinting ? 13 : 9);
    this.attackTime = Math.max(0, this.attackTime - deltaSeconds);
    const bob = this.movementBlend * Math.abs(Math.sin(this.walkClock)) * (0.045 + this.sprintBlend * 0.045)
      + Math.sin(this.idleClock * 1.9) * 0.009;
    this.visual.position.y = bob;
    const armSwing = this.movementBlend * Math.sin(this.walkClock) * (0.28 + this.sprintBlend * 0.2);
    const attackProgress = this.attackTime > 0 ? 1 - this.attackTime / 0.28 : 0;
    const attackSwing = attackProgress > 0 ? Math.sin(attackProgress * Math.PI) * 1.85 : 0;
    this.fallbackModel.visible = !this.animator.installed;
    this.leftLeg.rotation.x = -armSwing * 1.25;
    this.leftLeg.rotation.z = -0.025 * this.movementBlend;
    this.rightLeg.rotation.x = armSwing * 1.25;
    this.rightLeg.rotation.z = 0.025 * this.movementBlend;
    this.fallbackModel.rotation.z = this.movementBlend * Math.sin(this.walkClock) * 0.02;
    this.fallbackModel.rotation.x = this.sprintBlend * -0.075;
    this.leftArm.rotation.x = this.aiming ? -1.1 : armSwing;
    this.rightArm.rotation.x = this.aiming ? -1.4 : -armSwing - attackSwing;
  }

  triggerAttack(): void {
    this.animator.setState('attack');
    this.attackTime = 0.28;
  }

  takeDamage(amount: number): number {
    if (this.health <= 0) return 0;
    const applied = Math.min(this.health, Math.max(0, amount));
    this.health = Math.max(0, this.health - applied);
    return applied;
  }

  getHealth(): number {
    return this.health;
  }

  getPosition(): THREE.Vector3 {
    return this.root.position;
  }

  async installModel(entry: ModelEntry): Promise<void> {
    if (await this.animator.load(entry)) this.fallbackModel.visible = false;
  }

  reset(): void {
    this.health = 100;
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.visual.position.set(0, 0, 0);
    this.attackTime = 0;
  }

  dispose(): void {
    this.clothTexture?.dispose();
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
