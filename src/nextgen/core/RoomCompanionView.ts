import * as THREE from 'three/webgpu';
import { Companion } from '../../client/game/Companion';
import { CREATURES, creaturePower, type SpeciesId } from '../../../shared/expansion.mjs';
import { companionFollow } from './RoomFieldRules';
import { roomToScene } from './RoomIntent';

/** Original five-species art; the room's ownership, species and XP are authoritative. */
export class RoomCompanionView {
  private readonly pet: Companion;
  private readonly ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private position?: { x: number; z: number };
  private species: SpeciesId;
  private xp = 0;
  private pulseMs = 0;
  private pulseCount = 0;
  private visible = true;
  constructor(scene: THREE.Scene, species: SpeciesId) {
    this.species = species;
    this.pet = new Companion(scene, species);
    this.pet.setLightEnabled(false);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48), new THREE.MeshBasicMaterial({ color: CREATURES[species].glow, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);
  }
  update(owner: { x: number; z: number; yaw: number; hp: number }, species: SpeciesId, xp: number, dt: number) {
    this.species = species; this.xp = xp;
    this.pet.setForm(species, xp);
    this.visible = owner.hp > 0;
    this.pet.root.visible = this.visible;
    const target = companionFollow(owner, owner.yaw);
    const previous = this.position ?? target;
    const distance = Math.hypot(target.x - previous.x, target.z - previous.z);
    const alpha = distance > 8 ? 1 : 1 - Math.exp(-Math.min(100, Math.max(0, dt)) / 150);
    this.position = { x: previous.x + (target.x - previous.x) * alpha, z: previous.z + (target.z - previous.z) * alpha };
    this.pet.updateRemote(Math.min(100, Math.max(0, dt)) / 1000, new THREE.Vector3(...roomToScene(this.position.x, this.position.z)), owner.yaw, distance > 0.2 && distance <= 8);
    if (this.pulseMs > 0) {
      this.pulseMs = Math.max(0, this.pulseMs - Math.min(100, Math.max(0, dt)));
      const progress = 1 - this.pulseMs / 650;
      this.ring.scale.setScalar(Math.max(0.25, progress * creaturePower(this.species, this.xp).range));
      this.ring.material.opacity = (1 - progress) * 0.8;
    }
    this.ring.visible = this.pulseMs > 0 && this.visible;
  }
  /** Only called for a room-broadcast action:pulse event. No damage or cooldown authority. */
  pulse(origin: { x: number; z: number }) {
    this.pulseMs = 650; this.pulseCount++;
    this.pet.triggerPulse();
    this.ring.position.set(origin.x + 100, 0.04, origin.z + 100);
    this.ring.material.color.setHex(CREATURES[this.species].glow);
  }
  info() { return { species: this.species, xp: this.xp, form: creaturePower(this.species, this.xp).name, visible: this.visible, pulseCount: this.pulseCount }; }
  hide() { this.pet.root.visible = this.ring.visible = false; }
  dispose() { this.pet.dispose(); this.ring.removeFromParent(); this.ring.geometry.dispose(); this.ring.material.dispose(); }
}
