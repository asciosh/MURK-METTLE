import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Original instance data stays available for existing quality restoration; cells only change visibility submission. */
export class SpatialInstances {
  private readonly cells = new Map<string, THREE.InstancedMesh>();
  private readonly matrix = new THREE.Matrix4();
  private readonly color = new THREE.Color();
  private readonly parent: THREE.Object3D;
  constructor(private readonly source: THREE.InstancedMesh) {
    this.parent = source.parent!;
    const capacity = new Map<string, number>();
    for (let i = 0; i < source.count; i++) {
      const key = this.key(i);
      capacity.set(key, (capacity.get(key) || 0) + 1);
    }
    for (const [key, count] of capacity) {
      const cell = new THREE.InstancedMesh(source.geometry, source.material, count);
      cell.name = `spatial-${source.name || 'vegetation'}-${key}`;
      cell.castShadow = source.castShadow;
      cell.receiveShadow = source.receiveShadow;
      cell.customDepthMaterial = source.customDepthMaterial;
      cell.matrix.copy(source.matrix);
      cell.matrixAutoUpdate = false;
      this.cells.set(key, cell);
      this.parent.add(cell);
    }
    source.removeFromParent();
    this.refresh();
  }
  private key(i: number): string {
    this.source.getMatrixAt(i, this.matrix);
    return `${Math.floor((this.matrix.elements[12] + 32) / 64)},${Math.floor((this.matrix.elements[14] + 32) / 64)}`;
  }
  refresh(): void {
    for (const cell of this.cells.values()) cell.count = 0;
    for (let i = 0; i < this.source.count; i++) {
      const cell = this.cells.get(this.key(i))!;
      const index = cell.count++;
      cell.setMatrixAt(index, this.matrix);
      if (this.source.instanceColor) {
        this.source.getColorAt(i, this.color);
        cell.setColorAt(index, this.color);
      }
    }
    for (const cell of this.cells.values()) {
      cell.visible = cell.count > 0;
      cell.instanceMatrix.needsUpdate = true;
      if (cell.instanceColor) cell.instanceColor.needsUpdate = true;
      cell.computeBoundingSphere();
      if (cell.boundingSphere) cell.boundingSphere.radius += 0.4; // Conservative shader-wind margin.
    }
  }
  dispose(): void {
    this.source.dispose();
    for (const cell of this.cells.values()) cell.dispose();
  }
}

/** Static world-only meshes, grouped by material and shadow behavior. No actors or gameplay meshes enter here. */
export function batchStaticWorld(scene: THREE.Scene): void {
  const groups = new Map<string, THREE.Mesh[]>();
  scene.updateMatrixWorld(true);
  scene.traverse((node) => {
    if (
      !(node instanceof THREE.Mesh) ||
      node instanceof THREE.InstancedMesh ||
      node instanceof THREE.SkinnedMesh ||
      Array.isArray(node.material) ||
      !(node.material instanceof THREE.MeshStandardMaterial) ||
      node.material.transparent ||
      !node.visible
    )
      return;
    const key = `${node.material.uuid}/${node.castShadow}/${node.receiveShadow}/${node.renderOrder}`;
    const list = groups.get(key) || [];
    list.push(node);
    groups.set(key, list);
  });
  for (const parts of groups.values()) {
    if (parts.length < 2) continue;
    const geometries = parts.map((p) => {
      const g = p.geometry.clone().applyMatrix4(p.matrixWorld);
      if (!g.index) g.setIndex(Array.from({ length: g.getAttribute('position').count }, (_, i) => i));
      return g;
    });
    const merged = mergeGeometries(geometries);
    geometries.forEach((g) => g.dispose());
    if (!merged) continue;
    const first = parts[0],
      mesh = new THREE.Mesh(merged, first.material);
    mesh.name = 'batched-static-world';
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.renderOrder = first.renderOrder;
    mesh.matrixAutoUpdate = false;
    scene.add(mesh);
    for (const part of parts) {
      part.removeFromParent();
      part.geometry.dispose();
    }
  }
}
