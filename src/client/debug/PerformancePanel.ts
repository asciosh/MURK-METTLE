import type * as THREE from 'three';
import { FrameWindow } from './performance-metrics.mjs';
export class PerformancePanel {
  private readonly frames = new FrameWindow();
  private readonly root = document.createElement('details');
  private readonly content = document.createElement('pre');
  private next = 0;
  constructor() {
    this.root.setAttribute('aria-label', 'Development performance statistics');
    this.root.style.cssText =
      'position:fixed;z-index:10001;right:8px;top:54px;padding:10px;background:#091a13ed;color:#d5eac8;border:1px solid #6e9478;font:11px/1.6 monospace;pointer-events:none;max-width:320px';
    this.root.open = true;
    const summary = document.createElement('summary');
    summary.textContent = 'DEV PERFORMANCE · tap to collapse';
    summary.style.pointerEvents = 'auto';
    summary.style.cursor = 'pointer';
    this.root.append(summary, this.content);
    document.body.append(this.root);
    document.addEventListener('keydown', this.toggle);
  }
  private readonly toggle = (event: KeyboardEvent) => {
    if (event.code === 'F8') {
      event.preventDefault();
      this.root.hidden = !this.root.hidden;
    }
  };
  record(
    now: number,
    info: THREE.WebGLInfo,
    quality: string,
    network: { ageMs: number | null; intervalMs: number; jitterMs: number },
  ): void {
    this.frames.record(now);
    if (now < this.next || this.root.hidden) return;
    this.next = now + 500;
    const frame = this.frames.summary();
    this.content.textContent = `DEV · F8 hide/show\n${frame.fps.toFixed(1)} FPS · ${frame.meanMs.toFixed(1)} ms · p95 ${frame.p95Ms.toFixed(1)} ms\n${info.render.calls} draws · ${info.render.triangles.toLocaleString()} triangles\n${info.memory.geometries} geometries · ${info.memory.textures} textures\nPreset: ${quality}\nSnapshot age: ${network.ageMs === null ? 'n/a' : network.ageMs.toFixed(0) + ' ms'}\nArrival interval/jitter: ${network.intervalMs.toFixed(0)} / ${network.jitterMs.toFixed(1)} ms\nRTT: unavailable (no ping protocol)\nCounts are resources, not memory bytes.`;
  }
  dispose(): void {
    document.removeEventListener('keydown', this.toggle);
    this.root.remove();
  }
}
