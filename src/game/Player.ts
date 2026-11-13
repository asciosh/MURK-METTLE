import * as THREE from 'three';
import type { World } from './World';

/** Temporary procedural survivor model. Replace with an original rigged GLB later. */
export class Player {
  readonly root = new THREE.Group();

  private readonly visual = new THREE.Group();
  private leftArm!: THREE.Mesh;
  private rightArm!: THREE.Mesh;
  private walkClock = 0;
  private isMoving = false;
  private attackTime = 0;
  private health = 100;

  constructor(private readonly scene: THREE.Scene) {
    this.root.name = 'player';
    this.visual.name = 'player-visual';
    this.root.add(this.visual);
    this.createModel();
    this.scene.add(this.root);
  }

  private createModel(): void {
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x536f58, roughness: 0.88 });
    const darkMaterial = new THREE.MeshStandardMaterial({ color: 0x26362e, roughness: 0.92 });
    const skinMaterial = new THREE.MeshStandardMaterial({ color: 0xd5b89a, roughness: 0.9 });
    const accentMaterial = new THREE.MeshStandardMaterial({ color: 0xd97945, roughness: 0.72 });
    const visorMaterial = new THREE.MeshStandardMaterial({ color: 0x17231e, roughness: 0.3, metalness: 0.15 });

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.78, 5, 10), bodyMaterial);
    torso.position.y = 1.03;
    torso.castShadow = true;
    torso.receiveShadow = true;
    this.visual.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 16, 12), skinMaterial);
    head.position.set(0, 1.88, -0.015);
    head.castShadow = true;
    this.visual.add(head);

    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.105, 0.075), visorMaterial);
    visor.position.set(0, 1.91, -0.266);
    visor.castShadow = true;
    this.visual.add(visor);

    const scarf = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.16, 0.4), accentMaterial);
    scarf.position.set(0, 1.55, -0.015);
    scarf.castShadow = true;
    this.visual.add(scarf);

    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.58, 0.27), darkMaterial);
    backpack.position.set(0, 1.08, 0.34);
    backpack.castShadow = true;
    this.visual.add(backpack);

    const armGeometry = new THREE.CapsuleGeometry(0.115, 0.47, 4, 8);
    this.leftArm = new THREE.Mesh(armGeometry, bodyMaterial);
    this.rightArm = new THREE.Mesh(armGeometry, bodyMaterial);
    this.leftArm.position.set(-0.43, 1.02, -0.01);
    this.rightArm.position.set(0.43, 1.02, -0.01);
    this.leftArm.rotation.z = -0.12;
    this.rightArm.rotation.z = 0.12;
    this.leftArm.castShadow = true;
    this.rightArm.castShadow = true;
    this.visual.add(this.leftArm, this.rightArm);

    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.045, 6, 16), darkMaterial);
    belt.rotation.x = Math.PI / 2;
    belt.position.y = 0.73;
    this.visual.add(belt);
  }

  update(direction: THREE.Vector3, deltaSeconds: number, sprinting: boolean, world: World): void {
    this.isMoving = direction.lengthSq() > 0.0001 && this.health > 0;

    if (this.isMoving) {
      direction.normalize();
      const speed = sprinting ? 8.0 : 4.8;
      this.root.position.addScaledVector(direction, speed * deltaSeconds);
      world.constrainPlayerPosition(this.root.position);

      const targetYaw = Math.atan2(-direction.x, -direction.z);
      const angleDifference = THREE.MathUtils.euclideanModulo(
        targetYaw - this.root.rotation.y + Math.PI,
        Math.PI * 2,
      ) - Math.PI;
      this.root.rotation.y += angleDifference * Math.min(1, deltaSeconds * 13);
    }

    this.walkClock += deltaSeconds * (sprinting ? 13 : 9);
    this.attackTime = Math.max(0, this.attackTime - deltaSeconds);
    const bob = this.isMoving ? Math.abs(Math.sin(this.walkClock)) * (sprinting ? 0.09 : 0.045) : 0;
    this.visual.position.y = bob;
    const armSwing = this.isMoving ? Math.sin(this.walkClock) * (sprinting ? 0.48 : 0.28) : 0;
    const attackProgress = this.attackTime > 0 ? 1 - this.attackTime / 0.28 : 0;
    const attackSwing = attackProgress > 0 ? Math.sin(attackProgress * Math.PI) * 1.85 : 0;
    this.leftArm.rotation.x = armSwing;
    this.rightArm.rotation.x = -armSwing - attackSwing;
  }

  triggerAttack(): void {
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

  reset(): void {
    this.health = 100;
    this.root.position.set(0, 0, 0);
    this.root.rotation.set(0, 0, 0);
    this.visual.position.set(0, 0, 0);
    this.attackTime = 0;
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
