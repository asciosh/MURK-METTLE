import * as THREE from 'three';
/** Keep some crown cards on EVERY tree; do not remove whole crowns with a count cutoff. */
export class InstanceDetail {
  private readonly matrices: Float32Array;
  private readonly colors: Float32Array | null;
  private readonly total: number;
  constructor(
    private readonly mesh: THREE.InstancedMesh,
    private readonly groupSize = 1,
  ) {
    this.total = mesh.count;
    this.matrices = new Float32Array(mesh.instanceMatrix.array);
    this.colors = mesh.instanceColor ? new Float32Array(mesh.instanceColor.array) : null;
  }
  setFraction(fraction: number): void {
    const keep = Math.max(1, Math.min(this.groupSize, Math.round(this.groupSize * Math.max(0, Math.min(1, fraction)))));
    const count =
      this.groupSize === 1
        ? Math.floor(this.total * Math.max(0, Math.min(1, fraction)))
        : (this.total / this.groupSize) * keep;
    if (this.groupSize === 1) {
      this.mesh.count = count;
      return;
    }
    let target = 0;
    for (let group = 0; group < this.total; group += this.groupSize)
      for (let j = 0; j < keep; j++) {
        const source = group + Math.floor((j * this.groupSize) / keep);
        this.mesh.instanceMatrix.array.set(this.matrices.subarray(source * 16, source * 16 + 16), target * 16);
        if (this.colors && this.mesh.instanceColor)
          this.mesh.instanceColor.array.set(this.colors.subarray(source * 3, source * 3 + 3), target * 3);
        target++;
      }
    this.mesh.count = count;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.mesh.computeBoundingSphere();
  }
}
