export interface ActorPose {
  weapon: 'pistol' | 'rifle';
  aiming: boolean;
  sprinting: boolean;
  pitch: number;
}
export interface Point3 {
  x: number;
  y: number;
  z: number;
}
export function sanitizeActorPose(value?: unknown): ActorPose;
export function solveArm(
  shoulder: Point3,
  requested: Point3,
  bend: Point3,
  upper?: number,
  lower?: number,
): { elbow: Point3; wrist: Point3 };
