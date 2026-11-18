type Position = readonly [number, number, number];

export interface HordeTerrain {
  size: number;
  heightAt(x: number, z: number): number;
}

export interface HordeSpawn {
  x: number;
  z: number;
}

export class HordeDirector {
  private wave = 1;
  private defeatedBefore = 0;
  private delayRemainingMs: number | null = null;

  private readonly delayMs: number;
  private readonly maxEnemies: number;

  constructor(delayMs = 8000, maxEnemies = 6) {
    this.delayMs = Number.isFinite(delayMs)
      ? Math.max(1, delayMs)
      : 8000;

    this.maxEnemies = Number.isFinite(maxEnemies)
      ? Math.max(1, Math.min(6, Math.floor(maxEnemies)))
      : 6;
  }

  get spawnCount(): number {
    return Math.min(this.maxEnemies, this.wave + 2);
  }

  step(
    deltaTimeMs: number,
    living: number,
    total: number
  ): boolean {
    const dt = Number.isFinite(deltaTimeMs)
      ? Math.max(0, Math.min(100, deltaTimeMs))
      : 0;

    if (living > 0) {
      this.delayRemainingMs = null;
      return false;
    }

    if (dt === 0 || total === 0) return false;

    if (this.delayRemainingMs === null) {
      this.delayRemainingMs = this.delayMs;
      return false;
    }

    this.delayRemainingMs = Math.max(
      0,
      this.delayRemainingMs - dt
    );

    if (this.delayRemainingMs > 0) return false;

    this.defeatedBefore += total;
    this.wave++;
    this.delayRemainingMs = null;

    return true;
  }

  getState(living: number, total: number) {
    return {
      wave: this.wave,
      living,
      total,
      kills: this.defeatedBefore +
        Math.max(0, total - living),
      intermission: this.delayRemainingMs !== null,
      countdownMs: this.delayRemainingMs ?? 0
    };
  }

  reset(): void {
    this.wave = 1;
    this.defeatedBefore = 0;
    this.delayRemainingMs = null;
  }
}

export type HordeState =
  ReturnType<HordeDirector['getState']>;

export function createWaveSpawns(
  player: Position,
  terrain: HordeTerrain,
  count: number,
  wave: number
): HordeSpawn[] {
  const spawns: HordeSpawn[] = [];

  const amount = Math.max(
    0,
    Math.min(6, Math.floor(count))
  );

  const rotation = (wave - 1) * 0.43;

  for (let i = 0; i < amount; i++) {
    const radius = 12 + (i % 2) * 2;

    const baseAngle =
      Math.PI + rotation +
      i * Math.PI * 2 / amount;

    // Search alternate angles when near map boundaries.
    for (let attempt = 0; attempt < 72; attempt++) {
      const offset = attempt === 0
        ? 0
        : Math.ceil(attempt / 2) *
          (attempt % 2 ? 1 : -1);

      const angle =
        baseAngle + offset * Math.PI * 2 / 72;

      const x = player[0] + Math.sin(angle) * radius;
      const z = player[2] + Math.cos(angle) * radius;

      if (
        x < 0.4 ||
        z < 0.4 ||
        x > terrain.size - 0.4 ||
        z > terrain.size - 0.4
      ) {
        continue;
      }

      if (!Number.isFinite(terrain.heightAt(x, z))) {
        continue;
      }

      if (spawns.some(spawn =>
        Math.hypot(spawn.x - x, spawn.z - z) < 2
      )) {
        continue;
      }

      spawns.push({ x, z });
      break;
    }
  }

  return spawns;
}

interface SeparationAgent {
  getState(): {
    position: Position;
    health: number;
  };

  separate(dx: number, dz: number): void;
}

export function separateInfected(
  agents: readonly SeparationAgent[],
  deltaTimeMs: number
): void {
  const dt = Number.isFinite(deltaTimeMs)
    ? Math.max(0, Math.min(100, deltaTimeMs))
    : 0;

  if (dt === 0) return;

  const minimumDistance = 0.85;

  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      const a = agents[i].getState();
      const b = agents[j].getState();

      if (a.health <= 0 || b.health <= 0) continue;

      const dx = b.position[0] - a.position[0];
      const dz = b.position[2] - a.position[2];
      const distance = Math.hypot(dx, dz);

      if (distance >= minimumDistance) continue;

      const nx = distance > 0.000001
        ? dx / distance
        : 1;

      const nz = distance > 0.000001
        ? dz / distance
        : 0;

      const push = Math.min(
        (minimumDistance - distance) / 2,
        dt * 0.0012
      );

      agents[i].separate(-nx * push, -nz * push);
      agents[j].separate(nx * push, nz * push);
    }
  }
}