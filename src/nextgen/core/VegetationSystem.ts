export type VegetationKind =
  | 'pine'
  | 'deciduous'
  | 'bush'
  | 'grass'
  | 'rock'
  | 'log';

export interface VegetationPlacement {
  kind: VegetationKind;
  x: number;
  y: number;
  z: number;
  scale: number;
  rotation: number;
}

export interface TerrainSurface {
  readonly size: number;
  heightAt(x: number, z: number): number;
}

export interface VegetationChunk {
  x: number;
  z: number;
  placements: VegetationPlacement[];
}

export const CHUNK_SIZE = 25;

export function generateVegetation(
  terrain: TerrainSurface,
  seed = 12345
): VegetationPlacement[] {
  let state = Math.abs(Math.trunc(seed)) % 2147483647 || 1;

  const random = (): number => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };

  const placements: VegetationPlacement[] = [];

  const counts: Record<VegetationKind, number> = {
    pine: 100,
    deciduous: 60,
    bush: 90,
    grass: 400,
    rock: 40,
    log: 15
  };

  for (const kind of Object.keys(counts) as VegetationKind[]) {
    let placed = 0;
    let attempts = 0;

    while (placed < counts[kind] && attempts < counts[kind] * 20) {
      attempts++;

      const x = 10 + random() * (terrain.size - 20);
      const z = 10 + random() * (terrain.size - 20);
      const y = terrain.heightAt(x, z);

      const slopeX =
        (terrain.heightAt(x + 1, z) -
         terrain.heightAt(x - 1, z)) / 2;

      const slopeZ =
        (terrain.heightAt(x, z + 1) -
         terrain.heightAt(x, z - 1)) / 2;

      const slope = Math.hypot(slopeX, slopeZ);

      if (kind !== 'rock' && slope > 0.6) {
        continue;
      }

      if (kind !== 'rock' && kind !== 'log' && y > 18) {
        continue;
      }

      placements.push({
        kind,
        x,
        y,
        z,
        scale: 0.75 + random() * 0.65,
        rotation: random() * Math.PI * 2
      });

      placed++;
    }
  }

  return placements;
}

export function createVegetationChunks(
  placements: VegetationPlacement[]
): VegetationChunk[] {
  const chunks = new Map<string, VegetationChunk>();

  for (const placement of placements) {
    const x = Math.floor(placement.x / CHUNK_SIZE);
    const z = Math.floor(placement.z / CHUNK_SIZE);
    const key = `${x}:${z}`;

    let chunk = chunks.get(key);

    if (!chunk) {
      chunk = { x, z, placements: [] };
      chunks.set(key, chunk);
    }

    chunk.placements.push(placement);
  }

  return Array.from(chunks.values());
}

export function isChunkVisible(
  chunk: VegetationChunk,
  cameraX: number,
  cameraZ: number,
  distance: number
): boolean {
  const minX = chunk.x * CHUNK_SIZE;
  const minZ = chunk.z * CHUNK_SIZE;

  const nearestX = Math.max(
    minX,
    Math.min(minX + CHUNK_SIZE, cameraX)
  );

  const nearestZ = Math.max(
    minZ,
    Math.min(minZ + CHUNK_SIZE, cameraZ)
  );

  const dx = cameraX - nearestX;
  const dz = cameraZ - nearestZ;

  return dx * dx + dz * dz <= distance * distance;
}