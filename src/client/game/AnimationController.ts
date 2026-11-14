import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export type ActorAnimation = 'idle' | 'walk' | 'run' | 'attack' | 'hit' | 'death' | 'pulse';
export interface ModelEntry { url: string; scale?: number; yOffset?: number; yawOffset?: number; }
export interface ModelManifest {
  survivor?: ModelEntry;
  zombie?: ModelEntry;
  lanternkin?: ModelEntry;
}
const loader = new GLTFLoader();
function cloneMaterial(mat: THREE.Material): THREE.Material { return mat.clone(); }
/** Clone one asset per actor: independent bones, transforms, mixers and materials. */

/** Minimal GLB loader with named animation playback and crossfading.
 * Export Blender clips as Idle, Walk, Run, Attack, Hit, Death, Pulse (case-insensitive).
 * Missing clips gracefully fall back to Idle or the current clip.
 */
export class ActorAnimator {
  private mixer: THREE.AnimationMixer | null = null;
  private current: THREE.AnimationAction | null = null;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private mesh: THREE.Object3D | null = null;
  private disposed = false;
  private activeState: ActorAnimation = 'idle';
  constructor(private readonly target: THREE.Group, private readonly requiredClips: string[] = []) {}
  async load(entry: ModelEntry): Promise<boolean> {
    if (!entry.url || this.disposed) return false;
    try {
      const gltf = await loader.loadAsync(entry.url);
      if (this.disposed) return false;
      const clips = new Set(gltf.animations.map(clip => clip.name.trim().toLowerCase()));
      const missing = this.requiredClips.filter(name => !clips.has(name));
      if (missing.length) {
        console.warn(`GLB ${entry.url} missing required clips: ${missing.join(', ')}. Using animated procedural fallback.`);
        return false;
      }
      this.mesh = gltf.scene;
      this.mesh.scale.setScalar(entry.scale ?? 1);
      this.mesh.position.y = entry.yOffset ?? 0;
      this.mesh.rotation.y = entry.yawOffset ?? 0;
      this.mesh.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        node.castShadow = true;
        node.receiveShadow = true;
        if (Array.isArray(node.material)) node.material = node.material.map(cloneMaterial);
        else node.material = cloneMaterial(node.material);
      });
      this.target.add(this.mesh);
      this.mixer = new THREE.AnimationMixer(this.mesh);
      for (const clip of gltf.animations) {
        const action = this.mixer.clipAction(clip);
        const key = clip.name.trim().toLowerCase();
        this.actions.set(key, action);
        if (key === 'attack' || key === 'hit' || key === 'pulse' || key === 'death') {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
      }
      this.setState(this.activeState, true);
      return true;
    } catch (error) {
      console.warn(`Optional model could not load: ${entry.url}`, error);
      return false;
    }
  }
  get installed(): boolean { return this.mesh !== null; }
  setState(state: ActorAnimation, force = false): void {
    if (!force && state === this.activeState) return;
    this.activeState = state;
    const next = this.actions.get(state) ?? this.actions.get('idle');
    if (!next || (next === this.current && !force)) return;
    if (this.current) this.current.fadeOut(0.16);
    next.reset().fadeIn(0.16).play();
    this.current = next;
  }
  update(dt: number): void { this.mixer?.update(Math.min(0.05, dt)); }
  dispose(): void {
    this.disposed = true;
    if (this.mixer) this.mixer.stopAllAction();
    if (this.mesh) {
      this.target.remove(this.mesh);
      this.mesh.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        node.geometry.dispose();
        const mats = Array.isArray(node.material) ? node.material : [node.material];
        mats.forEach(m => m.dispose());
      });
    }
    this.actions.clear();
    this.mesh = null;
    this.mixer = null;
  }
}

export async function readModelManifest(): Promise<ModelManifest> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}models/manifest.json`);
    return response.ok ? await response.json() as ModelManifest : {};
  } catch { return {}; }
}
