import * as THREE from 'three/webgpu';

type Position = readonly [number, number, number];
export type LootKind = 'ammo' | 'bandage';
export interface LootItem {
  id: number;
  kind: LootKind;
  amount: number;
  position: [number, number, number];
}

export interface LootPickupResult {
  status: 'collected' | 'full' | 'not-nearby' | 'unavailable';
  kind: LootKind | null;
  amount: number;
}

type LootPreference = (item: Readonly<LootItem>) => boolean;

export class LootField {
  static readonly PICKUP_RANGE = 2;
  static readonly LIMIT = 24;
  readonly root = new THREE.Group();
  private readonly geometry = new THREE.BoxGeometry(0.42, 0.25, 0.32);
  private readonly markerGeometry = new THREE.OctahedronGeometry(0.15, 0);
  private readonly ammoMarker = new THREE.MeshBasicMaterial({ color: 0xffc34a, toneMapped: false });
  private readonly bandageMarker = new THREE.MeshBasicMaterial({ color: 0x86ffbe, toneMapped: false });
  private readonly ammoMaterial = new THREE.MeshStandardMaterial({ color: 0xc4a044, emissive: 0x543c0b, emissiveIntensity: 0.6 });
  private readonly bandageMaterial = new THREE.MeshStandardMaterial({ color: 0xe6eedb, emissive: 0x235a39, emissiveIntensity: 0.35 });
  private readonly items = new Map<number, { item: LootItem; mesh: THREE.Group }>();
  private nextId = 1;
  private disposed = false;

  constructor() { this.root.name = 'NEXTGEN loot'; }

  spawn(kind: LootKind, amount: number, position: Position): boolean {
    if (this.disposed || this.items.size >= LootField.LIMIT ||
        (kind !== 'ammo' && kind !== 'bandage') ||
        !Number.isSafeInteger(amount) || amount <= 0 || !position.every(Number.isFinite)) return false;
    const id = this.nextId++;
    const item: LootItem = { id, kind, amount, position: [...position] };
    const mesh = new THREE.Group();
    mesh.name = 'Loot ' + kind;
    mesh.position.set(...position);
    const box = new THREE.Mesh(this.geometry,
      kind === 'ammo' ? this.ammoMaterial : this.bandageMaterial);
    box.position.y = 0.13;
    box.receiveShadow = true;
    const marker = new THREE.Mesh(this.markerGeometry,
      kind === 'ammo' ? this.ammoMarker : this.bandageMarker);
    marker.name = 'Loot marker ' + kind;
    marker.position.y = 0.72;
    mesh.add(box, marker);
    this.root.add(mesh);
    this.items.set(id, { item, mesh });
    return true;
  }

  nearby(position: Position, prefer?: LootPreference): LootItem | null {
    if (this.disposed || !position.every(Number.isFinite)) return null;
    let nearest: LootItem | null = null;
    let preferred: LootItem | null = null;
    let nearestDistance = LootField.PICKUP_RANGE;
    let preferredDistance = LootField.PICKUP_RANGE;
    for (const { item } of this.items.values()) {
      const d = Math.hypot(item.position[0] - position[0],
        item.position[1] - position[1], item.position[2] - position[2]);
      if (d > LootField.PICKUP_RANGE) continue;
      if (!nearest || d < nearestDistance) {
        nearest = item;
        nearestDistance = d;
      }
      if (prefer && prefer(item) && (!preferred || d < preferredDistance)) {
        preferred = item;
        preferredDistance = d;
      }
    }
    const best = preferred ?? nearest;
    return best ? { ...best, position: [...best.position] } : null;
  }

  collectDetailed(position: Position,
    accept: (kind: LootKind, amount: number) => number,
    prefer?: LootPreference): LootPickupResult {
    const near = this.nearby(position, prefer);
    if (!near) return { status: 'not-nearby', kind: null, amount: 0 };
    return this.collectById(near.id, position, accept);
  }

  collectById(id: number, position: Position,
    accept: (kind: LootKind, amount: number) => number,
    reach: number = LootField.PICKUP_RANGE): LootPickupResult {
    const entry = this.items.get(id);
    if (this.disposed || !entry || !position.every(Number.isFinite) ||
        !Number.isFinite(reach) || reach < 0 ||
        Math.hypot(entry.item.position[0]-position[0], entry.item.position[1]-position[1],
          entry.item.position[2]-position[2]) > Math.min(reach, LootField.PICKUP_RANGE)) {
      return { status: 'not-nearby', kind: null, amount: 0 };
    }
    const near = entry.item;
    const accepted = accept(near.kind, near.amount);
    if (accepted === 0) return { status: 'full', kind: near.kind, amount: 0 };
    if (!Number.isSafeInteger(accepted) || accepted < 0 || accepted > near.amount) {
      return { status: 'unavailable', kind: near.kind, amount: 0 };
    }
    entry.item.amount -= accepted;
    if (entry.item.amount === 0) {
      entry.mesh.removeFromParent();
      this.items.delete(near.id);
    }
    return { status: 'collected', kind: near.kind, amount: accepted };
  }

  collect(position: Position, accept: (kind: LootKind, amount: number) => number,
    prefer?: LootPreference): number {
    return this.collectDetailed(position, accept, prefer).amount;
  }

  getState(): LootItem[] {
    return Array.from(this.items.values(), ({ item }): LootItem => ({
      ...item, position: [...item.position]
    }));
  }

  clear(): void { this.root.clear(); this.items.clear(); }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clear();
    this.root.removeFromParent();
    this.geometry.dispose();
    this.markerGeometry.dispose();
    this.ammoMarker.dispose();
    this.bandageMarker.dispose();
    this.ammoMaterial.dispose();
    this.bandageMaterial.dispose();
  }
}
