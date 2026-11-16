/**
 * Fixed-timestep simulation clock with interpolation alpha for display-rate
 * rendering. Capped delta and bounded catch-up steps prevent the spiral of
 * death after tab suspension (requirement).
 */

export interface SimulationStep {
  alpha: number; // interpolation factor in [0, 1] between last and next sim state
  steps: number; // fixed steps taken this frame
  tick: number; // monotonic fixed-step counter
}

export class SimulationClock {
  private readonly fixedDt: number;
  private readonly maxDelta: number;
  private readonly maxCatchUpSteps: number;
  private accumulator = 0;
  private lastTime: number | null = null;
  private alpha = 0;
  private fixedSteps = 0;
  private disposed = false;

  // All durations are in milliseconds, matching performance.now() / frame time.
  constructor(fixedDt = 1000 / 60, maxDelta = 250, maxCatchUpSteps = 6) {
    this.fixedDt = fixedDt;
    this.maxDelta = maxDelta;
    this.maxCatchUpSteps = maxCatchUpSteps;
  }

  tick(now: number): SimulationStep {
    if (this.disposed) return { alpha: this.alpha, steps: 0, tick: this.fixedSteps };
    if (this.lastTime === null) {
      this.lastTime = now;
      return { alpha: 0, steps: 0, tick: this.fixedSteps };
    }

    let delta = now - this.lastTime;
    this.lastTime = now;

    // Negative time (clock drift) or a huge gap after tab suspension is capped
    // so a single frame cannot run an unbounded number of simulation steps.
    if (!Number.isFinite(delta) || delta < 0) delta = 0;
    if (delta > this.maxDelta) delta = this.maxDelta;

    this.accumulator += delta;

    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < this.maxCatchUpSteps) {
      this.accumulator -= this.fixedDt;
      this.fixedSteps += 1;
      steps += 1;
    }

    // Interpolation alpha for the display renderer, clamped to [0, 1]. When
    // catch-up was capped the leftover accumulator is clamped rather than
    // letting rendering run ahead of simulation.
    this.alpha = Math.min(1, Math.max(0, this.accumulator / this.fixedDt));

    return { alpha: this.alpha, steps, tick: this.fixedSteps };
  }

  getAlpha(): number {
    return this.alpha;
  }

  getTick(): number {
    return this.fixedSteps;
  }

  getAccumulator(): number {
    return this.accumulator;
  }

  reset(): void {
    this.accumulator = 0;
    this.lastTime = null;
    this.alpha = 0;
    this.fixedSteps = 0;
  }

  dispose(): void {
    this.disposed = true;
    this.reset();
  }
}
