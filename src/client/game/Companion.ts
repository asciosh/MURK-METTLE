import { buildCreatureArt } from './CreatureArt';
import type { ModRegistry } from '../mods/ModRegistry';
import type { ModVisual } from '../mods/ModVisual';
import * as THREE from 'three';
import type { World } from './World';
import type { ModelEntry } from './AnimationController';
import { CREATURES, evolutionStage, type SpeciesId } from '../../../shared/expansion.mjs';

/** Five original species with distinct silhouettes and three visible growth stages. */
export class Companion {
  readonly root = new THREE.Group();
  private readonly visual = new THREE.Group();
  private readonly cosmeticMount = new THREE.Group();
  private cosmetic: ModVisual | null = null;
  private cosmeticGeneration = 0;
  private cosmeticId = '';
  private unsubscribeCosmetic?: () => void;
  private disposed = false;
  private cosmeticEffects = true;
  private readonly aura: THREE.Mesh;
  private readonly light: THREE.PointLight;
  private bound = false;
  private elapsed = 0;
  private pulseTime = 0;
  private stage = -1;
  private readonly wings: { pivot: THREE.Group; side: number }[] = [];
  private readonly tails: { mesh: THREE.Object3D; rest: number }[] = [];
  private readonly legs: { mesh: THREE.Object3D; phase: number }[] = [];
  private gaitBlend = 0;
  private readonly eyes: THREE.Group[] = [];
  private readonly petals: { mesh: THREE.Mesh; x: number; z: number }[] = [];
  private readonly luminous = new Set<THREE.MeshStandardMaterial>();
  speciesId: SpeciesId = 'lanternkin';
  constructor(
    private readonly scene: THREE.Scene,
    species: SpeciesId = 'lanternkin',
    private readonly cosmetics?: ModRegistry,
  ) {
    this.root.add(this.visual, this.cosmeticMount);
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
    this.unsubscribeCosmetic = cosmetics?.subscribe(() => this.refreshCosmetic());
  }
  private clearVisual(): void {
    this.wings.length = 0;
    this.petals.length = 0;
    this.luminous.clear();
    this.tails.length = 0;
    this.legs.length = 0;
    this.eyes.length = 0;
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.visual.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
      }
    });
    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
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
    buildCreatureArt(this.visual, species, stage, {
      wings: this.wings, tails: this.tails, legs: this.legs, petals: this.petals,
      eyes: this.eyes, luminous: this.luminous,
    });
    this.visual.scale.setScalar(1 + stage * 0.28);
    this.visual.userData = { species, stage, authoring: 'original-procedural-v0.27' };
    this.light.color.setHex(def.glow);
    (this.aura.material as THREE.MeshBasicMaterial).color.setHex(def.glow);
    if (changed) this.triggerPulse();
    this.refreshCosmetic();
  }
  private refreshCosmetic(): void {
    const id = this.cosmetics?.selection(this.speciesId) || '';
    if (this.disposed || id === this.cosmeticId) return;
    this.cosmeticId = id;
    const generation = ++this.cosmeticGeneration;
    this.cosmetic?.dispose();
    this.cosmetic = null;
    this.visual.visible = true;
    if (!id || !this.cosmetics) return;
    void this.cosmetics.acquire(this.speciesId).then((visual) => {
      if (!visual) return;
      if (this.disposed || generation !== this.cosmeticGeneration) {
        visual.dispose();
        return;
      }
      this.cosmetic = visual;
      this.cosmeticMount.add(visual.root);
      this.visual.visible = false;
    });
  }
  setLightEnabled(value: boolean): void {
    this.light.visible = value;
    this.cosmeticEffects = value;
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
    this.cosmetic?.pulse();
  }
  update(dt: number, position: THREE.Vector3, yaw: number, world: World): void {
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
    const walking = this.bound && Math.hypot(target.x - this.root.position.x, target.z - this.root.position.z) > 0.2;
    this.animateParts(dt, walking);
    this.root.position.lerp(target, 1 - Math.exp(-4 * dt));
    const y = this.root.position.y;
    world.constrainActorPosition(this.root.position, 0.3);
    this.root.position.y = y;
    this.root.position.y = height + Math.sin(this.elapsed * 2.3) * 0.055;
    let facing = this.bound ? yaw : Math.sin(this.elapsed * 0.4) * 0.25;
    if (!this.bound && this.root.position.distanceToSquared(position) < 64)
      facing = Math.atan2(this.root.position.x - position.x, this.root.position.z - position.z);
    const turn = THREE.MathUtils.euclideanModulo(facing - this.root.rotation.y + Math.PI, Math.PI * 2) - Math.PI;
    this.root.rotation.y += turn * (1 - Math.exp(-5 * dt));
    this.animateAura(height);
  }
  private animateParts(dt: number, walking: boolean): void {
    this.elapsed += dt;
    this.cosmetic?.update(dt, walking, this.cosmeticEffects);
    this.pulseTime = Math.max(0, this.pulseTime - dt);
    const pulse = this.pulseTime > 0 ? Math.sin((1 - this.pulseTime / 0.65) * Math.PI) : 0;
    for (const [i, petal] of this.petals.entries()) {
      const breath = Math.sin(this.elapsed * 2.3 + i * 0.35) * 0.04 + pulse * 0.3;
      petal.mesh.rotation.x = petal.x * (1 + breath);
      petal.mesh.rotation.z = petal.z * (1 + breath);
    }
    for (const material of this.luminous)
      material.emissiveIntensity = 0.28 + Math.sin(this.elapsed * 2.3) * 0.055 + pulse * 0.65;
    const size = (1 + this.stage * 0.28) * (1 + pulse * 0.09);
    this.visual.scale.set(size * (1 + pulse * 0.04), size, size * (1 + pulse * 0.04));
    this.cosmeticMount.scale.copy(this.visual.scale);
    // A short blink reads at third-person scale. Eye groups retain their local face placement.
    const blinkPhase = this.elapsed % 4.7;
    const blink = blinkPhase < 0.16 ? 1 - Math.sin(blinkPhase / 0.16 * Math.PI) * 0.94 : 1;
    for (const eye of this.eyes) eye.scale.y = blink;
    this.gaitBlend = THREE.MathUtils.damp(this.gaitBlend, walking ? 1 : 0, 7, dt);
    for (const wing of this.wings)
      wing.pivot.rotation.z =
        wing.side *
        (0.08 +
          Math.sin(this.elapsed * (this.speciesId === 'stormrook' ? 8 : 3.5)) *
            (this.speciesId === 'stormrook' ? 0.32 : 0.12));
    for (const [i, tail] of this.tails.entries())
      tail.mesh.rotation.y = tail.rest + Math.sin(this.elapsed * 3.5 + i * 0.3) * 0.15;
    for (const leg of this.legs) leg.mesh.rotation.x = Math.sin(this.elapsed * 9 + leg.phase) * 0.34 * this.gaitBlend;
  }
  private animateAura(height: number): void {
    this.visual.rotation.z = Math.sin(this.elapsed * 2) * (this.speciesId === 'mossback' ? 0.012 : 0.025);
    // Growing grounded forms must not sink into the unchanged collision floor. Only the
    // official mesh is offset; remote positions and mod normalization contracts stay intact.
    const footDepth = this.speciesId === 'emberling' ? 0.512 : this.speciesId === 'mossback' ? 0.372 : 0;
    this.visual.position.y = footDepth ? footDepth * (this.visual.scale.y - 1) - Math.sin(this.elapsed * 2.3) * 0.055 : 0;
    this.cosmeticMount.rotation.copy(this.visual.rotation);
    const progress = this.pulseTime > 0 ? 1 - this.pulseTime / 0.65 : 0;
    this.aura.scale.setScalar(this.pulseTime > 0 ? 1 + progress * 18 : 1);
    this.aura.position.y = -height + 0.035;
    (this.aura.material as THREE.MeshBasicMaterial).opacity = this.pulseTime > 0 ? (1 - progress) * 0.7 : 0.12;
    this.light.intensity = this.pulseTime > 0 ? 5 : 1.2;
  }
  updateRemote(dt: number, position: THREE.Vector3, yaw: number, moving: boolean): void {
    this.animateParts(dt, moving);
    const height = this.speciesId === 'mossback' ? 0.43 : this.speciesId === 'emberling' ? 0.58 : 1.25;
    this.root.position.set(position.x, height + Math.sin(this.elapsed * 2.3) * 0.055, position.z);
    this.root.rotation.y = yaw;
    this.animateAura(height);
  }
  async installModel(_entry: ModelEntry): Promise<void> {
    /* Species growth currently uses original procedural meshes. */
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.cosmeticGeneration++;
    this.unsubscribeCosmetic?.();
    this.cosmetic?.dispose();
    this.cosmetic = null;
    this.clearVisual();
    this.aura.geometry.dispose();
    (this.aura.material as THREE.Material).dispose();
    this.light.dispose();
    this.scene.remove(this.root);
  }
}
