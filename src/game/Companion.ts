import * as THREE from 'three';
import type { World } from './World';

/** Original procedural companion species. This class contains no external assets. */
export class Companion {
  readonly root = new THREE.Group();
  readonly speciesId = 'lanternkin';
  private readonly glow: THREE.PointLight;
  private readonly body: THREE.Mesh;
  private readonly aura: THREE.Mesh;
  private bound = false;
  private elapsed = 0;
  private pulseTime = 0;
  private readonly wildPosition = new THREE.Vector3(4.2, 0, -3.8);

  constructor(private readonly scene: THREE.Scene) {
    const core = new THREE.MeshStandardMaterial({ color: 0x94e8a9, emissive: 0x40cd8b, emissiveIntensity: 0.85, roughness: 0.36 });
    const leaves = new THREE.MeshStandardMaterial({ color: 0x285d42, roughness: 0.8, side: THREE.DoubleSide });
    const accent = new THREE.MeshStandardMaterial({ color: 0xf7f1c1, emissive: 0xcdbf62, emissiveIntensity: 0.45 });
    this.body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), core);
    this.body.castShadow = true;
    this.root.add(this.body);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.62, 3), leaves);
      const angle = i * Math.PI * 2 / 5;
      leaf.position.set(Math.cos(angle) * 0.28, 0.12, Math.sin(angle) * 0.28);
      leaf.rotation.z = Math.cos(angle) * -0.55;
      leaf.rotation.x = Math.sin(angle) * 0.55;
      this.root.add(leaf);
    }
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), accent);
      eye.position.set(side * 0.12, 0.02, -0.36);
      this.root.add(eye);
    }
    this.aura = new THREE.Mesh(
      new THREE.RingGeometry(0.55, 0.66, 40),
      new THREE.MeshBasicMaterial({ color: 0x9bfbc3, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false }),
    );
    this.aura.rotation.x = -Math.PI / 2;
    this.aura.position.y = -0.62;
    this.root.add(this.aura);
    this.glow = new THREE.PointLight(0x6aeabb, 1.8, 5.5, 2);
    this.root.add(this.glow);
    this.root.position.copy(this.wildPosition).add(new THREE.Vector3(0, 1.5, 0));
    this.scene.add(this.root);
  }

  isBound(): boolean { return this.bound; }

  getPosition(): THREE.Vector3 { return this.root.position; }

  canBond(playerPosition: THREE.Vector3): boolean {
    return !this.bound && this.wildPosition.distanceTo(playerPosition) < 2.7;
  }

  bond(): void { this.bound = true; }

  triggerPulse(): void { this.pulseTime = 0.5; }

  update(dt: number, playerPosition: THREE.Vector3, playerYaw: number, world: World): void {
    this.elapsed += dt;
    this.pulseTime = Math.max(0, this.pulseTime - dt);
    const target = this.bound
      ? playerPosition.clone().add(new THREE.Vector3(Math.sin(playerYaw) * 1.45, 1.48, Math.cos(playerYaw) * 1.45))
      : this.wildPosition.clone().add(new THREE.Vector3(0, 1.48, 0));
    const oldY = this.root.position.y;
    const lerpAmount = 1 - Math.exp(-(this.bound ? 5.1 : 1.4) * dt);
    this.root.position.lerp(target, lerpAmount);
    // Companion follows the player without becoming trapped inside simple props.
    const grounded = this.root.position.clone();
    grounded.y = 0;
    world.constrainPlayerPosition(grounded);
    this.root.position.x = grounded.x;
    this.root.position.z = grounded.z;
    this.root.position.y = THREE.MathUtils.lerp(oldY, target.y, lerpAmount) + Math.sin(this.elapsed * 3.1) * 0.012;
    this.root.rotation.y += dt * 0.7;
    this.body.rotation.z = Math.sin(this.elapsed * 2.8) * 0.12;
    const pulseProgress = this.pulseTime > 0 ? 1 - this.pulseTime / 0.5 : 0;
    const scale = this.pulseTime > 0 ? 1 + pulseProgress * 8 : 1;
    this.aura.scale.setScalar(scale);
    (this.aura.material as THREE.MeshBasicMaterial).opacity = this.pulseTime > 0 ? (1 - pulseProgress) * 0.9 : 0.45;
    this.glow.intensity = this.pulseTime > 0 ? 3.5 : 1.8 + Math.sin(this.elapsed * 2) * 0.25;
  }

  dispose(): void {
    this.scene.remove(this.root);
    this.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    });
    this.glow.dispose();
  }
}
