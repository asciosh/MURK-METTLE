export class FrameWindow {
  record(now: number): void;
  summary(): { fps: number; meanMs: number; p95Ms: number };
}
export class SnapshotArrivals {
  reset(): void;
  observe(now: number): void;
  summary(now: number): { ageMs: number | null; intervalMs: number; jitterMs: number; snapshots: number };
}
