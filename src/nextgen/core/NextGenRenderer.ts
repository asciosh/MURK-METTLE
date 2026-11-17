import * as THREE from 'three/webgpu';
import { GraphicsDevice } from './GraphicsDevice';
import { SimulationClock } from './SimulationClock';
import { ResourceTracker } from './ResourceTracker';
import { PerfInstrumentation } from './PerfInstrumentation';
import { GraphicsQuality } from './GraphicsQuality';
import type { GraphicsDeviceInfo, PresentResult, RendererOptions } from './types';

export interface NextGenRendererOptions extends RendererOptions {
  /** Invoked every displayed frame with telemetry (performance instrumentation). */
  onFrame?: (result: PresentResult) => void;
}

/**
 * NEXTGEN M01 renderer facade.
 *
 * Decouples fixed-timestep simulation from display-rate rendering. Owns the
 * GraphicsDevice backend, scene, camera, clock, resource tracker and quality
 * preset. Lifecycle: init → start (render loop) → stop → dispose, with guards
 * against duplicate render loops and use-after-dispose (renderer lifecycle
 * management, requirement).
 */

export class NextGenRenderer {
  private readonly device: GraphicsDevice;
  private readonly quality: GraphicsQuality;
  private readonly clock: SimulationClock;
  private readonly tracker: ResourceTracker;
  private readonly instrumentation: PerfInstrumentation;
  onFrame?: (result: PresentResult) => void;

  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;

  private running = false;
  private graphicsLost = false;
  private disposed = false;
  private width = 0;
  private height = 0;
  private deviceInfo: GraphicsDeviceInfo | null = null;

  constructor(options: NextGenRendererOptions = {}) {
    this.onFrame = options.onFrame;
    this.device = new GraphicsDevice(options);
    this.quality = new GraphicsQuality();
    this.clock = new SimulationClock();
    this.tracker = new ResourceTracker();
    this.instrumentation = new PerfInstrumentation();

    const handleGraphicsLoss = () => {
    if (this.disposed || this.graphicsLost) return;

    this.graphicsLost = true;
    this.stop();
  };

  this.device.onDeviceLost(handleGraphicsLoss);
  this.device.onContextLost(handleGraphicsLoss);

    this.scene = this.tracker.track(new THREE.Scene());
    this.camera = this.tracker.track(new THREE.PerspectiveCamera(58, 1, 0.1, 1000));
    this.camera.position.set(0, 2, 6);
    this.camera.lookAt(0, 0, 0);

    this.scene.background = new THREE.Color(0x1b2a26);
    this.scene.fog = new THREE.FogExp2(0x1b2a26, 0.02);
  }

  async init(): Promise<GraphicsDeviceInfo> {
    this.deviceInfo = await this.device.init();
    const renderer = this.device.backendRenderer;
    if (renderer) {
      this.quality.apply(renderer);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
    }
    this.resize(this.width || 800, this.height || 600);
    return this.deviceInfo;
  }

  /** Start the display-rate render loop. No-op if already running. */
  start(): void {
    if (this.running || this.disposed || this.graphicsLost) return;
    const renderer = this.device.backendRenderer;
    if (!renderer) {
      throw new Error('NextGenRenderer: cannot start before init().');
    }
    this.running = true;
    renderer.setAnimationLoop((time) => this._tick(time));
  }

  /** Stop the render loop. No-op if already stopped. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.device.backendRenderer?.setAnimationLoop(null);
  }

  private _tick(time: number): void {
    if (this.disposed || this.graphicsLost || !this.running) return;

    this.clock.tick(time);
    this._render();

    const frameMs = this.instrumentation.record(time);

    const renderer = this.device.backendRenderer;
    if (!renderer) return;

    const info = renderer.info;

    const result: PresentResult = {
      backend: this.deviceInfo?.backend ?? 'unknown',
      frameMs,
      timestampMs: time,
      drawCalls: info.render.drawCalls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
    };

    this.onFrame?.(result);
  }

  private _render(): void {
  const renderer = this.device.backendRenderer;
  if (!renderer) return;

  if (this.pipeline) {
    this.pipeline.render();
  } else {
    renderer.render(this.scene, this.camera);
  }
}

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.device.setSize(width, height);
  }

  setQuality(id: string): void {
    this.quality.set(id);
    const renderer = this.device.backendRenderer;
    if (renderer) this.quality.apply(renderer);
  }

  track<T extends { dispose(): void }>(resource: T): T {
    return this.tracker.track(resource);
  }

  getDeviceInfo(): GraphicsDeviceInfo | null {
    return this.deviceInfo;
  }

  getTrackerSize(): number {
    return this.tracker.size;
  }

  getAlpha(): number {
    return this.clock.getAlpha();
  }

  getTick(): number {
    return this.clock.getTick();
  }

  get sceneRef(): THREE.Scene {
    return this.scene;
  }

  get cameraRef(): THREE.PerspectiveCamera {
    return this.camera;
  }

  get backendRenderer() {
    return this.device.backendRenderer;
  }

  dispose(): void {
    this.stop();
    this.clock.dispose();
    this.instrumentation.dispose();
    this.quality.dispose();
    this.device.dispose();
    this.tracker.disposeAll();
    this.disposed = true;
  }

  private pipeline?: THREE.RenderPipeline;

  setRenderPipeline(pipeline?: THREE.RenderPipeline): void {
    this.pipeline = pipeline;
  }
}
