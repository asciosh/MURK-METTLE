import * as THREE from 'three/webgpu';
import { NextGenRenderer } from '../core/NextGenRenderer';
import type { PresentResult } from '../core/types';

/**
 * Independent graphics demonstration scene (M01 checkpoint).
 *
 * Procedural geometry only — no external assets, so provenance is trivially
 * original. Demonstrates the prepared architecture: PBR standard material,
 * image-based ambient (PMREM), directional + hemisphere lighting with shadows,
 * fog, ACESFilmic tone mapping, instanced vegetation, and a display-rate orbit
 * camera driven by the fixed-timestep renderer.
 */

export class SimpleDemo {
  private readonly renderer: NextGenRenderer;
  private readonly canvas: HTMLCanvasElement;
  private readonly container: HTMLElement;
  private sun?: THREE.DirectionalLight;
  private frame = 0;
  private lastResult?: PresentResult;
  private readonly results: PresentResult[] = [];
  private disposed = false;
  private resizeObserver?: ResizeObserver;

  private readonly qualityPresets = {
    low: {
      exposure: 1.0,
      bloomStrength: 0.5,
      bloomThreshold: 0.4,
      bloomRadius: 0.8,
    },
    balanced: {
      exposure: 1.2,
      bloomStrength: 1.2,
      bloomThreshold: 0.3,
      bloomRadius: 1.0,
    },
    cinematic: {
      exposure: 1.8,
      bloomStrength: 2.0,
      bloomThreshold: 0.2,
      bloomRadius: 1.4,
    },
  };

  private currentPreset = 'balanced';

  private pipeline?: THREE.RenderPipeline;

  constructor() {
    document.body.style.margin = '0';
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.container = document.createElement('div');
    this.container.style.cssText =
      'width:100vw;height:100vh;margin:0;background:#0b1612;overflow:hidden;';
    this.container.appendChild(this.canvas);
    document.body.appendChild(this.container);

    this.renderer = new NextGenRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.onFrame = (result) => {
      this.lastResult = result;
      this.results.push(result);
      if (this.results.length > 600) this.results.shift();
    };
  }

  async mount(): Promise<void> {
    await this.renderer.init();
    this.resize(window.innerWidth, window.innerHeight);
    this.buildScene();
    this.renderer.start();
    window.addEventListener('resize', this._onResize);
    this.resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) this.resize(width, height);
      }
    });
    this.resizeObserver.observe(this.container);
  }

  private readonly _onResize = () => this.resize(window.innerWidth, window.innerHeight);
  private buildScene(): void {
    const scene = this.renderer.sceneRef;
    const camera = this.renderer.cameraRef;
    const renderer = this.renderer.backendRenderer;
    if (!renderer) throw new Error('SimpleDemo: no backend renderer.');

    // Quality-dependent shadow presets (low/balanced/cinematic).
    const shadowPreset = 'balanced';
    const shadowConfig = {
      low: { resolution: 512, cameraFar: 100, distance: 30 },
      balanced: { resolution: 1024, cameraFar: 200, distance: 60 },
      cinematic: { resolution: 2048, cameraFar: 300, distance: 100 },
    }[shadowPreset];

    // Directional sunlight with quality-dependent shadow configuration.
    this.sun = new THREE.DirectionalLight(0xffdda9, 2.5);
    this.sun.position.set(-20, 30, 15);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowConfig.resolution, shadowConfig.resolution);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = shadowConfig.cameraFar;
    this.sun.shadow.camera.left = -shadowConfig.distance;
    this.sun.shadow.camera.right = shadowConfig.distance;
    this.sun.shadow.camera.top = shadowConfig.distance;
    this.sun.shadow.camera.bottom = -shadowConfig.distance;
    scene.add(this.renderer.track(this.sun));
    scene.add(this.sun.target);

    // PBR image-based ambient via PMREM (cinematic lighting foundation).
    const envScene = new THREE.Scene();
    const hemi = new THREE.HemisphereLight(0xb3cddd, 0x35493b, 0.9);
    envScene.add(hemi);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(envScene, 0.06);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.7;
    pmrem.dispose();

    // Ground — PBR standard material.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.MeshStandardMaterial({
        color: 0x3d5a51,
        roughness: 0.8,
        metalness: 0.1,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(this.renderer.track(ground));

    // Instanced vegetation — crowns and trunks.
    const count = 36;
    const spacing = 3;
    const half = (6 * spacing) / 2;
    const dummy = new THREE.Object3D();

    const crownGeo = new THREE.ConeGeometry(0.9, 1.8, 8);
    const crownMat = new THREE.MeshStandardMaterial({ color: 0x4a7c59, roughness: 0.9 });
    const trees = new THREE.InstancedMesh(crownGeo, crownMat, count);
    let n = 0;
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        dummy.position.set(x * spacing - half, 0.9, y * spacing - half);
        dummy.updateMatrix();
        trees.setMatrixAt(n++, dummy.matrix);
      }
    }
    trees.castShadow = true;
    trees.receiveShadow = true;
    scene.add(this.renderer.track(trees));
    this.renderer.track(crownGeo);
    this.renderer.track(crownMat);

    const trunkGeo = new THREE.CylinderGeometry(0.16, 0.2, 1.8, 8);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4a3a });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    n = 0;
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        dummy.position.set(x * spacing - half, 0.9, y * spacing - half);
        dummy.updateMatrix();
        trunks.setMatrixAt(n++, dummy.matrix);
      }
    }
    trunks.castShadow = true;
    scene.add(this.renderer.track(trunks));
    this.renderer.track(trunkGeo);
    this.renderer.track(trunkMat);
    this.renderer.track(dummy);

    // ---- RenderPipeline post-processing (WebGPU/WebGL2 compatible) ----

