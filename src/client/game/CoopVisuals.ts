import * as THREE from 'three';
import { Player } from './Player';
import { Companion } from './Companion';
import type { WeaponId } from '../../../shared/expansion.mjs';
import type { RemotePlayer, MissionState } from './Multiplayer';

/** Owns co-op-only actor and mission-sample visuals. No network or save access. */
export class CoopVisuals {
  lightsEnabled = true;
  private readonly remotePlayers = new Map<string, Player>();
  private readonly companions = new Map<string, Companion>();
  private readonly samples = new Map<string, THREE.Group>();

  constructor(private readonly scene: THREE.Scene) {}

  triggerShot(id: string, weapon: WeaponId): void {
    this.remotePlayers.get(id)?.triggerShot(weapon);
  }

  triggerAction(id: string, action: 'pulse' | 'melee'): void {
    if (action === 'pulse') this.companions.get(id)?.triggerPulse();
    else this.remotePlayers.get(id)?.triggerAttack();
  }
  updatePlayers(peers: ReadonlyMap<string, RemotePlayer>, dt: number): void {
    for (const [id, state] of peers) {
      let actor = this.remotePlayers.get(id);
      if (!actor) {
        actor = new Player(this.scene);
        actor.root.name = `ally-${id}`;
        this.remotePlayers.set(id, actor);
      }
      const moving = Math.hypot(state.x - actor.root.position.x, state.z - actor.root.position.z) > 0.001;
      actor.updateRemote(state, dt);
      let ally = this.companions.get(id);
      if (state.creatureOwned && !ally) {
        ally = new Companion(this.scene, state.species || 'lanternkin');
        this.companions.set(id, ally);
      }
      if (ally) {
        ally.setForm(state.species || 'lanternkin', state.creatureXp || 0);
        ally.setLightEnabled(this.lightsEnabled);
        ally.root.visible = !!state.creatureOwned && state.hp > 0;
        ally.updateRemote(dt, new THREE.Vector3(state.x + 0.95, 0, state.z + 0.5), state.yaw, moving);
      }
    }
    for (const [id, actor] of this.remotePlayers) {
      if (peers.has(id)) continue;
      actor.dispose();
      this.remotePlayers.delete(id);
      const companion = this.companions.get(id);
      if (companion) {
        companion.dispose();
        this.companions.delete(id);
      }
    }
  }

  updateSamples(mission: MissionState | null): void {
    const active = new Set(mission?.pickups.map((p) => p.id) ?? []);
    for (const [id, object] of this.samples) {
      if (active.has(id)) continue;
      this.removeMeshes(object);
      this.samples.delete(id);
    }
    for (const sample of mission?.pickups ?? []) {
      if (this.samples.has(sample.id)) continue;
      const object = new THREE.Group();
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.43),
        new THREE.MeshStandardMaterial({ color: 0x8be4e1, emissive: 0x237c86, emissiveIntensity: 1.6 }),
      );
      crystal.position.y = 0.95;
      object.add(crystal);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.6, 0.05, 6, 24),
        new THREE.MeshBasicMaterial({ color: 0x82f1e4 }),
      );
      ring.position.y = 0.12;
      ring.rotation.x = Math.PI / 2;
      object.add(ring);
      object.position.set(sample.x, 0, sample.z);
      this.scene.add(object);
      this.samples.set(sample.id, object);
    }
  }

  clear(): void {
    for (const actor of this.remotePlayers.values()) actor.dispose();
    this.remotePlayers.clear();
    for (const companion of this.companions.values()) companion.dispose();
    this.companions.clear();
    for (const sample of this.samples.values()) this.removeMeshes(sample);
    this.samples.clear();
  }

  private removeMeshes(root: THREE.Object3D): void {
    this.scene.remove(root);
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material.dispose();
    });
  }
}
