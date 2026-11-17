import {
  SURVIVAL,
  newVitals,
  canSprint,
  stepVitals
} from '../../../shared/survival.mjs';

export interface CharacterStaminaState {
  stamina: number;
  maxStamina: number;
  sprinting: boolean;
  exhausted: boolean;
}

export class CharacterStamina {
  static readonly MAX_STEP_MS = 100;

  private readonly vitals = newVitals();
  private elapsedMs = 0;

  canSprint(): boolean {
    return canSprint(this.vitals);
  }

  trySpend(cost: number): boolean {
    if (
      !Number.isFinite(cost) ||
      cost <= 0 ||
      this.vitals.exhausted ||
      this.vitals.stamina < cost
    ) {
      return false;
    }

    this.vitals.stamina = Math.max(
      0,
      this.vitals.stamina - cost
    );

    this.vitals.sprinting = false;
    this.vitals.regenAt =
      this.elapsedMs + SURVIVAL.recoveryDelay;

    if (this.vitals.stamina === 0) {
      this.vitals.exhausted = true;
    }

    return true;
  }

  getState(): CharacterStaminaState {
    return {
      stamina: this.vitals.stamina,
      maxStamina: SURVIVAL.stamina,
      sprinting: this.vitals.sprinting,
      exhausted: this.vitals.exhausted
    };
  }

  update(
    deltaTimeMs: number,
    moving: boolean,
    sprintRequested: boolean
  ): CharacterStaminaState {
    const dt = Number.isFinite(deltaTimeMs)
      ? Math.max(
          0,
          Math.min(
            CharacterStamina.MAX_STEP_MS,
            deltaTimeMs
          )
        )
      : 0;

    if (dt === 0) return this.getState();

    this.elapsedMs += dt;

    stepVitals(
      this.vitals,
      dt / 1000,
      this.elapsedMs,
      {
        moving: moving === true,
        sprint: sprintRequested === true
      }
    );

    return this.getState();
  }
}