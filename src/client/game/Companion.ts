import * as THREE from 'three';
import type { World } from './World';
import type { ModelEntry } from './AnimationController';
import { CREATURES, evolutionStage, type SpeciesId } from '../../../shared/expansion.mjs';

/** Five original species with distinct silhouettes and three visible growth stages. */
export class Companion {
  readonly root = new THREE.Group();
  private readonly visual = new THREE.Group();
  private readonly aura: THREE.Mesh;
  private readonly light: THREE.PointLight;
  private bound = false;
  private elapsed = 0;
  private pulseTime = 0;
  private stage = -1;
  speciesId: SpeciesId = 'lanternkin';
  constructor(
    private readonly scene: THREE.Scene,
    species: SpeciesId = 'lanternkin',
  ) {
    this.root.add(this.visual);
    this.aura = new THREE.Mesh(
      new THREE.RingGeometry(0.45, 0.49, 48),
      new THREE.MeshBasicMaterial({
        color: CREATURES[species].glow,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    this.aura.rotation.x = -Math.PI / 2;
    this.aura.position.y = -1.05;
    this.root.add(this.aura);
    this.light = new THREE.PointLight(CREATURES[species].glow, 1.5, 6);
    this.root.add(this.light);
    this.setForm(species, 0);
    this.retreat();
    this.scene.add(this.root);
  }
  private clearVisual(): void {
    this.visual.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        (o.material as THREE.Material).dispose();
      }
    });
    this.visual.clear();
  }
  setForm(species: SpeciesId, xp: number): void {
    const stage = evolutionStage(xp);
    if (this.speciesId === species && stage === this.stage) return;
    const changed = this.stage >= 0;
    this.speciesId = species;
    this.stage = stage;
    this.clearVisual();
    const def = CREATURES[species];
    const body = new THREE.MeshStandardMaterial({ color: def.color, roughness: 0.82, metalness: 0.04 });
    const dark = new THREE.MeshStandardMaterial({
      color: species === 'emberling' ? 0x3e342e : 0x344d43,
      roughness: 0.95,
    });
    const glow = new THREE.MeshStandardMaterial({
      color: def.glow,
      emissive: def.glow,
      emissiveIntensity: 0.9,
      roughness: 0.35,
    });
    const add = (
      geo: THREE.BufferGeometry,
      mat: THREE.Material,
      x: number,
      y: number,
      z: number,
      sx = 1,
      sy = 1,
      sz = 1,
    ) => {
      const m = new THREE.Mesh(geo, mat.clone());
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.castShadow = true;
      this.visual.add(m);
      return m;
    };
    const scale = 1 + stage * 0.28;
    this.visual.scale.setScalar(scale);
    if (species === 'lanternkin') {
      add(new THREE.SphereGeometry(0.35, 24, 16), body, 0, 0, 0, 0.85, 1.2, 0.8);
      add(new THREE.SphereGeometry(0.21, 20, 14), glow, 0, -0.01, -0.18, 0.8, 1, 0.5);
      for (let i = 0; i < 6 + stage * 3; i++) {
        const a = (i / (6 + stage * 3)) * Math.PI * 2;
        const leaf = add(
          new THREE.SphereGeometry(0.22, 14, 10),
          dark,
          Math.cos(a) * 0.28,
          0.13,
          Math.sin(a) * 0.28,
          0.45,
          2,
          0.25,
        );
        leaf.rotation.z = -Math.cos(a) * 0.6;
        leaf.rotation.x = Math.sin(a) * 0.6;
      }
      for (const s of [-1, 1]) {
        const antler = add(new THREE.CylinderGeometry(0.012, 0.035, 0.5 + stage * 0.18, 7), dark, s * 0.18, 0.55, 0);
        antler.rotation.z = -s * 0.3;
        add(new THREE.SphereGeometry(0.065, 12, 8), glow, s * 0.26, 0.82 + stage * 0.13, 0);
      }
    } else if (species === 'emberling') {
      add(new THREE.SphereGeometry(0.36, 24, 16), body, 0, 0, 0, 0.8, 0.9, 1.4);
      add(new THREE.SphereGeometry(0.25, 20, 14), body, 0, 0.22, -0.39, 0.85, 0.95, 1.2);
      add(new THREE.SphereGeometry(0.13, 16, 12), dark, 0, 0.16, -0.64, 1, 0.6, 1.2);
      for (const s of [-1, 1]) {
        const ear = add(new THREE.ConeGeometry(0.1, 0.36 + stage * 0.15, 14), body, s * 0.15, 0.53, -0.34);
        ear.rotation.z = s * 0.25;
        for (const z of [-0.25, 0.28]) add(new THREE.CapsuleGeometry(0.07, 0.22, 5, 8), dark, s * 0.21, -0.3, z);
        add(new THREE.SphereGeometry(0.035, 12, 8), glow, s * 0.16, 0.27, -0.57);
        if (stage > 0) {
          const horn = add(new THREE.ConeGeometry(0.065, 0.4 + stage * 0.15, 12), glow, s * 0.22, 0.62, -0.15);
          horn.rotation.z = -s * 0.4;
        }
      }
      const tail = add(new THREE.CapsuleGeometry(0.11, 0.55, 6, 12), body, 0, 0.18, 0.66);
      tail.rotation.x = 1.1;
      add(new THREE.SphereGeometry(0.13, 16, 12), glow, 0, 0.45, 0.92);
    } else if (species === 'mossback') {
      add(new THREE.SphereGeometry(0.4, 24, 16), body, 0, -0.05, 0, 1.2, 0.7, 1.4);
      add(new THREE.SphereGeometry(0.4, 24, 16), dark, 0, 0.12, 0.08, 1.25, 0.72, 1.35);
      add(new THREE.SphereGeometry(0.19, 18, 12), body, 0, -0.04, -0.55, 0.9, 0.85, 1.2);
      for (const side of [-1, 1]) {
        for (const z of [-0.29, 0.34]) add(new THREE.CapsuleGeometry(0.095, 0.12, 5, 10), body, side * 0.34, -0.28, z);
        add(new THREE.SphereGeometry(0.03, 12, 8), glow, side * 0.13, 0.01, -0.69);
        for (let i = 0; i < 2 + stage; i++) {
          const branch = add(
            new THREE.ConeGeometry(0.065, 0.23 + stage * 0.14, 10),
            dark,
            side * 0.23,
            0.42,
            i * 0.17 - 0.18,
          );
          branch.rotation.z = side * 0.38;
          if (stage > 0)
            add(
              new THREE.SphereGeometry(0.1, 12, 8),
              glow,
              side * 0.29,
              0.54 + stage * 0.06,
              i * 0.17 - 0.18,
              0.9,
              0.45,
              1.1,
            );
        }
      }
    } else if (species === 'stormrook') {
      add(new THREE.SphereGeometry(0.28, 22, 16), body, 0, 0, 0, 0.8, 1.15, 1.1);
      add(new THREE.SphereGeometry(0.19, 18, 14), body, 0, 0.32, -0.12);
      const beak = add(new THREE.ConeGeometry(0.075, 0.22, 12), dark, 0, 0.29, -0.34);
      beak.rotation.x = -Math.PI / 2;
      for (const side of [-1, 1]) {
        add(new THREE.SphereGeometry(0.03, 12, 8), glow, side * 0.13, 0.36, -0.25);
        for (let i = 0; i < 4 + stage; i++) {
          const feather = add(
            new THREE.SphereGeometry(0.2, 14, 10),
            i % 2 ? dark : body,
            side * (0.24 + i * 0.09),
            0.02,
            -0.04 + i * 0.07,
            0.42,
            0.2,
            2.1 + stage * 0.3,
          );
          feather.rotation.y = side * (0.2 + i * 0.1);
        }
        for (let i = 0; i <= stage; i++) {
          const crest = add(
            new THREE.ConeGeometry(0.045, 0.28 + stage * 0.1, 10),
            glow,
            side * 0.07,
            0.54,
            i * 0.08 - 0.08,
          );
          crest.rotation.z = -side * 0.3;
        }
      }
      for (const x of [-0.1, 0, 0.1]) {
        const tail = add(new THREE.SphereGeometry(0.18, 14, 10), dark, x, -0.03, 0.4, 0.35, 0.2, 1.7 + stage * 0.3);
        tail.rotation.y = -x;
      }
    } else {
      add(new THREE.SphereGeometry(0.35, 24, 16), body, 0, 0, 0, 1, 0.4, 1.5);
      for (const s of [-1, 1]) {
        const wing = add(
          new THREE.SphereGeometry(0.33, 20, 14),
          dark,
          s * 0.43,
          -0.01,
          0.05,
          1.6,
          0.12,
          1.1 + stage * 0.3,
        );
        wing.rotation.z = s * 0.2;
        add(new THREE.SphereGeometry(0.04, 12, 8), glow, s * 0.16, 0.1, -0.38);
      }
      const tail = add(new THREE.CapsuleGeometry(0.035, 0.8 + stage * 0.25, 5, 10), body, 0, -0.04, 0.7);
      tail.rotation.x = Math.PI / 2;
      if (stage > 0)
        for (const s of [-1, 1]) {
          const fin = add(new THREE.SphereGeometry(0.2, 18, 12), glow, s * 0.25, 0.18, 0.25, 0.25, 1 + stage * 0.4, 1);
          fin.rotation.z = -s * 0.3;
        }
    }
    body.dispose();
    dark.dispose();
    glow.dispose();
    this.light.color.setHex(def.glow);
    (this.aura.material as THREE.MeshBasicMaterial).color.setHex(def.glow);
    if (changed) this.triggerPulse();
  }
  isBound(): boolean {
    return this.bound;
  }
  getPosition(): THREE.Vector3 {
    return this.root.position;
  }
  canBond(position: THREE.Vector3): boolean {
    const d = CREATURES[this.speciesId];
    return !this.bound && Math.hypot(position.x - d.x, position.z - d.z) < 2.7;
  }
  bond(): void {
    this.bound = true;
  }
  retreat(): void {
    this.bound = false;
    const d = CREATURES[this.speciesId];
    this.root.position.set(d.x, 1.2, d.z);
  }
  triggerPulse(): void {
    this.pulseTime = 0.65;
  }
  update(dt: number, position: THREE.Vector3, yaw: number, world: World): void {
    this.elapsed += dt;
    this.pulseTime = Math.max(0, this.pulseTime - dt);
    const d = CREATURES[this.speciesId],
      height = this.speciesId === 'mossback' ? 0.43 : this.speciesId === 'emberling' ? 0.58 : 1.25;
    const target = this.bound
      ? position
          .clone()
          .add(
            new THREE.Vector3(
              Math.sin(yaw) * 1.6 + Math.cos(yaw) * 1.2,
              height,
              Math.cos(yaw) * 1.6 - Math.sin(yaw) * 1.2,
            ),
          )
      : new THREE.Vector3(d.x, height, d.z);
    this.root.position.lerp(target, 1 - Math.exp(-4 * dt));
    const y = this.root.position.y;
    world.constrainActorPosition(this.root.position, 0.3);
    this.root.position.y = y;
    this.root.position.y = height + Math.sin(this.elapsed * 2.3) * 0.055;
    this.root.rotation.y = this.bound ? yaw : Math.sin(this.elapsed * 0.4) * 0.25;
    this.visual.rotation.z = Math.sin(this.elapsed * 2) * 0.035;
    const progress = this.pulseTime > 0 ? 1 - this.pulseTime / 0.65 : 0;
    this.aura.scale.setScalar(this.pulseTime > 0 ? 1 + progress * 18 : 1);
    this.aura.position.y = -height + 0.035;
    (this.aura.material as THREE.MeshBasicMaterial).opacity = this.pulseTime > 0 ? (1 - progress) * 0.7 : 0.12;
    this.light.intensity = this.pulseTime > 0 ? 5 : 1.2;
  }
  async installModel(_entry: ModelEntry): Promise<void> {
    /* Species growth currently uses original procedural meshes. */
  }
  dispose(): void {
    this.clearVisual();
    this.aura.geometry.dispose();
    (this.aura.material as THREE.Material).dispose();
    this.light.dispose();
    this.scene.remove(this.root);
  }
}
