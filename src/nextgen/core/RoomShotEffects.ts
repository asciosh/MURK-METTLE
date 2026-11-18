import * as THREE from 'three/webgpu';
import { confirmedShotSegment } from './RoomPresentation';

type Shot = { origin: { x: number; y: number; z: number }; direction: { x: number; y: number; z: number }; distance: number; hit: boolean; resonant?: boolean };

/** Bounded, reusable VFX displayed only after the authoritative shot packet. */
export class RoomShotEffects {
  readonly root = new THREE.Group();
  private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly flashGeometry = new THREE.IcosahedronGeometry(1, 0);
  private readonly axis = new THREE.Vector3(0, 0, 1);
  private readonly slots = Array.from({ length: 12 }, () => {
    const tracer = new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({ color: 0xffcd7b, transparent: true, depthWrite: false, toneMapped: false }));
    const flash = new THREE.Mesh(this.flashGeometry, new THREE.MeshBasicMaterial({ color: 0xffd58c, transparent: true, depthWrite: false, toneMapped: false }));
    const impact = new THREE.Mesh(this.flashGeometry, new THREE.MeshBasicMaterial({ color: 0xb83723, transparent: true, depthWrite: false, toneMapped: false }));
    tracer.visible = flash.visible = impact.visible = false;
    this.root.add(tracer, flash, impact);
    return { tracer, flash, impact, remaining: 0, hit: false };
  });
  private cursor = 0;
  count = 0;
  show(shot: Shot): boolean {
    const segment = confirmedShotSegment(shot.origin, shot.direction, shot.distance);
    if (!segment) return false;
    const slot = this.slots[this.cursor++ % this.slots.length];
    const from = new THREE.Vector3(...segment.from), to = new THREE.Vector3(...segment.to);
    const delta = to.clone().sub(from), length = delta.length();
    slot.tracer.position.copy(from).lerp(to, 0.5);
    if (length > 0.001) slot.tracer.quaternion.setFromUnitVectors(this.axis, delta.normalize());
    slot.tracer.scale.set(0.025, 0.025, Math.max(0.001, length));
    slot.tracer.visible = length > 0.001;
    slot.tracer.material.color.setHex(shot.resonant ? 0x91ffc4 : 0xffcd7b);
    slot.flash.material.color.setHex(shot.resonant ? 0x91ffc4 : 0xffd58c);
    slot.flash.position.copy(from); slot.flash.scale.setScalar(0.11); slot.flash.visible = true;
    slot.impact.position.copy(to); slot.impact.scale.setScalar(0.1); slot.impact.visible = shot.hit;
    slot.tracer.material.opacity = slot.flash.material.opacity = slot.impact.material.opacity = 1;
    slot.remaining = 130; slot.hit = shot.hit; this.count++;
    return true;
  }
  update(dt: number) {
    for (const slot of this.slots) {
      if (slot.remaining <= 0) continue;
      slot.remaining = Math.max(0, slot.remaining - Math.max(0, dt));
      const life = slot.remaining / 130;
      slot.tracer.visible = slot.tracer.visible && slot.remaining > 65;
      slot.tracer.material.opacity = life;
      slot.flash.visible = slot.remaining > 50; slot.flash.material.opacity = life;
      slot.impact.visible = slot.hit && life > 0; slot.impact.material.opacity = life;
      slot.impact.scale.setScalar(0.1 + (1 - life) * 0.18);
    }
  }
  dispose() {
    for (const { tracer, flash, impact } of this.slots) { tracer.material.dispose(); flash.material.dispose(); impact.material.dispose(); }
    this.root.removeFromParent(); this.root.clear(); this.geometry.dispose(); this.flashGeometry.dispose();
  }
}