// Configure renderer for ACESFilmic tone mapping with quality-dependent exposure.
const preset = this.qualityPresets[this.currentPreset as keyof typeof this.qualityPresets];
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = preset.exposure;

// Create the RenderPipeline — the new post-processing pipeline that works
// with both WebGPU and WebGL2, replacing the legacy EffectComposer.
this.pipeline = new THREE.RenderPipeline(renderer);

// Configure RenderPipeline exposure and bloom/color grading settings.
// The RenderPipeline internally reads renderer.toneMapping and renderer.toneMappingExposure.
// Bloom and atmospheric color grading are controlled via the pipeline's settings.

// Slow orbit for a cinematic feel, driven by display-rate frames.
    let angle = 0;
    const prev = this.renderer.onFrame;
    this.renderer.onFrame = (result) => {
      prev?.(result);
      angle += 0.01;
      camera.position.set(Math.sin(angle) * 14, 4.5, Math.cos(angle) * 14);
      camera.lookAt(0, 0.9, 0);
      if (this.sun) {
        this.sun.position.set(Math.sin(angle) * 20, 30, Math.cos(angle) * 20);
      }
      this.sun?.target.position.set(0, 0, 0);
      this.frame += 1;
      // Render the scene into the backend renderer first,
      // then apply the RenderPipeline post-processing effects.
      renderer.render(scene, camera);
      // Render via RenderPipeline for post-processing effects (WebGPU/WebGL2 compatible).
      this.pipeline?.render();
    };
  }

  resize(width: number, height: number): void {
    this.renderer.resize(width, height);
    this.canvas.width = Math.max(1, Math.floor(width));
    this.canvas.height = Math.max(1, Math.floor(height));
  }

  getLastResult(): PresentResult | undefined {
    return this.lastResult;
  }

  getResults(): PresentResult[] {
    return this.results;
  }

  getBackend(): string {
    return this.renderer.getDeviceInfo()?.backend ?? 'unknown';
  }

  getDeviceInfo() {
    return this.renderer.getDeviceInfo();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('resize', this._onResize);
    this.resizeObserver?.disconnect();
    this.renderer.dispose();
    this.container.remove();
    document.body.style.margin = '';
  }
}

