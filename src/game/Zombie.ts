import * as THREE from 'three';
import type { World } from './World';

type ZombieState = 'idle' | 'chase' | 'attack' | 'dead';

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
  private readonly leftArm = new THREE.Group();
  private readonly rightArm = new THREE.Group();
  private health = 100;
  private state: ZombieState = 'idle';
  private attackCooldown = 0.6;
  private animationClock = 0;
  private hitFlashTime = 0;

  constructor(private readonly scene: THREE.Scene, position: THREE.Vector3) {
    this.root.name = 'infected-runner';
    this.root.position.copy(position);
    this.createModel();
    this.scene.add(this.root);
  }

  private createModel(): void {
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.39, 0.76, 5, 10), this.bodyMaterial);
    torso.position.y = 1.02;
    torso.rotation.z = -0.11;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.root.add(torso);

    const chestPatch = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), this.darkMaterial);
    chestPatch.position.set(0.18, 1.19, -0.29);
    chestPatch.scale.set(1.1, 0.75, 0.35);
    chestPatch.castShadow = true;
    this.root.add(chestPatch);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), this.bodyMaterial);
    head.position.set(0.04, 1.91, -0.11);
    head.rotation.z = -0.18;
    head.castShadow = true;
    this.root.add(head);

    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.13, 0.22), this.darkMaterial);
    jaw.position.set(0.04, 1.72, -0.35);
    jaw.rotation.x = -0.16;
    this.root.add(jaw);

    for (const x of [-0.105, 0.105]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), this.eyeMaterial);
      eye.position.set(x + 0.04, 1.94, -0.39);
      this.root.add(eye);
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
    this.root.add(this.leftArm, this.rightArm);

    const legGeometry = new THREE.CapsuleGeometry(0.145, 0.46, 4, 8);
    for (const x of [-0.19, 0.19]) {
      const leg = new THREE.Mesh(legGeometry, this.darkMaterial);
      leg.position.set(x, 0.38, 0.025);
      leg.castShadow = true;
      this.root.add(leg);
    }

    const spore = new THREE.Mesh(
      new THREE.SphereGeometry(0.16, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x9fb96d, emissive: 0x3c5520, emissiveIntensity: 0.7 }),
    );
    spore.position.set(-0.26, 1.52, 0.25);
    spore.scale.set(1, 0.75, 1);
    spore.castShadow = true;
    this.root.add(spore);
  }

  /** Returns true when the zombie lands a melee hit this frame. */
  update(playerPosition: THREE.Vector3, deltaSeconds: number, world: World): boolean {
    if (this.state === 'dead') return false;

    this.animationClock += deltaSeconds;
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
      if (distance > 0.001) {
        toPlayer.normalize();
        this.faceDirection(toPlayer);
        this.root.position.addScaledVector(toPlayer, 2.35 * deltaSeconds);
        world.constrainActorPosition(this.root.position, 0.43);
      }
      const gait = Math.sin(this.animationClock * 8.5);
      this.leftArm.rotation.x = -0.48 + gait * 0.28;
      this.rightArm.rotation.x = -0.48 - gait * 0.28;
      this.root.position.y = Math.abs(gait) * 0.035;
    } else {
      this.state = 'idle';
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
      this.root.visible = false;
      return true;
    }
    return false;
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

  dispose(): void {
    this.scene.remove(this.root);
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
  }
}
