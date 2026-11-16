/**
 * GPU resource ownership. Every Three.js GPU resource created by the nextgen
 * renderer (geometries, materials, textures, render targets, ...) is registered
 * here so `disposeAll()` deterministically releases GPU memory. Disposal is
 * testable and leak-assertable (requirement: resource ownership & GPU disposal).
 */

interface Disposable {
  dispose(): void;
}

export class ResourceTracker {
  private readonly resources = new Set<Disposable>();
  private disposed = false;

  track<T extends Disposable>(resource: T): T {
    if (this.disposed) {
      throw new Error('ResourceTracker: cannot track resource after disposal.');
    }
    this.resources.add(resource);
    return resource;
  }

  untrack(resource: Disposable): boolean {
    return this.resources.delete(resource);
  }

  get size(): number {
    return this.resources.size;
  }

  has(resource: Disposable): boolean {
    return this.resources.has(resource);
  }

  disposeAll(): void {
    if (this.disposed) return;
    this.disposed = true;
    for (const resource of this.resources) {
      try {
        resource.dispose();
      } catch {
        // A single failing disposal must not abort teardown of the rest.
      }
    }
    this.resources.clear();
  }
}
