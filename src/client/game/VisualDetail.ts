import * as THREE from 'three';

/** Visual-only geometry, kept separate from collision and network simulation. */
export function detailMesh(geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D,
  position: [number, number, number], scale?: [number, number, number]): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

/** Distinctive hand-made silhouette for the default survivor, not a downloaded asset. */
export function decorateSurvivor(root: THREE.Group): void {
  const jacket = new THREE.MeshStandardMaterial({ color: 0x668f73, roughness: 0.94, flatShading: true });
  const fabric = new THREE.MeshStandardMaterial({ color: 0x334c45, roughness: 1, flatShading: true });
  const straps = new THREE.MeshStandardMaterial({ color: 0xbaa77d, roughness: 0.91 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x839f9b, metalness: 0.42, roughness: 0.52 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xa6eac7, emissive: 0x42b48f, emissiveIntensity: 0.85 });
  // Shoulder pads and chest detail give a strong, instantly readable character silhouette.
  for (const sign of [-1, 1]) {
    const pad = detailMesh(new THREE.IcosahedronGeometry(0.22, 1), jacket, root, [sign * 0.44, 1.38, 0.01], [1.25, 0.68, 1]);
    pad.rotation.z = -sign * 0.3;
    const strap = detailMesh(new THREE.BoxGeometry(0.09, 0.72, 0.075), straps, root, [sign * 0.22, 1.09, -0.33]);
    strap.rotation.z = sign * 0.15;
    detailMesh(new THREE.BoxGeometry(0.16, 0.14, 0.09), metal, root, [sign * 0.24, 0.88, -0.39]);
  }
  detailMesh(new THREE.BoxGeometry(0.26, 0.35, 0.09), fabric, root, [0, 1.14, -0.365]);
  detailMesh(new THREE.BoxGeometry(0.17, 0.12, 0.06), glow, root, [0, 1.24, -0.426]);
  // Utility pack with straps, side pockets and a small field beacon.
  detailMesh(new THREE.BoxGeometry(0.53, 0.58, 0.32), fabric, root, [0, 1.16, 0.42]);
  detailMesh(new THREE.BoxGeometry(0.36, 0.19, 0.11), straps, root, [0, 1.32, 0.61]);
  for (const side of [-1, 1]) {
    detailMesh(new THREE.BoxGeometry(0.15, 0.22, 0.18), jacket, root, [side * 0.32, 1.01, 0.37]);
  }
  detailMesh(new THREE.CylinderGeometry(0.07, 0.07, 0.28, 8), metal, root, [0.19, 1.62, 0.43]);
  detailMesh(new THREE.SphereGeometry(0.07, 10, 8), glow, root, [0.19, 1.82, 0.43]);
  // Mask and eyebrow band lend a stronger stylized face than the original two primitives.
  detailMesh(new THREE.BoxGeometry(0.39, 0.13, 0.11), fabric, root, [0, 1.77, -0.268]);
  detailMesh(new THREE.BoxGeometry(0.40, 0.05, 0.065), straps, root, [0, 2.045, -0.12]);
}

/** Organic infected growths of varying sizes; strain colors remain controlled by Zombie.ts. */
export function decorateInfected(root: THREE.Group, strainColor: number): void {
  const scar = new THREE.MeshStandardMaterial({ color: strainColor, emissive: strainColor, emissiveIntensity: 0.14, roughness: 0.82, flatShading: true });
  const bone = new THREE.MeshStandardMaterial({ color: 0xc7bf99, roughness: 0.96 });
  for (let i = 0; i < 6; i++) {
    const side = i % 2 ? 1 : -1;
    const scale = 0.085 + (i % 3) * 0.033;
    const nodule = detailMesh(new THREE.IcosahedronGeometry(scale, 1), scar, root,
      [side * (0.31 + (i % 3) * 0.032), 0.9 + i * 0.175, 0.01 + (i % 2) * 0.1]);
    nodule.rotation.z = i * 0.66;
  }
  for (let i = 0; i < 3; i++) {
    const growth = detailMesh(new THREE.ConeGeometry(0.065 + i * 0.013, 0.3 + i * 0.07, 5), bone, root,
      [-0.20 + i * 0.2, 2.18 + i * 0.07, -0.09]);
    growth.rotation.z = (i - 1) * 0.35;
  }
}
