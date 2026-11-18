import * as THREE from 'three/webgpu';

import {
  GLTFLoader,
  type GLTF
} from 'three/addons/loaders/GLTFLoader.js';

import {
  clone
} from 'three/addons/utils/SkeletonUtils.js';

function releaseAsset(gltf: GLTF): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const skeletons = new Set<THREE.Skeleton>();

  const scenes = new Set([
    gltf.scene,
    ...gltf.scenes
  ]);

  for (const scene of scenes) {
    scene.traverse(node => {
      if (node instanceof THREE.SkinnedMesh) {
        skeletons.add(node.skeleton);
      }

      if (!(node instanceof THREE.Mesh)) return;

      geometries.add(node.geometry);

      const list = Array.isArray(node.material)
        ? node.material
        : [node.material];

      for (const material of list) {
        materials.add(material);

        for (const value of Object.values(material)) {
          if (value instanceof THREE.Texture) {
            textures.add(value);
          }
        }
      }
    });
  }

  geometries.forEach(g => g.dispose());
  materials.forEach(m => m.dispose());
  textures.forEach(t => t.dispose());
  skeletons.forEach(s => s.dispose());
}

export class InfectedModel {
  readonly root = new THREE.Group();

  private readonly skeletons =
    new Set<THREE.Skeleton>();

  private disposed = false;

  private readonly clips: THREE.AnimationClip[];
private readonly onDispose: () => void;

constructor(
  scene: THREE.Object3D,
  clips: THREE.AnimationClip[],
  scale: number,
  offsetY: number,
  onDispose: () => void
) {
  this.clips = clips;
  this.onDispose = onDispose;

    this.root.name = 'NEXTGEN Infected';

    const normalized = new THREE.Group();

    normalized.scale.setScalar(scale);
    normalized.position.y = offsetY;

    normalized.add(scene);
    this.root.add(normalized);

    scene.traverse(node => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = true;
        node.receiveShadow = true;
      }

      if (node instanceof THREE.SkinnedMesh) {
        this.skeletons.add(node.skeleton);
      }
    });
  }

  getClips(): THREE.AnimationClip[] {
    return [...this.clips];
  }

  get hasSkeleton(): boolean {
    return this.skeletons.size > 0;
  }

  setShadows(enabled: boolean): void {
    if (this.disposed) return;

    this.root.traverse(node => {
      if (node instanceof THREE.Mesh) {
        node.castShadow = enabled;
      }
    });
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;

    this.root.removeFromParent();

    // Only release instance-owned skeletons.
    // Geometry, textures and materials belong to the pool.
    this.skeletons.forEach(skeleton => skeleton.dispose());
    this.skeletons.clear();

    this.root.clear();
    this.onDispose();
  }
}

export class InfectedModelPool {
  static readonly HEIGHT = 1.75;

  private asset: GLTF | null = null;

  private loading: Promise<boolean> | null = null;
  private url: string | null = null;

  private scale = 1;
  private offsetY = 0;
  private disposed = false;

  private readonly instances =
    new Set<InfectedModel>();

private readonly loader: Pick<GLTFLoader, 'loadAsync'>;

constructor(
  loader: Pick<GLTFLoader, 'loadAsync'> = new GLTFLoader()
) {
  this.loader = loader;
}

  load(url: string): Promise<boolean> {
    if (
      this.disposed ||
      (this.url !== null && this.url !== url)
    ) {
      return Promise.resolve(false);
    }

    if (this.asset) return Promise.resolve(true);

    // Concurrent requests share the same loading promise.
    if (this.loading) return this.loading;

    this.url = url;

    this.loading = this.loadAsset(url).finally(() => {
      this.loading = null;

      if (!this.asset) {
        this.url = null;
      }
    });

    return this.loading;
  }

  private async loadAsset(url: string): Promise<boolean> {
    let gltf: GLTF | null = null;

    try {
      gltf = await this.loader.loadAsync(url);

      if (this.disposed) return false;

      for (const name of [
        'idle', 'walk', 'run',
        'attack', 'hit', 'death'
      ]) {
        const valid = gltf.animations.some(
          clip =>
            clip.name.trim().toLowerCase() === name &&
            Number.isFinite(clip.duration) &&
            clip.duration > 0
        );

        if (!valid) {
          throw new Error(`Missing infected animation: ${name}`);
        }
      }

      let skinned = false;

      gltf.scene.traverse(node => {
        if (node instanceof THREE.SkinnedMesh) {
          skinned = true;
        }
      });

      if (!skinned) {
        throw new Error('Missing infected skeleton');
      }

      gltf.scene.updateMatrixWorld(true);

      const bounds = new THREE.Box3()
        .setFromObject(gltf.scene);

      const height = bounds.max.y - bounds.min.y;

      if (!Number.isFinite(height) || height <= 0) {
        throw new Error('Invalid infected model bounds');
      }

      this.scale = InfectedModelPool.HEIGHT / height;
      this.offsetY = -bounds.min.y * this.scale;

      this.asset = gltf;

      return true;
    } catch (error) {
      console.warn('NEXTGEN infected model fallback:', error);

      return false;
    } finally {
      if (gltf && this.asset !== gltf) {
        releaseAsset(gltf);
      }
    }
  }

  create(): InfectedModel | null {
    if (this.disposed || !this.asset) {
      return null;
    }

    // Clone bones, but share geometry and materials.
    const scene = clone(this.asset.scene);

    const instance = new InfectedModel(
      scene,
      this.asset.animations,
      this.scale,
      this.offsetY,
      () => this.instances.delete(instance)
    );

    this.instances.add(instance);

    return instance;
  }

  get loaded(): boolean {
    return this.asset !== null;
  }

  get count(): number {
    return this.instances.size;
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;

    for (const instance of this.instances) {
      instance.dispose();
    }

    this.instances.clear();

    // Release shared resources only after all enemies.
    if (this.asset) {
      releaseAsset(this.asset);
      this.asset = null;
    }
  }
}