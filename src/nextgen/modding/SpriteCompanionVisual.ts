import * as THREE from 'three/webgpu';
import { spriteFrame, type SpriteState } from './sprite-pack.mjs';
import type { SpriteSelection } from './SpritePackRegistry';

/** World-space billboard with an independent, terrain-grounded circular shadow. */
export class SpriteCompanionVisual {
  readonly root = new THREE.Group();
  private readonly map: THREE.Texture;
  private readonly material: THREE.SpriteMaterial;
  private readonly sprite: THREE.Sprite;
  private readonly shadowGeometry = new THREE.CircleGeometry(0.32, 24);
  private readonly shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x101611, transparent: true, opacity: 0.28, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
  private state: SpriteState = 'idle';
  private elapsed = 0;
  private action: 'pulse' | 'attack' | null = null;
  private actionEnds = 0;
  private disposed = false;
  private constructor(private readonly source: SpriteSelection, private readonly bitmap: ImageBitmap) {
    const { entry, width, height } = source;
    this.root.name = `NEXTGEN sprite: ${entry.key}`;
    this.map = new THREE.Texture(bitmap);
    this.map.flipY = false; this.map.colorSpace = THREE.SRGBColorSpace;
    this.map.magFilter = THREE.NearestFilter; this.map.minFilter = THREE.NearestFilter; this.map.generateMipmaps = false;
    this.map.repeat.set(1 / entry.columns, 1 / entry.rows); this.map.needsUpdate = true;
    this.material = new THREE.SpriteMaterial({ map: this.map, transparent: false, alphaTest: 0.5, depthWrite: true, toneMapped: false });
    this.sprite = new THREE.Sprite(this.material); this.sprite.center.set(0.5, 0);
    const aspect = (width / entry.columns) / (height / entry.rows);
    this.sprite.scale.set(entry.height * aspect, entry.height, 1); this.sprite.position.y = 0.03;
    const shadow = new THREE.Mesh(this.shadowGeometry, this.shadowMaterial);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.035;
    this.root.add(shadow, this.sprite); this.update(0, false);
  }
  static async create(source: SpriteSelection) {
    const bitmap = await createImageBitmap(new Blob([source.bytes], { type: 'image/png' }), { imageOrientation: 'flipY' });
    try { return new SpriteCompanionVisual(source, bitmap); } catch (error) { bitmap.close(); throw error; }
  }
  private play(state: 'pulse' | 'attack') { this.action = state; this.actionEnds = state === 'pulse' ? 0.65 : 0.4; this.state = state; this.elapsed = 0; }
  pulse() { this.play('pulse'); }
  attack() { this.play('attack'); }
  update(dt: number, moving: boolean) {
    if (this.disposed) return;
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(0.1, dt)) : 0;
    this.actionEnds = Math.max(0, this.actionEnds - dt);
    if (!this.actionEnds) this.action = null;
    const state = this.action ?? (moving ? 'walk' : 'idle');
    if (state !== this.state) { this.state = state; this.elapsed = 0; }
    this.elapsed += dt;
    const { entry } = this.source;
    const frame = spriteFrame(entry, state, this.elapsed, !this.action);
    this.map.offset.set(frame.column / entry.columns, 1 - (frame.row + 1) / entry.rows);
  }
  dispose() {
    if (this.disposed) return; this.disposed = true;
    this.root.removeFromParent(); this.root.clear(); this.map.dispose(); this.bitmap.close(); this.material.dispose();
    this.shadowMaterial.dispose(); this.shadowGeometry.dispose();
  }
}
