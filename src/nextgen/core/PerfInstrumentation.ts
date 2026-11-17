/**
 * Frame-rate telemetry independent of the legacy src/client/debug metrics so the
 * nextgen path stays decoupled from v0.27. Tab suspension is naturally ignored:
 * setAnimationLoop pauses when the tab is hidden, so no large gap is recorded.
 * Performance instrumentation (requirement).
 */

export interface PerfSummary {
  fps: number;
  meanMs: number;
  p95Ms: number;
  samples: number;
  frame: number;
}

export class PerfInstrumentation {
  private readonly samples: number[] = [];
  private last: number | null = null;
  private frame = 0;
  private disposed = false;

record(now: number): number {
  if (this.disposed || !Number.isFinite(now)) {
    return 0;
  }

  let frameMs = 0;

  if (this.last !== null) {
    const dt = now - this.last;

    if (dt > 0 && dt < 2000) {
      frameMs = dt;

      this.samples.push(dt);

      if (this.samples.length > 120) {
        this.samples.shift();
      }
    }
  }

  this.last = now;
  this.frame += 1;

  return frameMs;
}

  summary(): PerfSummary {
    if (this.samples.length === 0) {
      return { fps: 0, meanMs: 0, p95Ms: 0, samples: 0, frame: this.frame };
    }
    const sorted = [...this.samples].sort((a, b) => a - b);
    const mean = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
    return {
      fps: 1000 / mean,
      meanMs: mean,
      p95Ms: p95,
      samples: this.samples.length,
      frame: this.frame,
    };
  }

  reset(): void {
    this.samples.length = 0;
    this.last = null;
    this.frame = 0;
  }

  dispose(): void {
    this.disposed = true;
    this.reset();
  }
}
