import * as THREE from 'three';
import { type SpeciesId } from '../../../shared/expansion.mjs';
import { batchRigidParts } from './ActorGeometry';
import { leafGeometry, stemGeometry } from './BotanicalGeometry';

export interface CreatureParts {
  wings: { pivot: THREE.Group; side: number }[];
  tails: { mesh: THREE.Object3D; rest: number }[];
  legs: { mesh: THREE.Object3D; phase: number }[];
  petals: { mesh: THREE.Mesh; x: number; z: number }[];
  eyes: THREE.Group[];
  luminous: Set<THREE.MeshStandardMaterial>;
}

/** Original source-authored creature meshes. All faces look toward -Z.
 * Shared materials and rigid batching preserve independent eyelids, limbs and foliage pivots.
 * No gameplay data, external downloads, skeleton or mod replacement is involved here.
 */
export function buildCreatureArt(root: THREE.Group, species: SpeciesId, stage: number, parts: CreatureParts): void {
  const palettes = {
    lanternkin: [0x79a98b, 0x315d48, 0xcad6ac, 0xe6eacb, 0x9ed9b3],
    emberling: [0xb56e3c, 0x433d39, 0xe5bb79, 0xf0dcb2, 0xefac56],
    mossback: [0x7b9270, 0x435c44, 0xaaa76b, 0xd6d5a6, 0xbed88c],
    stormrook: [0x708eae, 0x313e59, 0xa7bfd1, 0xd9e3df, 0x9ccade],
    reedwisp: [0x70b6ac, 0x305c60, 0xb2cbb4, 0xdeebd8, 0x96d9ca],
  }[species];
  const material = (color: number, roughness = 0.72) => new THREE.MeshStandardMaterial({ color, roughness });
  const body = material(palettes[0]), dark = material(palettes[1]), accent = material(palettes[2]);
  const ivory = material(palettes[3], 0.4), ink = material(0x122520, 0.2);
  const glow = material(palettes[4], 0.35);
  glow.emissive.setHex(palettes[4]); glow.emissiveIntensity = 0.3;
  parts.luminous.add(glow);
  const blade = material(palettes[0]); blade.side = THREE.DoubleSide; blade.vertexColors = true;
  const bladeDark = blade.clone(); bladeDark.color.setHex(palettes[1]);
  const bladeLight = blade.clone(); bladeLight.color.setHex(palettes[2]);
  const allMaterials = [body, dark, accent, ivory, ink, glow, blade, bladeDark, bladeLight];
  const used = new Set<THREE.Material>();
  const sphere = new THREE.SphereGeometry(1, 20, 14);
  const small = new THREE.SphereGeometry(1, 10, 8);
  const eyeSphere = new THREE.SphereGeometry(1, 16, 12);
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number,
    sx = 1, sy = 1, sz = 1, parent: THREE.Object3D = root): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.scale.set(sx, sy, sz);
    m.castShadow = m.receiveShadow = true;
    parent.add(m); used.add(mat);
    return m;
  };
  const orb = (mat: THREE.Material, x: number, y: number, z: number, sx: number, sy = sx, sz = sx,
    parent: THREE.Object3D = root, tiny = false) => add(tiny ? small : sphere, mat, x, y, z, sx, sy, sz, parent);
  const leaf = (mat: THREE.Material, x: number, y: number, z: number, w: number, h: number,
    curl = 0.12, parent: THREE.Object3D = root, serration = 0) => add(leafGeometry(w, h, curl, serration), mat, x, y, z, 1, 1, 1, parent);
  const stem = (mat: THREE.Material, coordinates: [number, number, number][], radius: number, parent = root) =>
    add(stemGeometry(coordinates, radius), mat, 0, 0, 0, 1, 1, 1, parent);
  const eye = (x: number, y: number, z: number, size: number, yaw = 0) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, z); pivot.rotation.y = yaw;
    pivot.name = 'expressive-eye'; root.add(pivot); parts.eyes.push(pivot);
    orb(dark, 0, 0, 0.012, size * 1.16, size * 1.24, size * 0.5, pivot, true);
    orb(ivory, 0, 0, 0, size, size * 1.08, size * 0.48, pivot, true);
    orb(accent, 0, -size * 0.02, -size * 0.43, size * 0.68, size * 0.83, size * 0.19, pivot, true);
    orb(ink, 0, 0, -size * 0.57, size * 0.38, size * 0.61, size * 0.12, pivot, true);
    orb(ivory, -size * 0.23, size * 0.34, -size * 0.67, size * 0.19, size * 0.2, size * 0.1, pivot, true);
    for (const m of pivot.children) if (m instanceof THREE.Mesh) m.geometry = eyeSphere;
  };
  const smile = (y: number, z: number, width: number) =>
    stem(dark, [[-width, y + 0.012, z], [0, y, z - 0.008], [width, y + 0.012, z]], 0.009);
  const leg = (side: number, z: number, top: number, length: number, width: number) => {
    const pivot = new THREE.Group(); pivot.position.set(side, top, z); root.add(pivot);
    orb(body, 0, -length * 0.4, 0, width, length * 0.6, width, pivot);
    orb(dark, 0, -length, -0.045, width * 1.12, width * 0.55, width * 1.5, pivot);
    for (let i = -1; i <= 1; i++) orb(accent, i * width * 0.5, -length, -width * 1.3,
      width * 0.16, width * 0.18, width * 0.28, pivot, true);
    parts.legs.push({ mesh: pivot, phase: (z > 0 ? Math.PI : 0) + (side > 0 ? Math.PI : 0) });
  };
  if (species === 'lanternkin') {
    const profile = [[0.03,-0.37],[0.19,-0.32],[0.27,-0.16],[0.28,0.04],[0.23,0.23],[0.13,0.32],[0,0.34]];
    add(new THREE.LatheGeometry(profile.map(([r,y]) => new THREE.Vector2(r,y)), 24), body, 0, 0, 0, 1, 1, 0.83);
    orb(ivory, 0, 0.24, -0.11, 0.24, 0.22, 0.18);
    // Lantern belly is framed by curved ribs, kept below the face.
    orb(glow, 0, -0.11, -0.205, 0.14, 0.17, 0.075);
    for (const side of [-1, 1]) {
      eye(side * 0.105, 0.275, -0.263, 0.066, side * -0.1);
      stem(accent, [[side * 0.12,-0.27,-0.2],[side * 0.19,-0.1,-0.2],[side * 0.12,0.08,-0.23]], 0.018);
      const hand = leaf(bladeLight, side * 0.23, 0, -0.02, 0.16, 0.3, -0.1);
      hand.rotation.z = side * 2.1;
      parts.petals.push({ mesh: hand, x: 0, z: hand.rotation.z });
      orb(dark, side * 0.11, -0.32, -0.01, 0.075, 0.12, 0.09);
      const hornTop = 0.66 + stage * 0.06;
      stem(dark, [[side * 0.13,0.38,0.04],[side * 0.26,0.6,0.09],[side * 0.23,hornTop,0.02]], 0.034);
      const bud = leaf(bladeLight, side * 0.23, hornTop - 0.04, 0.02, 0.16, 0.2, -0.04);
      bud.rotation.z = -side * 0.3;
      orb(glow, side * 0.23, hornTop + 0.04, -0.01, 0.035, 0.055, 0.035, root, true);
    }
    smile(0.175, -0.286, 0.041);
    // The crown grows behind the face. The old front petals occluded both eyes.
    for (let i = 0; i < 5 + stage * 2; i++) {
      const a = -1.6 + i / (4 + stage * 2) * 3.2;
      const p = leaf(i % 2 ? blade : bladeDark, Math.sin(a) * 0.19, 0.06, 0.13 + Math.cos(a) * 0.1,
        0.27 + stage * 0.025, 0.58 + stage * 0.12, 0.17);
      p.rotation.set(Math.cos(a) * 0.35, a * 0.35, -Math.sin(a) * 0.72);
      parts.petals.push({ mesh: p, x: p.rotation.x, z: p.rotation.z });
    }
    if (stage > 0) {
      for (let i = 0; i < 5; i++) {
        const p = leaf(bladeLight, Math.sin(i * 1.25) * 0.13, -0.23, Math.cos(i * 1.25) * 0.13,
          0.18, 0.3 + stage * 0.07, -0.12);
        p.rotation.set(2.3, i * 1.25, 0);
      }
    }
  } else if (species === 'emberling') {
    orb(body, 0, -0.02, 0, 0.29, 0.31, 0.44);
    orb(accent, 0, -0.08, -0.34, 0.22, 0.25, 0.13);
    orb(body, 0, 0.24, -0.34, 0.25, 0.25, 0.25);
    orb(ivory, 0, 0.14, -0.53, 0.16, 0.12, 0.13);
    orb(ink, 0, 0.18, -0.65, 0.055, 0.035, 0.03, root, true);
    smile(0.1, -0.638, 0.055);
    for (const s of [-1, 1]) {
      eye(s * 0.15, 0.29, -0.52, 0.065, -s * 0.3);
      const ear = leaf(blade, s * 0.15, 0.38, -0.32, 0.19, 0.42 + stage * 0.12, 0.05);
      ear.rotation.z = -s * 0.26;
      const inner = leaf(bladeLight, s * 0.15, 0.4, -0.37, 0.095, 0.29 + stage * 0.1, 0.015);
      inner.rotation.z = -s * 0.26;
      for (const z of [-0.24, 0.27]) leg(s * 0.21, z, -0.12, 0.35, 0.077);
      for (let i = 0; i < 3 + stage; i++) {
        const tuft = leaf(bladeLight, s * 0.19, 0.05, -0.31 + i * 0.05, 0.14, 0.28, 0.1);
        tuft.rotation.z = -s * (1.2 + i * 0.15);
      }
    }
    const tail = new THREE.Group(); tail.position.set(0, 0.03, 0.34); root.add(tail);
    stem(body, [[0,0,0],[0.12,0.18,0.3],[0.16,0.47 + stage * 0.08,0.46],[0.08,0.61,0.3]], 0.13, tail);
    for (let i = 0; i < 3; i++) {
      const tip = leaf(bladeLight, 0.1, 0.43, 0.37, 0.18, 0.35, -0.14, tail);
      tip.rotation.set(0, i * 2.1, 0.2);
    }
    parts.tails.push({ mesh: tail, rest: 0 });
    for (let i = 0; i < stage + 1; i++) orb(glow, 0, 0.25, i * 0.14, 0.04, 0.02, 0.06, root, true);
  } else if (species === 'mossback') {
    orb(body, 0, -0.08, 0, 0.43, 0.25, 0.51);
    orb(dark, 0, 0.12, 0.06, 0.49, 0.33, 0.54);
    // Overlapping leaf scutes form an actual shell, instead of a smooth sphere with cones.
    for (let row = 0; row < 3; row++) for (let k = -1; k <= 1; k++) {
      const geometry = leafGeometry(0.25, 0.28, 0);
      geometry.rotateX(Math.PI / 2);
      const p = geometry.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i) + k * 0.27, z = p.getZ(i) - 0.35 + row * 0.3;
        const dome = Math.sqrt(Math.max(0, 1 - (x / 0.49) ** 2 - ((z - 0.06) / 0.54) ** 2));
        p.setXYZ(i, x, 0.12 + 0.33 * dome + 0.03, z);
      }
      geometry.computeVertexNormals();
      add(geometry, k === 0 ? bladeLight : blade, 0, 0, 0);
    }
    orb(body, 0, -0.03, -0.51, 0.2, 0.18, 0.23);
    orb(accent, 0, -0.1, -0.68, 0.17, 0.09, 0.1);
    for (const s of [-1, 1]) {
      eye(s * 0.13, 0.025, -0.66, 0.052, -s * 0.25);
      for (const z of [-0.28, 0.31]) leg(s * 0.33, z, -0.14, 0.18, 0.095);
    }
    smile(-0.1, -0.775, 0.06);
    for (let i = 0; i <= stage; i++) {
      const x = (i % 2 ? 1 : -1) * (stage ? 0.16 : 0), z = 0.1 + i * 0.09;
      stem(accent, [[x,0.35,z],[x + 0.02,0.5 + stage * 0.05,z]], 0.035);
      orb(accent, x + 0.02, 0.51 + stage * 0.05, z, 0.13, 0.045, 0.12);
      orb(glow, x + 0.02, 0.48 + stage * 0.05, z, 0.07, 0.018, 0.07, root, true);
    }
  } else if (species === 'stormrook') {
    orb(body, 0, 0, 0, 0.23, 0.31, 0.28);
    add(new THREE.SphereGeometry(1, 18, 12, Math.PI * 1.18, Math.PI * 0.64, Math.PI * 0.24, Math.PI * 0.56),
      ivory, 0, 0, 0, 0.233, 0.313, 0.283);
    orb(body, 0, 0.3, -0.1, 0.22, 0.21, 0.22);
    const beak = add(new THREE.ConeGeometry(0.065, 0.18, 4), accent, 0, 0.23, -0.33);
    beak.rotation.x = -Math.PI / 2;
    for (const s of [-1, 1]) {
      eye(s * 0.13, 0.34, -0.255, 0.066, -s * 0.25);
      const brow = leaf(bladeDark, s * 0.07, 0.42, -0.24, 0.1, 0.26 + stage * 0.06, 0.05);
      brow.rotation.z = -s * 0.85;
      const wing = new THREE.Group(); wing.position.set(s * 0.21, 0.1, 0.02); root.add(wing);
      parts.wings.push({ pivot: wing, side: s });
      for (let i = 0; i < 5 + stage; i++) {
        const feather = leaf(i % 2 ? bladeDark : blade, s * i * 0.085, -i * 0.035, i * 0.06,
          0.16, 0.52 + stage * 0.08 - i * 0.02, 0.07, wing, 0.07);
        feather.rotation.set(0.7, s * 0.25, -s * (1.5 + i * 0.08));
      }
      stem(dark, [[s * 0.08,-0.2,0],[s * 0.09,-0.36,-0.01],[s * 0.12,-0.37,-0.14]], 0.025);
    }
    for (let i = -1; i <= 1; i++) {
      const feather = leaf(i ? bladeDark : bladeLight, i * 0.09, -0.14, 0.2, 0.15, 0.43 + stage * 0.12, 0.07);
      feather.rotation.set(Math.PI / 2, -i * 0.18, 0);
      parts.tails.push({ mesh: feather, rest: feather.rotation.y });
    }
  } else {
    orb(body, 0, 0, 0, 0.31, 0.16, 0.43);
    add(new THREE.SphereGeometry(1, 18, 10, Math.PI * 1.05, Math.PI * 0.9, Math.PI * 0.48, Math.PI * 0.43),
      ivory, 0, 0, 0, 0.314, 0.164, 0.434);
    for (const s of [-1, 1]) {
      eye(s * 0.14, 0.09, -0.32, 0.062, -s * 0.25);
      const wing = new THREE.Group(); wing.position.set(s * 0.21, 0, 0); root.add(wing);
      parts.wings.push({ pivot: wing, side: s });
      for (let i = 0; i < 4; i++) {
        const fin = leaf(i % 2 ? blade : bladeLight, s * i * 0.08, 0, i * 0.12 - 0.2,
          0.28, 0.65 + stage * 0.13 - i * 0.08, -0.14, wing);
        fin.rotation.set(0.25, 0, -s * (1.35 + i * 0.15));
      }
      stem(accent, [[s * 0.15,0,-0.36],[s * 0.31,-0.03,-0.5],[s * 0.42,0.08,-0.5]], 0.012);
    }
    smile(-0.02, -0.42, 0.055);
    const tail = new THREE.Group(); tail.position.z = 0.33; root.add(tail);
    stem(body, [[0,0,0],[0,-0.03,0.38],[0.1,0.04,0.75 + stage * 0.12]], 0.06, tail);
    for (const s of [-1, 1]) {
      const fin = leaf(bladeLight, 0.08, 0.02, 0.63 + stage * 0.1, 0.16, 0.32, 0.04, tail);
      fin.rotation.set(1.3, 0, s * 1.1);
    }
    parts.tails.push({ mesh: tail, rest: 0 });
    for (let i = 0; i <= stage; i++) orb(glow, 0, 0.16, i * 0.13, 0.035, 0.025, 0.055, root, true);
  }
  const animated = new Set<THREE.Object3D>([...parts.petals.map(p => p.mesh), ...parts.tails.map(p => p.mesh)]);
  batchRigidParts(root, animated);
  for (const m of allMaterials) if (!used.has(m)) { parts.luminous.delete(m); m.dispose(); }
  // A shared primitive may have been completely replaced by merged geometry.
  const attached = new Set<THREE.BufferGeometry>();
  root.traverse(o => { if (o instanceof THREE.Mesh) attached.add(o.geometry); });
  for (const g of [sphere, small, eyeSphere]) if (!attached.has(g)) g.dispose();
}
