export const TRAIL_SPURS: readonly { x1: number; z1: number; x2: number; z2: number }[];
export function forestZone(x: number, z: number): 'pine' | 'wetland' | 'broadleaf';
export function foliageScale(zone: string, layer: number): { width: number; height: number; y: number };
export const WORLD_DECOR_BUDGET: Readonly<{ grass: number; ferns: number; pebbles: number; lilyPads: number }>;
