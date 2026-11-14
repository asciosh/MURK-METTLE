import * as THREE from 'three';

/** Curved cutout fronds replace single flat undergrowth cards. */
export function fernGeometry(): THREE.BufferGeometry {
  const vertices: number[] = [],
    uvs: number[] = [],
    indices: number[] = [];
  for (let frond = 0; frond < 5; frond++) {
    const angle = (frond * Math.PI * 2) / 5,
      base = vertices.length / 3;
    for (let k = 0; k <= 5; k++) {
      const t = k / 5,
        r = t * 0.65,
        height = Math.sin(t * Math.PI * 0.72) * 1.05,
        width = 0.32 * (1 - t * 0.7);
      for (const side of [-1, 1]) {
        vertices.push(
          Math.cos(angle) * r + Math.sin(angle) * width * side,
          height,
          Math.sin(angle) * r - Math.cos(angle) * width * side,
        );
        uvs.push(side === -1 ? 0 : 1, t);
      }
    }
    for (let k = 0; k < 5; k++) {
      const p = base + k * 2;
      indices.push(p, p + 1, p + 2, p + 1, p + 3, p + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export class OutdoorMotion {
  private time = 0;
  private readonly leaves: THREE.Points;
  private readonly texture: THREE.CanvasTexture;
  constructor(scene: THREE.Scene) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#a39a67';
    ctx.beginPath();
    ctx.moveTo(15, 2);
    ctx.bezierCurveTo(30, 11, 27, 24, 17, 30);
    ctx.bezierCurveTo(3, 23, 3, 12, 15, 2);
    ctx.fill();
    ctx.strokeStyle = '#d3c598';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(16, 4);
    ctx.lineTo(17, 28);
    ctx.stroke();
    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    const positions = new Float32Array(64 * 3),
      seeds = new Float32Array(64);
    for (let i = 0; i < 64; i++) {
      positions[i * 3] = Math.sin(i * 431.31) * 12;
      positions[i * 3 + 1] = (i * 0.731) % 8;
      positions[i * 3 + 2] = Math.cos(i * 137.77) * 12;
      seeds[i] = i * 0.713;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geometry.setDrawRange(0, 40);
    const material = new THREE.PointsMaterial({
      map: this.texture,
      size: 0.12,
      opacity: 0.72,
      transparent: true,
      alphaTest: 0.2,
      depthWrite: false,
      color: 0xc6bc93,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.leafTime = {
        get value() {
          return self.time;
        },
      };
      shader.vertexShader = 'uniform float leafTime;attribute float aSeed;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
      transformed.y=mod(position.y-leafTime*.48+aSeed+1000.,8.);
      transformed.x+=sin(leafTime*.65+aSeed)*1.2;transformed.z+=cos(leafTime*.43+aSeed)*.7;`,
      );
    };
    const self = this;
    material.customProgramCacheKey = () => 'canopy-falling-leaves-v026';
    this.leaves = new THREE.Points(geometry, material);
    this.leaves.name = 'falling-leaves';
    this.leaves.frustumCulled = false;
    scene.add(this.leaves);
  }
  update(dt: number, focus?: THREE.Vector3): void {
    this.time = (this.time + dt) % 1000;
    if (focus) this.leaves.position.set(focus.x, 0, focus.z);
  }
  dispose(): void {
    this.leaves.removeFromParent();
    this.leaves.geometry.dispose();
    (this.leaves.material as THREE.Material).dispose();
    this.texture.dispose();
  }
}

/** Water uses an animated height texture and the existing environment reflections. */
export function waterRipples(): THREE.DataTexture {
  const n = 128,
    bytes = new Uint8Array(n * n * 4);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = (x / n) * Math.PI * 2,
        v = (y / n) * Math.PI * 2,
        value = 128 + Math.sin(u * 3 + Math.sin(v * 2) * 0.6) * 26 + Math.sin(v * 5 + u * 2) * 13;
      const i = (y * n + x) * 4;
      bytes[i] = bytes[i + 1] = bytes[i + 2] = value;
      bytes[i + 3] = 255;
    }
  const texture = new THREE.DataTexture(bytes, n, n);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.repeat.set(5, 5);
  texture.needsUpdate = true;
  return texture;
}
