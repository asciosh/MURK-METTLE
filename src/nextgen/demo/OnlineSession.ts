import * as THREE from 'three/webgpu';
import { Multiplayer, type RoomEvent, type RemotePlayer } from '../../client/game/Multiplayer';
import { OBSTACLES, WEAPONS, type Arsenal, type WeaponId } from '../../../shared/expansion.mjs';
import { canSprint } from '../../../shared/survival.mjs';
import { KeyboardInput } from '../core/KeyboardInput';
import { ThirdPersonCamera } from '../core/ThirdPersonCamera';
import { PlayerAvatar } from '../core/PlayerAvatar';
import { characterSkinFile } from '../core/CharacterSkins';
import { roomDirection, roomMove, roomToScene, validateRoomCode } from '../core/RoomIntent';

/** Explicit co-op sandbox. No PlayableSession, local horde, loot or damage simulation. */
export class OnlineSession {
  private readonly net = new Multiplayer();
  private readonly keyboard = new KeyboardInput();
  private readonly follow = new ThirdPersonCamera();
  private readonly world = new THREE.Group();
  private readonly avatar = new PlayerAvatar();
  private readonly peers = new Map<string, PlayerAvatar>();
  private readonly enemies = new Map<string, THREE.Mesh>();
  private readonly geometry = new THREE.CapsuleGeometry(0.32, 1.05, 4, 8);
  private readonly enemyMaterial = new THREE.MeshStandardMaterial({ color: 0x864740 });
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0x555b50 });
  private readonly groundGeometry = new THREE.PlaneGeometry(200, 200);
  private readonly groundMaterial = new THREE.MeshStandardMaterial({ color: 0x465445, roughness: 0.95 });
  private readonly panel = document.createElement('div');
  private readonly status = document.createElement('div');
  private readonly detail = document.createElement('div');
  private readonly reticle = document.createElement('div');
  private readonly abort = new AbortController();
  private position = { x: 0, z: 0 };
  private weapon: WeaponId = 'pistol';
  private arsenal: Arsenal | null = null;
  private aim = false;
  private firing = false;
  private lastMove = 0;
  private lastShot = 0;
  private yaw = 0;
  private note = 'Checking account…';
  private disposed = false;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private ready = false;
  private acceptedShots = 0;
  private acceptedActions = 0;
  private acceptedRewards = 0;
  private readonly fireEvents = new Set<string>();
  private readonly meleeEvents = new Set<string>();
  private readonly reloadEvents = new Set<string>();
  private previousHp = 100;

  constructor(private readonly scene: THREE.Scene, private readonly camera: THREE.PerspectiveCamera, private readonly canvas: HTMLCanvasElement, code: string) {
    const normalized = validateRoomCode(code);
    const ground = new THREE.Mesh(this.groundGeometry, this.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(100, 0, 100);
    ground.receiveShadow = true;
    this.world.add(ground);
    for (const o of OBSTACLES) {
      const mesh = new THREE.Mesh(this.box, this.obstacleMaterial);
      mesh.position.set(o.x + 100, o.h / 2, o.z + 100);
      mesh.scale.set(o.w, o.h, o.d);
      mesh.castShadow = mesh.receiveShadow = true;
      this.world.add(mesh);
    }
    scene.add(this.world, this.avatar.root);
    this.loadAvatar(this.avatar);
    this.panel.style.cssText = 'position:fixed;top:12px;left:12px;z-index:10000;background:#14211de8;color:#e7f4e8;padding:14px;max-width:360px;font:14px system-ui;border:1px solid #75917b;border-radius:8px;line-height:1.5';
    const heading = document.createElement('strong'); heading.textContent = 'NEXTGEN · AUTHORITATIVE CO-OP';
    const controls = document.createElement('div'); controls.textContent = 'Click field · WASD / Shift · RMB aim · LMB shoot · 1/2 weapons · R reload · F melee · H bandage · X Pulse · Enter respawn';
    const exit = document.createElement('a'); exit.href = '/'; exit.textContent = 'Return to account menu'; exit.style.color = '#bde5cf';
    this.panel.append(heading, this.status, this.detail, controls, exit);
    document.body.append(this.panel);
    this.reticle.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9999;color:#e9f4d7;font:24px monospace;pointer-events:none;display:none';
    this.reticle.textContent = '+';
    document.body.append(this.reticle);
    this.net.onEvent = this.onEvent;
    const signal = this.abort.signal;
    canvas.addEventListener('click', () => { if (this.isReady() && document.pointerLockElement !== canvas) { try { void Promise.resolve(canvas.requestPointerLock()).catch(() => {}); } catch {} } }, { signal });
    canvas.addEventListener('contextmenu', e => e.preventDefault(), { signal });
    window.addEventListener('keydown', this.keyDown, { signal });
    window.addEventListener('keyup', e => this.keyboard.keyUp(e.code), { signal });
    window.addEventListener('mousedown', this.mouseDown, { signal });
    window.addEventListener('mouseup', e => { if (e.button === 0) this.firing = false; if (e.button === 2) this.aim = false; }, { signal });
    document.addEventListener('mousemove', e => { if (this.locked()) this.follow.rotate(e.movementX, e.movementY); }, { signal });
    document.addEventListener('pointerlockchange', () => { if (!this.locked()) this.resetInput(); }, { signal });
    window.addEventListener('blur', this.resetInput, { signal });
    document.addEventListener('visibilitychange', this.resetInput, { signal });
    if (normalized) void this.connect(normalized); else this.note = 'Invalid room code (3–12 letters or numbers).';
  }

  private loadAvatar(avatar: PlayerAvatar) {
    void avatar.loadModel(`${import.meta.env.BASE_URL}models/nextgen/${characterSkinFile('survivor', 'classic')}`).catch(() => {});
  }
  private async connect(code: string) {
    try {
      const res = await fetch('/api/account/me', { credentials: 'same-origin', signal: this.abort.signal });
      if (!res.ok) { this.note = 'Login through the account menu first, then reopen this room URL.'; return; }
      if (this.disposed) return;
      this.note = `Connecting to ${code}…`;
      this.net.connect(code);
      this.timeout = setTimeout(() => { if (!this.ready) { this.net.disconnect(); this.note = 'Room connection timed out. Reload to retry.'; } }, 12000);
    } catch { if (!this.disposed) this.note = 'Account API unavailable. Use the local Wrangler Worker.'; }
  }
  private readonly onEvent = (event: RoomEvent) => {
    switch (event.type) {
      case 'welcome': this.note = `Joined ${event.code}; waiting for authoritative snapshot…`; break;
      case 'snapshot': {
        const me = this.net.self;
        if (!me) break;
        if (!this.ready) { this.position = { x: me.x, z: me.z }; this.ready = true; this.lastMove = performance.now(); clearTimeout(this.timeout); this.note = 'Server connected.'; }
        if (me.hp <= 0 || Math.hypot(me.x - this.position.x, me.z - this.position.z) > 1.2) this.position = { x: me.x, z: me.z };
        break;
      }
      case 'correction': this.position = { x: event.x, z: event.z }; break;
      case 'respawn': this.position = { x: event.x, z: event.z }; this.note = 'Respawn accepted.'; break;
      case 'arsenal': this.arsenal = event.arsenal; break;
      case 'shot': this.fireEvents.add(event.by); this.acceptedShots++; if (event.by === this.net.id) this.note = event.hit ? 'Server-confirmed HIT' : 'Server-confirmed shot'; break;
      case 'action': this.acceptedActions++; if (event.action === 'melee') this.meleeEvents.add(event.by); if (event.by === this.net.id) this.note = `Server accepted ${event.action}.`; break;
      case 'reward': this.acceptedRewards++; this.note = `Server reward: +${event.xp} XP · +${event.creatureXp} creature XP`; break;
      case 'error': this.note = this.net.connected ? event.message : 'Connection unavailable/disconnected. Reload to retry.'; if (!this.net.connected) { this.ready = false; this.resetInput(); } break;
    }
  };
  private locked() { return document.pointerLockElement === this.canvas; }
  private isReady() { return this.ready && this.net.connected && !!this.net.self; }
  private alive() { return this.isReady() && (this.net.self?.hp ?? 0) > 0; }
  private readonly resetInput = () => { this.keyboard.reset(); this.aim = this.firing = false; };
  private readonly keyDown = (e: KeyboardEvent) => {
    if (!this.locked() || !this.isReady()) return;
    if (e.code === 'Enter' && !e.repeat && !this.alive()) { this.net.send('restart'); return; }
    if (!this.alive()) return;
    if (this.keyboard.keyDown(e.code, e.repeat)) { e.preventDefault(); return; }
    if (e.repeat) return;
    switch (e.code) {
      case 'Digit1': this.weapon = 'pistol'; break;
      case 'Digit2': this.weapon = 'rifle'; break;
      case 'KeyR': this.net.send('reload', { weapon: this.weapon }); break;
      case 'KeyF': this.net.send('attack'); break;
      case 'KeyH': this.net.send('heal'); break;
      case 'KeyX': if (this.net.self?.creatureOwned) this.net.send('pulse'); else this.note = 'Pulse requires a cloud-owned bonded creature.'; break;
    }
  };
  private readonly mouseDown = (e: MouseEvent) => {
    if (!this.locked() || !this.alive()) return;
    if (e.button === 2) this.aim = true;
    if (e.button === 0 && this.aim) { this.firing = true; this.shoot(performance.now()); }
  };
  private shoot(now: number) {
    if (now - this.lastShot < WEAPONS[this.weapon].interval) return;
    this.lastShot = now;
    this.net.send('shoot', { weapon: this.weapon, direction: roomDirection(this.yaw, this.follow.getAimPitch()) });
  }
  private syncAvatar(avatar: PlayerAvatar, p: RemotePlayer, dt: number, pos = { x: p.x, z: p.z }, yaw = p.yaw) {
    const next = roomToScene(pos.x, pos.z);
    const speed = dt > 0 ? Math.min(9, Math.hypot(next[0] - avatar.root.position.x, next[2] - avatar.root.position.z) * 1000 / dt) : 0;
    avatar.setEquipment(p.weapon === 'rifle' ? 'rifle' : 'pistol', 'rifle', false, false);
    avatar.update({ position: next, facing: [-Math.sin(yaw), 0, -Math.cos(yaw)] });
    avatar.animate(dt, { speed: p.hp > 0 ? speed : 0, sprinting: !!p.sprinting, airborne: false, dodging: false, aiming: !!p.aiming, aimPitch: p.pitch, shoot: this.fireEvents.has(p.id), melee: this.meleeEvents.has(p.id), reload: (p.reloadProgress ?? 0) > 0 && !this.reloadEvents.has(p.id), healing: !!p.survival?.healEndsAt, hit: p.id === this.net.id && p.hp < this.previousHp, dead: p.hp <= 0 });
    if ((p.reloadProgress ?? 0) > 0) this.reloadEvents.add(p.id); else this.reloadEvents.delete(p.id);
  }
  present(dt: number) {
    if (this.disposed) return;
    const now = performance.now();
    const me = this.net.self;
    if (this.isReady() && me) {
      const orientation = this.follow.getOrientation();
      this.yaw = Math.atan2(-orientation.front[0], -orientation.front[2]);
      if (now - this.lastMove >= 65) {
        const input = this.keyboard.read();
        const sprint = !!input.sprint && !this.aim && !!me.survival && canSprint(me.survival);
        if (this.alive() && this.locked()) {
          this.position = roomMove(this.position, input.forward, input.strafe, this.yaw, sprint, now - this.lastMove);
          this.net.send('move', { ...this.position, yaw: this.yaw, pitch: this.follow.getAimPitch(), aiming: this.aim, sprinting: sprint, weapon: this.weapon });
        }
        this.lastMove = now;
      }
      if (this.alive() && this.locked() && this.aim && this.firing && WEAPONS[this.weapon].automatic) this.shoot(now);
      this.net.updateVisuals();
      this.syncAvatar(this.avatar, { ...me, weapon: this.weapon, aiming: this.aim, pitch: this.follow.getAimPitch() }, dt, this.position, this.yaw);
      this.previousHp = me.hp;
      for (const [id, p] of this.net.peers) {
        let avatar = this.peers.get(id);
        if (!avatar) { avatar = new PlayerAvatar(); this.peers.set(id, avatar); this.scene.add(avatar.root); this.loadAvatar(avatar); }
        this.syncAvatar(avatar, p, dt);
      }
      for (const [id, a] of this.peers) if (!this.net.peers.has(id)) { a.dispose(); a.root.removeFromParent(); this.peers.delete(id); this.reloadEvents.delete(id); }
      const current = new Set<string>();
      for (const enemy of this.net.horde?.enemies ?? []) {
        current.add(enemy.id);
        let mesh = this.enemies.get(enemy.id);
        if (!mesh) { mesh = new THREE.Mesh(this.geometry, this.enemyMaterial); this.enemies.set(enemy.id, mesh); this.world.add(mesh); }
        mesh.position.set(enemy.x + 100, 0.85, enemy.z + 100); mesh.visible = enemy.hp > 0;
      }
      for (const [id, mesh] of this.enemies) if (!current.has(id)) { mesh.removeFromParent(); this.enemies.delete(id); }
    } else { for (const a of this.peers.values()) a.root.visible = false; for (const e of this.enemies.values()) e.visible = false; }
    this.fireEvents.clear(); this.meleeEvents.clear();
    const p = roomToScene(this.position.x, this.position.z);
    const pose = this.follow.update(dt, p, { heightAt: () => 0 }, this.aim);
    this.camera.position.set(...pose.position); this.camera.lookAt(...pose.target); this.camera.fov = pose.fov; this.camera.updateProjectionMatrix();
    this.status.textContent = this.isReady() ? `Room ${this.net.code} · ${this.net.peers.size + 1}/4 · HP ${me?.hp} · Wave ${this.net.horde?.wave ?? '–'}` : 'Not connected';
    this.reticle.style.display = this.alive() && this.locked() && this.aim ? 'block' : 'none';
    const ammo = this.arsenal?.[this.weapon];
    this.detail.textContent = `${this.weapon.toUpperCase()} ${ammo ? `${ammo.magazine}/${ammo.reserve}` : '–'} · Bandages ${me?.survival?.bandages ?? '–'} · ${this.note}`;
  }
  getInfo() {
    return { connected: this.isReady(), room: this.net.code, id: this.net.id, peers: [...this.net.peers.keys()], self: this.net.self, horde: this.net.horde, arsenal: this.arsenal, acceptedShots: this.acceptedShots, acceptedActions: this.acceptedActions, acceptedRewards: this.acceptedRewards };
  }
  dispose() {
    this.disposed = true; this.abort.abort(); clearTimeout(this.timeout); this.net.disconnect(); this.resetInput();
    if (this.locked()) document.exitPointerLock();
    this.avatar.dispose(); this.avatar.root.removeFromParent();
    for (const a of this.peers.values()) { a.dispose(); a.root.removeFromParent(); }
    this.peers.clear(); this.enemies.clear(); this.world.removeFromParent();
    this.geometry.dispose(); this.enemyMaterial.dispose(); this.box.dispose(); this.obstacleMaterial.dispose(); this.groundGeometry.dispose(); this.groundMaterial.dispose(); this.panel.remove(); this.reticle.remove();
  }
}
