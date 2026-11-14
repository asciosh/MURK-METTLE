import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDINGS } from '../../../shared/expansion.mjs';
import { SurfaceMaterials } from './SurfaceMaterials';

/** Roof-supported silhouettes and painted story details; no new walkable elevations or blockers. */
export function addZoneStory(scene: THREE.Scene, surfaces: SurfaceMaterials): THREE.Texture[] {
  const steel = surfaces.material('metal', 0xb09a7c, 1),
    wood = surfaces.material('bark', 0x8d8c77, 1);
  const paint = new THREE.MeshStandardMaterial({ color: 0x975c48, roughness: 1 });
  const campPaint = new THREE.MeshStandardMaterial({ color: 0x87aa95, roughness: 1 });
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>(),
    transform = new THREE.Object3D();
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    transform.position.set(x, y, z);
    transform.rotation.set(rx, ry, rz);
    transform.scale.set(1, 1, 1);
    transform.updateMatrix();
    g.applyMatrix4(transform.matrix);
    const batch = groups.get(m) || [];
    batch.push(g);
    groups.set(m, batch);
  };
  const box = (
    w: number,
    h: number,
    d: number,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => add(new THREE.BoxGeometry(w, h, d), m, x, y, z, rx, ry, rz);
  const relay = BUILDINGS[4],
    tank = BUILDINGS[2];
  // A narrow lattice relay occupies only the existing roof footprint.
  for (const side of [-1, 1]) {
    box(0.11, 13, 0.11, steel, relay.x + side * 0.8, relay.h + 6.65, relay.z);
    for (let k = 0; k < 6; k++) {
      box(1.65, 0.08, 0.08, steel, relay.x, relay.h + 1 + k * 2, relay.z);
      box(0.06, 2.5, 0.06, steel, relay.x, relay.h + 2 + k * 2, relay.z, 0, 0, side * 0.68);
    }
  }
  add(
    new THREE.TorusGeometry(1.15, 0.07, 5, 20, Math.PI * 1.4),
    steel,
    relay.x,
    relay.h + 11,
    relay.z - 0.15,
    0.2,
    0.4,
  );
  box(3.2, 0.08, 0.08, steel, relay.x, relay.h + 13, relay.z);
  box(0.08, 1.4, 0.08, steel, relay.x - 1.2, relay.h + 13, relay.z);
  box(0.08, 1.8, 0.08, steel, relay.x + 1.1, relay.h + 13, relay.z);
  // Reservoir tank and legs visibly rest on an existing Haven roof.
  for (const x of [-1, 1]) for (const z of [-1, 1]) box(0.14, 2.2, 0.14, steel, tank.x + x, tank.h + 1.25, tank.z + z);
  add(new THREE.CylinderGeometry(1.65, 1.65, 2.6, 20), steel, tank.x, tank.h + 3.5, tank.z);
  for (const y of [2.3, 4.7])
    add(new THREE.TorusGeometry(1.66, 0.055, 5, 20), wood, tank.x, tank.h + y, tank.z, Math.PI / 2);
  add(new THREE.ConeGeometry(1.78, 0.65, 20), steel, tank.x, tank.h + 5.1, tank.z);
  box(0.12, 4.4, 0.12, steel, tank.x + 1.2, tank.h + 2.2, tank.z + 1.4);
  // Gate hazard paint uses the existing pillars. It is a warning, not a new combat boundary.
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++) box(0.5, 0.16, 0.018, paint, side * 2.1, 0.45 + i * 0.48, -23.16, 0, 0, 0.2);
  // Flush camp edging gives the camp a human scale without adding collision props.
  add(new THREE.RingGeometry(3.4, 3.49, 40), campPaint, -10, 0.007, 6, -Math.PI / 2);
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const captions = [
    ['HAVEN / ISOLATION', 'THE LAST CONVOY LEFT AT DAWN'],
    ['RELAY 04', 'KEEP THE SIGNAL ALIVE'],
    ['REEDWATER', 'WATER SAMPLE / DO NOT DRINK'],
    ['FIELD CAMP', 'UNFORTIFIED / STAY ALERT'],
  ];
  captions.forEach(([title, line], i) => {
    const x = i * 256;
    ctx.fillStyle = '#1c302a';
    ctx.fillRect(x, 0, 256, 256);
    ctx.strokeStyle = i === 0 ? '#c19472' : '#a3b7a1';
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 8, 8, 240, 240);
    ctx.fillStyle = '#d3d4ba';
    ctx.textAlign = 'center';
    ctx.font = 'bold 19px monospace';
    ctx.fillText(title, x + 128, 95);
    ctx.font = '11px monospace';
    ctx.fillText(line, x + 128, 134);
    ctx.fillText('MURK & METTLE / SECTOR 009', x + 128, 208);
  });
  const atlas = new THREE.CanvasTexture(canvas);
  atlas.colorSpace = THREE.SRGBColorSpace;
  const notices = new THREE.MeshStandardMaterial({ map: atlas, roughness: 1, side: THREE.DoubleSide });
  const placements = [
    [-14, 2, -42.39],
    [49, 2, 31.13],
    [-42, 0.024, -18],
    [-7, 0.024, 7],
  ];
  placements.forEach(([x, y, z], i) => {
    const g = new THREE.PlaneGeometry(i < 2 ? 2 : 1.6, i < 2 ? 2 : 1.6);
    const uv = g.getAttribute('uv');
    for (let j = 0; j < uv.count; j++) uv.setX(j, (uv.getX(j) + i) / 4);
    add(g, notices, x, y, z, i < 2 ? 0 : -Math.PI / 2);
  });
  for (const [material, list] of groups) {
    const geometry = mergeGeometries(list);
    list.forEach((g) => g.dispose());
    if (!geometry) {
      material.dispose();
      continue;
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'batched-zone-story';
    mesh.castShadow = material === steel || material === wood;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  return [atlas];
}
