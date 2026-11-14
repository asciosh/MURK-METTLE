import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDINGS, constrainPosition } from '../../../shared/expansion.mjs';
import { SurfaceMaterials } from './SurfaceMaterials';

/** Small visual details are merged by material. Building footprints and player collision stay shared. */
export function addSettlementDetails(scene: THREE.Scene, surfaces: SurfaceMaterials): void {
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>(),
    transform = new THREE.Object3D();
  const masonry = surfaces.material('plaster', 0xc7c7b7, 1),
    rust = surfaces.material('metal', 0xa69983, 1),
    wood = surfaces.material('bark', 0x9b917c, 1);
  const dark = new THREE.MeshStandardMaterial({ color: 0x252b28, roughness: 0.91 }),
    stone = surfaces.material('plaster', 0x817f70, 1);
  const glass = new THREE.MeshStandardMaterial({ color: 0x667477, metalness: 0.7, roughness: 0.22 });
  const add = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => {
    transform.position.set(x, y, z);
    transform.rotation.set(rx, ry, rz);
    transform.scale.set(1, 1, 1);
    transform.updateMatrix();
    geometry.applyMatrix4(transform.matrix);
    const list = groups.get(material) ?? [];
    list.push(geometry);
    groups.set(material, list);
  };
  const box = (
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
  ) => add(new THREE.BoxGeometry(w, h, d), mat, x, y, z, rx, ry, rz);
  for (const [i, b] of BUILDINGS.entries()) {
    // Raised parapets, exposed chimney masonry and roof ventilation break the box silhouette.
    for (const side of [-1, 1]) {
      box(b.w + 0.25, 0.26, 0.15, masonry, b.x, b.h + 0.36, b.z + side * (b.d / 2 + 0.1));
      box(0.16, 0.26, b.d, masonry, b.x + side * (b.w / 2 + 0.1), b.h + 0.36, b.z);
      box(0.18, 0.22, b.d + 0.5, dark, b.x + side * (b.w / 2 + 0.12), b.h - 0.03, b.z);
    }
    box(0.8, 1.3, 0.75, masonry, b.x - b.w * 0.23, b.h + 0.8, b.z - b.d * 0.2);
    box(0.95, 0.13, 0.88, dark, b.x - b.w * 0.23, b.h + 1.49, b.z - b.d * 0.2);
    box(0.48, 0.6, 0.5, rust, b.x + b.w * 0.29, b.h + 0.45, b.z + b.d * 0.18);
    box(0.65, 0.08, 0.65, dark, b.x + b.w * 0.29, b.h + 0.77, b.z + b.d * 0.18);
    for (const side of [-1, 1])
      for (let k = 0; k < 3; k++) {
        const x = b.x - b.w * 0.3 + k * b.w * 0.3,
          z = b.z + side * (b.d / 2 + 0.09);
        for (const sx of [-1, 1]) box(0.085, 2, 0.14, masonry, x + sx * 0.76, 2.3, z);
        for (const sy of [-1, 1]) box(1.6, 0.105, 0.24, masonry, x, 2.3 + sy * 0.94, z);
        box(0.055, 1.7, 0.1, rust, x, 2.3, z + side * 0.03);
        box(1.35, 0.055, 0.1, rust, x, 2.5, z + side * 0.03);
        if ((i + k) % 3 === 0) {
          const shard = new THREE.BufferGeometry();
          shard.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(
              [-0.61, -0.76, 0, -0.61, 0.7, 0, -0.14, 0.51, 0, 0.62, 0.76, 0, 0.62, -0.08, 0, 0.31, 0.19, 0],
              3,
            ),
          );
          shard.setIndex([0, 1, 2, 3, 4, 5]);
          shard.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 0.5, 1, 1, 1, 0, 0, 0.5], 2));
          shard.computeVertexNormals();
          add(shard, glass, x, 2.3, z + side * 0.04, 0, side === -1 ? Math.PI : 0);
        } else box(0.55, 0.67, 0.025, glass, x - 0.32, 2.85, z + side * 0.035);
        box(1.8, 0.09, 0.46, stone, x, 1.31, z + side * 0.1);
        if ((i + k) % 2 === 0) box(0.14, 2.07, 0.11, wood, x + 0.21, 2.27, z + side * 0.08, 0, 0, -0.27);
        // Water run-off streaks below window sills are flat surface details.
        for (let stain = 0; stain < 3; stain++)
          box(
            0.035 + stain * 0.012,
            0.42 + stain * 0.11,
            0.012,
            dark,
            x - 0.51 + stain * 0.39,
            0.91 - stain * 0.06,
            z - side * 0.025,
          );
      }
    const front = b.z + b.d / 2 + 0.15;
    for (const side of [-1, 1]) box(0.12, 2.32, 0.16, stone, b.x + side * 0.64, 1.16, front);
    box(1.45, 0.13, 0.2, stone, b.x, 2.36, front);
    box(1.32, 0.09, 0.65, stone, b.x, 0.12, front + 0.15);
    box(0.04, 0.12, 0.06, rust, b.x + 0.4, 1.08, front + 0.04);
    box(0.3, 0.035, 0.12, dark, b.x + 0.31, 1.12, front + 0.08);
    // Decorative rubble hugs existing foundations, rather than adding invisible collision blockers.
    for (let k = 0; k < 15; k++) {
      const side = k % 2 ? 1 : -1,
        x = b.x + Math.sin(k * 23.7 + i) * b.w * 0.48,
        z = b.z + side * (b.d / 2 + 0.22 + (k % 3) * 0.07);
      box(
        0.15 + (k % 3) * 0.11,
        0.09 + (k % 2) * 0.08,
        0.17 + (k % 4) * 0.06,
        k % 3 ? stone : wood,
        x,
        0.05,
        z,
        0,
        k * 1.7,
        (k % 3) * 0.11,
      );
    }
    // Side utility pipe follows a solid wall.
    add(
      new THREE.CylinderGeometry(0.045, 0.045, b.h - 0.45, 8),
      rust,
      b.x + b.w / 2 + 0.13,
      (b.h - 0.45) / 2,
      b.z - 0.8,
    );
    for (let k = 0; k < 3; k++) box(0.19, 0.07, 0.12, dark, b.x + b.w / 2 + 0.13, 0.5 + (k * (b.h - 1)) / 3, b.z - 0.8);
  }
  // Asphalt edge damage, low weeds and paper scraps: geometry is kept very close to the ground.
  for (let i = 0; i < 120; i++) {
    const side = i % 2 ? 1 : -1,
      x = side * (3.6 + (i % 7) * 0.12),
      z = -30 - ((i * 7.73) % 48);
    box(0.035 + (i % 3) * 0.03, 0.018, 0.15 + (i % 5) * 0.09, i % 4 ? stone : dark, x, 0.02, z, 0, i * 1.8);
  }
  const litter = new THREE.MeshStandardMaterial({ color: 0x7e7752, roughness: 1, side: THREE.DoubleSide });
  for (let i = 0; i < 800; i++) {
    const x = Math.sin(i * 187.8) * 87,
      z = Math.cos(i * 319.21) * 87;
    if (Math.abs(x) < 2.7 || Math.hypot(x + 48, z + 31) < 12) continue;
    const pos = constrainPosition({ x, z }, 0.05);
    if (Math.hypot(pos.x - x, pos.z - z) > 0.1) continue;
    const geo = new THREE.CircleGeometry(0.05 + (i % 4) * 0.022, 5);
    geo.scale(0.5, 1.4, 1);
    add(geo, litter, x, 0.012 + (i % 3) * 0.002, z, -Math.PI / 2, 0, i * 2.4);
  }
  for (const [material, geometries] of groups) {
    const merged = mergeGeometries(geometries, false);
    for (const g of geometries) g.dispose();
    if (!merged) {
      material.dispose();
      continue;
    }
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = 'batched-settlement-weathering';
    mesh.castShadow = material !== litter;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  // Shallow wet patches have irregular silhouettes and roughness, with sky reflections from PMREM.
  const puddleMaterial = new THREE.MeshStandardMaterial({
    color: 0x6f7871,
    metalness: 0.35,
    roughness: 0.32,
    normalMap: surfaces.get('earth').normalMap,
    normalScale: new THREE.Vector2(0.035, 0.035),
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const pools: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 12; i++) {
    const x = (i % 2 ? 1 : -1) * (1.4 + (i % 4) * 0.33),
      z = -9 - ((i * 3.41) % 67),
      shape = new THREE.Shape();
    for (let k = 0; k <= 16; k++) {
      const a = (k / 16) * Math.PI * 2,
        r = 0.6 + Math.sin(a * 3 + i) * 0.08 + Math.cos(a * 5 - i) * 0.06;
      const px = Math.cos(a) * r * (0.8 + (i % 3) * 0.3),
        py = Math.sin(a) * r * 0.5;
      k === 0 ? shape.moveTo(px, py) : shape.lineTo(px, py);
    }
    const g = new THREE.ShapeGeometry(shape);
    g.rotateX(-Math.PI / 2);
    g.translate(x, 0.008, z);
    pools.push(g);
  }
  const pooled = mergeGeometries(pools, false);
  for (const g of pools) g.dispose();
  if (pooled) {
    const m = new THREE.Mesh(pooled, puddleMaterial);
    m.name = 'rain-puddles';
    m.receiveShadow = true;
    scene.add(m);
  } else puddleMaterial.dispose();
}
