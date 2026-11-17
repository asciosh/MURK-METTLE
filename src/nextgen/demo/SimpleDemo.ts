import * as THREE from 'three/webgpu';
import { pass, vec3, vec4, uniform } from 'three/tsl';
import { NextGenRenderer } from '../core/NextGenRenderer';
import type { PresentResult } from '../core/types';
import { qualityId } from '../../../shared/render-profile.mjs';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { TerrainGenerator } from '../core/TerrainGenerator';
import { TerrainMaterial } from '../core/TerrainMaterial';
import { VegetationRenderer } from '../core/VegetationRenderer';
import { PlayableSession } from './PlayableSession';

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
  private benchmarkFrames: PresentResult[] | null = null;
  private disposed = false;
  private resizeObserver?: ResizeObserver;
  private vegetation?: VegetationRenderer;
  private session?: PlayableSession;

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

  private scenePass?: ReturnType<typeof pass>;

  private bloomNode?: ReturnType<typeof bloom>;

  private readonly bloomStrength = uniform(1.2);
  private readonly bloomRadius = uniform(1.0);
  private readonly bloomThreshold = uniform(0.3);

  constructor(private readonly playable = false) {
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
      this.benchmarkFrames?.push(result);
      if (this.results.length > 600) this.results.shift();
    };
  }

async mount(): Promise<void> {
  await this.renderer.init();
  this.resize(window.innerWidth, window.innerHeight);

  this.buildScene();

  const scene = this.renderer.sceneRef;
  const camera = this.renderer.cameraRef;
  const renderer = this.renderer.backendRenderer;

  if (!renderer) {
    throw new Error('SimpleDemo: no backend renderer.');
  }

  this.pipeline = new THREE.RenderPipeline(renderer);

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  this.scenePass = pass(scene, camera);

  const sceneColor = this.scenePass.getTextureNode('output');

  this.bloomNode = bloom(
  sceneColor,
  this.bloomStrength,
  this.bloomRadius,
  this.bloomThreshold
);

  const combined = sceneColor.add(this.bloomNode);

  this.pipeline.outputNode = vec4(
    combined.rgb.mul(vec3(0.96, 1.0, 1.04)),
    sceneColor.a
  );

  this.setQuality('balanced');
  this.renderer.setRenderPipeline(this.pipeline);

  this.renderer.start();

  window.addEventListener('resize', this._onResize);

  this.resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const { width, height } = entry.contentRect;

      if (width > 0 && height > 0) {
        this.resize(width, height);
      }
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

    this.sun = new THREE.DirectionalLight(0xffdda9, 2.5);
    this.sun.position.set(-20, 30, 15);

    scene.add(this.renderer.track(this.sun));
    scene.add(this.sun.target);

    this.applyShadowPreset();

    // PBR image-based ambient via PMREM (cinematic lighting foundation).
    const envScene = new THREE.Scene();
    const hemi = new THREE.HemisphereLight(0xb3cddd, 0x35493b, 0.9);
    envScene.add(hemi);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(envScene, 0.06);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = 0.7;
    pmrem.dispose();

        // Heightfield terrain
    const terrain = new TerrainGenerator(12345);
    const grid = terrain.gridSize;
    const cell = terrain.cellSize;
    const heights = terrain.getHeights();

    const geometry = this.renderer.track(
      new THREE.PlaneGeometry(
        terrain.size,
        terrain.size,
        grid - 1,
        grid - 1
      )
    );

    const positions = geometry.getAttribute('position');

    for (let z = 0; z < grid; z++) {
      for (let x = 0; x < grid; x++) {
        const index = z * grid + x;

        positions.setXYZ(
          index,
          x * cell,
          heights[index],
          z * cell
        );
      }
    }

    positions.needsUpdate = true;

    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const groundMaterial = this.renderer.track(
      new TerrainMaterial()
    );

    const ground = new THREE.Mesh(
      geometry,
      groundMaterial
    );

    ground.receiveShadow = true;
    scene.add(ground);

        const centerX = terrain.size / 2;
    const centerZ = terrain.size / 2;

    // Procedural vegetation and environment props.
    this.vegetation = this.renderer.track(
      new VegetationRenderer(scene, terrain, 12345)
    );

    this.vegetation.setQuality(this.currentPreset);

    // Natural ambient illumination.
    const ambient = new THREE.HemisphereLight(
      0xc5d9ef,
      0x596044,
      1.4
    );

    scene.add(ambient);

    if (scene.fog instanceof THREE.FogExp2) {
      scene.fog.density = 0.012;
    }

    // Center the lighting on the new terrain.
    const centerHeight = terrain.heightAt(centerX, centerZ);

    if (this.sun) {
      this.sun.position.set(
        centerX - 30,
        centerHeight + 45,
        centerZ + 25
      );

      this.sun.target.position.set(
        centerX,
        centerHeight,
        centerZ
      );
    }

      if (this.playable) {
    const session = new PlayableSession(
      scene,
      camera,
      this.canvas,
      terrain
    );

    this.session = session;

    this.renderer.onSimulationStep = (dtMs) => {
      session.step(dtMs);
    };

    this.renderer.onBeforeRender = (dtMs, alpha) => {
      session.present(dtMs, alpha);

      this.vegetation?.update(
        camera.position.x,
        camera.position.z
      );

      if (this.sun) {
        const [x, y, z] = session.getState().position;

        this.sun.position.set(x - 30, y + 45, z + 25);
        this.sun.target.position.set(x, y, z);
      }
    };

    return;
  }

    // Camera orbit above the actual heightfield.
    let angle = 0;
    const prev = this.renderer.onFrame;

 const updateCamera = () => {
  const px = centerX + Math.sin(angle) * 43;
  const pz = centerZ + Math.cos(angle) * 43;

  const cameraHeight = Math.max(
    terrain.heightAt(px, pz) + 12,
    centerHeight + 20
  );

  camera.position.set(px, cameraHeight, pz);
  camera.lookAt(centerX, centerHeight + 2.5, centerZ);

  this.vegetation?.update(px, pz);
};

    updateCamera();

    this.renderer.onFrame = (result) => {
      prev?.(result);

      angle += result.frameMs * 0.0003;
      updateCamera();

      this.frame++;
    };
  }

  resize(width: number, height: number): void {
    this.renderer.resize(width, height);
  }

  getLastResult(): PresentResult | undefined {
    return this.lastResult;
  }

  getPlayerModelInfo() {
    return this.session?.getModelInfo();
  }

  getPlayerState() {
    return this.session?.getState();
  }

  getResults(): PresentResult[] {
    return this.results;
  }

  startBenchmarkCapture(): void {
    this.benchmarkFrames = [];
  }

  finishBenchmarkCapture(): PresentResult[] {
    const results = this.benchmarkFrames ?? [];
    this.benchmarkFrames = null;
    return results;
  }

  get backendRenderer() {
  return this.renderer.backendRenderer;
}

  getBackend(): string {
    return this.renderer.getDeviceInfo()?.backend ?? 'unknown';
  }

  getDeviceInfo() {
    return this.renderer.getDeviceInfo();
  }

  /** Set the quality preset and update ALL renderer + pipeline settings. */
 setQuality(id: string): void {
  this.currentPreset = qualityId(id);

  const preset = this.qualityPresets[
    this.currentPreset as keyof typeof this.qualityPresets
  ];

  this.renderer.setQuality(this.currentPreset);
  this.vegetation?.setQuality(this.currentPreset);
  this.applyShadowPreset();

  const renderer = this.renderer.backendRenderer;

  if (renderer) {
    renderer.toneMappingExposure = preset.exposure;
  }

  this.bloomStrength.value = preset.bloomStrength;
  this.bloomRadius.value = Math.min(1, preset.bloomRadius);
  this.bloomThreshold.value = preset.bloomThreshold;

  if (this.pipeline && this.scenePass && this.bloomNode) {
    const sceneColor = this.scenePass.getTextureNode('output');

    const color = this.currentPreset === 'low'
      ? sceneColor
      : sceneColor.add(this.bloomNode);

    const tint = this.currentPreset === 'low'
      ? vec3(1, 1, 1)
      : vec3(0.96, 1.0, 1.04);

    this.pipeline.outputNode = vec4(
      color.rgb.mul(tint),
      sceneColor.a
    );

    this.pipeline.needsUpdate = true;
  }
}

