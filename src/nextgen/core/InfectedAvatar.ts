import * as THREE from 'three/webgpu';

import {
  InfectedController,
  type InfectedPosition,
  type InfectedState
} from './InfectedController.ts';

import {
  InfectedModelPool,
  type InfectedModel
} from './InfectedModel.ts';

import {
  InfectedAnimator
} from './InfectedAnimator.ts';

export class InfectedAvatar {
  readonly root = new THREE.Group();

  private readonly controller: InfectedController;

  private model: InfectedModel | null = null;
  private animator: InfectedAnimator | null = null;

  private placeholder: THREE.Mesh<
    THREE.CapsuleGeometry,
    THREE.MeshStandardMaterial
  > | null = null;

  private disposed = false;

  constructor(controller: InfectedController) {
    this.controller = controller;

    this.root.name = 'NEXTGEN Infected Avatar';

    this.placeholder = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.24, 1.27, 4, 8),
      new THREE.MeshStandardMaterial({
        color: 0x823c38,
        roughness: 0.9
      })
    );

    this.placeholder.position.y = 0.875;
    this.placeholder.castShadow = true;
    this.placeholder.receiveShadow = true;

    this.root.add(this.placeholder);

    this.present(this.controller.getState());
  }

  attachModel(pool: InfectedModelPool): boolean {
    if (this.disposed) return false;

    if (this.model) return true;

    const model = pool.create();

    if (!model) return false;

    this.model = model;

    this.root.add(model.root);

    this.animator = new InfectedAnimator(
      model.root,
      model.getClips()
    );

    this.releasePlaceholder();

    this.animator.update(
      0,
      this.controller.getState()
    );

    return true;
  }

  update(
    deltaTimeMs: number,
    target: InfectedPosition | null
  ): InfectedState {
    if (this.disposed) {
      return this.controller.getState();
    }

    const state = this.controller.update(
      deltaTimeMs,
      target
    );

    this.present(state);

    this.animator?.update(deltaTimeMs, state);

    return state;
  }

  separate(dx: number, dz: number): void {
  if (this.disposed) return;

  if (this.controller.separate(dx, dz)) {
    this.present(this.controller.getState());
  }
}

  damage(amount: number): boolean {
    if (this.disposed) return false;

    const accepted = this.controller.damage(amount);

    if (accepted) {
      const state = this.controller.getState();

      this.present(state);
      this.animator?.update(0, state);
    }

    return accepted;
  }

  getState(): InfectedState {
    return this.controller.getState();
  }

  getModelInfo() {
    return {
      status: this.model ? 'ready' : 'fallback',
      skinned: this.model?.hasSkeleton ?? false,
      activeClip: this.animator?.getActiveClip() ?? null,
      clips: this.model?.getClips().map(
        clip => clip.name
      ) ?? []
    };
  }

  private present(state: InfectedState): void {
    this.root.position.set(...state.position);

    const [x, , z] = state.facing;

    if (Math.hypot(x, z) > 0.000001) {
      this.root.rotation.y = Math.atan2(-x, -z);
    }

    if (this.placeholder) {
      const dead = state.animation === 'death';

      this.placeholder.rotation.z =
        dead ? Math.PI / 2 : 0;

      this.placeholder.position.y =
        dead ? 0.24 : 0.875;
    }
  }

  private releasePlaceholder(): void {
    if (!this.placeholder) return;

    this.placeholder.removeFromParent();
    this.placeholder.geometry.dispose();
    this.placeholder.material.dispose();

    this.placeholder = null;
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;

    this.animator?.dispose();
    this.animator = null;

    this.model?.dispose();
    this.model = null;

    this.releasePlaceholder();

    this.root.removeFromParent();
    this.root.clear();
  }
}