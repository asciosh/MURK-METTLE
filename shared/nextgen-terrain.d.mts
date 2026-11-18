export class TerrainGenerator {
  static readonly SIZE:number;static readonly GRID_SIZE:number;static readonly CELL_SIZE:number;static readonly MAX_HEIGHT:number;
  constructor(seed:number);heightAt(x:number,z:number):number;getHeights():Float32Array;
  get size():number;get cellSize():number;get gridSize():number;
}
export interface TerrainPoint {x:number;z:number}
export interface TerrainRay {x:number;y:number;z:number}
export const NEXTGEN_TERRAIN_SEED:number;
export const NEXTGEN_MAP_ID:'nextgen-terrain-v1';
export const NEXTGEN_MAP_OFFSET:number;
export function roomHeight(x:number,z:number):number;
export function terrainConstrain<T extends TerrainPoint>(pos:T,radius?:number):T;
export function terrainDistance(origin:TerrainRay,direction:TerrainRay,maxDistance:number):number;
export function terrainShotDistance(origin:TerrainRay,direction:TerrainRay,target:TerrainPoint,maxDistance:number):number|null;
export const NEXTGEN_MAP:Readonly<{id:typeof NEXTGEN_MAP_ID;boundary:number;heightAt:typeof roomHeight;constrain:typeof terrainConstrain;distance:typeof terrainDistance;shotDistance:typeof terrainShotDistance}>;
