import * as THREE from 'three/webgpu';
import { Multiplayer, type RoomEvent, type RemotePlayer, type MissionState } from '../../client/game/Multiplayer';
import { CREATURES, creaturePower, type Arsenal } from '../../../shared/expansion.mjs';
import { COMPANION_MODES } from '../../../shared/nextgen-companion-combat.mjs';
import { NEXTGEN_WEAPONS as WEAPONS, REVIVE_RULES, reviveInRange, type NextgenWeapon } from '../../../shared/nextgen-combat.mjs';
import type { CollectionState } from '../../../shared/collection.mjs';
import { MISSION_KILLS, MISSION_SALVAGE, EXTRACTION } from '../../../shared/coop-rules.mjs';
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
import { RoomSquadOverlay } from '../core/RoomSquadOverlay';
import { squadRoster, objectiveDisplay } from '../core/RoomSquadState.mjs';
import { PlayableHud } from './PlayableHud';
import { NEXTGEN_MAP, NEXTGEN_MAP_ID, NEXTGEN_TERRAIN_SEED } from '../../../shared/nextgen-terrain.mjs';
import { fieldIntent, nearestFieldTarget, nextOwnedSpecies, roomFieldTargets } from '../core/RoomFieldRules';

/** Explicit co-op sandbox. No PlayableSession, local horde, loot or damage simulation. */
export class OnlineSession {
  // 100ms authoritative horde ticks need more than one tick of jitter buffer.
  // Local player input and server damage are unaffected by this visual delay.
  private readonly net = new Multiplayer(190);
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
  private readonly pendingStrikes = new Map<string, { x: number; z: number; at: number }>();
  private readonly field = new RoomFieldView();
  private readonly squadOverlay = new RoomSquadOverlay();
  private readonly requestedRoom: string | null;
  private collection: CollectionState | null = null;
  private mission: MissionState | null = null;
  private inventory: { scrap: number; fiber: number; spore: number } | null = null;
  private inventoryRevision = 0;
  private accountXp: number|null = null;
  private accountExtractions: number|null = null;
  private readonly geometry = new THREE.CapsuleGeometry(0.32, 1.05, 4, 8);
  private readonly enemyMaterial = new THREE.MeshStandardMaterial({ color: 0x864740 });
  private readonly hud = new PlayableHud(true);
  private inventoryOpen = false;
  private readonly primaryByPlayer = new Map<string, 'rifle' | 'shotgun'>();
  private readonly abort = new AbortController();
  private position = { x: 0, z: 0 };
  private visualPosition = { x: 0, z: 0 };
  private weapon: NextgenWeapon = 'pistol';
  private arsenal: Arsenal | null = null;
  private aim = false;
  private firing = false;
  private lastMove = 0;
  private lastShot = 0;
  private lastHello = 0;
  private yaw = 0;
  private note = 'Checking account…';
  private disposed = false;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private ready = false;
  private acceptedShots = 0;
  private confirmedHits = 0;
  private acceptedActions = 0;
  private acceptedPulses = 0;
  private acceptedStrikes = 0;
  private acceptedAutoStrikes = 0;
  private acceptedRevives = 0;
  private acceptedResonantShots = 0;
  private acceptedShotgunShots = 0;
  private acceptedRewards = 0;
  private readonly fireEvents = new Set<string>();
  private readonly meleeEvents = new Set<string>();
  private readonly reloadEvents = new Set<string>();
  private readonly previousHp = new Map<string, number>();

