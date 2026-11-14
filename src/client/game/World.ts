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
  private readonly crates = new Map<string, THREE.Group>();
  constructor(private readonly scene: THREE.Scene) {
    this.createTerrain();
    this.createForest();
    this.createTown();
    this.createWetland();
    this.createSupplies();
    this.createLandmarks();
  }
  private texture(kind: 'soil' | 'bark' | 'concrete' | 'brick' | 'leaf'): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    let seed = 542;
    const rand = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    if (kind === 'leaf') {
      for (let i = 0; i < 45; i++) {
        const x = 30 + rand() * 196,
          y = 15 + rand() * 220;
        ctx.fillStyle = `rgb(${55 + rand() * 35},${70 + rand() * 40},${42 + rand() * 25})`;
        ctx.beginPath();
        ctx.ellipse(x, y, 9 + rand() * 13, 3 + rand() * 6, rand() * 6.28, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#79805b';
        ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(x - 9, y);
        ctx.lineTo(x + 9, y);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle =
        kind === 'soil' ? '#a6a18c' : kind === 'bark' ? '#60574b' : kind === 'brick' ? '#796759' : '#9b9a8e';
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
      new THREE.MeshStandardMaterial({ map, bumpMap: map, bumpScale: 0.12, roughness: 0.96, vertexColors: true }),
      0,
      -0.025,
      0,
    );
    ground.castShadow = false;
    // Soft relief beyond the navigable sector, leaving gameplay on a predictable plane.
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x4d5d51, roughness: 1 });
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const hill = this.mesh(new THREE.SphereGeometry(1, 20, 12), hillMat, Math.cos(a) * 133, 0, Math.sin(a) * 133);
      hill.scale.set(27, 12 + Math.sin(i * 4) * 7, 24);
      hill.castShadow = false;
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
    const branches=new THREE.InstancedMesh(new THREE.CylinderGeometry(.035,.10,2.8,6),new THREE.MeshStandardMaterial({map:bark,roughness:1}),TREES.length*5);
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.18, 0.34, 7.5, 9),
      new THREE.MeshStandardMaterial({ map: bark, bumpMap: bark, bumpScale: 0.08, roughness: 1 }),
      TREES.length,
    );
    const foliage = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(5.3, 6),
      new THREE.MeshStandardMaterial({ map: leaf, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 1 }),
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
        const angle=j*2.4+i;
        d.position.set(t.x+Math.sin(angle)*.7*t.size,(4.8+j*.55)*t.size,t.z+Math.cos(angle)*.7*t.size);
        d.rotation.set(Math.cos(angle)*1.05,0,-Math.sin(angle)*1.05);d.scale.setScalar(t.size);d.updateMatrix();branches.setMatrixAt(i*5+j,d.matrix);
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
    trunks.computeBoundingSphere();
    foliage.computeBoundingSphere();
    branches.castShadow=true;branches.receiveShadow=true;branches.computeBoundingSphere();
    this.scene.add(trunks, foliage, branches);
    // Crossing textured grass cards replace the former solid triangular plants.
    const grass = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(0.9, 0.7),
      new THREE.MeshStandardMaterial({
        map: leaf,
        alphaTest: 0.5,
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
    grass.computeBoundingSphere();
    this.scene.add(grass);
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
  }
}
