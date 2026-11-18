import * as THREE from 'three/webgpu';
import type { EnemySnapshot } from '../../../shared/survival.mjs';
import { InfectedModelPool, type InfectedModel } from './InfectedModel';
import { InfectedAnimator } from './InfectedAnimator';
import { enemyMotion, type RoomEnemyMotion } from './RoomPresentation';
import { roomToScene } from './RoomIntent';

/** Snapshot-driven presentation only. No local infected controller or damage calls. */
export class RoomInfectedView {
  readonly root = new THREE.Group();
  private readonly fallback: THREE.Mesh;
  private model: InfectedModel | null = null;
  private animator: InfectedAnimator | null = null;
  private motion?: RoomEnemyMotion;
  constructor(geometry: THREE.BufferGeometry, material: THREE.Material) {
    this.fallback = new THREE.Mesh(geometry, material);
    this.fallback.position.y = 0.85;
    this.root.add(this.fallback);
  }
  update(enemy: EnemySnapshot, dt: number, players: readonly { x: number; z: number }[], pool: InfectedModelPool) {
    if (!this.model && pool.loaded) {
      this.model = pool.create();
      if (this.model) {
        this.root.add(this.model.root);
        this.animator = new InfectedAnimator(this.model.root, this.model.getClips());
        this.fallback.visible = false;
      }
    }
    this.motion = enemyMotion(this.motion, enemy, dt, players);
    this.root.position.set(...roomToScene(enemy.x, enemy.z,true));
    this.root.rotation.y = this.motion.yaw;
    this.animator?.update(dt, this.motion);
    if (!this.model) { this.fallback.rotation.z = enemy.hp <= 0 ? Math.PI / 2 : 0; this.fallback.position.y = enemy.hp <= 0 ? 0.3 : 0.85; }
  }
  info() { return { rigged: !!this.model?.hasSkeleton, animation: this.motion?.animation ?? 'idle', hp: this.motion?.hp ?? null }; }
  dispose() { this.animator?.dispose(); this.model?.dispose(); this.root.removeFromParent(); this.root.clear(); }
}
