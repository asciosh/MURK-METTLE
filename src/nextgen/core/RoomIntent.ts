import { constrainPosition } from '../../../shared/expansion.mjs';
import { SURVIVAL } from '../../../shared/survival.mjs';
import { roomHeight,terrainConstrain } from '../../../shared/nextgen-terrain.mjs';

export const ROOM_OFFSET = 100;
export const roomToScene = (x: number, z: number, terrain=false): [number, number, number] => [x + ROOM_OFFSET, terrain?roomHeight(x,z):0, z + ROOM_OFFSET];
export function roomDirection(yaw: number, pitch: number) {
  return { x: -Math.sin(yaw) * Math.cos(pitch), y: Math.sin(pitch), z: -Math.cos(yaw) * Math.cos(pitch) };
}
export function roomMove(pos: { x: number; z: number }, forward: number, strafe: number, yaw: number, sprint: boolean, elapsedMs: number,terrain=false) {
  const len = Math.hypot(forward, strafe);
  const scale = len > 1 ? 1 / len : 1;
  const distance = Math.max(0, Math.min(100, elapsedMs)) / 1000 * (sprint ? SURVIVAL.sprintSpeed : SURVIVAL.walkSpeed);
  return (terrain?terrainConstrain:constrainPosition)({
    x: pos.x + (-Math.sin(yaw) * forward + Math.cos(yaw) * strafe) * distance * scale,
    z: pos.z + (-Math.cos(yaw) * forward - Math.sin(yaw) * strafe) * distance * scale,
  });
}
export function validateRoomCode(code: string): string | null {
  const normalized = code.trim().toUpperCase();
  return /^[A-Z0-9]{3,12}$/.test(normalized) ? normalized : null;
}
