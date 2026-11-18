export class TerrainGenerator {
  static          SIZE = 200;
  static          GRID_SIZE = 257;
  static          CELL_SIZE =
    TerrainGenerator.SIZE / (TerrainGenerator.GRID_SIZE - 1);
  static          MAX_HEIGHT = 20;

                   seed        ;
                   heights              ;

  constructor(seed        ) {
    this.seed = seed | 0;
    this.heights = new Float32Array(
      TerrainGenerator.GRID_SIZE * TerrainGenerator.GRID_SIZE
    );
    this.generate();
  }

          hash(x        , z        )         {
    let h =
      Math.imul(x, 374761393) ^
      Math.imul(z, 668265263) ^
      Math.imul(this.seed, 1274126177);

    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;

    return (h >>> 0) / 4294967295;
  }

          noise(x        , z        )         {
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

          generate()       {
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

    heightAt(x        , z        )         {
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

  getHeights()               {
    return this.heights;
  }

  get size()         {
    return TerrainGenerator.SIZE;
  }

  get cellSize()         {
    return TerrainGenerator.CELL_SIZE;
  }

  get gridSize()         {
    return TerrainGenerator.GRID_SIZE;
  }
}

// The solo world is 200m across; room coordinates stay centered at (0,0).
export const NEXTGEN_TERRAIN_SEED = 12345;
export const NEXTGEN_MAP_ID = 'nextgen-terrain-v1';
export const NEXTGEN_MAP_OFFSET = 100;
const field = new TerrainGenerator(NEXTGEN_TERRAIN_SEED);
export const roomHeight = (x,z) => field.heightAt(x+NEXTGEN_MAP_OFFSET,z+NEXTGEN_MAP_OFFSET);
export function terrainConstrain(pos,radius=0.4){
  const limit=100-radius;pos.x=Math.max(-limit,Math.min(limit,pos.x));pos.z=Math.max(-limit,Math.min(limit,pos.z));return pos;
}
// Ray intersection with the *same* interpolated heightfield used to build the mesh.
// March in <=0.125m increments; refine impact to millimeter precision. No client Y trusted.
export function terrainDistance(origin,direction,maxDistance){
  const clearance=t=>origin.y+direction.y*t-roomHeight(origin.x+direction.x*t,origin.z+direction.z*t);
  if(clearance(0)<=0)return 0;
  const count=Math.ceil(maxDistance/0.125);
  for(let i=1;i<=count;i++){
    const t=Math.min(maxDistance,i*0.125);if(clearance(t)>0)continue;
    let lo=Math.max(0,t-0.125),hi=t;
    for(let j=0;j<8;j++){const mid=(lo+hi)/2;if(clearance(mid)>0)lo=mid;else hi=mid;}return hi;
  }return maxDistance;
}
export function terrainShotDistance(origin,direction,target,maxDistance){
  let hit=maxDistance;const base=roomHeight(target.x,target.z);
  for(const y of [0.5,1.1,1.7]){
    const dx=origin.x-target.x,dy=origin.y-base-y,dz=origin.z-target.z;
    const b=dx*direction.x+dy*direction.y+dz*direction.z,c=dx*dx+dy*dy+dz*dz-0.46**2,disc=b*b-c;
    if(disc<0)continue;const t=-b-Math.sqrt(disc);if(t>=0)hit=Math.min(hit,t);
  }return hit<maxDistance?hit:null;
}
export const NEXTGEN_MAP=Object.freeze({id:NEXTGEN_MAP_ID,boundary:100,heightAt:roomHeight,constrain:terrainConstrain,distance:terrainDistance,shotDistance:terrainShotDistance});
