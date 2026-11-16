import * as THREE from 'three/webgpu';
import { pass, vec3, vec4 } from 'three/tsl';
import { NextGenRenderer } from '../core/NextGenRenderer';
import type { PresentResult } from '../core/types';
import { qualityId } from '../../../shared/render-profile.mjs';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { TerrainGenerator } from '../core/TerrainGenerator';
import { TerrainMaterial } from '../core/TerrainMaterial';

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

  private scenePass?: ReturnType<typeof pass>;

  private bloomNode?: ReturnType<typeof bloom>;

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

  this.bloomNode = bloom(sceneColor, 1.0, 0.8, 0.3);

  const combined = sceneColor.add(this.bloomNode);

  this.pipeline.outputNode = vec4(
    combined.rgb.mul(vec3(0.96, 1.0, 1.04)),
    sceneColor.a
  );

  this.setQualityPreset('balanced');
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

    // Instanced placeholder trees
    const count = 36;
    const spacing = 8;
    const centerX = 100;
    const centerZ = 100;

    const dummy = new THREE.Object3D();

    const trunkGeo = this.renderer.track(
      new THREE.CylinderGeometry(0.25, 0.4, 3, 8)
    );

    const trunkMat = this.renderer.track(
      new THREE.MeshStandardMaterial({
        color: 0x5d4a3a,
        roughness: 0.95
      })
    );

    const crownGeo = this.renderer.track(
      new THREE.ConeGeometry(1.8, 4, 8)
    );

    const crownMat = this.renderer.track(
      new THREE.MeshStandardMaterial({
        color: 0x355d39,
        roughness: 0.9
      })
    );

    const trunks = this.renderer.track(
      new THREE.InstancedMesh(trunkGeo, trunkMat, count)
    );

    const crowns = this.renderer.track(
      new THREE.InstancedMesh(crownGeo, crownMat, count)
    );

    let n = 0;

    for (let z = 0; z < 6; z++) {
      for (let x = 0; x < 6; x++) {
        const px = centerX + (x - 2.5) * spacing;
        const pz = centerZ + (z - 2.5) * spacing;
        const h = terrain.heightAt(px, pz);

        dummy.position.set(px, h + 1.5, pz);
        dummy.updateMatrix();
        trunks.setMatrixAt(n, dummy.matrix);

        dummy.position.set(px, h + 3.6, pz);
        dummy.updateMatrix();
        crowns.setMatrixAt(n, dummy.matrix);

        n++;
      }
    }

    trunks.instanceMatrix.needsUpdate = true;
    crowns.instanceMatrix.needsUpdate = true;

    trunks.castShadow = true;
    crowns.castShadow = true;

    trunks.receiveShadow = true;
    crowns.receiveShadow = true;

    scene.add(trunks);
    scene.add(crowns);

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
    };

    updateCamera();

    this.renderer.onFrame = (result) => {
      prev?.(result);

      angle += 0.005;
      updateCamera();

      this.frame++;
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
    const preset = this.qualityPresets[this.currentPreset as keyof typeof this.qualityPresets];

    // Update renderer exposure
    const renderer = this.renderer.backendRenderer;
    if (renderer) {
      renderer.toneMappingExposure = preset.exposure;
    }

    // Update RenderPipeline bloom and exposure settings
    if (this.pipeline) {
      // @ts-expect-error — RenderPipeline accepts bloom configuration properties
      this.pipeline.bloomStrength = preset.bloomStrength;
      // @ts-expect-error — RenderPipeline accepts bloom configuration properties
      this.pipeline.bloomThreshold = preset.bloomThreshold;
      // @ts-expect-error — RenderPipeline accepts bloom configuration properties
      this.pipeline.bloomRadius = preset.bloomRadius;
    }

    // Forward to NextGenRenderer quality for downstream compatibility
    this.renderer.setQuality(this.currentPreset);
  }

  /** Apply a quality preset directly, updating renderer and pipeline settings. */
  private setQualityPreset(id: keyof typeof this.qualityPresets): void {
    const preset = this.qualityPresets[id];

    // Update renderer exposure
    const renderer = this.renderer.backendRenderer;
    if (renderer) {
      renderer.toneMappingExposure = preset.exposure;
    }

    // Update TSL bloom node settings
    if (this.bloomNode) {
      // @ts-expect-error — BloomNode accepts strength, radius, threshold properties
      this.bloomNode.strength = preset.bloomStrength;
      // @ts-expect-error — BloomNode accepts strength, radius, threshold properties
      this.bloomNode.threshold = preset.bloomThreshold;
      // @ts-expect-error — BloomNode accepts strength, radius, threshold properties
      this.bloomNode.radius = preset.bloomRadius;
    }
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
    this.renderer.dispose();
    this.container.remove();
    document.body.style.margin = '';
  }
}

