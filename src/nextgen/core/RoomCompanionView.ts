import * as THREE from 'three/webgpu';
import { Companion } from '../../client/game/Companion';
import { CREATURES, creaturePower, type SpeciesId } from '../../../shared/expansion.mjs';
import { companionFollow } from './RoomFieldRules';
import { roomToScene } from './RoomIntent';
import { CompanionAvatar } from './CompanionAvatar';

/** Original five-species art; the room's ownership, species and XP are authoritative. */
export class RoomCompanionView {
  private readonly pet: Companion;
  private readonly nextgenPet = new CompanionAvatar();
  private readonly ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private position?: { x: number; z: number };
  private species: SpeciesId;
  private xp = 0;
  private pulseMs = 0;
  private pulseCount = 0;
  private strikeCount = 0;
  private strikeMs = 0;
  private strikeTarget?: { x: number; z: number };
  private visible = true;
  constructor(scene: THREE.Scene, species: SpeciesId) {
    this.species = species;
    this.pet = new Companion(scene, species);
    this.pet.setLightEnabled(false);
    scene.add(this.nextgenPet.root);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 48), new THREE.MeshBasicMaterial({ color: CREATURES[species].glow, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    scene.add(this.ring);
  }
  update(owner: { x: number; z: number; yaw: number; hp: number }, species: SpeciesId, xp: number, dt: number) {
    this.species = species; this.xp = xp;
    this.pet.setForm(species, xp);
    this.visible = owner.hp > 0;
    this.pet.root.visible = this.visible && species !== 'lanternkin';
    this.nextgenPet.root.visible = this.visible && species === 'lanternkin';
    const target = companionFollow(owner, owner.yaw,true);
    const previous = this.position ?? target;
    const distance = Math.hypot(target.x - previous.x, target.z - previous.z);
    const alpha = distance > 8 ? 1 : 1 - Math.exp(-Math.min(100, Math.max(0, dt)) / 150);
    this.position = { x: previous.x + (target.x - previous.x) * alpha, z: previous.z + (target.z - previous.z) * alpha };
    let visual = this.position, facing = owner.yaw;
    if (this.strikeMs > 0 && this.strikeTarget) {
      this.strikeMs = Math.max(0, this.strikeMs - Math.min(100, Math.max(0, dt)));
      const dx = this.strikeTarget.x - this.position.x, dz = this.strikeTarget.z - this.position.z;
      const l = Math.hypot(dx, dz), travel = Math.min(2.4, l) * Math.sin(Math.PI * (1 - this.strikeMs / 400));
      if (l > 0.01) { visual = { x: this.position.x + dx / l * travel, z: this.position.z + dz / l * travel }; facing = Math.atan2(-dx, -dz); }
    }
    const point=roomToScene(visual.x,visual.z,true),moving=(distance>0.2&&distance<=8)||this.strikeMs>0;
    if(species==='lanternkin'){
      const power=creaturePower(species,xp);
      this.nextgenPet.update(dt,{species:'lanternkin',name:power.name,position:point,facing:[-Math.sin(facing),0,-Math.cos(facing)],assist:false,mode:this.strikeMs>0?'attack':'follow',moving,attackPoseMs:Math.min(320,this.strikeMs),pulsePoseMs:0,pulseCooldownMs:0,pulseMaxCooldownMs:power.cooldown*1000,pulseRange:power.range,attacks:this.strikeCount,pulses:this.pulseCount});
    }else this.pet.updateRemote(Math.min(100, Math.max(0, dt)) / 1000, new THREE.Vector3(...point), facing, moving);
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
    const [x,y,z]=roomToScene(origin.x,origin.z,true); this.ring.position.set(x,y+0.3,z);
    this.ring.material.color.setHex(CREATURES[this.species].glow);
  }
  strike(target: { x: number; z: number }) { this.strikeTarget = { ...target }; this.strikeMs = 400; this.strikeCount++; }
  info() { return { species: this.species, xp: this.xp, form: creaturePower(this.species, this.xp).name, visible: this.visible, pulseCount: this.pulseCount, strikeCount: this.strikeCount }; }
  hide() { this.nextgenPet.root.visible=this.pet.root.visible = this.ring.visible = false; }
  dispose() { this.nextgenPet.dispose();this.pet.dispose(); this.ring.removeFromParent(); this.ring.geometry.dispose(); this.ring.material.dispose(); }
}
