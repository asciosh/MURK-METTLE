/**
 * NEXTGEN M01 — graphics architecture shared types.
 *
 * Single Three.js module-instance convention: every module in this tree imports
 * the Three scene graph and renderers from 'three/webgpu' so WebGPURenderer,
 * WebGLRenderer, geometries, materials and cameras never exist as duplicated
 * module instances (requirement: avoid duplicated Three.js module instances).
 */

export type GraphicsBackend = 'webgpu' | 'webgl2' | 'unknown';

export interface GraphicsDeviceInfo {
  backend: GraphicsBackend;
  /** Marketing name of the adapter/GPU, when readable. */
  deviceName: string;
  /** Whether navigator.gpu was detected at all. */
  webgpuAvailable: boolean;
  /** Whether the active renderer fell back from WebGPU to WebGL 2. */
  fallbackUsed: boolean;
}

export interface RendererOptions {
  canvas?: HTMLCanvasElement;
  antialias?: boolean;
  /** Device pixel ratio cap; undefined follows the active quality preset. */
  pixelRatio?: number;
  /** Force the WebGL 2 backend even when WebGPU is available (for testing). */
  forceWebGL?: boolean;
}

export interface PresentResult {
  backend: GraphicsBackend;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}
