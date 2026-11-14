import * as THREE from 'three';
import type { ModVisual } from './ModVisual';
/** One small, DPR-1 preview. Never runs when the manager is closed. */
export class ModPreview {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
  private frame = 0;
  private last = 0;
  private width = 0;
  private readonly resizeObserver: ResizeObserver;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor(
    private readonly host: HTMLElement,
    readonly visual: ModVisual,
  ) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute('aria-label', 'Local creature cosmetic 3D preview');
    this.host.replaceChildren(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight(0xd8ebce, 0x18251c, 2.5));
    const sun = new THREE.DirectionalLight(0xffe1b2, 3);
    sun.position.set(-3, 4, -3);
    this.scene.add(sun, visual.root);
    this.camera.position.set(1.35, 0.7, -2.8);
    this.camera.lookAt(0, 0.1, 0);
    this.resizeObserver = new ResizeObserver(() => this.render(0));
    this.resizeObserver.observe(host);
    this.render(0);
    if (!this.reduced) this.frame = requestAnimationFrame(this.tick);
  }
  pulse(): void {
    this.visual.pulse();
    if (this.reduced) {
      this.visual.update(0.15, false);
      this.render(0);
    }
  }
  private readonly tick = (now: number) => {
    this.frame = requestAnimationFrame(this.tick);
    if (now - this.last < 66) return;
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    this.render(dt);
  };
  private render(dt: number): void {
    const width = Math.max(1, this.host.clientWidth),
      height = 220;
    if (this.width !== width) {
      this.width = width;
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    }
    this.visual.update(dt, false);
    this.renderer.render(this.scene, this.camera);
  }
  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.visual.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
