export class FrameWindow {
  constructor() {
    this.samples = [];
    this.last = null;
  }
  record(now) {
    if (this.last !== null) {
      const dt = now - this.last;
      if (dt > 0 && dt < 2000) {
        this.samples.push(dt);
        if (this.samples.length > 120) this.samples.shift();
      }
    }
    this.last = now;
  }
  summary() {
    if (!this.samples.length) return { fps: 0, meanMs: 0, p95Ms: 0 };
    const sorted = [...this.samples].sort((a, b) => a - b),
      mean = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    return { fps: 1000 / mean, meanMs: mean, p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] };
  }
}
export class SnapshotArrivals {
  constructor() {
    this.reset();
  }
  reset() {
    this.last = null;
    this.interval = 0;
    this.jitter = 0;
    this.count = 0;
  }
  observe(now) {
    if (this.last !== null) {
      const gap = now - this.last;
      if (gap >= 0) {
        this.interval = this.count < 2 ? gap : this.interval * 0.9 + gap * 0.1;
        this.jitter = this.jitter * 0.9 + Math.abs(gap - this.interval) * 0.1;
      }
    }
    this.last = now;
    this.count++;
  }
  summary(now) {
    return {
      ageMs: this.last === null ? null : Math.max(0, now - this.last),
      intervalMs: this.interval,
      jitterMs: this.jitter,
      snapshots: this.count,
    };
  }
}
