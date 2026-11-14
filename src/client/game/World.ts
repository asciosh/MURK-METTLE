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
  private readonly textures: THREE.Texture[] = [];
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
  }
  private texture(kind: 'soil' | 'bark' | 'concrete' | 'brick' | 'leaf' | 'grass' | 'road'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    let seed = 542;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    if (kind === 'grass') {
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
      // Branches connect the leaves, replacing the earlier floating-ellipse pattern.
      ctx.strokeStyle = '#615c42';
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(128, 256);
      ctx.quadraticCurveTo(120, 130, 127, 12);
      ctx.stroke();
      for (let branch = 0; branch < 13; branch++) {
        const side = branch % 2 ? 1 : -1,
          startY = 235 - branch * 15,
          endX = 128 + side * (40 + rand() * 63),
          endY = startY - 42 - rand() * 25;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(125, startY);
        ctx.quadraticCurveTo((125 + endX) / 2, startY - 10, endX, endY);
        ctx.stroke();
        for (let k = 0; k < 12; k++) {
          const t = 0.13 + k * 0.075,
            x = 125 + (endX - 125) * t + (rand() - 0.5) * 22,
            y = startY + (endY - startY) * t + (rand() - 0.5) * 19;
          const angle = side * 0.65 + (rand() - 0.5) * 1.1;
          ctx.fillStyle = `rgb(${60 + rand() * 38},${82 + rand() * 46},${35 + rand() * 27})`;
          ctx.beginPath();
          ctx.ellipse(x, y, 5 + rand() * 5, 2 + rand() * 2, angle, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#7c8957';
          ctx.lineWidth = 0.4;
          ctx.beginPath();
          ctx.moveTo(x - 5 * Math.cos(angle), y - 5 * Math.sin(angle));
          ctx.lineTo(x + 5 * Math.cos(angle), y + 5 * Math.sin(angle));
          ctx.stroke();
          ctx.strokeStyle = '#615c42';
        }
      }
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
    const map = this.texture('soil');
    map.repeat.set(95, 95);
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
    const ground = this.mesh(
      geometry,
      new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.025, roughness: 0.96, vertexColors: true }),
      0,
      -0.025,
      0,
    );
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
      const ridge = 9 + Math.abs(Math.sin(x * 0.024 + z * 0.017)) * 18 + Math.sin(x * 0.057) * Math.cos(z * 0.046) * 7;
      const height = ramp * ridge;
      points.setY(i, height - 0.12);
      tint.setHSL(0.22, 0.13, 0.29 + height * 0.002);
      tints.push(tint.r, tint.g, tint.b);
    }
    mountains.setAttribute('color', new THREE.Float32BufferAttribute(tints, 3));
    mountains.computeVertexNormals();
    const mountain = this.mesh(
      mountains,
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }),
      0,
      -0.12,
      0,
    );
    mountain.castShadow = false;
    // The settlement's worn asphalt is distinct from the forest's dirt path.
    const roadMap = this.texture('road');
    roadMap.repeat.set(3, 22);
    const road = this.mesh(
      new THREE.PlaneGeometry(7.5, 56),
      new THREE.MeshStandardMaterial({
        map: roadMap,
        bumpMap: roadMap,
        bumpScale: 0.018,
        roughness: 0.94,
        color: 0x909183,
      }),
      0,
      0.003,
      -56,
    );
    road.rotation.x = -Math.PI / 2;
    road.castShadow = false;
    const paint = new THREE.MeshStandardMaterial({ color: 0xaca47a, roughness: 1, transparent: true, opacity: 0.45 });
    for (let z = -32; z > -80; z -= 6) {
      const dash = this.mesh(new THREE.PlaneGeometry(0.1, 1.7), paint, 0, 0.008, z);
      dash.rotation.x = -Math.PI / 2;
      dash.castShadow = false;
    }
    const pebbleGeo = new THREE.IcosahedronGeometry(0.13, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0x77786c, roughness: 1 });
    const pebbles = new THREE.InstancedMesh(pebbleGeo, mat, 850);
    const d = new THREE.Object3D();
    for (let i = 0; i < 850; i++) {
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
  private createForest(): void {
    const bark = this.texture('bark');
    bark.repeat.set(1, 3);
    const leaf = this.texture('leaf');
    const branches = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.035, 0.1, 2.8, 6),
      new THREE.MeshStandardMaterial({ map: bark, roughness: 1 }),
      TREES.length * 5,
    );
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.18, 0.34, 7.5, 9),
      new THREE.MeshStandardMaterial({ map: bark, bumpMap: bark, bumpScale: 0.08, roughness: 1 }),
      TREES.length,
    );
    const foliage = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(5.3, 6),
      new THREE.MeshStandardMaterial({
        map: leaf,
        alphaTest: 0.4,
        alphaToCoverage: true,
        side: THREE.DoubleSide,
        roughness: 1,
      }),
      TREES.length * 5,
    );
    const d = new THREE.Object3D();
    const color = new THREE.Color();
    for (const [i, t] of TREES.entries()) {
      d.position.set(t.x, 3.75 * t.size, t.z);
      d.rotation.set(0, i * 2.4, 0);
      d.scale.setScalar(t.size);
      d.updateMatrix();
      trunks.setMatrixAt(i, d.matrix);
      for (let j = 0; j < 5; j++) {
        const angle = j * 2.4 + i;
        d.position.set(
          t.x + Math.sin(angle) * 0.7 * t.size,
          (4.8 + j * 0.55) * t.size,
          t.z + Math.cos(angle) * 0.7 * t.size,
        );
        d.rotation.set(Math.cos(angle) * 1.05, 0, -Math.sin(angle) * 1.05);
        d.scale.setScalar(t.size);
        d.updateMatrix();
        branches.setMatrixAt(i * 5 + j, d.matrix);
        d.position.set(t.x + Math.sin(j * 2.3) * t.size, (5 + j * 0.55) * t.size, t.z + Math.cos(j * 2.3) * t.size);
        d.rotation.set(j * 0.32, j * 2.4 + i, j * 0.11);
        d.scale.set(1.1 * t.size, (0.7 + (j % 2) * 0.2) * t.size, t.size);
        d.updateMatrix();
        foliage.setMatrixAt(i * 5 + j, d.matrix);
        color.setHSL(0.2 + (i % 7) * 0.005, 0.16, 0.4 + (i % 4) * 0.025);
        foliage.setColorAt(i * 5 + j, color);
      }
    }
    trunks.castShadow = true;
    trunks.receiveShadow = true;
    foliage.castShadow = true;
    foliage.receiveShadow = true;
    this.applyWind(foliage);
    trunks.computeBoundingSphere();
    foliage.computeBoundingSphere();
    branches.castShadow = true;
    branches.receiveShadow = true;
    branches.computeBoundingSphere();
    this.scene.add(trunks, foliage, branches);
    // Crossing textured grass cards replace the former solid triangular plants.
    const grass = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.9, 0.7),
      new THREE.MeshStandardMaterial({
        map: this.texture('grass'),
        alphaTest: 0.4,
        alphaToCoverage: true,
        side: THREE.DoubleSide,
        color: 0x81865c,
        roughness: 1,
      }),
      4000,
    );
    for (let i = 0; i < 4000; i++) {
      const x = Math.sin(i * 127.1) * 88,
        z = Math.sin(i * 311.7) * 88;
      d.position.set(x, Math.abs(x) < 5 ? -0.6 : 0.23, z);
      d.rotation.set(0, i * 2.4, 0);
      d.scale.setScalar(0.6 + (i % 7) * 0.12);
      d.updateMatrix();
      grass.setMatrixAt(i, d.matrix);
    }
    grass.receiveShadow = true;
    this.applyWind(grass);
    grass.computeBoundingSphere();
    this.scene.add(grass);
    const undergrowth = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.7, 1.5), foliage.material, 900);
    for (let i = 0; i < 900; i++) {
      const x = Math.sin(i * 531.6) * 86,
        z = Math.cos(i * 214.7) * 86;
      const clearing = Math.abs(x) < 6 || (Math.abs(x) < 30 && z < -29) || Math.hypot(x + 48, z + 28) < 13;
      d.position.set(x, clearing ? -2 : 0.6, z);
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
  }
  update(dt: number): void {
    this.windTime.value += dt;
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
    mesh.material.onBeforeCompile = patch;
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
    const brick = this.texture('brick');
    brick.repeat.set(3, 2);
    const concrete = this.texture('concrete');
    concrete.repeat.set(2, 2);
    const wall = new THREE.MeshStandardMaterial({ map: brick, bumpMap: brick, bumpScale: 0.08, roughness: 0.96 });
    const plaster = new THREE.MeshStandardMaterial({
      map: concrete,
      bumpMap: concrete,
      bumpScale: 0.05,
      roughness: 1,
      color: 0xaaa99a,
    });
    const roof = new THREE.MeshStandardMaterial({ color: 0x424b48, metalness: 0.35, roughness: 0.82 });
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x192728, roughness: 0.35, metalness: 0.3 });
    const timber = new THREE.MeshStandardMaterial({ map: this.texture('bark'), color: 0x777060, roughness: 1 });
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
      for (let k = 0; k < 8; k++) {
        const vine = this.mesh(
          new THREE.SphereGeometry(0.6, 7, 5),
          new THREE.MeshStandardMaterial({ color: 0x46523e, roughness: 1 }),
          b.x - b.w / 2 - 0.05,
          b.h * (k / 8),
          b.z + Math.sin(k) * b.d * 0.3,
        );
        vine.scale.set(0.2, 1.6, 1.2);
      }
    }
    // Abandoned vehicle silhouettes, with weathered bodywork and rubber wheels.
    const metal = new THREE.MeshStandardMaterial({ map: concrete, color: 0x67766c, metalness: 0.3, roughness: 0.84 });
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
    const water = this.mesh(
      new THREE.CircleGeometry(12, 48),
      new THREE.MeshPhysicalMaterial({
        color: 0x344b48,
        metalness: 0.35,
        roughness: 0.22,
        clearcoat: 0.7,
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
    const planks = new THREE.MeshStandardMaterial({ map: this.texture('bark'), color: 0x8a8070, roughness: 1 });
    for (let i = 0; i < 22; i++) this.mesh(new THREE.BoxGeometry(2.5, 0.16, 0.42), planks, -48, 0.15, -15 - i * 0.48);
  }
  private createSupplies(): void {
    const olive = new THREE.MeshStandardMaterial({ color: 0x505e48, metalness: 0.35, roughness: 0.75 });
    const trim = new THREE.MeshStandardMaterial({ color: 0xb6ad81, roughness: 0.8 });
    for (const p of SUPPLIES) {
      const group = new THREE.Group();
      group.position.set(p.x, 0, p.z);
      this.mesh(new THREE.BoxGeometry(1.2, 0.7, 0.7), olive, 0, 0.35, 0, group);
      for (const x of [-0.4, 0.4]) this.mesh(new THREE.BoxGeometry(0.08, 0.72, 0.74), trim, x, 0.36, 0, group);
      this.scene.add(group);
      this.crates.set(p.id, group);
    }
  }
  private createLandmarks(): void {
    const mat = new THREE.MeshStandardMaterial({ color: 0x777b6f, roughness: 1 });
    for (const x of [-2.1, 2.1]) this.mesh(new THREE.BoxGeometry(0.55, 3.8, 0.65), mat, x, 1.9, -23.5);
    this.mesh(new THREE.BoxGeometry(5, 0.5, 0.8), mat, 0, 3.8, -23.5);
    const camp = new THREE.MeshStandardMaterial({ color: 0x777462, roughness: 1 });
    const tent = this.mesh(new THREE.CylinderGeometry(0, 2.7, 2.7, 4, 1, false, Math.PI / 4), camp, -10, 1.35, 6);
    tent.scale.z = 1.5;
    this.sign('FIELD CAMP', -6, 2.4, 5, mat);
    for (const def of Object.values(CREATURES)) {
      const ground = this.mesh(
        new THREE.CircleGeometry(1.2, 24),
        new THREE.MeshStandardMaterial({ color: 0x737c64, roughness: 1 }),
        def.x,
        0.02,
        def.z,
      );
      ground.rotation.x = -Math.PI / 2;
      ground.castShadow = false;
    }
  }
  region(position: THREE.Vector3): string {
    return position.z < -32 && Math.abs(position.x) < 30
      ? 'HAVEN / ABANDONED SETTLEMENT'
      : Math.hypot(position.x + 48, position.z + 28) < 24
        ? 'REEDWATER / WETLAND'
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
    for (const texture of this.textures) texture.dispose();
    for (const material of this.depthMaterials) material.dispose();
  }
}
