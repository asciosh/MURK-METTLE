import * as THREE from 'three/webgpu';
import { Multiplayer, type RoomEvent, type RemotePlayer, type MissionState } from '../../client/game/Multiplayer';
import { OBSTACLES, WEAPONS, CREATURES, creaturePower, type Arsenal, type WeaponId } from '../../../shared/expansion.mjs';
import type { CollectionState } from '../../../shared/collection.mjs';
import { MISSION_KILLS, MISSION_SALVAGE } from '../../../shared/coop-rules.mjs';
import { canSprint } from '../../../shared/survival.mjs';
import { KeyboardInput } from '../core/KeyboardInput';
import { ThirdPersonCamera } from '../core/ThirdPersonCamera';
import { PlayerAvatar } from '../core/PlayerAvatar';
import { characterSkinFile } from '../core/CharacterSkins';
import { roomDirection, roomMove, roomToScene, validateRoomCode } from '../core/RoomIntent';
import { InfectedModelPool } from '../core/InfectedModel';
import { RoomInfectedView } from '../core/RoomInfectedView';
import { RoomShotEffects } from '../core/RoomShotEffects';
import { roomAimDirection, smoothRoomPosition } from '../core/RoomPresentation';
import { CombatFeedback } from '../core/CombatFeedback';
import { RoomCompanionView } from '../core/RoomCompanionView';
import { RoomFieldView } from '../core/RoomFieldView';
import { fieldIntent, nearestFieldTarget, nextOwnedSpecies, roomFieldTargets } from '../core/RoomFieldRules';

