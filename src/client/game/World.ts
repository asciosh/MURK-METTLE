import { SpatialInstances, batchStaticWorld } from './WorldBatches';
import { addHabitatArt } from './HabitatArt';
import { forestZone, foliageScale, WORLD_DECOR_BUDGET } from './world-composition.mjs';
import { OutdoorMotion, fernGeometry, waterRipples } from './OutdoorMotion';
import { InstanceDetail } from './InstanceDetail';
import type { RenderProfile } from '../../../shared/render-profile.mjs';
import { SurfaceMaterials } from './SurfaceMaterials';
import { terrainMaterial } from './TerrainMaterial';
import { addZoneStory } from './WorldStory';
import { addSettlementDetails } from './WorldDetails';
import * as THREE from 'three';
import {
  BUILDINGS,
  TREES,
  SUPPLIES,
  CREATURES,
  constrainPosition,
  obstacleDistance,
} from '../../../shared/expansion.mjs';

/** Deterministic 180m sector. Collision geometry is shared with the room server. */
export class World {
  private readonly outdoor: OutdoorMotion;
  private readonly spatial: SpatialInstances[] = [];
  private waterBump: THREE.Texture | null = null;
  private readonly detailMeshes: { detail: InstanceDetail; kind: 'foliage' | 'grass' | 'undergrowth' }[] = [];
  private readonly surfaces = new SurfaceMaterials();
  private readonly textures: THREE.Texture[] = [];
  private readonly generatedTextures = new Map<string, THREE.CanvasTexture>();
  private readonly windTime = { value: 0 };
  private readonly depthMaterials: THREE.Material[] = [];
  private readonly crates = new Map<string, THREE.Group>();
  constructor(private readonly scene: THREE.Scene) {
    this.createTerrain();
    this.createForest();
    this.createTown();
    this.createWetland();
    this.createSupplies();
    this.createLandmarks();
    addSettlementDetails(this.scene, this.surfaces);
    this.textures.push(...addZoneStory(this.scene, this.surfaces));
    const habitatFronds = addHabitatArt(this.scene, this.surfaces, this.texture('leaf'));
    this.applyWind(habitatFronds);
    this.detailMeshes.push({ detail: new InstanceDetail(habitatFronds, 16), kind: 'undergrowth' });
    this.outdoor = new OutdoorMotion(this.scene);
    batchStaticWorld(this.scene);
    const sources: THREE.InstancedMesh[] = [];
    this.scene.traverse((node) => {
      if (node instanceof THREE.InstancedMesh && node.count >= 400) sources.push(node);
    });
    for (const source of sources) this.spatial.push(new SpatialInstances(source));
  }
  private texture(
    kind: 'soil' | 'bark' | 'concrete' | 'brick' | 'leaf' | 'pine' | 'grass' | 'road',
  ): THREE.CanvasTexture {
    const cached = this.generatedTextures.get(kind);
    if (cached) return cached;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.scale(2, 2);
    let seed = 542;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    if (kind === 'pine') {
      // Original evergreen bough atlas: five tapered sprays, not solid cone geometry.
      for (let b = 0; b < 5; b++) {
        const y = 28 + b * 42,
          width = 20 + b * 19;
        ctx.fillStyle = b % 2 ? '#3b553d' : '#476146';
        ctx.beginPath();
        ctx.moveTo(128, y - 25);
        for (let k = 0; k < 12; k++) {
          const t = k / 11;
          ctx.lineTo(128 - width * t + (k % 2 ? 4 : -2), y - 12 + t * 34);
        }
        ctx.lineTo(128, y + 11);
        for (let k = 11; k >= 0; k--) {
          const t = k / 11;
          ctx.lineTo(128 + width * t + (k % 2 ? -4 : 2), y - 12 + t * 34);
        }
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#6d7354';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(128, y - 22);
        ctx.lineTo(128, y + 20);
        ctx.stroke();
        for (let k = 0; k < 70; k++) {
          const side = k % 2 ? 1 : -1,
            t = rand(),
            x = 128 + side * width * t;
          ctx.strokeStyle = `rgb(${55 + rand() * 35},${75 + rand() * 38},${48 + rand() * 28})`;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(128, y - 12 + t * 24);
          ctx.lineTo(x, y + 15 + t * 10);
          ctx.stroke();
          for (let needle = 0; needle < 3; needle++) {
            ctx.beginPath();
            ctx.moveTo(x, y + 10);
            ctx.lineTo(x + side * (4 + rand() * 5), y + 3 + needle * 5);
            ctx.stroke();
          }
        }
      }
    } else if (kind === 'grass') {
      for (let i = 0; i < 40; i++) {
        const base = 12 + rand() * 232,
          tip = base + (rand() - 0.5) * 62,
          height = 50 + rand() * 180;
        ctx.fillStyle = `rgb(${68 + rand() * 40},${80 + rand() * 42},${39 + rand() * 25})`;
        ctx.beginPath();
        ctx.moveTo(base, 256);
        ctx.quadraticCurveTo(base - 7, 256 - height * 0.55, tip, 256 - height);
        ctx.quadraticCurveTo(base + 8, 256 - height * 0.35, base + 3, 256);
        ctx.fill();
      }
    } else if (kind === 'leaf') {
      const branch = (
        x: number,
        y: number,
        angle: number,
        length: number,
        width: number,
        depth: number,
      ): void => {
        const ex = x + Math.sin(angle) * length,
          ey = y - Math.cos(angle) * length;
        ctx.strokeStyle = '#514f36';
        ctx.lineWidth = width;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        if (depth > 0) {
          for (let k = 1; k <= 3; k++) {
            const t = k / 3;
            for (const side of [-1, 1])
              branch(
                x + (ex - x) * t,
                y + (ey - y) * t,
                angle + side * (0.55 + rand() * 0.3),
                length * 0.42,
                width * 0.55,
                depth - 1,
              );
          }
        } else {
          for (let k = 0; k < 30; k++) {
            const lx = ex + (rand() - 0.5) * 42,
              ly = ey + (rand() - 0.5) * 36,
              a = angle + (rand() - 0.5) * 2;
            const shade = rand();
            ctx.fillStyle = `rgb(${48 + shade * 39},${61 + shade * 46},${29 + shade * 25})`;
            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(a);
            ctx.scale(0.62, 0.62);
            ctx.beginPath();
            ctx.moveTo(0, -8);
            ctx.bezierCurveTo(6, -5, 6, 3, 0, 8);
            ctx.bezierCurveTo(-5, 3, -5, -5, 0, -8);
            ctx.fill();
            ctx.strokeStyle = 'rgba(156,159,102,.38)';
            ctx.lineWidth = 0.45;
            ctx.beginPath();
            ctx.moveTo(0, -6);
            ctx.lineTo(0, 6);
            ctx.stroke();
            ctx.restore();
          }
        }
      };
      branch(128, 243, 0, 132, 3, 2);
      branch(128, 209, -0.65, 100, 2.4, 2);
      branch(128, 204, 0.67, 102, 2.4, 2);
    } else {
      ctx.fillStyle =
        kind === 'road'
          ? '#75766b'
          : kind === 'soil'
            ? '#b4ae96'
            : kind === 'bark'
              ? '#60574b'
              : kind === 'brick'
                ? '#796759'
                : '#9b9a8e';
      ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 18000; i++) {
        const n = rand() * 100;
        ctx.fillStyle = `rgba(${n},${n},${n},${rand() * 0.23})`;
        const x = rand() * 256,
          y = rand() * 256;
        ctx.fillRect(
          x,
          y,
          kind === 'bark' ? 1 + rand() * 3 : 1 + rand() * 2,
          kind === 'bark' ? rand() * 60 : 1 + rand() * 3,
        );
      }
      if (kind === 'soil')
        for (let i = 0; i < 100; i++) {
          const x = rand() * 256,
            y = rand() * 256;
          ctx.fillStyle = `rgba(${65 + rand() * 45},${55 + rand() * 30},${28 + rand() * 20},.45)`;
          ctx.beginPath();
          ctx.ellipse(x, y, 2 + rand() * 5, 1 + rand() * 2, rand() * 6.28, 0, Math.PI * 2);
          ctx.fill();
        }
      if (kind === 'brick') {
        ctx.strokeStyle = '#4b4b43';
        ctx.lineWidth = 3;
        for (let y = 0; y < 256; y += 32) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(256, y);
          ctx.stroke();
          for (let x = y % 64 ? -32 : 0; x < 256; x += 64) {
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, y + 32);
            ctx.stroke();
          }
        }
      }
      for (let i = 0; i < 70; i++) {
        ctx.strokeStyle = `rgba(25,30,24,${rand() * 0.28})`;
        ctx.lineWidth = rand() * 2;
        let x = rand() * 256,
          y = rand() * 256;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += rand() * 12 - 6;
          y += rand() * 10;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
    this.textures.push(texture);
    this.generatedTextures.set(kind, texture);
    return texture;
  }
  private mesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    parent: THREE.Object3D = this.scene,
  ): THREE.Mesh {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  private createTerrain(): void {
    const geometry = new THREE.PlaneGeometry(210, 210, 100, 100);
    geometry.rotateX(-Math.PI / 2);
    const colors = [];
    const position = geometry.getAttribute('position');
    const color = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i),
        z = position.getZ(i);
      const road = Math.abs(x) < 4.5 || (Math.abs(z) < 2.7 && x > -55 && x < 65);
      const town = Math.abs(x) < 29 && z < -32 && z > -78;
      const marsh = Math.hypot(x + 48, z + 28) < 16;
      const n = Math.sin(x * 0.19) * Math.cos(z * 0.13) * 0.06 + Math.sin(x * 1.7 + z * 0.8) * 0.025;
      color.set(road ? 0x7c7766 : town ? 0x676b5b : marsh ? 0x46554b : 0x64714c);
      color.offsetHSL(0, -0.06, n);
      colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const ground = this.mesh(geometry, terrainMaterial(this.surfaces), 0, -0.025, 0);
    ground.name = 'flat-playable-ground';
    ground.castShadow = false;
    // A continuous ridgeline replaces the obvious sphere-shaped background hills.
    const mountains = new THREE.PlaneGeometry(430, 430, 90, 90);
    mountains.rotateX(-Math.PI / 2);
    const points = mountains.getAttribute('position'),
      tints = [];
    const tint = new THREE.Color();
    for (let i = 0; i < points.count; i++) {
      const x = points.getX(i),
        z = points.getZ(i),
        r = Math.max(Math.abs(x), Math.abs(z));
      const ramp = THREE.MathUtils.smoothstep(r, 94, 142);
      const ridge =
        9 + Math.abs(Math.sin(x * 0.024 + z * 0.017)) * 18 + Math.sin(x * 0.057) * Math.cos(z * 0.046) * 7;
      const height = ramp * ridge;
      points.setY(i, height - 0.12);
      tint.setHSL(0.22, 0.13, 0.29 + height * 0.002);
      tints.push(tint.r, tint.g, tint.b);
    }
    mountains.setAttribute('color', new THREE.Float32BufferAttribute(tints, 3));
    mountains.computeVertexNormals();
    const mountain = this.mesh(mountains, this.surfaces.material('forest', 0xa3ac91, 65), 0, -0.12, 0);
    mountain.castShadow = false;
    // The settlement's worn asphalt is distinct from the forest's dirt path.
    const paint = new THREE.MeshStandardMaterial({
      color: 0xaca47a,
      roughness: 1,
      transparent: true,
      opacity: 0.22,
    });
    for (let z = -32; z > -80; z -= 6) {
      const dash = this.mesh(new THREE.PlaneGeometry(0.1, 1.7), paint, 0, 0.008, z);
      dash.rotation.x = -Math.PI / 2;
      dash.castShadow = false;
    }
    const pebbleGeo = new THREE.IcosahedronGeometry(0.13, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x77786c, roughness: 1 });
    const pebbles = new THREE.InstancedMesh(pebbleGeo, mat, WORLD_DECOR_BUDGET.pebbles);
    const d = new THREE.Object3D();
    for (let i = 0; i < WORLD_DECOR_BUDGET.pebbles; i++) {
      const x = Math.sin(i * 674.21) * 88,
        z = Math.cos(i * 341.43) * 88;
      d.position.set(x, 0.04, z);
      d.scale.set(0.6 + (i % 5) * 0.3, 0.4, 1.2);
      d.rotation.set(i, 0, i * 0.5);
      d.updateMatrix();
      pebbles.setMatrixAt(i, d.matrix);
    }
    pebbles.computeBoundingSphere();
    pebbles.receiveShadow = true;
    this.scene.add(pebbles);
  }
  private trunkGeometry(): THREE.CylinderGeometry {
    const geometry = new THREE.CylinderGeometry(0.12, 0.34, 8.5, 14, 8),
      position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i),
        z = position.getZ(i),
        y = position.getY(i),
        angle = Math.atan2(z, x);
      const flare = 1 + Math.exp(-(y + 4.25) * 3) * (0.35 + 0.22 * Math.sin(angle * 5));
      position.setX(i, x * flare + Math.sin((y + 4.25) * 0.4) * 0.075);
      position.setZ(i, z * flare + Math.sin((y + 4.25) * 0.51) * 0.055);
    }
    geometry.computeVertexNormals();
    return geometry;
  }
  private createForest(): void {
    const barkMaterial = this.surfaces.material('bark', 0xffffff, 2);
    const leaf = this.texture('leaf');
    const pineTrees = TREES.filter((t) => forestZone(t.x, t.z) === 'pine');
    const broadTrees = TREES.filter((t) => forestZone(t.x, t.z) !== 'pine');
    const branches = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.035, 0.1, 2.8, 6),
      barkMaterial,
      TREES.length * 10,
    );
    const trunks = new THREE.InstancedMesh(this.trunkGeometry(), barkMaterial, TREES.length);
    const foliage = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(5.4, 5.2),
      new THREE.MeshStandardMaterial({
        map: leaf,
        alphaTest: 0.4,
        alphaToCoverage: true,
        side: THREE.DoubleSide,
        roughness: 1,
      }),
      broadTrees.length * 10,
    );
    const pineMaterial = (foliage.material as THREE.MeshStandardMaterial).clone();
    pineMaterial.map = this.texture('pine');
    const pineFoliage = new THREE.InstancedMesh(
      foliage.geometry.clone(),
      pineMaterial,
      pineTrees.length * 10,
    );
    let broadIndex = 0,
      pineIndex = 0;
    const stormHome = CREATURES.stormrook;
    const stormTree = TREES.reduce(
      (best, t, i) =>
        Math.hypot(t.x - stormHome.x, t.z - stormHome.z) <
        Math.hypot(TREES[best].x - stormHome.x, TREES[best].z - stormHome.z)
          ? i
          : best,
      0,
    );
    const d = new THREE.Object3D();
    const color = new THREE.Color();
    for (const [i, t] of TREES.entries()) {
      d.position.set(t.x, 4.25 * t.size, t.z);
      d.rotation.set(0, i * 2.4, 0);
      d.scale.setScalar(t.size);
      d.updateMatrix();
      trunks.setMatrixAt(i, d.matrix);
      trunks.setColorAt(i, color.setHex(i === stormTree ? 0xb1b8ad : 0xffffff));
      const zone = forestZone(t.x, t.z);
      const crown = zone === 'pine' ? pineFoliage : foliage;
      const crownIndex = zone === 'pine' ? pineIndex++ : broadIndex++;
      for (let j = 0; j < 10; j++) {
        const angle = j * 2.4 + i;
        d.position.set(
          t.x + Math.sin(angle) * 0.7 * t.size,
          (4.2 + j * 0.38) * t.size,
          t.z + Math.cos(angle) * 0.7 * t.size,
        );
        d.rotation.set(Math.cos(angle) * 1.05, 0, -Math.sin(angle) * 1.05);
        d.scale.set(
          t.size * (zone === 'pine' ? 0.65 : 1),
          t.size * (zone === 'pine' ? 0.8 : 1),
          t.size * (zone === 'pine' ? 0.65 : 1),
        );
        d.updateMatrix();
        branches.setMatrixAt(i * 10 + j, d.matrix);
        const shape = foliageScale(zone, j);
        d.position.set(
          t.x + Math.sin(j * 2.3) * (zone === 'pine' ? 0.25 : 1.5 + (j % 3) * 0.35) * t.size,
          shape.y * t.size,
          t.z + Math.cos(j * 2.3) * (zone === 'pine' ? 0.25 : 1.5 + (j % 3) * 0.35) * t.size,
        );
        d.rotation.set((j % 3) * 0.38, j * 2.4 + i, Math.sin(j) * 0.32);
        d.scale.set(shape.width * t.size * (i === stormTree ? 0.45 : 1), shape.height * t.size, t.size);
        if (zone === 'wetland') d.rotation.z += 0.32 * Math.sin(j * 2.3);
        d.updateMatrix();
        crown.setMatrixAt(crownIndex * 10 + j, d.matrix);
        color.setHSL(0.2 + (i % 7) * 0.005, 0.1, 0.67 + (i % 4) * 0.045);
        if (zone === 'wetland') color.setHSL(0.25, 0.1, 0.72);
        if (zone === 'pine') color.setHSL(0.29, 0.12, 0.66 + (i % 3) * 0.03);
        if (i === stormTree) color.setRGB(1, 0.64, 0.45);
        crown.setColorAt(crownIndex * 10 + j, color);
      }
    }
    trunks.castShadow = true;
    trunks.receiveShadow = true;
    foliage.castShadow = true;
    foliage.receiveShadow = false;
    this.applyWind(foliage);
    trunks.computeBoundingSphere();
    foliage.computeBoundingSphere();
    branches.castShadow = true;
    branches.receiveShadow = true;
    branches.computeBoundingSphere();
    pineFoliage.name = 'southern-pine-crowns';
    foliage.name = 'broadleaf-and-willow-crowns';
    pineFoliage.castShadow = true;
    pineFoliage.receiveShadow = false;
    this.applyWind(pineFoliage);
    pineFoliage.computeBoundingSphere();
    this.scene.add(trunks, foliage, pineFoliage, branches);
    this.detailMeshes.push(
      { detail: new InstanceDetail(foliage, 10), kind: 'foliage' },
      { detail: new InstanceDetail(pineFoliage, 10), kind: 'foliage' },
      { detail: new InstanceDetail(branches, 10), kind: 'foliage' },
    );
    // Crossing textured grass cards replace the former solid triangular plants.
    const grass = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.9, 0.7),
      new THREE.MeshStandardMaterial({
        map: this.texture('grass'),
        alphaTest: 0.4,
        alphaToCoverage: true,
        side: THREE.DoubleSide,
        color: 0xb1b293,
        roughness: 1,
      }),
      WORLD_DECOR_BUDGET.grass,
    );
    for (let i = 0; i < WORLD_DECOR_BUDGET.grass; i++) {
      const x = Math.sin(i * 127.1) * 88,
        z = Math.sin(i * 311.7) * 88;
      const wet = Math.hypot(x + 48, z + 31) < 13;
      const town = Math.abs(x) < 30 && z < -29 && z > -80;
      const trail = Math.abs(x) < 5 || (Math.abs(z) < 3 && x > -56 && x < 66);
      d.position.set(x, wet || town || trail ? -1 : 0.23, z);
      color.setHex(forestZone(x, z) === 'pine' ? 0xa0aa91 : 0xbfc098);
      grass.setColorAt(i, color);
      d.rotation.set(0, i * 2.4, 0);
      d.scale.setScalar(0.6 + (i % 7) * 0.12);
      d.updateMatrix();
      grass.setMatrixAt(i, d.matrix);
    }
    grass.receiveShadow = true;
    this.applyWind(grass);
    grass.computeBoundingSphere();
    this.scene.add(grass);
    this.detailMeshes.push({ detail: new InstanceDetail(grass), kind: 'grass' });
    const undergrowth = new THREE.InstancedMesh(fernGeometry(), foliage.material, WORLD_DECOR_BUDGET.ferns);
    for (let i = 0; i < WORLD_DECOR_BUDGET.ferns; i++) {
      const x = Math.sin(i * 531.6) * 86,
        z = Math.cos(i * 214.7) * 86;
      const clearing = Math.abs(x) < 6 || (Math.abs(x) < 30 && z < -29) || Math.hypot(x + 48, z + 28) < 13;
      d.position.set(x, clearing ? -2 : 0.015, z);
      d.rotation.set(0.12 * Math.sin(i), i * 2.4, 0);
      d.scale.setScalar(0.6 + (i % 5) * 0.2);
      d.updateMatrix();
      undergrowth.setMatrixAt(i, d.matrix);
    }
    undergrowth.receiveShadow = true;
    undergrowth.castShadow = true;
    undergrowth.computeBoundingSphere();
    this.applyWind(undergrowth);
    this.scene.add(undergrowth);
    this.detailMeshes.push({ detail: new InstanceDetail(undergrowth), kind: 'undergrowth' });
  }
  setQuality(profile: RenderProfile): void {
    for (const { detail, kind } of this.detailMeshes) detail.setFraction(profile[kind]);
    for (const spatial of this.spatial) spatial.refresh();
    this.scene.traverse((o) => {
      if (o.name === 'falling-leaves' && o instanceof THREE.Points)
        o.geometry.setDrawRange(0, profile.particles);
    });
  }
  update(dt: number, focus?: THREE.Vector3): void {
    this.windTime.value += dt;
    this.outdoor.update(dt, focus);
    if (this.waterBump) {
      this.waterBump.offset.x = (this.waterBump.offset.x + dt * 0.018) % 1;
      this.waterBump.offset.y = (this.waterBump.offset.y + dt * 0.011) % 1;
    }
  }
  private applyWind(mesh: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>): void {
    const patch = (shader: Parameters<THREE.Material['onBeforeCompile']>[0]) => {
      shader.uniforms.fieldWindTime = this.windTime;
      shader.vertexShader = 'uniform float fieldWindTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
        float breeze = fieldWindTime * 1.45 + instanceMatrix[3].x * 0.075 + instanceMatrix[3].z * 0.052;
        transformed.x += sin(breeze + uv.y * 1.3) * uv.y * uv.y * 0.10;
        transformed.z += cos(breeze * 0.8) * uv.y * uv.y * 0.055;
        #endif
      `,
      );
    };
    mesh.material.onBeforeCompile = (shader) => {
      patch(shader);
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <lights_fragment_end>',
        '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse += diffuseColor.rgb * vec3(.16,.20,.11);',
      );
    };
    mesh.material.customProgramCacheKey = () => 'field-wind-v1';
    const depth = new THREE.MeshDepthMaterial({
      map: mesh.material.map,
      alphaTest: mesh.material.alphaTest,
      side: THREE.DoubleSide,
      depthPacking: THREE.RGBADepthPacking,
    });
    depth.onBeforeCompile = patch;
    depth.customProgramCacheKey = () => 'field-depth-wind-v1';
    mesh.customDepthMaterial = depth;
    this.depthMaterials.push(depth);
  }
  private createTown(): void {
    const wall = this.surfaces.material('brick', 0xffffff, 3);
    const plaster = this.surfaces.material('plaster', 0xd8d5c8, 2);
    const roof = this.surfaces.material('metal', 0x747f7c, 2);
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x172327, roughness: 0.16, metalness: 0.55 });
    const timber = this.surfaces.material('bark', 0xaaa391, 2);
    const ivyMap = this.texture('leaf');
    const ivyMaterial = new THREE.MeshStandardMaterial({
      map: ivyMap,
      alphaTest: 0.43,
      side: THREE.DoubleSide,
      roughness: 1,
      color: 0x9ca386,
    });
    for (const [i, b] of BUILDINGS.entries()) {
      this.mesh(new THREE.BoxGeometry(b.w, b.h, b.d), i % 2 ? plaster : wall, b.x, b.h / 2, b.z);
      this.mesh(new THREE.BoxGeometry(b.w + 0.6, 0.3, b.d + 0.6), roof, b.x, b.h + 0.15, b.z);
      this.mesh(new THREE.BoxGeometry(b.w + 0.3, 0.3, b.d + 0.3), plaster, b.x, 0.15, b.z);
      for (const side of [-1, 1])
        for (let k = 0; k < 3; k++) {
          const x = b.x - b.w * 0.3 + k * b.w * 0.3,
            z = b.z + side * (b.d / 2 + 0.025);
          this.mesh(new THREE.BoxGeometry(1.4, 1.8, 0.08), windowMat, x, 2.3, z);
          const board = this.mesh(new THREE.BoxGeometry(1.65, 0.18, 0.12), timber, x, 2.3, z + side * 0.08);
          board.rotation.z = k % 2 ? 0.24 : -0.3;
        }
      const front = b.z + b.d / 2 + 0.08;
      this.mesh(new THREE.BoxGeometry(1.1, 2.15, 0.08), timber, b.x, 1.075, front);
      this.mesh(new THREE.BoxGeometry(1.35, 0.18, 0.35), plaster, b.x, 2.28, front + 0.1);
      this.mesh(new THREE.BoxGeometry(1.45, 0.16, 0.65), plaster, b.x, 0.08, front + 0.24);
      this.mesh(new THREE.BoxGeometry(0.045, 0.045, 0.05), roof, b.x + 0.35, 1.05, front + 0.055);
      for (const side of [-1, 1]) {
        const gutter = this.mesh(
          new THREE.CylinderGeometry(0.06, 0.06, b.h, 8),
          roof,
          b.x + side * (b.w / 2 - 0.15),
          b.h / 2,
          front,
        );
        gutter.castShadow = false;
      }
      for (let k = 0; k < 5; k++) {
        const ivy = this.mesh(
          new THREE.PlaneGeometry(2.5, 3.5),
          ivyMaterial,
          b.x - b.w / 2 - 0.035,
          1.7 + k * 0.7,
          b.z + Math.sin(k * 1.7) * b.d * 0.3,
        );
        ivy.rotation.y = -Math.PI / 2;
        ivy.rotation.z = Math.sin(k) * 0.2;
      }
    }
    // Abandoned vehicle silhouettes, with weathered bodywork and rubber wheels.
    const metal = this.surfaces.material('metal', 0x84938b, 2);
    const rubber = new THREE.MeshStandardMaterial({ color: 0x252a28, roughness: 1 });
    for (const [x, z] of [
      [-6, -37],
      [7, -70],
      [44, 19],
    ]) {
      const car = new THREE.Group();
      car.position.set(x, 0, z);
      car.rotation.y = 0.25;
      this.mesh(new THREE.BoxGeometry(1.7, 0.65, 3.7), metal, 0, 0.75, 0, car);
      this.mesh(new THREE.BoxGeometry(1.48, 0.65, 1.8), windowMat, 0, 1.4, -0.25, car);
      this.mesh(new THREE.BoxGeometry(1.55, 0.12, 1.95), metal, 0, 1.78, -0.25, car);
      for (const a of [-1, 1])
        for (const b of [-1, 1]) {
          const wheel = this.mesh(
            new THREE.CylinderGeometry(0.37, 0.37, 0.24, 14),
            rubber,
            a * 0.83,
            0.4,
            b * 1.16,
            car,
          );
          wheel.rotation.z = Math.PI / 2;
        }
      this.scene.add(car);
    }
    this.sign('HAVEN / EVACUATED', 0, 3, -33, plaster);
    this.sign('RELAY 04', 49, 5, 31, plaster);
  }
  private sign(text: string, x: number, y: number, z: number, material: THREE.Material): void {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#27332f';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#a3ac98';
    ctx.lineWidth = 5;
    ctx.strokeRect(5, 5, 502, 118);
    ctx.fillStyle = '#c2c5af';
    ctx.font = 'bold 34px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, 256, 78);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(texture);
    this.mesh(new THREE.BoxGeometry(5.5, 0.16, 0.16), material, x, y - 1, z);
    this.mesh(
      new THREE.PlaneGeometry(5.3, 1.3),
      new THREE.MeshStandardMaterial({ map: texture, side: THREE.DoubleSide, roughness: 0.8 }),
      x,
      y,
      z,
    );
  }
  private createWetland(): void {
    this.waterBump = waterRipples();
    this.textures.push(this.waterBump);
    const waterGeometry = new THREE.CircleGeometry(12, 64),
      edge = waterGeometry.getAttribute('position');
    for (let i = 1; i < edge.count; i++) {
      const x = edge.getX(i),
        y = edge.getY(i),
        a = Math.atan2(y, x),
        scale = 1 + Math.sin(a * 5) * 0.035 + Math.cos(a * 9) * 0.02;
      edge.setXY(i, x * scale, y * scale);
    }
    const water = this.mesh(
      waterGeometry,
      new THREE.MeshPhysicalMaterial({
        color: 0x344b48,
        metalness: 0.35,
        roughness: 0.22,
        clearcoat: 0.7,
        bumpMap: this.waterBump,
        bumpScale: 0.035,
        transparent: true,
        opacity: 0.9,
      }),
      -48,
      0.015,
      -31,
    );
    water.rotation.x = -Math.PI / 2;
    water.castShadow = false;
    const reeds = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.018, 0.035, 1.6, 4),
      new THREE.MeshStandardMaterial({ color: 0x686f47, roughness: 1 }),
      240,
    );
    const d = new THREE.Object3D();
    for (let i = 0; i < 240; i++) {
      const a = i * 2.4,
        r = 11 + (i % 11) * 0.3;
      d.position.set(-48 + Math.cos(a) * r, 0.65, -31 + Math.sin(a) * r);
      d.rotation.set(0.1 * Math.sin(i), 0, 0.1 * Math.cos(i));
      d.updateMatrix();
      reeds.setMatrixAt(i, d.matrix);
    }
    reeds.computeBoundingSphere();
    this.scene.add(reeds);
    const pads = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.29, 10, 0.15, Math.PI * 1.86),
      new THREE.MeshStandardMaterial({ color: 0x64785c, roughness: 0.72, side: THREE.DoubleSide }),
      WORLD_DECOR_BUDGET.lilyPads,
    );
    for (let i = 0; i < WORLD_DECOR_BUDGET.lilyPads; i++) {
      const a = i * 2.4,
        r = 3 + (i % 9) * 0.7;
      d.position.set(-48 + Math.cos(a) * r, 0.026, -31 + Math.sin(a) * r);
      d.rotation.set(-Math.PI / 2, 0, i * 1.7);
      d.scale.setScalar(0.7 + (i % 4) * 0.2);
      d.updateMatrix();
      pads.setMatrixAt(i, d.matrix);
    }
    pads.name = 'reedwater-lily-pads';
    pads.computeBoundingSphere();
    this.scene.add(pads);
    this.detailMeshes.push({ detail: new InstanceDetail(pads), kind: 'undergrowth' });
    const planks = this.surfaces.material('bark', 0xb4aa92, 2);
    for (let i = 0; i < 22; i++)
      this.mesh(new THREE.BoxGeometry(2.5, 0.016, 0.42), planks, -48, 0.013, -15 - i * 0.48);
  }
  private createSupplies(): void {
    const olive = new THREE.MeshStandardMaterial({ color: 0x505e48, metalness: 0.35, roughness: 0.75 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xb6ad81, roughness: 0.8 });
    for (const p of SUPPLIES) {
      const group = new THREE.Group();
      group.position.set(p.x, 0, p.z);
      this.mesh(new THREE.BoxGeometry(1.2, 0.7, 0.7), olive, 0, 0.35, 0, group);
      for (const x of [-0.4, 0.4])
        this.mesh(new THREE.BoxGeometry(0.08, 0.72, 0.74), trim, x, 0.36, 0, group);
      this.scene.add(group);
      this.crates.set(p.id, group);
    }
  }
  private createLandmarks(): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0x777b6f, roughness: 1 });
    for (const x of [-2.1, 2.1]) this.mesh(new THREE.BoxGeometry(0.55, 3.8, 0.65), mat, x, 1.9, -23.5);
    this.mesh(new THREE.BoxGeometry(5, 0.5, 0.8), mat, 0, 3.8, -23.5);
    const camp = new THREE.MeshStandardMaterial({ color: 0x777462, roughness: 1 });
    const tent = this.mesh(
      new THREE.CylinderGeometry(0, 2.7, 2.7, 4, 1, false, Math.PI / 4),
      camp,
      -10,
      1.35,
      6,
    );
    tent.scale.z = 1.5;
    this.sign('FIELD CAMP', -6, 2.4, 5, mat);
    for (const def of Object.values(CREATURES)) {
      const ground = this.mesh(
        new THREE.CircleGeometry(1.2, 24),
        this.surfaces.material('forest', 0xbac0a3, 1),
        def.x,
        0.02,
        def.z,
      );
      ground.rotation.x = -Math.PI / 2;
      ground.name = 'creature-habitat-surface';
      ground.castShadow = false;
    }
  }
  photographic(enabled: boolean, onProgress?: (loaded: number, total: number) => void): Promise<void> {
    return this.surfaces.photographic(enabled, onProgress);
  }
  region(position: THREE.Vector3): string {
    return position.z < -32 && Math.abs(position.x) < 30
      ? 'HAVEN / ABANDONED SETTLEMENT'
      : Math.hypot(position.x + 48, position.z + 28) < 24
        ? 'REEDWATER / WETLAND'
        : position.z > 28
          ? 'SOUTHERN PINES / SURVEY WOOD'
          : position.x > 35
            ? 'EAST RIDGE / RELAY STATION'
            : 'WILDLANDS / FOREST TRAIL';
  }
  constrainPlayerPosition(position: THREE.Vector3): void {
    constrainPosition(position);
  }
  constrainActorPosition(position: THREE.Vector3, radius: number): void {
    constrainPosition(position, radius);
  }
  cameraDistance(origin: THREE.Vector3, direction: THREE.Vector3, distance: number): number {
    return obstacleDistance(origin, direction, distance);
  }
  dispose(): void {
    for (const spatial of this.spatial) spatial.dispose();
    this.outdoor.dispose();
    this.surfaces.dispose();
    for (const texture of this.textures) texture.dispose();
    for (const material of this.depthMaterials) material.dispose();
  }
}
