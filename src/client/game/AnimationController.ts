import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';

export type ActorAnimation = 'idle' | 'walk' | 'run' | 'attack' | 'hit' | 'death' | 'pulse';
export interface ModelEntry {
  url: string;
  scale?: number;
  yOffset?: number;
  yawOffset?: number;
  presentation?: 'equipment';
}
export interface ModelManifest {
  survivor?: ModelEntry;
  zombie?: ModelEntry;
  lanternkin?: ModelEntry;
}
const loader = new GLTFLoader();
type CachedModel = { promise: Promise<GLTF>; users: number };
const cache = new Map<string, CachedModel>();
function release(url: string, asset: CachedModel): void {
  if (--asset.users > 0) return;
  cache.delete(url);
  void asset.promise.then(
    (gltf) => {
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>(),
        textures = new Set<THREE.Texture>();
      gltf.scene.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        geometries.add(node.geometry);
        for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
          materials.add(mat);
          for (const value of Object.values(mat)) if (value instanceof THREE.Texture) textures.add(value);
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
    },
    () => {},
  );
}
/** Cache source resources; each actor owns its skeleton, mixer and cloned materials. */
export class ActorAnimator {
  private mixer: THREE.AnimationMixer | null = null;
  private current: THREE.AnimationAction | null = null;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private mesh: THREE.Object3D | null = null;
  private disposed = false;
  private loading = false;
  private readonly ownedGeometry = new Set<THREE.BufferGeometry>();
  private activeState: ActorAnimation = 'idle';
  private lease: { url: string; asset: CachedModel } | null = null;
  equipment = false;
  constructor(
    private readonly target: THREE.Group,
    private readonly requiredClips: string[] = [],
  ) {}
  async load(entry: ModelEntry): Promise<boolean> {
    if (!entry.url || this.disposed || this.loading || this.mesh) return false;
    this.loading = true;
    const url = new URL(entry.url, document.baseURI).href;
    let asset = cache.get(url);
    if (!asset) {
      asset = { promise: loader.loadAsync(url), users: 0 };
      cache.set(url, asset);
    }
    asset.users++;
    try {
      const gltf = await asset.promise;
      if (this.disposed) return false;
      const names = gltf.animations.map((c) => c.name.trim().toLowerCase());
      const missing = this.requiredClips.filter((name) => !names.includes(name));
      if (entry.presentation !== 'equipment' && missing.length) throw new Error(`Missing clips: ${missing.join(', ')}`);
      const mesh = clone(gltf.scene);
      mesh.scale.setScalar(entry.scale ?? 1);
      mesh.position.y = entry.yOffset ?? 0;
      mesh.rotation.y = entry.yawOffset ?? 0;
      this.equipment = entry.presentation === 'equipment';
      const equipmentNames = new Set(['pack', 'pack-panel', 'beacon', 'belt-pouch']);
      if (this.equipment && [...equipmentNames].some((name) => !mesh.getObjectByName(name)))
        throw new Error('Equipment nodes missing');
      const materials = new Map<THREE.Material, THREE.Material>();
      mesh.traverse((node) => {
        if (!(node instanceof THREE.Mesh)) return;
        node.castShadow = node.receiveShadow = true;
        if (this.equipment) node.visible = equipmentNames.has(node.name);
        const independent = (m: THREE.Material) => {
          let copy = materials.get(m);
          if (!copy) {
            copy = m.clone();
            materials.set(m, copy);
          }
          return copy;
        };
        node.material = Array.isArray(node.material) ? node.material.map(independent) : independent(node.material);
        if (this.equipment && node.visible) {
          node.geometry.computeBoundingBox();
          const box = node.geometry.boundingBox!,
            size = box.getSize(new THREE.Vector3());
          const geometry = new RoundedBoxGeometry(size.x, size.y, size.z, 1, Math.min(size.x, size.y, size.z) * 0.12);
          const center = box.getCenter(new THREE.Vector3());
          geometry.translate(center.x, center.y, center.z);
          this.ownedGeometry.add(geometry);
          node.geometry = geometry;
          if (node.material instanceof THREE.MeshStandardMaterial) {
            node.material.color.setHex(
              node.name === 'pack-panel' ? 0x8b8064 : node.name === 'beacon' ? 0x83b9a1 : 0x304a40,
            );
            node.material.roughness = node.name === 'beacon' ? 0.35 : 0.92;
            node.material.metalness = 0;
          }
        }
      });
      this.mesh = mesh;
      this.lease = { url, asset };
      this.target.add(mesh);
      if (!this.equipment) {
        this.mixer = new THREE.AnimationMixer(mesh);
        for (const clip of gltf.animations) {
          const key = clip.name.trim().toLowerCase(),
            action = this.mixer.clipAction(clip);
          this.actions.set(key, action);
          if (['attack', 'hit', 'pulse', 'death'].includes(key)) {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          }
        }
        this.setState(this.activeState, true);
      }
      this.target.userData.model = {
        status: 'ready',
        url,
        presentation: this.equipment ? 'equipment + procedural articulation' : 'animated',
        clips: names,
      };
      return true;
    } catch (error) {
      this.target.userData.model = {
        status: 'fallback',
        url,
        reason: String(error),
      };
      console.warn(`Model fallback: ${url}`, error);
      return false;
    } finally {
      this.loading = false;
      if (!this.lease) release(url, asset);
    }
  }
  get installed(): boolean {
    return this.mesh !== null && !this.equipment;
  }
  setState(state: ActorAnimation, force = false): void {
    if (!force && state === this.activeState) return;
    this.activeState = state;
    const next = this.actions.get(state) ?? this.actions.get('idle');
    if (!next || (next === this.current && !force)) return;
    const duration = state === 'hit' ? 0.06 : state === 'death' ? 0.1 : 0.2;
    next.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if (this.current && next !== this.current) next.crossFadeFrom(this.current, duration, false);
    this.current = next;
  }
  update(dt: number): void {
    this.mixer?.update(Math.max(0, Math.min(0.05, dt)));
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mixer?.stopAllAction();
    if (this.mesh) {
      this.mixer?.uncacheRoot(this.mesh);
      this.mesh.traverse((node) => {
        if (node instanceof THREE.SkinnedMesh) node.skeleton.dispose();
      });
      const materials = new Set<THREE.Material>();
      this.mesh.traverse((node) => {
        if (node instanceof THREE.Mesh)
          for (const mat of Array.isArray(node.material) ? node.material : [node.material]) materials.add(mat);
      });
      materials.forEach((m) => m.dispose());
      this.mesh.removeFromParent();
    }
    if (this.lease) release(this.lease.url, this.lease.asset);
    this.ownedGeometry.forEach((g) => g.dispose());
    this.ownedGeometry.clear();
    this.lease = null;
    this.mesh = null;
    this.mixer = null;
    this.current = null;
    this.actions.clear();
  }
}
export async function readModelManifest(): Promise<ModelManifest> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}models/manifest.json`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return (await response.json()) as ModelManifest;
  } catch (error) {
    console.warn('Model manifest unavailable; using procedural actors.', error);
    return {};
  }
}
