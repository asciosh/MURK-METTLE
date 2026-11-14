import * as THREE from 'three';
import { springStep, impactBudget } from './combat-feedback.mjs';
import { CombatAudio } from './CombatAudio';
/** Bounded cosmetic state; never supplies aim, movement, health or network data. */
export class CombatFeedback {
  readonly audio = new CombatAudio();
  readonly camera = new THREE.PerspectiveCamera();
  private readonly velocity = new THREE.Vector3();
  private initialized = false;
  private kick = 0;
  private shake = 0;
  private age = 0;
  private budget = 40;
  private hitTime = 0;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly geometry = new THREE.BufferGeometry();
  private readonly positions = new Float32Array(64 * 3);
  private readonly particles: { position: THREE.Vector3; velocity: THREE.Vector3; life: number }[] = [];
  private readonly points: THREE.Points;
  private readonly label = document.querySelector<HTMLElement>('#hit-feedback');
  constructor(private readonly scene: THREE.Scene) {
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setDrawRange(0, 0);
    this.points = new THREE.Points(
      this.geometry,
      new THREE.PointsMaterial({ color: 0xd8b58a, size: 0.055, depthWrite: false, transparent: true, opacity: 0.85 }),
    );
    this.points.name = 'cosmetic-combat-impacts';
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  setQuality(quality: string): void {
    this.budget = impactBudget(quality);
    this.particles.length = Math.min(this.particles.length, this.budget);
  }
  shot(weapon: 'pistol' | 'rifle'): void {
    this.kick = Math.min(0.035, this.kick + (weapon === 'pistol' ? 0.016 : 0.009));
  }
  hurt(): void {
    this.shake = 0.012;
    this.audio.play('hurt');
  }
  confirm(kill = false): void {
    this.hitTime = 0.2;
    if (this.label) {
      this.label.textContent = kill ? 'ELIMINATED' : 'HIT';
      this.label.dataset.kind = kill ? 'kill' : 'hit';
    }
    this.audio.play('hit');
  }
  impact(position: THREE.Vector3): void {
    if (this.reduced.matches) return;
    for (let i = 0; i < 6 && this.particles.length < this.budget; i++) {
      const angle = this.age * 7 + i * 2.4;
      this.particles.push({
        position: position.clone(),
        velocity: new THREE.Vector3(Math.cos(angle) * 1.3, 0.8 + i * 0.15, Math.sin(angle) * 1.3),
        life: 0.28 + i * 0.02,
      });
    }
  }
  update(dt: number): void {
    this.age += dt;
    this.kick *= Math.exp(-18 * dt);
    this.shake *= Math.exp(-16 * dt);
    this.hitTime = Math.max(0, this.hitTime - dt);
    this.label?.classList.toggle('visible', this.hitTime > 0);
    let count = 0;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.velocity.y -= dt * 4;
      p.position.addScaledVector(p.velocity, dt);
      p.position.toArray(this.positions, count++ * 3);
    }
    this.points.visible = count > 0;
    this.geometry.setDrawRange(0, count);
    this.geometry.getAttribute('position').needsUpdate = true;
  }
  prepareCamera(aim: THREE.PerspectiveCamera, dt: number): void {
    if (!this.initialized || this.camera.position.distanceTo(aim.position) > 4 || this.reduced.matches) {
      this.camera.position.copy(aim.position);
      this.velocity.set(0, 0, 0);
      this.initialized = true;
    } else
      for (const axis of ['x', 'y', 'z'] as const) {
        const next = springStep(this.camera.position[axis], this.velocity[axis], aim.position[axis], dt, 24);
        this.camera.position[axis] = next.position;
        this.velocity[axis] = next.velocity;
      }
    this.camera.quaternion.copy(aim.quaternion);
    this.camera.projectionMatrix.copy(aim.projectionMatrix);
    this.camera.projectionMatrixInverse.copy(aim.projectionMatrixInverse);
    this.camera.near = aim.near;
    this.camera.far = aim.far;
    if (!this.reduced.matches) this.camera.rotateX(this.kick + Math.sin(this.age * 71) * this.shake);
    this.camera.updateMatrixWorld();
  }
  reset(): void {
    this.initialized = false;
    this.kick = this.shake = this.hitTime = 0;
    this.particles.length = 0;
    this.geometry.setDrawRange(0, 0);
  }
  dispose(): void {
    this.audio.dispose();
    this.scene.remove(this.points);
    this.geometry.dispose();
    (this.points.material as THREE.Material).dispose();
  }
}