/** Explicit co-op sandbox. No PlayableSession, local horde, loot or damage simulation. */
export class OnlineSession {
  private readonly net = new Multiplayer();
  private readonly keyboard = new KeyboardInput();
  private readonly follow = new ThirdPersonCamera();
  private readonly world = new THREE.Group();
  private readonly avatar = new PlayerAvatar();
  private readonly peers = new Map<string, PlayerAvatar>();
  private readonly enemies = new Map<string, RoomInfectedView>();
  private readonly infectedPool = new InfectedModelPool();
  private readonly effects = new RoomShotEffects();
  private readonly feedback = new CombatFeedback();
  private readonly companions = new Map<string, RoomCompanionView>();
  private readonly pendingPulses = new Map<string, number>();
  private readonly field = new RoomFieldView();
  private collection: CollectionState | null = null;
  private mission: MissionState | null = null;
  private inventory: { scrap: number; fiber: number; spore: number } | null = null;
  private inventoryRevision = 0;
  private readonly geometry = new THREE.CapsuleGeometry(0.32, 1.05, 4, 8);
  private readonly enemyMaterial = new THREE.MeshStandardMaterial({ color: 0x864740 });
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0x555b50 });
  private readonly groundGeometry = new THREE.PlaneGeometry(200, 200);
  private readonly groundMaterial = new THREE.MeshStandardMaterial({ color: 0x465445, roughness: 0.95 });
  private readonly panel = document.createElement('div');
  private readonly status = document.createElement('div');
  private readonly detail = document.createElement('div');
  private readonly objectives = document.createElement('div');
  private readonly creatureStatus = document.createElement('div');
  private readonly interaction = document.createElement('div');
  private readonly inventoryStatus = document.createElement('div');
  private readonly reticle = document.createElement('div');
  private readonly abort = new AbortController();
  private position = { x: 0, z: 0 };
  private visualPosition = { x: 0, z: 0 };
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
  private confirmedHits = 0;
  private acceptedActions = 0;
  private acceptedPulses = 0;
  private acceptedRewards = 0;
  private readonly fireEvents = new Set<string>();
  private readonly meleeEvents = new Set<string>();
  private readonly reloadEvents = new Set<string>();
  private readonly previousHp = new Map<string, number>();

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
    scene.add(this.world, this.avatar.root, this.effects.root, this.feedback.root, this.field.root);
    this.loadAvatar(this.avatar);
    void this.infectedPool.load(`${import.meta.env.BASE_URL}models/nextgen/${characterSkinFile('infected', 'classic')}`);
    this.panel.style.cssText = 'position:fixed;top:12px;left:12px;z-index:10000;background:#14211de8;color:#e7f4e8;padding:14px;max-width:360px;font:14px system-ui;border:1px solid #75917b;border-radius:8px;line-height:1.5';
    const heading = document.createElement('strong'); heading.textContent = 'NEXTGEN · AUTHORITATIVE CO-OP';
    const controls = document.createElement('div'); controls.textContent = 'Click field · WASD / Shift · RMB aim · LMB shoot · 1/2 weapons · R reload · F melee · H bandage · E interact · C cycle owned creature · X Pulse · Enter respawn';
    this.interaction.style.color = '#eacb8a';
    this.interaction.style.fontWeight = '700';
    const exit = document.createElement('a'); exit.href = '/'; exit.textContent = 'Return to account menu'; exit.style.color = '#bde5cf';
    this.panel.append(heading, this.status, this.detail, this.creatureStatus, this.inventoryStatus, this.objectives, this.interaction, controls, exit);
    document.body.append(this.panel);
    this.reticle.style.cssText = 'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9999;color:#e9f4d7;font:24px monospace;pointer-events:none;display:none';
    this.reticle.textContent = '+';
    document.body.append(this.reticle);
    this.net.onEvent = this.onEvent;
    const signal = this.abort.signal;
    canvas.addEventListener('click', () => { this.feedback.unlockAudio(); if (this.isReady() && document.pointerLockElement !== canvas) { try { void Promise.resolve(canvas.requestPointerLock()).catch(() => {}); } catch {} } }, { signal });
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
  private async refreshInventory() {
    const revision = ++this.inventoryRevision;
    try {
      const response = await fetch('/api/account/coop-state', { credentials: 'same-origin', signal: this.abort.signal });
      if (!response.ok) return;
      const data = await response.json();
      const inventory = data.inventory;
      if (!this.disposed && revision === this.inventoryRevision && inventory && [inventory.scrap, inventory.fiber, inventory.spore].every(n => Number.isInteger(n) && n >= 0 && n <= 20)) this.inventory = { scrap: inventory.scrap, fiber: inventory.fiber, spore: inventory.spore };
    } catch { /* Account state stays at the most recent confirmed read. */ }
  }
  private readonly onEvent = (event: RoomEvent) => {
    switch (event.type) {
      case 'welcome': this.note = `Joined ${event.code}; waiting for authoritative snapshot…`; void this.refreshInventory(); break;
      case 'snapshot': {
        const me = this.net.self;
        if (!me) break;
        if (!this.ready) { this.position = { x: me.x, z: me.z }; this.visualPosition = { ...this.position }; this.ready = true; this.lastMove = performance.now(); clearTimeout(this.timeout); this.note = 'Server connected.'; }
        if (me.hp <= 0 || Math.hypot(me.x - this.position.x, me.z - this.position.z) > 1.2) this.position = { x: me.x, z: me.z };
        break;
      }
      case 'correction': this.position = { x: event.x, z: event.z }; this.visualPosition = { ...this.position }; break;
      case 'respawn': this.position = { x: event.x, z: event.z }; this.visualPosition = { ...this.position }; this.note = 'Respawn accepted.'; break;
      case 'arsenal': this.arsenal = event.arsenal; break;
      case 'collection-state': this.collection = event.collection; if (event.bonded) this.note = `Bond confirmed: ${CREATURES[event.collection.active].name}`; break;
      case 'mission-state': if (this.mission && event.salvage > this.mission.salvage) this.note = 'Team sample recovered.'; this.mission = event; break;
      case 'mission-extracted': this.note = `Team extraction confirmed. Expedition ${event.completed}.`; break;
      case 'mission-reward': this.note = `Expedition reward: +${event.xp} XP`; void this.refreshInventory(); break;
      case 'shot': this.fireEvents.add(event.by); this.acceptedShots++; if (event.hit) this.confirmedHits++; if (this.effects.show(event)) this.feedback.sound(event.weapon === 'rifle' ? 'rifle-shot' : 'shot'); if (event.by === this.net.id) this.note = event.hit ? 'Server-confirmed HIT' : 'Server-confirmed shot'; break;
      case 'action': this.acceptedActions++; if (event.action === 'melee') { this.meleeEvents.add(event.by); this.feedback.sound('swing'); } else { this.acceptedPulses++; this.pendingPulses.set(event.by, performance.now()); this.feedback.sound('pulse'); } if (event.by === this.net.id) this.note = `Server accepted ${event.action}.`; break;
      case 'reward': this.acceptedRewards++; this.note = event.duplicate ? 'Server reward already recorded.' : `Server reward: +${event.xp} XP · +${event.creatureXp} creature XP${event.material ? ' · ' + event.material : ''}`; void this.refreshInventory(); break;
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
      case 'KeyE': {
        const me = this.net.self;
        const target = me ? nearestFieldTarget(me, roomFieldTargets(this.collection, this.mission)) : null;
        const intent = target ? fieldIntent(target) : null;
        if (intent) { this.net.send(intent.type, intent.body); this.note = `Requested: ${target!.label}`; }
        else this.note = 'Move closer to a field marker.';
        break;
      }
      case 'KeyC': {
        const species = nextOwnedSpecies(this.collection);
        if (species) this.net.send('select-creature', { species }); else this.note = 'Bond with another creature to cycle companions.';
        break;
      }
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
    const orientation = this.follow.getOrientation();
    const yaw = Math.atan2(-orientation.front[0], -orientation.front[2]);
    const view = roomDirection(yaw, this.follow.getAimPitch());
    const camera = { x: this.camera.position.x - 100, y: this.camera.position.y, z: this.camera.position.z - 100 };
    const direction = roomAimDirection(this.position, camera, view, WEAPONS[this.weapon].range, this.net.horde?.enemies ?? []);
    this.net.send('shoot', { weapon: this.weapon, direction });
  }
  private syncAvatar(avatar: PlayerAvatar, p: RemotePlayer, dt: number, pos = { x: p.x, z: p.z }, yaw = p.yaw) {
    const next = roomToScene(pos.x, pos.z);
    const initial = !this.previousHp.has(p.id);
    const speed = !initial && dt > 0 ? Math.min(9, Math.hypot(next[0] - avatar.root.position.x, next[2] - avatar.root.position.z) * 1000 / dt) : 0;
    const damaged = p.hp < (this.previousHp.get(p.id) ?? p.hp);
    if (damaged && p.id === this.net.id) this.feedback.damage();
    this.previousHp.set(p.id, p.hp);
    avatar.setEquipment(p.weapon === 'rifle' ? 'rifle' : 'pistol', 'rifle', false, false);
    avatar.update({ position: next, facing: [-Math.sin(yaw), 0, -Math.cos(yaw)] });
    avatar.animate(dt, { speed: p.hp > 0 ? speed : 0, sprinting: !!p.sprinting, airborne: false, dodging: false, aiming: !!p.aiming, aimPitch: p.pitch, shoot: this.fireEvents.has(p.id), melee: this.meleeEvents.has(p.id), reload: (p.reloadProgress ?? 0) > 0 && !this.reloadEvents.has(p.id), healing: !!p.survival?.healEndsAt, hit: damaged, dead: p.hp <= 0 });
    if ((p.reloadProgress ?? 0) > 0) this.reloadEvents.add(p.id); else this.reloadEvents.delete(p.id);
  }
  private syncCompanion(owner: RemotePlayer, dt: number, position = { x: owner.x, z: owner.z }, yaw = owner.yaw) {
    if (!owner.creatureOwned || !owner.species) {
      this.companions.get(owner.id)?.dispose(); this.companions.delete(owner.id);
      return;
    }
    let view = this.companions.get(owner.id);
    if (!view) { view = new RoomCompanionView(this.scene, owner.species); this.companions.set(owner.id, view); }
    view.update({ ...position, yaw, hp: owner.hp }, owner.species, owner.creatureXp ?? 0, dt);
    const at = this.pendingPulses.get(owner.id);
    if (at !== undefined) { if (performance.now() - at < 2000) view.pulse(owner); this.pendingPulses.delete(owner.id); }
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
      this.visualPosition = smoothRoomPosition(this.visualPosition, this.position, dt);
      this.syncAvatar(this.avatar, { ...me, weapon: this.weapon, aiming: this.aim, pitch: this.follow.getAimPitch() }, dt, this.visualPosition, this.yaw);
      this.syncCompanion(me, dt, this.visualPosition, this.yaw);
      for (const [id, p] of this.net.peers) {
        let avatar = this.peers.get(id);
        if (!avatar) { avatar = new PlayerAvatar(); this.peers.set(id, avatar); this.scene.add(avatar.root); this.loadAvatar(avatar); }
        this.syncAvatar(avatar, p, dt);
        this.syncCompanion(p, dt);
      }
      for (const [id, a] of this.peers) if (!this.net.peers.has(id)) { a.dispose(); a.root.removeFromParent(); this.peers.delete(id); this.reloadEvents.delete(id); this.previousHp.delete(id); }
      const current = new Set<string>();
      const living = [me, ...this.net.peers.values()].filter(p => p.hp > 0);
      for (const enemy of this.net.horde?.enemies ?? []) {
        current.add(enemy.id);
        let view = this.enemies.get(enemy.id);
        if (!view) { view = new RoomInfectedView(this.geometry, this.enemyMaterial); this.enemies.set(enemy.id, view); this.world.add(view.root); }
        view.update(enemy, dt, living, this.infectedPool);
      }
      for (const [id, view] of this.enemies) if (!current.has(id)) { view.dispose(); this.enemies.delete(id); }
      for (const [id, view] of this.companions) if (id !== me.id && !this.net.peers.has(id)) { view.dispose(); this.companions.delete(id); }
      this.field.update(roomFieldTargets(this.collection, this.mission), dt);
    } else { for (const a of this.peers.values()) a.root.visible = false; for (const e of this.enemies.values()) e.root.visible = false; for (const c of this.companions.values()) c.hide(); this.field.update([], dt); }
    for (const [id, at] of this.pendingPulses) if (now - at >= 2000) this.pendingPulses.delete(id);
    this.fireEvents.clear(); this.meleeEvents.clear();
    this.effects.update(dt); this.feedback.update(dt, null);
    const p = roomToScene(this.visualPosition.x, this.visualPosition.z);
    const pose = this.follow.update(dt, p, { heightAt: () => 0 }, this.aim);
    this.camera.position.set(...pose.position); this.camera.lookAt(...pose.target); this.camera.fov = pose.fov; this.camera.updateProjectionMatrix();
    this.status.textContent = this.isReady() ? `Room ${this.net.code} · ${this.net.peers.size + 1}/4 · HP ${me?.hp} · Wave ${this.net.horde?.wave ?? '–'}` : 'Not connected';
    this.reticle.style.display = this.alive() && this.locked() && this.aim ? 'block' : 'none';
    const ammo = this.arsenal?.[this.weapon];
    this.detail.textContent = `${this.weapon.toUpperCase()} ${ammo ? `${ammo.magazine}/${ammo.reserve}` : '–'} · Bandages ${me?.survival?.bandages ?? '–'} · Stamina ${Math.round(me?.survival?.stamina ?? 0)}${me?.survival?.healEndsAt ? ' · BANDAGING' : ''} · ${this.note}`;
    this.creatureStatus.textContent = me?.creatureOwned && me.species ? `Companion: ${creaturePower(me.species, me.creatureXp ?? 0).name} · ${me.creatureXp ?? 0} XP` : 'No bonded creature · find a green habitat marker';
    this.inventoryStatus.textContent = this.inventory ? `Cloud materials · Scrap ${this.inventory.scrap} · Fiber ${this.inventory.fiber} · Spore ${this.inventory.spore}` : 'Cloud materials: synchronizing…';
    this.objectives.textContent = this.mission ? `Team objective · Infected ${this.mission.kills}/${MISSION_KILLS} · Samples ${this.mission.salvage}/${MISSION_SALVAGE}${this.mission.ready ? ' · EXTRACTION READY' : ''}` : 'Waiting for team mission…';
    const target = this.alive() && me ? nearestFieldTarget(me, roomFieldTargets(this.collection, this.mission)) : null;
    this.interaction.textContent = target ? `E · ${target.label}` : this.isReady() && !this.alive() ? 'Downed: Enter to respawn (teammate revive not yet supported)' : '';
  }
  getInfo() {
    return { connected: this.isReady(), room: this.net.code, id: this.net.id, peers: [...this.net.peers.keys()], remotePlayers: [...this.net.peers.values()], self: this.net.self, horde: this.net.horde, arsenal: this.arsenal, collection: this.collection, mission: this.mission, inventory: this.inventory, fieldMarkers: this.field.info(), companionViews: [...this.companions].map(([id, view]) => ({ id, ...view.info() })), acceptedShots: this.acceptedShots, confirmedHits: this.confirmedHits, shotEffects: this.effects.count, infectedViews: [...this.enemies].map(([id, view]) => ({ id, ...view.info() })), acceptedActions: this.acceptedActions, acceptedPulses: this.acceptedPulses, acceptedRewards: this.acceptedRewards };
  }
  dispose() {
    this.disposed = true; this.abort.abort(); clearTimeout(this.timeout); this.net.disconnect(); this.resetInput();
    if (this.locked()) document.exitPointerLock();
    this.avatar.dispose(); this.avatar.root.removeFromParent();
    for (const a of this.peers.values()) { a.dispose(); a.root.removeFromParent(); }
    for (const view of this.enemies.values()) view.dispose();
    for (const view of this.companions.values()) view.dispose();
    this.companions.clear(); this.pendingPulses.clear(); this.field.dispose();
    this.peers.clear(); this.enemies.clear(); this.infectedPool.dispose(); this.effects.dispose(); this.feedback.dispose(); this.world.removeFromParent();
    this.geometry.dispose(); this.enemyMaterial.dispose(); this.box.dispose(); this.obstacleMaterial.dispose(); this.groundGeometry.dispose(); this.groundMaterial.dispose(); this.panel.remove(); this.reticle.remove();
  }
}