private applyShadowPreset(): void {
  if (!this.sun) return;

  const configs = {
    low: {
      resolution: 512,
      cameraFar: 100,
      distance: 30,
    },
    balanced: {
      resolution: 1024,
      cameraFar: 200,
      distance: 60,
    },
    cinematic: {
      resolution: 2048,
      cameraFar: 300,
      distance: 100,
    },
  };

  const config = configs[
    this.currentPreset as keyof typeof configs
  ];

  this.sun.castShadow = this.currentPreset !== 'low';

  const shadow = this.sun.shadow;

  shadow.mapSize.set(config.resolution, config.resolution);
  shadow.camera.near = 1;
  shadow.camera.far = config.cameraFar;
  shadow.camera.left = -config.distance;
  shadow.camera.right = config.distance;
  shadow.camera.top = config.distance;
  shadow.camera.bottom = -config.distance;

  shadow.camera.updateProjectionMatrix();

  shadow.map?.setSize(config.resolution, config.resolution);

  shadow.needsUpdate = true;
}

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('resize', this._onResize);
    this.resizeObserver?.disconnect();
    // Dispose RenderPipeline resources
    if (this.pipeline) {
      this.pipeline.dispose();
      this.pipeline = undefined;
    }
    this.renderer.stop();
    this.renderer.onSimulationStep = undefined;
    this.renderer.onBeforeRender = undefined;

    this.session?.dispose();
    this.session = undefined;

    this.renderer.dispose();
    this.container.remove();
    document.body.style.margin = '';
  }
}

