import * as THREE from 'three';
import { createAtmosphere } from '../game/Atmosphere';
import type { SceneEffects } from '../game/SceneEffects';
import type { QualityId, RenderProfile } from '../../../shared/render-profile.mjs';

/** Owns field lighting and optional render targets; contains no simulation or network state. */
export class FieldGraphics {
  private readonly sky = createAtmosphere();
  private readonly sun = new THREE.DirectionalLight(0xffdda9, 3.6);
  private readonly ambient = new THREE.HemisphereLight(0xb3cddd, 0x35493b, 1.05);
  private readonly environmentTarget: THREE.WebGLRenderTarget;
  private effects: SceneEffects | null = null;
  private generation = 0;
  private disposed = false;
  private cinematic = false;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.Camera,
    private readonly warn: (message: string) => void,
  ) {
    // Cool distant air, warm directional light and restrained ambient fill.
    scene.background = new THREE.Color(0x8fa9a2);
    scene.fog = new THREE.FogExp2(0x8fa9a2, 0.009);
    scene.add(this.sky);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = new THREE.Scene();
    environment.add(this.sky.clone());
    this.environmentTarget = pmrem.fromScene(environment, 0.06);
    scene.environment = this.environmentTarget.texture;
    scene.environmentIntensity = 0.62;
    pmrem.dispose();
    this.sun.position.set(-28, 30, 16);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 100 });
    this.sun.shadow.bias = -0.00015;
    this.sun.shadow.normalBias = 0.025;
    scene.add(this.ambient, this.sun, this.sun.target);
  }

  setQuality(id: QualityId, profile: RenderProfile): void {
    this.cinematic = id === 'cinematic';
    const generation = ++this.generation;
    if (this.cinematic && !this.effects) {
      void import('../game/SceneEffects').then(({ SceneEffects }) => {
        if (this.disposed || generation !== this.generation || !this.cinematic) return;
        this.effects = new SceneEffects(this.renderer, this.scene, this.camera);
        this.resize();
      }).catch(() => {
        if (!this.disposed && generation === this.generation)
          this.warn('Cinematic effects unavailable. Standard rendering remains active.');
      });
    }
    if (!this.cinematic && this.effects) {
      this.effects.dispose();
      this.effects = null;
    }
    this.renderer.shadowMap.enabled = profile.shadows;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.pixelRatio));
    this.sky.material.uniforms.cloudLayers.value = profile.cloudLayers;
  }

  update(dt: number): void {
    this.sky.material.uniforms.cloudTime.value = (this.sky.material.uniforms.cloudTime.value + dt) % 3600;
  }

  followShadow(position: THREE.Vector3): void {
    if (this.sun.target.position.distanceTo(position) > 4) {
      this.sun.target.position.copy(position);
      this.sun.position.copy(position).add(new THREE.Vector3(-28, 30, 16));
    }
  }

  resize(): void {
    const size = this.renderer.getSize(new THREE.Vector2());
    this.effects?.resize(size.x, size.y, this.renderer.getPixelRatio());
  }

  render(): void {
    if (this.cinematic && this.effects) this.effects.render();
    else this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    this.effects?.dispose();
    this.effects = null;
    if (this.scene.environment === this.environmentTarget.texture) this.scene.environment = null;
    this.environmentTarget.dispose();
    this.sun.dispose();
    this.sky.removeFromParent();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
    this.scene.remove(this.sun, this.sun.target, this.ambient);
  }
}
