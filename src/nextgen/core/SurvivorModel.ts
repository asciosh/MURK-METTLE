import * as THREE from 'three/webgpu';

import {
  GLTFLoader,
  type GLTF
} from 'three/addons/loaders/GLTFLoader.js';

export class SurvivorModel {
  static readonly HEIGHT = 1.85;

  readonly root = new THREE.Group();

  private readonly loader = new GLTFLoader();

  private asset: GLTF | null = null;
  private loading = false;
  private disposed = false;

  constructor() {
    this.root.name = 'NEXTGEN Survivor Model';
  }

  async load(url: string): Promise<boolean> {
    if (this.disposed || this.loading) {
      return false;
    }

    if (this.asset) return true;

    this.loading = true;

    let gltf: GLTF | null = null;

    try {
      gltf = await this.loader.loadAsync(url);

      if (this.disposed) return false;

      const clips = gltf.animations.map(
        clip => clip.name.trim().toLowerCase()
      );

      for (const name of ['idle', 'walk', 'run']) {
        if (!clips.includes(name)) {
          throw new Error(`Missing animation: ${name}`);
        }
      }

      gltf.scene.traverse(node => {
        if (node instanceof THREE.Mesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });

      this.root.add(gltf.scene);

      // Normalize character height and align feet to Y=0.
      this.root.updateMatrixWorld(true);

      const bounds = new THREE.Box3()
        .setFromObject(this.root);

      const height = bounds.max.y - bounds.min.y;

      if (!Number.isFinite(height) || height <= 0) {
        throw new Error('Invalid survivor model bounds');
      }

      const scale = SurvivorModel.HEIGHT / height;

      this.root.scale.setScalar(scale);
      this.root.position.y = -bounds.min.y * scale;

      this.asset = gltf;

      return true;
    } catch (error) {
      console.warn('NEXTGEN survivor model fallback:', error);

      this.root.clear();

      return false;
    } finally {
      this.loading = false;

      if (gltf && this.asset !== gltf) {
        this.releaseAsset(gltf);
      }
    }
  }

  get loaded(): boolean {
    return this.asset !== null;
  }

  getClips(): THREE.AnimationClip[] {
    return [...(this.asset?.animations ?? [])];
  }

  get hasSkeleton(): boolean {
    let found = false;

    this.root.traverse(node => {
      if (node instanceof THREE.SkinnedMesh) {
        found = true;
      }
    });

    return found;
  }

  private releaseAsset(gltf: GLTF): void {
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

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;

    this.root.removeFromParent();

    if (this.asset) {
      this.releaseAsset(this.asset);
      this.asset = null;
    }

    this.root.clear();
  }
}