export interface Vitals {
  stamina: number;
  exhausted: boolean;
  regenAt: number;
  sprinting: boolean;
  bandages: number;
  healEndsAt: number;
}
export interface Position2 {
  x: number;
  z: number;
}
export interface Combatant extends Position2 {
  id: string;
  hp: number;
  yaw?: number;
  hurtUntil?: number;
  sprinting?: boolean;
}
export interface Enemy extends Position2 {
  id: string;
  encounterId: string;
  generation: number;
  hp: number;
  max: number;
  strain: string;
  speed: number;
  damage: number;
  homeX: number;
  homeZ: number;
  state: string;
  alertUntil: number;
  investigateX: number;
  investigateZ: number;
  lastHit: number;
  windupEndsAt: number;
  route: Position2[];
  routeAt: number;
  routeGoal?: string;
}
export type EnemySnapshot = Pick<Enemy, 'id' | 'x' | 'z' | 'hp' | 'max' | 'strain' | 'generation' | 'state'>;
export interface HordePacket {
  wave: number;
  nextWaveAt: number;
  enemies: EnemySnapshot[];
}
export const SURVIVAL: Readonly<{
  stamina: number;
  drain: number;
  regeneration: number;
  recoveryDelay: number;
  exhaustionThreshold: number;
  walkSpeed: number;
  sprintSpeed: number;
  bandages: number;
  healAmount: number;
  healDuration: number;
  damageGrace: number;
  waveDelay: number;
  maxEnemies: number;
}>;
export function newVitals(): Vitals;
export function canSprint(s: Vitals): boolean;
export function beginHealing(s: Vitals, hp: number, now: number): boolean;
export function cancelHealing(s: Vitals): boolean;
export function stepVitals(s: Vitals, dt: number, now: number, input?: { moving?: boolean; sprint?: boolean }): number;
export function refillVitals(s: Vitals): void;
export function findRoute(start: Position2, goal: Position2): Position2[];
export function spawnHorde(players: Combatant[], wave: number, runId?: string): Enemy[];
export function alertHorde(enemies: Enemy[], source: Position2, now: number, radius?: number): void;
export function damageEnemy(enemy: Enemy, damage: number): boolean;
export function bulletTarget<T extends Pick<Enemy, 'hp' | 'x' | 'z'>>(
  enemies: T[],
  origin: Position2 & { y: number },
  direction: Position2 & { y: number },
  range: number,
): { enemy: T; distance: number } | null;
export function meleeTarget<T extends Pick<Enemy, 'hp' | 'x' | 'z'>>(
  enemies: T[],
  player: Position2 & { yaw: number },
  range: number,
): T | null;
export function pulseTargets<T extends Pick<Enemy, 'hp' | 'x' | 'z'>>(
  enemies: T[],
  player: Position2,
  range: number,
): T[];
export interface HordeHit {
  playerId: string;
  enemyId: string;
  damage: number;
  hp: number;
}
export function stepHorde(enemies: Enemy[], players: Combatant[], dt: number, now: number): HordeHit[];
export class HordeSimulation {
  enemies: Enemy[];
  wave: number;
  nextWaveAt: number;
  runId: string;
  relocateAt: number;
  reset(players?: Combatant[]): void;
  spawn(players: Combatant[]): void;
  step(players: Combatant[], dt: number, now: number): HordeHit[];
  packet(): HordePacket;
}

export function admitMovement(
  player: { survival: Vitals; moveBudget?: number; budgetAt?: number },
  distance: number,
  sprint: boolean,
  now: number,
): boolean;
