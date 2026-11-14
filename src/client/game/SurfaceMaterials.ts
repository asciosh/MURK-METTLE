import photoManifest from './photo-surfaces.json';
import * as THREE from 'three';

export type SurfaceKind = 'earth' | 'forest' | 'asphalt' | 'bark' | 'brick' | 'plaster' | 'fabric' | 'skin' | 'metal';
interface Surface {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
}

/** Original, deterministic tileable PBR surfaces. No downloads or per-frame texture generation. */
export class SurfaceMaterials {
  private disposed = false;
  private photoGeneration = 0;
  private readonly downloads = new Map<
    SurfaceKind,
    Promise<{ data: Uint8Array<ArrayBuffer>; width: number; height: number }[]>
  >();
  private readonly originalImages = new Map<SurfaceKind, THREE.DataTexture['image'][]>();
  private readonly downloadAbort = new AbortController();
  private readonly surfaces = new Map<SurfaceKind, Surface>();
  private readonly materials = new Set<THREE.Material>();
  get(kind: SurfaceKind): Surface {
    const cached = this.surfaces.get(kind);
    if (cached) return cached;
    const size = 512,
      count = size * size,
      heights = new Float32Array(count);
    let seed = 7129 + kind.length * 391;
    const rand = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
    const layers = [4, 8, 16, 32, 64, 128].map((n) => ({ n, values: Float32Array.from({ length: n * n }, rand) }));
    const noise = (x: number, y: number, level: number): number => {
      const { n, values } = layers[level];
      const px = (x * n) / size,
        py = (y * n) / size,
        ix = Math.floor(px),
        iy = Math.floor(py);
      let u = px - ix,
        v = py - iy;
      u = u * u * (3 - 2 * u);
      v = v * v * (3 - 2 * v);
      const at = (a: number, b: number) => values[((b + n) % n) * n + ((a + n) % n)];
      return THREE.MathUtils.lerp(
        THREE.MathUtils.lerp(at(ix, iy), at(ix + 1, iy), u),
        THREE.MathUtils.lerp(at(ix, iy + 1), at(ix + 1, iy + 1), u),
        v,
      );
    };
    const base: Record<SurfaceKind, [number, number, number]> = {
      earth: [113, 100, 78],
      forest: [73, 77, 49],
      asphalt: [65, 67, 65],
      bark: [83, 76, 62],
      brick: [126, 105, 87],
      plaster: [159, 158, 143],
      fabric: [160, 164, 148],
      skin: [187, 173, 151],
      metal: [93, 101, 94],
    };
    const albedo = new Uint8Array(count * 4),
      normal = new Uint8Array(count * 4),
      rough = new Uint8Array(count * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const i = y * size + x,
          n0 = noise(x, y, 0),
          n1 = noise(x, y, 1),
          n2 = noise(x, y, 2),
          n3 = noise(x, y, 3),
          grain = rand();
        let h = n0 * 0.3 + n1 * 0.25 + n2 * 0.22 + n3 * 0.15 + grain * 0.08;
        let tone = 0.61 + h * 0.62,
          stain = 1,
          red = 1;
        if (kind === 'brick') {
          const row = Math.floor(y / 64),
            bx = (x + (row % 2) * 64) % 128,
            by = y % 64;
          const mortar = bx < 3 || by < 3;
          h = mortar ? 0.08 : 0.42 + n2 * 0.17 + grain * 0.08;
          tone = mortar ? 0.73 : 0.65 + n0 * 0.26 + n1 * 0.25 + grain * 0.12;
          red = 1 + (row % 3) * 0.035;
        } else if (kind === 'bark') {
          const grooves = Math.pow(0.5 + 0.5 * Math.sin(x * 0.38 + noise(x, y, 1) * 12), 6);
          h = 0.35 + n1 * 0.15 + n3 * 0.22 - grooves * 0.3;
          tone = 0.59 + h * 0.67;
        } else if (kind === 'fabric') {
          h = 0.45 + (x % 4 < 2 !== y % 4 < 2 ? 0.12 : -0.1) + n2 * 0.1;
          tone = 0.65 + n0 * 0.24 + grain * 0.12 + (x % 4 < 2 ? 0.025 : 0);
        } else if (kind === 'skin') {
          h = 0.45 + n3 * 0.07 + grain * 0.025;
          tone = 0.75 + n0 * 0.15 + n1 * 0.14 + grain * 0.035;
          stain = n1 < 0.35 ? 0.72 : 1;
          red = 1 + (n2 - 0.5) * 0.19;
        } else if (kind === 'plaster') {
          const damage = n0 * 0.6 + n1 * 0.4;
          h = damage < 0.24 ? 0.14 + n3 * 0.07 : 0.58 + n3 * 0.12;
          stain = damage < 0.24 ? 0.68 : 1;
          tone = 0.81 + n2 * 0.18 + grain * 0.07;
          if (Math.abs(n1 - 0.51) < 0.006) {
            h -= 0.18;
            stain *= 0.65;
          }
        } else if (kind === 'asphalt') {
          h = 0.38 + n3 * 0.2 + grain * 0.23;
          tone = 0.68 + grain * 0.38 + n0 * 0.17;
          if (Math.abs(Math.sin(x * 0.021 + y * 0.006 + n2 * 0.035)) < 0.012 && n0 < 0.42) {
            h = 0.12;
            tone *= 0.72;
          }
        } else if (kind === 'metal') {
          const rust = n0 * 0.6 + n2 * 0.4 < 0.43;
          stain = rust ? 0.69 : 1;
          red = rust ? 1.5 : 1;
          h = 0.3 + n3 * 0.08 + (rust ? grain * 0.2 : 0);
          tone = 0.68 + n1 * 0.25 + grain * 0.1;
        } else {
          const stone = grain > 0.964;
          h += stone ? 0.17 : 0;
          tone += stone ? 0.12 : 0;
          stain = n0 < 0.35 ? 0.9 : 1;
          if (kind === 'forest' && n3 > 0.63) {
            tone *= 1.17;
            red = 1.15;
          }
        }
        heights[i] = h;
        const rgb = base[kind];
        albedo[i * 4] = Math.min(255, rgb[0] * tone * stain * red);
        albedo[i * 4 + 1] = Math.min(255, rgb[1] * tone * stain);
        albedo[i * 4 + 2] = Math.min(255, rgb[2] * tone * stain);
        albedo[i * 4 + 3] = 255;
        const r = kind === 'metal' ? 0.55 + n1 * 0.4 : kind === 'asphalt' ? 0.76 + n0 * 0.22 : 0.87 + grain * 0.12;
        rough[i * 4] = rough[i * 4 + 1] = rough[i * 4 + 2] = r * 255;
        rough[i * 4 + 3] = 255;
      }
    const strength = kind === 'fabric' ? 1.1 : kind === 'skin' ? 0.65 : kind === 'brick' ? 1.4 : 3.6;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const i = y * size + x,
          dx = (heights[y * size + ((x + 1) % size)] - heights[y * size + ((x + size - 1) % size)]) * strength,
          dy = (heights[((y + 1) % size) * size + x] - heights[((y + size - 1) % size) * size + x]) * strength;
        const inverse = 1 / Math.hypot(dx, dy, 1);
        normal[i * 4] = (-dx * inverse * 0.5 + 0.5) * 255;
        normal[i * 4 + 1] = (-dy * inverse * 0.5 + 0.5) * 255;
        normal[i * 4 + 2] = (inverse * 0.5 + 0.5) * 255;
        normal[i * 4 + 3] = 255;
      }
    const texture = (bytes: Uint8Array, color = false) => {
      const t = new THREE.DataTexture(bytes, size, size);
      t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.magFilter = THREE.LinearFilter;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.generateMipmaps = true;
      t.anisotropy = 8;
      t.needsUpdate = true;
      return t;
    };
    const surface = { map: texture(albedo, true), normalMap: texture(normal), roughnessMap: texture(rough) };
    this.originalImages.set(kind, [surface.map.image, surface.normalMap.image, surface.roughnessMap.image]);
    this.surfaces.set(kind, surface);
    return surface;
  }
  material(kind: SurfaceKind, color: THREE.ColorRepresentation = 0xffffff, repeat = 1): THREE.MeshStandardMaterial {
    const s = this.get(kind);
    // Each material owns transforms, while image bytes stay shared within this library.
    const maps = [s.map, s.normalMap, s.roughnessMap].map((t) => {
      const copy = t.clone();
      copy.repeat.setScalar(repeat);
      copy.needsUpdate = true;
      return copy;
    });
    const material = new THREE.MeshStandardMaterial({
      map: maps[0],
      normalMap: maps[1],
      roughnessMap: maps[2],
      color,
      roughness: 1,
      normalScale: new THREE.Vector2(0.7, 0.7),
      metalness: kind === 'metal' ? 0.38 : 0,
    });
    material.userData.surfaceMaps = maps;
    this.materials.add(material);
    let released = false;
    material.addEventListener('dispose', () => {
      if (released) return;
      released = true;
      for (const t of maps) t.dispose();
      this.materials.delete(material);
    });
    return material;
  }
  async photographic(enabled: boolean, onProgress?: (loaded: number, total: number) => void): Promise<void> {
    const generation = ++this.photoGeneration;
    const entries = Object.entries(photoManifest) as [SurfaceKind, { maps: { url: string; integrity: string }[] }][];
    if (!enabled) {
      for (const [kind, images] of this.originalImages) this.applyImages(kind, images);
      return;
    }
    let loaded = 0;
    onProgress?.(loaded, entries.length);
    await Promise.allSettled(
      entries.map(async ([kind, asset]) => {
        if (!this.downloads.has(kind))
          this.downloads.set(
            kind,
            Promise.all(
              asset.maps.map(async (m) => {
                const response = await fetch(m.url, {
                  integrity: m.integrity,
                  mode: 'cors',
                  credentials: 'omit',
                  signal: this.downloadAbort.signal,
                });
                if (!response.ok) throw Error('Photo material unavailable');
                const blob = await response.blob();
                if (blob.size > 3_000_000) throw Error('Photo material exceeds budget');
                const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
                try {
                  if (bitmap.width > 1024 || bitmap.height > 1024) throw Error('Photo material exceeds dimensions');
                  const canvas = document.createElement('canvas');
                  canvas.width = bitmap.width;
                  canvas.height = bitmap.height;
                  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
                  ctx.drawImage(bitmap, 0, 0);
                  const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
                  return { data: new Uint8Array(pixels.data), width: bitmap.width, height: bitmap.height };
                } finally {
                  bitmap.close();
                }
              }),
            ),
          );
        let images;
        try {
          images = await this.downloads.get(kind)!;
        } catch (error) {
          this.downloads.delete(kind);
          throw error;
        }
        if (this.disposed || generation !== this.photoGeneration) return;
        this.get(kind);
        this.applyImages(kind, images);
        onProgress?.(++loaded, entries.length);
      }),
    );
  }
  private applyImages(kind: SurfaceKind, images: THREE.DataTexture['image'][]): void {
    const surface = this.surfaces.get(kind);
    if (!surface || this.disposed) return;
    const textures = [surface.map, surface.normalMap, surface.roughnessMap];
    textures.forEach((texture, i) => {
      texture.image = images[i];
      texture.needsUpdate = true;
    });
    for (const material of this.materials) {
      for (const texture of material.userData.surfaceMaps as THREE.Texture[]) {
        if (textures.some((base) => base.source === texture.source)) texture.needsUpdate = true;
      }
    }
  }
  dispose(): void {
    this.disposed = true;
    this.downloadAbort.abort();
    this.downloads.clear();
    this.originalImages.clear();
    for (const m of [...this.materials]) m.dispose();
    for (const s of this.surfaces.values()) {
      s.map.dispose();
      s.normalMap.dispose();
      s.roughnessMap.dispose();
    }
    this.surfaces.clear();
    this.materials.clear();
  }
}

let actorSurfaces: SurfaceMaterials | null = null,
  actorUsers = 0;
export function acquireActorSurfaces(): SurfaceMaterials {
  actorUsers++;
  return actorSurfaces ?? (actorSurfaces = new SurfaceMaterials());
}
export function releaseActorSurfaces(): void {
  if (actorUsers > 0 && --actorUsers === 0) {
    actorSurfaces?.dispose();
    actorSurfaces = null;
  }
}
