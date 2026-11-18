import type { WeaponId } from './EquipmentInventory.ts';
import { resonantBallistics } from './WeaponResonance.ts';
type Vec3 = readonly [number, number, number];

export interface ShotTarget {
  position: Vec3;
  health: number;
}

function cylinderDistance(
  origin: Vec3,
  direction: Vec3,
  position: Vec3
): number | null {
  const radius = 0.4;
  const height = 1.75;

  const x = origin[0] - position[0];
  const z = origin[2] - position[2];

  const dx = direction[0];
  const dy = direction[1];
  const dz = direction[2];

  const a = dx * dx + dz * dz;
  const b = 2 * (x * dx + z * dz);
  const c = x * x + z * z - radius * radius;

  let near = 0;
  let far = Infinity;

  if (a > 0.000001) {
    const discriminant = b * b - 4 * a * c;

    if (discriminant < 0) return null;

    const root = Math.sqrt(discriminant);

    near = Math.max(near, (-b - root) / (2 * a));
    far = Math.min(far, (-b + root) / (2 * a));
  } else if (c > 0) {
    return null;
  }

  const bottom = position[1];
  const top = bottom + height;

  if (Math.abs(dy) > 0.000001) {
    const t1 = (bottom - origin[1]) / dy;
    const t2 = (top - origin[1]) / dy;

    near = Math.max(near, Math.min(t1, t2));
    far = Math.min(far, Math.max(t1, t2));
  } else if (origin[1] < bottom || origin[1] > top) {
    return null;
  }

  return near <= far ? near : null;
}

function terrainBlocked(
  start: Vec3,
  end: Vec3,
  heightAt: (x: number, z: number) => number
): boolean {
  const distance = Math.hypot(
    end[0] - start[0],
    end[1] - start[1],
    end[2] - start[2]
  );

  const steps = Math.max(1, Math.ceil(distance / 0.1));

  for (let i = 1; i <= steps; i++) {
    const t = i / steps;

    const x = start[0] + (end[0] - start[0]) * t;
    const y = start[1] + (end[1] - start[1]) * t;
    const z = start[2] + (end[2] - start[2]) * t;

    const height = heightAt(x, z);

    if (!Number.isFinite(height) || y < height) {
      return true;
    }
  }

  return false;
}

export function findShotTarget(
  origin: Vec3,
  direction: Vec3,
  shooter: Vec3,
  targets: readonly ShotTarget[],
  range: number,
  heightAt: (x: number, z: number) => number
): number | null {
  if (
    !origin.every(Number.isFinite) ||
    !direction.every(Number.isFinite) ||
    !shooter.every(Number.isFinite) ||
    !Number.isFinite(range) ||
    range <= 0
  ) {
    return null;
  }

  const length = Math.hypot(...direction);

  if (length < 0.000001) return null;

  const ray: Vec3 = [
    direction[0] / length,
    direction[1] / length,
    direction[2] / length
  ];

  let nearest: number | null = null;
  let nearestDistance = Infinity;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];

    if (
      !Number.isFinite(target.health) ||
      target.health <= 0 ||
      !target.position.every(Number.isFinite)
    ) {
      continue;
    }

    const distance = cylinderDistance(
      origin,
      ray,
      target.position
    );

    if (distance === null || distance >= nearestDistance) {
      continue;
    }

    const point: Vec3 = [
      origin[0] + ray[0] * distance,
      origin[1] + ray[1] * distance,
      origin[2] + ray[2] * distance
    ];

    const relative: Vec3 = [
      point[0] - shooter[0],
      point[1] - shooter[1],
      point[2] - shooter[2]
    ];

    const forward =
      relative[0] * ray[0] +
      relative[1] * ray[1] +
      relative[2] * ray[2];

    if (
      forward < 0 ||
      Math.hypot(...relative) > range ||
      terrainBlocked(origin, point, heightAt) ||
      terrainBlocked(shooter, point, heightAt)
    ) {
      continue;
    }

    nearest = i;
    nearestDistance = distance;
  }

  return nearest;
}

// One trigger pull; five deterministic pellets for the shotgun. Group damage
// by target so a single blast cannot repeatedly restart its hit animation.
export function findWeaponHits(weapon: WeaponId, origin: Vec3, direction: Vec3,
  shooter: Vec3, targets: readonly ShotTarget[], heightAt: (x:number,z:number)=>number, resonant=false) {
  const spec = resonantBallistics(weapon,resonant);
  const offsets: readonly (readonly [number,number])[] = weapon === 'shotgun'
    ? [[0,0],[-.035,.02],[.035,.02],[-.025,-.025],[.025,-.025]] : [[0,0]];
  const len = Math.hypot(...direction);
  if (!Number.isFinite(len) || len < 1e-6) return [];
  const [dx,dy,dz] = direction.map(v=>v/len) as [number,number,number];
  const horizontal = Math.hypot(dx,dz);
  const rx = horizontal > 1e-6 ? -dz/horizontal : 1;
  const rz = horizontal > 1e-6 ? dx/horizontal : 0;
  const up: Vec3 = [-rz*dy, rz*dx-rx*dz, rx*dy];
  const hits = new Map<number,number>();
  for (const [x,y] of offsets) {
    const ray: Vec3 = [dx+(rx*x+up[0]*y)*spec.spread,dy+up[1]*y*spec.spread,dz+(rz*x+up[2]*y)*spec.spread];
    const index = findShotTarget(origin,ray,shooter,targets,spec.range,heightAt);
    if (index !== null) hits.set(index,(hits.get(index)??0)+1);
  }
  return [...hits].map(([index,pellets])=>({index,damage:spec.damage*pellets/offsets.length}));
}

// The legacy melee cone is retained, but visibility uses the NEXTGEN terrain.
export function findMeleeTarget(
  position: Vec3,
  facing: Vec3,
  targets: readonly ShotTarget[],
  range: number,
  heightAt: (x: number, z: number) => number
): number | null {
  if (!position.every(Number.isFinite) || !facing.every(Number.isFinite) ||
      !Number.isFinite(range) || range <= 0 || range > 10) return null;
  const length = Math.hypot(facing[0], facing[2]);
  if (length < 0.000001) return null;
  let nearest: number | null = null;
  let best = range;
  targets.forEach((target, index) => {
    if (!Number.isFinite(target.health) || target.health <= 0 ||
        !target.position.every(Number.isFinite) ||
        Math.abs(target.position[1] - position[1]) > 1) return;
    const dx = target.position[0] - position[0];
    const dz = target.position[2] - position[2];
    const distance = Math.hypot(dx, dz);
    if (distance > best || (nearest !== null && distance === best)) return;
    if (distance > 0.001 && (dx * facing[0] + dz * facing[2]) /
        (length * distance) < -0.15) return;
    if (terrainBlocked(
      [position[0], position[1] + 1, position[2]],
      [target.position[0], target.position[1] + 1, target.position[2]],
      heightAt
    )) return;
    nearest = index;
    best = distance;
  });
  return nearest;
}
