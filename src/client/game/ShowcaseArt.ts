import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BUILDINGS, TREES, CREATURES } from '../../../shared/expansion.mjs';
import { leafGeometry as detailedLeaf, stemGeometry as detailedStem } from './BotanicalGeometry';
import { SurfaceMaterials } from './SurfaceMaterials';

/** Bounded original set dressing. Raised solid details stay on existing walls/trunks;
 * ground cover is soft vegetation or <= 4cm. No collision/navigation changes.
 */
export function addShowcaseArt(scene: THREE.Scene, surfaces: SurfaceMaterials): void {
  // Environment leaves are smaller on screen than companion leaves: half the longitudinal detail.
  const leafGeometry = (w: number, h: number, curl: number, serration = 0) => detailedLeaf(w, h, curl, serration, 6);
  const stemGeometry = (p: [number, number, number][], radius: number) => detailedStem(p, radius, 6);
  const bark = surfaces.material('bark', 0x89947c, 1);
  const copper = surfaces.material('metal', 0x94735b, 1);
  const paint = new THREE.MeshStandardMaterial({ color: 0x3f6257, roughness: 0.94 });
  const pale = new THREE.MeshStandardMaterial({ color: 0xb8b4a0, roughness: 0.94 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x55794d, vertexColors: true, roughness: 0.76, side: THREE.DoubleSide });
  const blueLeaf = leaf.clone(); blueLeaf.color.setHex(0x398575);
  const petal = leaf.clone(); petal.color.setHex(0xc3dcc0); petal.emissive.setHex(0x6da892); petal.emissiveIntensity = 0.18;
  const amber = leaf.clone(); amber.color.setHex(0xae6a39);
  const groups = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const transform = new THREE.Object3D();
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number,
    rx = 0, ry = 0, rz = 0, scale = 1) => {
    transform.position.set(x, y, z); transform.rotation.set(rx, ry, rz); transform.scale.setScalar(scale);
    transform.updateMatrix(); geo.applyMatrix4(transform.matrix);
    const list = groups.get(mat) || []; list.push(geo); groups.set(mat, list);
  };
  // Low buttress roots give visible trees contact with the ground without a new blocker.
  for (const [i, tree] of TREES.entries()) {
    if (i % 7 || Math.hypot(tree.x, tree.z) > 75) continue;
    for (let j = 0; j < 3; j++) {
      const angle = i + j * 2.1;
      add(stemGeometry([[0, 0.12, 0], [0.15, 0.04, 0], [0.52, 0.015, 0.1]], 0.06),
        bark, tree.x, 0, tree.z, 0, angle, 0, tree.size);
    }
    // Climbing leaves are attached to trunks, not floating beside the player's route.
    for (let j = 0; j < 4; j++) {
      const a = i + j * 1.9;
      add(leafGeometry(0.21, 0.4, -0.08), leaf,
        tree.x + Math.sin(a) * 0.22 * tree.size, 0.5 + j * 0.28,
        tree.z + Math.cos(a) * 0.22 * tree.size, 0.4, a, 0.6);
    }
  }
  // Reclaimed settlement: deep paint bands, louvres, wall-supported awnings and hanging vines.
  for (const [i, b] of BUILDINGS.entries()) {
    const front = b.z + b.d / 2 + 0.19;
    add(new THREE.BoxGeometry(b.w, 0.82, 0.025), paint, b.x, 0.57, front);
    add(new THREE.BoxGeometry(b.w, 0.045, 0.03), pale, b.x, 1.0, front + 0.01);
    add(new THREE.BoxGeometry(1.9, 0.09, 0.72), copper, b.x, 2.6, front + 0.25, 0.12);
    for (let k = 0; k < 5; k++)
      add(new THREE.BoxGeometry(1, 0.055, 0.08), copper, b.x + b.w * 0.33, b.h - 0.7 + k * 0.1, front, 0.3);
    for (let vine = 0; vine < 3; vine++) {
      const x = b.x - b.w * 0.42 + vine * 0.65;
      for (let k = 0; k < 7; k++) {
        const y = b.h + 0.3 - k * 0.3;
        add(leafGeometry(0.4, 0.65, 0.09), leaf, x + Math.sin(k * 1.3 + i) * 0.16,
          y, front + 0.02, 0.16, 0, k % 2 ? 2.3 : -2.3);
      }
    }
  }
  // Readable botanical motifs around the EXACT canonical homes; the central bonding space stays open.
  for (const [species, home] of Object.entries(CREATURES)) {
    for (let i = 0; i < 7; i++) {
      const a = i * 2.399, radius = 2.9 + (i % 3) * 0.55;
      const x = home.x + Math.cos(a) * radius, z = home.z + Math.sin(a) * radius;
      const wet = species === 'reedwisp';
      for (let blade = 0; blade < 3; blade++) {
        const angle = a + blade * 2.094;
        add(leafGeometry(wet ? 0.3 : 0.24, wet ? 0.85 : 0.6, -0.28),
          wet ? blueLeaf : species === 'emberling' ? amber : leaf,
          x, wet ? 0.025 : 0, z, 0.65, angle, 0);
      }
      if (species === 'lanternkin' || wet) {
        const height = wet ? 0.72 : 0.48;
        add(stemGeometry([[0, 0, 0], [0.05, height * 0.6, 0], [0, height, 0]], 0.022), bark, x, 0, z);
        for (let k = 0; k < 6; k++)
          add(leafGeometry(0.16, 0.32, -0.12), petal, x, height, z, wet ? 1.15 : 0.65, k * Math.PI / 3);
      } else if (species === 'mossback') {
        // Bracket fungi: flat scalloped caps rooted in the grove, no blocking boulders.
        for (let k = 0; k < 3; k++)
          add(leafGeometry(0.6, 0.32, 0.04, 0.13), amber, x + k * 0.09, 0.045 + k * 0.07, z, -1.35, a);
      } else if (species === 'stormrook') {
        for (let k = 0; k < 2; k++)
          add(leafGeometry(0.1, 0.46, 0.03, 0.1), petal, x + k * 0.14, 0.028, z, -Math.PI / 2, a + k);
      }
    }
  }
  // Merge once per material: bounded geometry, no per-frame JS work or new lights.
  for (const [material, parts] of groups) {
    const geometry = mergeGeometries(parts);
    parts.forEach(g => g.dispose());
    if (!geometry) { material.dispose(); continue; }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'showcase-botanical-dressing';
    mesh.receiveShadow = true;
    mesh.castShadow = material === bark || material === copper;
    scene.add(mesh);
  }
}
