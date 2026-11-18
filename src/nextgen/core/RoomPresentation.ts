import type { EnemySnapshot } from '../../../shared/survival.mjs';
import type { InfectedAnimation } from './InfectedController.ts';
import { roomToScene } from './RoomIntent.ts';
import { obstacleDistance, shotDistance } from '../../../shared/expansion.mjs';
import { NEXTGEN_MAP } from '../../../shared/nextgen-terrain.mjs';

export type RoomEnemyMotion = { hp: number; x: number; z: number; yaw: number; speed: number; animation: InfectedAnimation; hitMs: number; attackMs: number; serverState: string };
type Point2 = { x: number; z: number };
type Point3 = { x: number; y: number; z: number };

// Presentation derives animation from server snapshots; it never advances AI or HP.
export function enemyMotion(previous: RoomEnemyMotion | undefined, enemy: EnemySnapshot, elapsedMs: number, livingPlayers: readonly Point2[]): RoomEnemyMotion {
  const dt = Math.max(0, Math.min(100, Number.isFinite(elapsedMs) ? elapsedMs : 0));
  const dx = previous ? enemy.x - previous.x : 0, dz = previous ? enemy.z - previous.z : 0;
  const observedSpeed = dt > 0 ? Math.min(4, Math.hypot(dx, dz) * 1000 / dt) : 0;
  // A snapshot arriving slightly late must not restart the run/idle animation
  // every few frames. Smooth cosmetic speed and use the server's locomotion
  // state as a minimum while chasing or investigating. No AI is simulated here.
  const response = 1 - Math.exp(-dt / 110);
  const filteredSpeed = previous
    ? previous.speed + (observedSpeed - previous.speed) * response
    : observedSpeed;
  const speed = enemy.state === 'chase' ? Math.max(2.25, filteredSpeed)
    : enemy.state === 'investigate' ? Math.max(0.9, filteredSpeed)
    : filteredSpeed;
  let yaw = previous?.yaw ?? 0;
  let hitMs = Math.max(0, (previous?.hitMs ?? 0) - dt);
  let attackMs = Math.max(0, (previous?.attackMs ?? 0) - dt);
  if (previous && enemy.hp < previous.hp) hitMs = 333;
  if (enemy.state === 'windup' && previous?.serverState !== 'windup') attackMs = 1000;
  if (enemy.state === 'windup' || enemy.state === 'attack') {
    const target = [...livingPlayers].sort((a, b) => Math.hypot(a.x - enemy.x, a.z - enemy.z) - Math.hypot(b.x - enemy.x, b.z - enemy.z))[0];
    if (target && Math.hypot(target.x - enemy.x, target.z - enemy.z) > 0.001) yaw = Math.atan2(enemy.x - target.x, enemy.z - target.z);
  } else if (Math.hypot(dx, dz) > 0.001) yaw = Math.atan2(-dx, -dz);
  const animation: InfectedAnimation = enemy.hp <= 0 ? 'death' : attackMs > 0 ? 'attack' : hitMs > 0 ? 'hit' : speed > 2.0 ? 'run' : speed > 0.08 ? 'walk' : 'idle';
  return { hp: enemy.hp, x: enemy.x, z: enemy.z, yaw, speed, animation, hitMs, attackMs, serverState: enemy.state };
}

export function smoothRoomPosition(previous: Point2, target: Point2, elapsedMs: number): Point2 {
  if (Math.hypot(target.x - previous.x, target.z - previous.z) > 1.2) return { ...target };
  const alpha = 1 - Math.exp(-Math.max(0, Math.min(100, elapsedMs)) / 45);
  return { x: previous.x + (target.x - previous.x) * alpha, z: previous.z + (target.z - previous.z) * alpha };
}

export function confirmedShotSegment(origin: Point3, direction: Point3, distance: number): { from: [number, number, number]; to: [number, number, number] } | null {
  if (![origin.x, origin.y, origin.z, direction.x, direction.y, direction.z, distance].every(Number.isFinite) || distance < 0 || distance > 120 || Math.abs(Math.hypot(direction.x, direction.y, direction.z) - 1) > 0.015) return null;
  const from = roomToScene(origin.x, origin.z); from[1] = origin.y;
  return { from, to: [from[0] + direction.x * distance, from[1] + direction.y * distance, from[2] + direction.z * distance] };
}

// Converge from the server's fixed shot origin toward the visible center of the shoulder camera.
// The server still performs the real ray test; this is only a normalized direction intent.
export function roomAimDirection(player: Point2, camera: Point3, view: Point3, range: number, enemies: readonly EnemySnapshot[],terrain=false): Point3 {
  const origin = { x: player.x, y: 1.32+(terrain?NEXTGEN_MAP.heightAt(player.x,player.z):0), z: player.z };
  let distance = (terrain?NEXTGEN_MAP.distance:obstacleDistance)(camera, view, range);
  for (const enemy of enemies) {
    if (enemy.hp <= 0) continue;
    const hit = (terrain?NEXTGEN_MAP.shotDistance:shotDistance)(camera, view, enemy, distance);
    if (hit !== null) distance = Math.min(distance, hit);
  }
  const target = { x: camera.x + view.x * distance, y: camera.y + view.y * distance, z: camera.z + view.z * distance };
  const delta = { x: target.x - origin.x, y: target.y - origin.y, z: target.z - origin.z };
  const len = Math.hypot(delta.x, delta.y, delta.z);
  const forward = delta.x * view.x + delta.y * view.y + delta.z * view.z;
  return len > 0.001 && forward > 0.2 ? { x: delta.x / len, y: delta.y / len, z: delta.z / len } : { ...view };
}
