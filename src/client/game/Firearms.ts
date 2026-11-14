import { setText } from '../ui/ChangedValue';
import * as THREE from 'three';
import type { CombatFeedback } from './CombatFeedback';
import type { Player } from './Player';
import {
  WEAPONS,
  SUPPLIES,
  newArsenal,
  fireWeapon,
  reloadWeapon,
  settleReload,
  obstacleDistance,
  type WeaponId,
} from '../../../shared/expansion.mjs';

/** Local presentation/prediction. Room server owns ammo and hit results in co-op. */
export class Firearms {
  selected: WeaponId = 'pistol';
  arsenal = newArsenal();
  aiming = false;
  private readonly tracers: { line: THREE.Line; life: number }[] = [];
  private hitTime = 0;
  private wasReloading = false;
  private reloadWeaponId: WeaponId = 'pistol';
  private readonly supplyAt = new Map<string, number>();
  constructor(
    private readonly scene: THREE.Scene,
    private readonly player: Player,
    private readonly feedback: CombatFeedback,
  ) {}

  switchWeapon(id: WeaponId): void {
    this.selected = id;
  }
  reset(): void {
    this.arsenal = newArsenal();
    this.supplyAt.clear();
  }
  reload(): boolean {
    const success = reloadWeapon(this.arsenal, this.selected, Date.now());
    if (success) this.feedback.audio.play('reload');
    return success;
  }
  tryFire(): boolean {
    const ok = fireWeapon(this.arsenal, this.selected, Date.now());
    if (ok) {
      this.player.triggerShot(this.selected);
      this.feedback.audio.play(this.selected);
    }
    return ok;
  }
  muzzle(): THREE.Vector3 {
    return this.player.muzzlePosition();
  }
  effect(origin: THREE.Vector3, direction: THREE.Vector3, distance: number, hit = false): void {
    const end = origin.clone().addScaledVector(direction, Math.max(0.1, obstacleDistance(origin, direction, distance)));
    const geometry = new THREE.BufferGeometry().setFromPoints([origin, end]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineBasicMaterial({ color: 0xf9dc9c, transparent: true, opacity: 0.65 }),
    );
    if (this.tracers.length >= 16) {
      const oldest = this.tracers.shift()!;
      oldest.line.removeFromParent();
      oldest.line.geometry.dispose();
      (oldest.line.material as THREE.Material).dispose();
    }
    this.scene.add(line);
    this.tracers.push({ line, life: 0.075 });
    if (hit) this.markHit();
  }
  markHit(): void {
    this.hitTime = 0.16;
    this.feedback.confirm();
  }
  nearSupply(position: THREE.Vector3): (typeof SUPPLIES)[number] | undefined {
    return SUPPLIES.find((p) => Math.hypot(p.x - position.x, p.z - position.z) < 2.8);
  }
  resupply(position: THREE.Vector3): boolean {
    const p = this.nearSupply(position);
    if (!p || Date.now() - (this.supplyAt.get(p.id) ?? 0) < 45000) return false;
    for (const id of ['pistol', 'rifle'] as WeaponId[]) this.arsenal[id].reserve = WEAPONS[id].reserve;
    this.supplyAt.set(p.id, Date.now());
    this.feedback.audio.play('reload');
    return true;
  }
  update(dt: number): void {
    for (const id of ['pistol', 'rifle'] as WeaponId[]) settleReload(this.arsenal, id, Date.now());
    this.hitTime = Math.max(0, this.hitTime - dt);
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        (t.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }
    const state = this.arsenal[this.selected],
      def = WEAPONS[this.selected];
    const label = document.querySelector('#weapon-name'),
      ammo = document.querySelector('#weapon-ammo'),
      hint = document.querySelector('#weapon-hint');
    const reloading = state.reloadAt > Date.now();
    if (this.wasReloading && !reloading && this.reloadWeaponId === this.selected && state.magazine > 0)
      this.feedback.audio.play('ready');
    this.wasReloading = reloading;
    this.reloadWeaponId = this.selected;
    const panel = document.querySelector<HTMLElement>('.weapon-panel');
    panel?.classList.toggle('reloading', reloading);
    panel?.classList.toggle('empty', state.magazine === 0 && !reloading);
    const reloadWidth = `${reloading ? Math.max(0, Math.min(100, 100 * (1 - (state.reloadAt - Date.now()) / def.reload))) : 0}%`;
    if (panel && panel.style.getPropertyValue('--reload-progress') !== reloadWidth)
      panel.style.setProperty('--reload-progress', reloadWidth);
    const status = document.querySelector('#weapon-state');
    const statusText = reloading ? 'RELOADING' : state.magazine === 0 ? 'EMPTY · RELOAD' : 'READY';
    if (status && status.textContent !== statusText) setText(status, statusText);
    if (label) setText(label, def.name);
    if (ammo) setText(ammo, `${state.magazine.toString().padStart(2, '0')} / ${state.reserve}`);
    if (hint)
      setText(
        hint,
        state.reloadAt
          ? 'RELOADING…'
          : state.magazine === 0
            ? 'R · RELOAD  /  E · SUPPLY CACHE'
            : 'R · RELOAD   1 / 2 · SWITCH',
      );
    document.body.classList.toggle('is-aiming', this.aiming);
    document.body.classList.toggle('hit-confirmed', this.hitTime > 0);
  }
  dispose(): void {
    for (const t of this.tracers) {
      this.scene.remove(t.line);
      t.line.geometry.dispose();
      (t.line.material as THREE.Material).dispose();
    }
    this.tracers.length = 0;
  }
}
