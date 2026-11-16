import * as THREE from 'three/webgpu';
import type { GraphicsBackend, GraphicsDeviceInfo, RendererOptions } from './types';

/**
 * Probes the client's graphics capabilities and owns the active Three renderer
 * backend. WebGPU is preferred; WebGL 2 is the guaranteed fallback.
 *
 * Construction never touches the GPU. `init()` performs async backend selection
 * and surfaces WebGPU initialization failures before falling back (requirement:
 * WebGPU when supported, reliable WebGL 2 compatibility, async init failure
 * handling, WebGL 2 fallback verification).
 *
 * WebGPU device loss and WebGL context loss are each wired to their backend's
 * native lifecycle signals (requirement).
 */

export class GraphicsDevice {
  private renderer: THREE.Renderer | null = null;
  private disposed = false;
  private initPromise: Promise<void> | null = null;
  public readonly info: GraphicsDeviceInfo = {
    backend: 'unknown',
    deviceName: '',
    webgpuAvailable: false,
    fallbackUsed: false,
  };

  private readonly deviceLostHandlers = new Set<() => void>();
  private readonly contextLostHandlers = new Set<() => void>();

  private readonly options: RendererOptions;
  constructor(options: RendererOptions = {}) {
    this.options = options;
  }

  /**
   * Pure, testable backend selection without creating GPU resources. Used by
   * unit tests running in headless node (no WebGL context available).
   */
  static detect(options: RendererOptions = {}): {
    backend: GraphicsBackend;
    webgpuAvailable: boolean;
    forceWebGL: boolean;
  } {
    const forceWebGL = options.forceWebGL === true;
    const webgpuAvailable =
      !forceWebGL &&
      typeof navigator !== 'undefined' &&
      'gpu' in navigator &&
      navigator.gpu !== undefined;
    const backend: GraphicsBackend = webgpuAvailable ? 'webgpu' : 'webgl2';
    return { backend, webgpuAvailable, forceWebGL };
  }

  async init(): Promise<GraphicsDeviceInfo> {
    if (this.disposed) {
      throw new Error('GraphicsDevice: cannot init after disposal.');
    }
    if (this.initPromise) {
      await this.initPromise;
      return this.info;
    }
    this.initPromise = this._init();
    await this.initPromise;
    return this.info;
  }
  private async _init(): Promise<void> {
  const canvas = this._canvas();

  const { backend, webgpuAvailable, forceWebGL } =
    GraphicsDevice.detect(this.options);

  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: this.options.antialias ?? true,
    forceWebGL: forceWebGL || backend === 'webgl2',
  });

  await renderer.init();

  this.renderer = renderer;

  const isWebGpuLive =
    renderer.coordinateSystem === THREE.WebGPUCoordinateSystem;

  this.info.webgpuAvailable = webgpuAvailable;
  this.info.backend = isWebGpuLive ? 'webgpu' : 'webgl2';
  this.info.fallbackUsed = backend === 'webgpu' && !isWebGpuLive;

  this.info.deviceName = isWebGpuLive
    ? 'WebGPU adapter'
    : this._readDeviceName(renderer);

  if (isWebGpuLive) {
    this._wireDeviceLoss(renderer);
  } else {
    this._wireContextLoss(canvas);
  }
}

  private _canvas(): HTMLCanvasElement {
    if (this.options.canvas) return this.options.canvas;
    if (typeof document === 'undefined') {
      throw new Error('GraphicsDevice: no canvas and no document.');
    }
    const canvas = document.createElement('canvas');
    return canvas;
  }

  private _readDeviceName(renderer: THREE.Renderer): string {
    try {
      const context = renderer.getContext();
      if (!context) return '';
      // WebGL2 path: read the unmasked renderer string when the extension exists.
      const gl = context as WebGL2RenderingContext;
      const getExt = (gl as any).getExtension;
      if (typeof getExt === 'function') {
        const ext = getExt.call(gl, 'WEBGL_debug_renderer_info');
        if (ext) {
          const getParameter = (gl as any).getParameter;
          if (typeof getParameter === 'function') {
            return String(
              getParameter.call(gl, ext.UNMASKED_RENDERER_WEBGL),
            );
          }
        }
      }
      return 'WebGL 2';
    } catch {
      return '';
    }
  }

  private _wireDeviceLoss(renderer: THREE.Renderer): void {
    const backend = renderer as unknown as {
      device?: { lost: Promise<unknown> };
      info?: { backend?: string };
    };
    if (backend.device?.lost) {
      backend.device.lost.then(() => {
        for (const handler of this.deviceLostHandlers) handler();
      });
    }
  }

  private _wireContextLoss(canvas: HTMLCanvasElement): void {
    const handler = () => {
      for (const h of this.contextLostHandlers) h();
    };
    canvas.addEventListener('webglcontextlost', handler, { passive: true });
    canvas.addEventListener('webglcontextrestored', handler, { passive: true });
  }

  /** The live Three renderer backend (WebGPU or WebGL 2), or null before init. */
  get backendRenderer(): THREE.Renderer | null {
    return this.renderer;
  }

  /** The canvas the renderer draws into, or null before init. */
  get domElement(): HTMLCanvasElement | null {
    return this.renderer?.domElement ?? null;
  }

  /** The active rendering context (GPUCanvasContext | WebGL2RenderingContext). */
  getContext(): unknown {
    return this.renderer?.getContext() ?? null;
  }

  setSize(width: number, height: number): void {
    this.renderer?.setSize(width, height);
  }

  setPixelRatio(ratio: number): void {
    this.renderer?.setPixelRatio(ratio);
  }

  setAnimationLoop(callback: ((time: number) => void) | null): void {
    this.renderer?.setAnimationLoop(callback);
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer?.render(scene, camera);
  }

  onDeviceLost(handler: () => void): void {
    this.deviceLostHandlers.add(handler);
  }

  onContextLost(handler: () => void): void {
    this.contextLostHandlers.add(handler);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.initPromise = null;
    this.renderer?.dispose();
    this.renderer = null;
  }
}

