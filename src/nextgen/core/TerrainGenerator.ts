export class TerrainGenerator {
  static readonly SIZE = 200;
  static readonly GRID_SIZE = 257;
  static readonly CELL_SIZE =
    TerrainGenerator.SIZE / (TerrainGenerator.GRID_SIZE - 1);
  static readonly MAX_HEIGHT = 20;

  private readonly seed: number;
  private readonly heights: Float32Array;

  constructor(seed: number) {
    this.seed = seed | 0;
    this.heights = new Float32Array(
      TerrainGenerator.GRID_SIZE * TerrainGenerator.GRID_SIZE
    );
    this.generate();
  }

  private hash(x: number, z: number): number {
    let h =
      Math.imul(x, 374761393) ^
      Math.imul(z, 668265263) ^
      Math.imul(this.seed, 1274126177);

    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;

    return (h >>> 0) / 4294967295;
  }

  private noise(x: number, z: number): number {
    const ix = Math.floor(x);
    const iz = Math.floor(z);

    const fx = x - ix;
    const fz = z - iz;

    const u = fx * fx * (3 - 2 * fx);
    const v = fz * fz * (3 - 2 * fz);

    const a = this.hash(ix, iz);
    const b = this.hash(ix + 1, iz);
    const c = this.hash(ix, iz + 1);
    const d = this.hash(ix + 1, iz + 1);

    const top = a + (b - a) * u;
    const bottom = c + (d - c) * u;

    return top + (bottom - top) * v;
  }

  private generate(): void {
    const grid = TerrainGenerator.GRID_SIZE;
    const cell = TerrainGenerator.CELL_SIZE;

    for (let z = 0; z < grid; z++) {
      for (let x = 0; x < grid; x++) {
        const wx = x * cell;
        const wz = z * cell;

        const value =
          this.noise(wx / 85, wz / 85) * 0.65 +
          this.noise(wx / 42.5 + 17, wz / 42.5 + 31) * 0.25 +
          this.noise(wx / 21.25 + 43, wz / 21.25 + 71) * 0.10;

        const normalized = Math.max(
          0,
          Math.min(1, (value - 0.5) * 1.4 + 0.5)
        );

        this.heights[z * grid + x] =
          normalized * TerrainGenerator.MAX_HEIGHT;
      }
    }
  }

    heightAt(x: number, z: number): number {
    const grid = TerrainGenerator.GRID_SIZE;
    const size = TerrainGenerator.SIZE;
    const cell = TerrainGenerator.CELL_SIZE;

    const sx = Math.max(0, Math.min(size, x)) / cell;
    const sz = Math.max(0, Math.min(size, z)) / cell;

    const ix = Math.min(grid - 2, Math.floor(sx));
    const iz = Math.min(grid - 2, Math.floor(sz));

    const dx = sx - ix;
    const dz = sz - iz;

    const a = this.heights[iz * grid + ix];
    const b = this.heights[iz * grid + ix + 1];
    const c = this.heights[(iz + 1) * grid + ix];
    const d = this.heights[(iz + 1) * grid + ix + 1];

    if (dx + dz <= 1) {
      return a + (b - a) * dx + (c - a) * dz;
    }

    return d + (c - d) * (1 - dx) +
      (b - d) * (1 - dz);
  }

  getHeights(): Float32Array {
    return this.heights;
  }

  get size(): number {
    return TerrainGenerator.SIZE;
  }

  get cellSize(): number {
    return TerrainGenerator.CELL_SIZE;
  }

  get gridSize(): number {
    return TerrainGenerator.GRID_SIZE;
  }
}