  constructor(private readonly scene: THREE.Scene, private readonly camera: THREE.PerspectiveCamera, private readonly canvas: HTMLCanvasElement, code: string) {
    const normalized = validateRoomCode(code);
    this.requestedRoom = normalized;
    this.hud.setReconnectHandler(() => {
      if (this.disposed || !this.requestedRoom) return;
      this.ready=false; this.net.disconnect(); clearTimeout(this.timeout);
      this.note='Reconnecting to '+this.requestedRoom+'…';
      void this.connect(this.requestedRoom);
    });
    scene.add(this.world, this.avatar.root, this.effects.root, this.feedback.root, this.field.root);
    this.loadAvatar(this.avatar);
    void this.infectedPool.load(`${import.meta.env.BASE_URL}models/nextgen/${characterSkinFile('infected', 'classic')}`);
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
      this.net.connect(code,NEXTGEN_MAP_ID);
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
      if (!this.disposed && revision === this.inventoryRevision && Number.isSafeInteger(data.stats?.xp) && data.stats.xp >= 0) {
        this.accountXp=data.stats.xp;
        this.accountExtractions=Number.isSafeInteger(data.stats.extractions) ? data.stats.extractions : 0;
      }
      if (!this.disposed && revision === this.inventoryRevision && inventory && [inventory.scrap, inventory.fiber, inventory.spore].every(n => Number.isInteger(n) && n >= 0 && n <= 20)) this.inventory = { scrap: inventory.scrap, fiber: inventory.fiber, spore: inventory.spore };
    } catch { /* Account state stays at the most recent confirmed read. */ }
  }
  private readonly onEvent = (event: RoomEvent) => {
    switch (event.type) {
      case 'welcome': if(event.map!==NEXTGEN_MAP_ID){this.net.disconnect();this.note='NEXTGEN map mismatch. Restart the local Worker.';break;} this.note = `Joined ${event.code}; waiting for authoritative snapshot…`; this.net.send('nextgen-hello', { version: 1 }); this.lastHello = performance.now(); void this.refreshInventory(); break;
      case 'snapshot': {
        const me = this.net.self;
        if (!me) break;
        if (!this.ready) { this.position = { x: me.x, z: me.z }; this.visualPosition = { ...this.position }; this.ready = true; this.lastMove = performance.now(); clearTimeout(this.timeout); this.note = 'Server connected.'; }
        if (me.hp <= 0 || me.nextgen?.dodging || Math.hypot(me.x - this.position.x, me.z - this.position.z) > 1.2) this.position = { x: me.x, z: me.z };
        break;
      }
      case 'correction': this.position = { x: event.x, z: event.z }; this.visualPosition = { ...this.position }; break;
      case 'respawn': this.position = { x: event.x, z: event.z }; this.visualPosition = { ...this.position }; this.weapon = 'pistol'; if(this.net.id)this.primaryByPlayer.delete(this.net.id); this.inventoryOpen = false; this.note = 'Respawn accepted.'; break;
      case 'arsenal': this.arsenal = event.arsenal; break;
      case 'collection-state': this.collection = event.collection; if (event.bonded) this.note = `Bond confirmed: ${CREATURES[event.collection.active].name}`; break;
      case 'creature-captured': this.note = 'Wild Lanternkin captured and deployed! Its individual progress is saved in your collection.'; break;
      case 'capture-state': this.note = event.status==='started'?'Capture capsule deployed · hold position!':`Capture interrupted: ${event.reason??'cancelled'}. Capsule retained.`; break;
      case 'companion-status': this.note = event.message; break;
      case 'mission-state': if (this.mission && event.salvage > this.mission.salvage) this.note = 'Team sample recovered.'; this.mission = event; break;
      case 'mission-extracted':
        this.note=`Expedition ${event.completed} completed; verifying personal reward.`;
        this.hud.startExtraction(event.completed,this.alive());
        if (this.locked()) document.exitPointerLock();
        break;
      case 'mission-reward':
        this.note=`Expedition reward confirmed: +${event.xp} XP`;
        this.hud.confirmExtraction(event);
        this.accountXp=event.totals.xp;
        this.accountExtractions=event.completed;
        void this.refreshInventory();
        break;
      case 'shot': {
        this.fireEvents.add(event.by); this.acceptedShots++; if (event.hit) this.confirmedHits++;
        if (event.resonant) this.acceptedResonantShots++;
        if (event.nextgenWeapon === 'shotgun') this.acceptedShotgunShots++;
        for (const ray of event.pellets ?? [event]) this.effects.show({ ...ray, origin: event.origin, resonant: event.resonant });
        this.feedback.sound(event.nextgenWeapon === 'shotgun' ? 'shotgun-shot' : event.weapon === 'rifle' ? 'rifle-shot' : 'shot');
        if (event.by === this.net.id) this.note = event.hit ? 'Server-confirmed HIT' : 'Server-confirmed shot'; break;
      }
      case 'action': this.acceptedActions++; if (event.action === 'melee') { this.meleeEvents.add(event.by); this.feedback.sound('swing'); } else { this.acceptedPulses++; this.pendingPulses.set(event.by, performance.now()); this.feedback.sound('pulse'); } if (event.by === this.net.id) this.note = `Server accepted ${event.action}.`; break;
      case 'companion-strike': this.acceptedStrikes++; if(event.auto)this.acceptedAutoStrikes++; this.pendingStrikes.set(event.by, { x: event.x, z: event.z, at: performance.now() }); this.feedback.sound('punch'); break;
      case 'revive-state':
        if (event.status === 'completed') this.acceptedRevives++;
        if (event.by === this.net.id || event.target === this.net.id) {
          this.note = event.status === 'started' ? 'Reviving — stay still.' : event.status === 'completed' ? 'Teammate revived.' : `Revive cancelled: ${event.reason ?? 'interrupted'}.`;
          if (event.status === 'completed') this.feedback.sound('healed');
          if (event.status === 'started' && event.by === this.net.id) this.feedback.sound('bandage');
        }
        break;
      case 'reward': this.acceptedRewards++; this.note = event.duplicate ? 'Server reward already recorded.' : `Server reward: +${event.xp} XP · +${event.creatureXp} creature XP${event.material ? ' · ' + event.material : ''}`; void this.refreshInventory(); break;
      case 'error': if (event.message.includes('Party reward could not be credited')) this.hud.failExtraction(); this.note = this.net.connected ? event.message : 'Connection unavailable/disconnected. Reload to retry.'; if (!this.net.connected) { this.ready = false; this.resetInput(); } break;
    }
  };
  private locked() { return document.pointerLockElement === this.canvas; }
  private isReady() { return this.ready && this.net.connected && !!this.net.self; }
  private alive() { return this.isReady() && (this.net.self?.hp ?? 0) > 0; }
  private readonly resetInput = () => { this.keyboard.reset(); this.aim = this.firing = false; this.inventoryOpen = false; if (this.net.self?.nextgen?.revivingTarget) this.net.send('revive-cancel'); };
  private equip(weapon: NextgenWeapon) {
    if (weapon === 'shotgun' && !this.net.self?.nextgen) { this.note = 'Shotgun requires the NEXTGEN room extension.'; return; }
    this.weapon = weapon;
    if (this.net.self?.nextgen) this.net.send('nextgen-equip', { weapon });
  }
  private reviveTarget() {
    const me = this.net.self;
    if (!me?.nextgen || me.hp <= 0 || !me.survival?.bandages || me.nextgen.revivingTarget) return null;
    return [...this.net.peers.values()].filter(p => p.hp <= 0 && (p.nextgen?.downedMs ?? 0) >= REVIVE_RULES.duration && !p.nextgen?.reviveBy && reviveInRange(me, p,NEXTGEN_MAP)).sort((a,b) => Math.hypot(a.x-me.x,a.z-me.z)-Math.hypot(b.x-me.x,b.z-me.z))[0] ?? null;
  }
  private readonly keyDown = (e: KeyboardEvent) => {
    if (!this.locked() || !this.isReady()) return;
    if (e.code === 'Enter' && !e.repeat && !this.alive()) { this.net.send('restart'); return; }
    if (!this.alive()) return;
    if (e.code === 'KeyI' && !e.repeat) {
      this.inventoryOpen = !this.inventoryOpen;
      this.keyboard.reset(); this.aim = this.firing = false;
      if (this.net.self?.nextgen?.revivingTarget) this.net.send('revive-cancel');
      e.preventDefault(); return;
    }
    if (this.inventoryOpen) { e.preventDefault(); return; }
    // NEXTGEN-only actions: send intent, never invent movement or height locally.
    if (e.code === 'Space' || e.code === 'ControlLeft') {
      e.preventDefault();
      if (e.repeat || !this.net.self?.nextgen) return;
      if (e.code === 'Space') this.net.send('nextgen-jump');
      else {
        const movement = this.keyboard.read();
        const forward = movement.forward || (!movement.strafe ? 1 : 0);
        const x = -Math.sin(this.yaw) * forward + Math.cos(this.yaw) * movement.strafe;
        const z = -Math.cos(this.yaw) * forward - Math.sin(this.yaw) * movement.strafe;
        const length = Math.hypot(x,z) || 1;
        this.net.send('nextgen-dodge', { x:x/length, z:z/length });
      }
      return;
    }
    if (this.keyboard.keyDown(e.code, e.repeat)) { e.preventDefault(); return; }
    if (e.repeat) return;
    switch (e.code) {
      case 'Digit1': this.equip('pistol'); break;
      case 'Digit2': this.equip('rifle'); break;
      case 'Digit3': this.equip('shotgun'); break;
      case 'KeyR': this.net.send('reload', { weapon: this.weapon }); break;
      case 'KeyQ': if (this.net.self?.nextgen) this.net.send('nextgen-resonance'); break;
      case 'KeyG': if (this.net.self?.nextgen && this.net.self.creatureOwned) this.net.send('companion-strike'); else this.note = 'A bonded creature is required.'; break;
      case 'KeyV': { const t = this.reviveTarget(); if (t) this.net.send('revive', { target: t.id }); else this.note = 'No nearby revivable teammate or missing bandage.'; break; }
      case 'KeyF': this.net.send('attack'); break;
      case 'KeyH': this.net.send('heal'); break;
      case 'KeyE': {
        const me = this.net.self;
        if(me?.captureProgress!==null && me?.captureProgress!==undefined) {this.net.send('capture-cancel');break;}
        const target = me ? nearestFieldTarget(me, roomFieldTargets(this.collection, this.mission, me.captureAvailable === true)) : null;
        const intent = target ? fieldIntent(target) : null;
        if (intent) { this.net.send(intent.type, intent.body); this.note = `Requested: ${target!.label}`; }
        else if (me && this.mission && !this.mission.ready && Math.hypot(me.x-EXTRACTION.x,me.z-EXTRACTION.z)<=EXTRACTION.radius)
          this.note=`Extraction locked: ${this.mission.kills}/${MISSION_KILLS} kills, ${this.mission.salvage}/${MISSION_SALVAGE} samples.`;
        else this.note = 'Move closer to a field marker.';
        break;
      }
      case 'KeyC': {
        if (this.net.self?.creatureInstanceId) {
          const pet=this.net.self.nativeCompanion;
          if(!pet || pet.hp<=0) {this.note='Companion unavailable · recover at a supply cache.';break;}
          this.net.send('companion-mode',{mode:COMPANION_MODES[(COMPANION_MODES.indexOf(pet.mode)+1)%COMPANION_MODES.length]}); break;
        }
        const species = nextOwnedSpecies(this.collection);
        if (species) this.net.send('select-creature', { species }); else this.note = 'Bond with another creature to cycle companions.';
        break;
      }
      case 'KeyX': if (this.net.self?.creatureOwned) this.net.send('pulse'); else this.note = 'Pulse requires a cloud-owned bonded creature.'; break;
    }
  };
  private readonly mouseDown = (e: MouseEvent) => {
    if (!this.locked() || !this.alive() || this.inventoryOpen) return;
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
    const direction = roomAimDirection(this.position, camera, view, WEAPONS[this.weapon].range, this.net.horde?.enemies ?? [],true);
    this.net.send('shoot', { weapon: this.weapon, direction });
  }
  private syncAvatar(avatar: PlayerAvatar, p: RemotePlayer, dt: number, pos = { x: p.x, z: p.z }, yaw = p.yaw) {
    const next = roomToScene(pos.x, pos.z,true);
    next[1] += p.nextgen?.jumpHeight ?? 0;
    const initial = !this.previousHp.has(p.id);
    const speed = !initial && dt > 0 ? Math.min(9, Math.hypot(next[0] - avatar.root.position.x, next[2] - avatar.root.position.z) * 1000 / dt) : 0;
    const damaged = p.hp < (this.previousHp.get(p.id) ?? p.hp);
    if (damaged && p.id === this.net.id) this.feedback.damage();
    this.previousHp.set(p.id, p.hp);
    const weapon = p.nextgen?.weapon ?? (p.weapon === 'rifle' ? 'rifle' : 'pistol');
    if (weapon !== 'pistol') this.primaryByPlayer.set(p.id, weapon);
    avatar.setEquipment(weapon, this.primaryByPlayer.get(p.id) ?? null, !!p.nextgen?.transitioning, !!p.nextgen?.resonant);
    avatar.update({ position: next, facing: [-Math.sin(yaw), 0, -Math.cos(yaw)] });
    const reloading = weapon === 'shotgun' ? !!p.nextgen?.shotgun.reloadAt : (p.reloadProgress ?? 0) > 0;
    avatar.animate(dt, { speed: p.hp > 0 ? speed : 0, sprinting: !!p.sprinting, airborne: !!p.nextgen?.airborne, dodging: !!p.nextgen?.dodging, aiming: !!p.aiming, aimPitch: p.pitch, shoot: this.fireEvents.has(p.id), melee: this.meleeEvents.has(p.id), reload: reloading && !this.reloadEvents.has(p.id), healing: !!p.survival?.healEndsAt || !!p.nextgen?.revivingTarget, hit: damaged, dead: p.hp <= 0 });
    if (reloading) this.reloadEvents.add(p.id); else this.reloadEvents.delete(p.id);
  }
  private syncCompanion(owner: RemotePlayer, dt: number, position = { x: owner.x, z: owner.z }, yaw = owner.yaw) {
    if (!owner.creatureOwned || !owner.species) {
      this.companions.get(owner.id)?.dispose(); this.companions.delete(owner.id);
      return;
    }
    let view = this.companions.get(owner.id);
    if (!view) { view = new RoomCompanionView(this.scene, owner.species); this.companions.set(owner.id, view); }
    view.update({ ...position, yaw, hp: owner.hp }, owner.species, owner.creatureFormXp ?? owner.creatureXp ?? 0, dt, owner.nativeCompanion);
    const at = this.pendingPulses.get(owner.id);
    if (at !== undefined) { if (performance.now() - at < 2000) view.pulse(owner); this.pendingPulses.delete(owner.id); }
    const strike = this.pendingStrikes.get(owner.id);
    if (strike) { if (performance.now() - strike.at < 2000) view.strike(strike); this.pendingStrikes.delete(owner.id); }
  }
  present(dt: number) {
    if (this.disposed) return;
    const now = performance.now();
    const me = this.net.self;
    if (this.isReady() && me) {
      if (!me.nextgen && now - this.lastHello > 5000) { this.net.send('nextgen-hello', { version: 1 }); this.lastHello = now; }
      const orientation = this.follow.getOrientation();
      this.yaw = Math.atan2(-orientation.front[0], -orientation.front[2]);
      if (now - this.lastMove >= 65) {
        const input = this.inventoryOpen ? { forward: 0, strafe: 0, sprint: false } : this.keyboard.read();
        const sprint = !!input.sprint && !this.aim && !!me.survival && canSprint(me.survival);
        if (this.alive() && this.locked() && !this.inventoryOpen && !me.nextgen?.dodging) {
          this.position = roomMove(this.position, input.forward, input.strafe, this.yaw, sprint, now - this.lastMove,true);
          this.net.send('move', { ...this.position, yaw: this.yaw, pitch: this.follow.getAimPitch(), aiming: this.aim, sprinting: sprint, weapon: this.weapon === 'shotgun' ? 'rifle' : this.weapon, ...(me.nextgen ? { nextgenWeapon: this.weapon } : {}) });
        }
        this.lastMove = now;
      }
      if (this.alive() && this.locked() && !this.inventoryOpen && this.aim && this.firing && WEAPONS[this.weapon].automatic) this.shoot(now);
      this.net.updateVisuals();
      this.visualPosition = smoothRoomPosition(this.visualPosition, this.position, dt);
      this.syncAvatar(this.avatar, { ...me, weapon: this.weapon === 'shotgun' ? 'rifle' : this.weapon, aiming: this.aim, pitch: this.follow.getAimPitch() }, dt, this.visualPosition, this.yaw);
      this.syncCompanion(me, dt, this.visualPosition, this.yaw);
      for (const [id, p] of this.net.peers) {
        let avatar = this.peers.get(id);
        if (!avatar) { avatar = new PlayerAvatar(); this.peers.set(id, avatar); this.scene.add(avatar.root); this.loadAvatar(avatar); }
        this.syncAvatar(avatar, p, dt);
        this.syncCompanion(p, dt);
      }
      for (const [id, a] of this.peers) if (!this.net.peers.has(id)) { a.dispose(); a.root.removeFromParent(); this.peers.delete(id); this.reloadEvents.delete(id); this.previousHp.delete(id); this.primaryByPlayer.delete(id); }
      const current = new Set<string>();
      const livingPlayers = [me, ...this.net.peers.values()].filter(p => p.hp > 0);
      const living = [...livingPlayers, ...livingPlayers.flatMap(p=>p.nativeCompanion && p.nativeCompanion.hp>0 && p.nativeCompanion.mode!=='follow' ? [p.nativeCompanion] : [])];
      for (const enemy of this.net.horde?.enemies ?? []) {
        current.add(enemy.id);
        let view = this.enemies.get(enemy.id);
        if (!view) { view = new RoomInfectedView(this.geometry, this.enemyMaterial); this.enemies.set(enemy.id, view); this.world.add(view.root); }
        view.update(enemy, dt, living, this.infectedPool);
      }
      for (const [id, view] of this.enemies) if (!current.has(id)) { view.dispose(); this.enemies.delete(id); }
      for (const [id, view] of this.companions) if (id !== me.id && !this.net.peers.has(id)) { view.dispose(); this.companions.delete(id); }
      this.field.update(roomFieldTargets(this.collection, this.mission, this.net.self?.captureAvailable === true), dt, me.captureProgress??null);
    } else { for (const a of this.peers.values()) a.root.visible = false; for (const e of this.enemies.values()) e.root.visible = false; for (const c of this.companions.values()) c.hide(); this.field.update([], dt); }
    for (const [id, at] of this.pendingPulses) if (now - at >= 2000) this.pendingPulses.delete(id);
    for (const [id, strike] of this.pendingStrikes) if (now - strike.at >= 2000) this.pendingStrikes.delete(id);
    this.fireEvents.clear(); this.meleeEvents.clear();
    this.effects.update(dt); this.feedback.update(dt, null);
    const p = roomToScene(this.visualPosition.x, this.visualPosition.z,true);
    p[1] += me?.nextgen?.jumpHeight ?? 0;
    const pose = this.follow.update(dt, p, { heightAt: (x,z)=>NEXTGEN_MAP.heightAt(x-100,z-100) }, this.aim);
    this.camera.position.set(...pose.position); this.camera.lookAt(...pose.target); this.camera.fov = pose.fov; this.camera.updateProjectionMatrix();
    const squad=squadRoster(me, [...this.net.peers.values()]);
    this.squadOverlay.update(this.isReady() ? squad.slice(1) : [], this.camera, this.isReady()?roomFieldTargets(this.collection,this.mission,me?.captureAvailable === true):[], me);
    const objective=objectiveDisplay(this.mission, MISSION_KILLS, MISSION_SALVAGE);
    const ammo = this.weapon === 'shotgun' ? me?.nextgen?.shotgun : this.arsenal?.[this.weapon];
    const target = this.alive() && me ? nearestFieldTarget(me, roomFieldTargets(this.collection, this.mission, me.captureAvailable === true)) : null;
    const revive = this.reviveTarget();
    const horde = this.net.horde;
    this.hud.updateOnline({
      connected:this.isReady(), room:this.net.code ?? '–', roster:this.net.peers.size + (me?1:0),
      locked:this.locked(), inventoryOpen:this.inventoryOpen, alive:this.alive(), hp:me?.hp ?? 0,
      stamina:me?.survival?.stamina ?? 0, exhausted:!!me?.survival?.exhausted, sprinting:!!me?.sprinting,
      aiming:this.aim, weapon:this.weapon, magazine:ammo?.magazine ?? null, reserve:ammo?.reserve ?? null,
      reloading:this.weapon==='shotgun'?!!me?.nextgen?.shotgun.reloadAt:!!me?.reloadProgress,
      bandages:me?.survival?.bandages ?? 0, healing:!!me?.survival?.healEndsAt,
      wave:horde?.wave ?? 0, infected:horde?.enemies.length ?? 0,
      waveCountdown:horde?.nextWaveAt ? Math.max(0,horde.nextWaveAt-Date.now()) : 0,
      kills:this.mission?.kills ?? 0, samples:this.mission?.salvage ?? 0,
      killGoal:MISSION_KILLS, sampleGoal:MISSION_SALVAGE, extractionReady:!!this.mission?.ready,
      materials:this.inventory, accountXp:this.accountXp, accountExtractions:this.accountExtractions, arsenal:{pistol:this.arsenal?.pistol ?? null,rifle:this.arsenal?.rifle ?? null,shotgun:me?.nextgen?.shotgun ?? null},
      charge:me?.nextgen?.charge ?? 0, resonant:!!me?.nextgen?.resonant, transitioning:!!me?.nextgen?.transitioning,
      creature:me?.creatureOwned && me.species ? creaturePower(me.species,me.creatureFormXp ?? me.creatureXp ?? 0).name : null,
      creatureXp:me?.creatureXp ?? 0,
      nativeCompanion:me?.nativeCompanion,
      captureKit:me?.captureKit, captureProgress:me?.captureProgress??null,
      target:revive?'V · Revive teammate (1 bandage)':target?`E · ${target.label}`:this.note,
      note:this.note, reviveProgress:me?.nextgen?.revivingTarget ? me.nextgen.reviveProgress : null,
      downedSeconds:(me?.nextgen?.downedMs ?? 0)/1000, squad, objective:objective.label
    });
  }
  getPosition() { return this.visualPosition; }
  getLandscapeInfo() { return {style:NEXTGEN_MAP_ID,seed:NEXTGEN_TERRAIN_SEED,groundHeight:NEXTGEN_MAP.heightAt(0,0),position:this.avatar.root.position.toArray()}; }
  getInfo() {
    return { connected: this.isReady(), room: this.net.code, id: this.net.id, peers: [...this.net.peers.keys()], remotePlayers: [...this.net.peers.values()], self: this.net.self, horde: this.net.horde, arsenal: this.arsenal, collection: this.collection, mission: this.mission, inventory: this.inventory, fieldMarkers: this.field.info(), fieldVisuals: this.field.visualInfo(), inventoryOpen:this.inventoryOpen, companionViews: [...this.companions].map(([id, view]) => ({ id, ...view.info() })), acceptedShots: this.acceptedShots, confirmedHits: this.confirmedHits, shotEffects: this.effects.count, infectedViews: [...this.enemies].map(([id, view]) => ({ id, ...view.info() })), acceptedActions: this.acceptedActions, acceptedPulses: this.acceptedPulses, acceptedStrikes: this.acceptedStrikes, acceptedAutoStrikes:this.acceptedAutoStrikes, acceptedRevives: this.acceptedRevives, acceptedResonantShots: this.acceptedResonantShots, acceptedShotgunShots: this.acceptedShotgunShots, acceptedRewards: this.acceptedRewards, extraction:this.hud.getExtractionInfo(), accountXp:this.accountXp, accountExtractions:this.accountExtractions };
  }
  dispose() {
    this.disposed = true; this.abort.abort(); clearTimeout(this.timeout); this.net.disconnect(); this.resetInput();
    if (this.locked()) document.exitPointerLock();
    this.avatar.dispose(); this.avatar.root.removeFromParent();
    for (const a of this.peers.values()) { a.dispose(); a.root.removeFromParent(); }
    for (const view of this.enemies.values()) view.dispose();
    for (const view of this.companions.values()) view.dispose();
    this.companions.clear(); this.pendingPulses.clear(); this.pendingStrikes.clear(); this.field.dispose();
    this.peers.clear(); this.enemies.clear(); this.infectedPool.dispose(); this.effects.dispose(); this.feedback.dispose(); this.world.removeFromParent();
    this.geometry.dispose(); this.enemyMaterial.dispose(); this.hud.dispose();this.squadOverlay.dispose();this.primaryByPlayer.clear();
  }
}
