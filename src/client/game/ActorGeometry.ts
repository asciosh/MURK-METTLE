import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Merge rigid siblings only; joint pivots and explicitly animated meshes stay independent. */
export function batchRigidParts(root: THREE.Group, excluded: ReadonlySet<THREE.Object3D>): void {
  for (const child of [...root.children]) if (child instanceof THREE.Group) batchRigidParts(child, excluded);
  const batches = new Map<THREE.Material, THREE.Mesh[]>();
  for (const node of root.children) {
    if (
      !(node instanceof THREE.Mesh) ||
      node instanceof THREE.SkinnedMesh ||
      excluded.has(node) ||
      !node.visible ||
      Array.isArray(node.material)
    )
      continue;
    const batch = batches.get(node.material) ?? [];
    batch.push(node);
    batches.set(node.material, batch);
  }
  for (const [material, parts] of batches) {
    if (parts.length < 2) continue;
    const geometry = parts.map((part) => {
      part.updateMatrix();
      const copy = part.geometry.clone().applyMatrix4(part.matrix);
      if (!copy.index) copy.setIndex(Array.from({ length: copy.getAttribute('position').count }, (_, i) => i));
      return copy;
    });
    const merged = mergeGeometries(geometry);
    geometry.forEach((g) => g.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = 'batched-rigid-parts';
    mesh.castShadow = parts.some((p) => p.castShadow);
    mesh.receiveShadow = parts.some((p) => p.receiveShadow);
    root.add(mesh);
    for (const part of parts) {
      part.removeFromParent();
      part.geometry.dispose();
    }
  }
}
