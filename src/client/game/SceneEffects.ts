import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** Optional cinematic contact shading. Alpha foliage keeps its real cutout silhouette. */
class OpaqueOcclusionPass extends SSAOPass {
  override render(...args: Parameters<SSAOPass['render']>): void {
    const hidden: THREE.Object3D[] = [];
    this.scene.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !node.visible) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      if (materials.some((m) => m.alphaTest > 0 || m.transparent)) {
        hidden.push(node);
        node.visible = false;
      }
    });
    try {
      super.render(...args);
    } finally {
      for (const node of hidden) node.visible = true;
    }
  }
}
export class SceneEffects {
  private readonly composer: EffectComposer;
  private readonly occlusion: OpaqueOcclusionPass;
  private readonly output = new OutputPass();
  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: Math.min(4, renderer.capabilities.maxSamples),
    });
    this.composer = new EffectComposer(renderer, target);
    this.occlusion = new OpaqueOcclusionPass(scene, camera, 1, 1, 12);
    this.occlusion.kernelRadius = 8;
    this.occlusion.minDistance = 0.001;
    this.occlusion.maxDistance = 0.035;
    this.composer.addPass(new RenderPass(scene, camera));
    this.composer.addPass(this.occlusion);
    this.composer.addPass(this.output);
  }
  resize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    this.occlusion.setSize(
      Math.max(1, Math.round(width * pixelRatio * 0.5)),
      Math.max(1, Math.round(height * pixelRatio * 0.5)),
    );
  }
  render(): void {
    this.composer.render();
  }
  dispose(): void {
    this.occlusion.dispose();
    this.occlusion.ssaoMaterial.dispose();
    this.occlusion.noiseTexture.dispose();
    this.output.dispose();
    this.composer.dispose();
  }
}
