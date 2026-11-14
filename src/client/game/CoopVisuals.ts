import * as THREE from 'three';
import { Player } from './Player';
import type { RemotePlayer, MissionState } from './Multiplayer';

/** Owns co-op-only actor and mission-sample visuals. No network or save access. */
export class CoopVisuals {
  private readonly remotePlayers = new Map<string, Player>();
  private readonly companions = new Map<string, THREE.Group>();
  private readonly samples = new Map<string, THREE.Group>();

  constructor(private readonly scene: THREE.Scene) {}

  updatePlayers(peers: ReadonlyMap<string, RemotePlayer>): void {
    for (const [id, state] of peers) {
      let actor = this.remotePlayers.get(id);
      if (!actor) {
        actor = new Player(this.scene);
        actor.root.name = `ally-${id}`;
        this.remotePlayers.set(id, actor);
      }
      actor.root.position.set(state.x, 0, state.z);
      actor.root.rotation.y = state.yaw;
      actor.root.visible = state.hp > 0;
      let ally = this.companions.get(id);
      if (state.creatureOwned && !ally) {
        ally = new THREE.Group();
        const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.3, 1),
          new THREE.MeshStandardMaterial({ color: 0xa3edb2, emissive: 0x45a876, emissiveIntensity: 1.1 }));
        ally.add(glow);
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.43, 5),
          new THREE.MeshStandardMaterial({ color: 0x387a51 }));
        leaf.position.y = 0.38;
        ally.add(leaf);
        this.scene.add(ally);
        this.companions.set(id, ally);
      }
      if (ally) {
        ally.visible = !!state.creatureOwned && state.hp > 0;
        ally.position.set(state.x + 0.95, 1.55 + Math.sin(performance.now() * 0.002) * 0.12, state.z + 0.5);
      }
    }
    for (const [id, actor] of this.remotePlayers) {
      if (peers.has(id)) continue;
      actor.dispose();
      this.remotePlayers.delete(id);
      const companion = this.companions.get(id);
      if (companion) { this.removeMeshes(companion); this.companions.delete(id); }
    }
  }

  updateSamples(mission: MissionState | null): void {
    const active = new Set(mission?.pickups.map(p => p.id) ?? []);
    for (const [id, object] of this.samples) {
      if (active.has(id)) continue;
      this.removeMeshes(object);
      this.samples.delete(id);
    }
    for (const sample of mission?.pickups ?? []) {
      if (this.samples.has(sample.id)) continue;
      const object = new THREE.Group();
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.43),
        new THREE.MeshStandardMaterial({ color: 0x8be4e1, emissive: 0x237c86, emissiveIntensity: 1.6 }));
      crystal.position.y = 0.95;
      object.add(crystal);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.05, 6, 24),
        new THREE.MeshBasicMaterial({ color: 0x82f1e4 }));
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
    for (const companion of this.companions.values()) this.removeMeshes(companion);
    this.companions.clear();
    for (const sample of this.samples.values()) this.removeMeshes(sample);
    this.samples.clear();
  }

  private removeMeshes(root: THREE.Object3D): void {
    this.scene.remove(root);
    root.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry.dispose();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) material.dispose();
    });
  }
}
