import { renderProfile, type QualityId } from '../../../shared/render-profile.mjs';
import { TouchControls } from './TouchControls';
import { journalEntry } from '../../../shared/collection.mjs';
import { progressStore } from './ProgressStore';
import { Firearms } from './Firearms';
import { Collection, emptyCollection, type CollectionState } from './Collection';
import { createAtmosphere } from './Atmosphere';
import { CombatFeedback } from './CombatFeedback';
import { SceneEffects } from './SceneEffects';
import {
  CREATURES,
  SPECIES_IDS,
  WEAPONS,
  creaturePower,
  evolutionStage,
  obstacleDistance,
  type SpeciesId,
} from '../../../shared/expansion.mjs';
import * as THREE from 'three';
import { InputController } from './InputController';
import { Player } from './Player';
import { readModelManifest, type ModelManifest } from './AnimationController';
import { World } from './World';
import { Minimap } from './Minimap';
import { InfectedGroup, infectedName } from './InfectedGroup';
import {
  SURVIVAL,
  newVitals,
  beginHealing,
  cancelHealing,
  stepVitals,
  refillVitals,
  alertHorde,
  bulletTarget,
  meleeTarget,
  pulseTargets,
  type Vitals,
  type Combatant,
} from '../../../shared/survival.mjs';
import { Companion } from './Companion';
import { Inventory, ITEM_DEFINITIONS, type ItemId } from './Inventory';
import { Loot } from './Loot';
import { Crafting } from './Crafting';
import { FieldInventoryUI } from './FieldInventoryUI';
import { Multiplayer, type RoomEvent } from './Multiplayer';
import { CoopProgress } from './CoopProgress';
import { CoopVisuals } from './CoopVisuals';
import {
  Expedition,
  EXTRACTION_X,
  EXTRACTION_Z,
  EXTRACTION_RADIUS,
  KILLS_REQUIRED,
  SALVAGE_REQUIRED,
} from './Expedition';
import {
  Progression,
  levelFromXp,
  xpInLevel,
  CREATURE_XP_PER_PULSE_HIT,
  CREATURE_XP_PER_PULSE_KILL,
} from './Progression';

export class Game {
  private readonly scene = new THREE.Scene();
  private readonly feedback = new CombatFeedback(this.scene);
  private renderDelta = 0;
  private effects: SceneEffects | null = null;
  private cinematic = false;
  private sky: ReturnType<typeof createAtmosphere> | null = null;
  private readonly mobileDevice = matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
  private quality: QualityId = 'balanced';
  private lastFrameAt = 0;
  private readonly touch: TouchControls;
  private environmentTarget: THREE.WebGLRenderTarget | null = null;
  private readonly sun = new THREE.DirectionalLight(0xffdfb5, 2.65);
  private readonly firearms: Firearms;
  private readonly collection: Collection;
  private coopCollection: CollectionState | null = null;
  private readonly wildCreatures = new Map<SpeciesId, Companion>();
  private readonly aimRay = new THREE.Raycaster();
  private collectionSignature = '';
  private trackedCreature: SpeciesId | null = null;
  private aiming = false;
  private evolutionTime = 0;

  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 350);
  private readonly renderer: THREE.WebGLRenderer;
  private assetManifest: ModelManifest = {};
  private readonly clock = new THREE.Clock();
  private fieldEntered = false;
  private readonly world: World;
  private readonly minimap = new Minimap();
  private readonly player: Player;
  private readonly input: InputController;
  private readonly infected: InfectedGroup;
  private vitals: Vitals = newVitals();
  private lastServerVitals: Vitals | null = null;
  private readonly soloTarget: Combatant = { id: 'solo', x: 0, z: 0, yaw: 0, hp: 100, hurtUntil: 0 };
  private wasCoop = false;
  private readonly companion: Companion;
  private readonly creaturePanel: HTMLElement | null;
  private readonly bondHint: HTMLElement | null;
  private readonly abilityButton: HTMLButtonElement | null;
  private abilityCooldown = 0;
  private readonly inventory = new Inventory();
  private readonly expedition = new Expedition();
  private readonly extractionBeacon = new THREE.Group();
  private readonly missionStatus: HTMLElement | null;
  private readonly missionKills: HTMLElement | null;
  private readonly missionSalvage: HTMLElement | null;
  private readonly missionTotal: HTMLElement | null;
  private readonly missionHint: HTMLElement | null;
  private readonly crafting = new Crafting(this.inventory);
  private readonly inventoryUI = new FieldInventoryUI(
    this.inventory,
    this.crafting,
    () => this.multiplayer.connected,
    () => {
      this.bondStrain = Math.max(0, this.bondStrain - 60);
      if (this.recoveringBond) this.antidotePending = true;
      this.updateCompanionHud();
    },
    (message) => this.showToast(message, 'success'),
  );
  private readonly multiplayer = new Multiplayer();
  private readonly coopProgress = new CoopProgress((recipe) => {
    if (recipe === 'restorative') {
      this.bondStrain = Math.max(0, this.bondStrain - 60);
      if (this.recoveringBond) this.antidotePending = true;
      this.updateCompanionHud();
    }
    this.multiplayer.send('sync-equipment');
  });
  private readonly coopVisuals = new CoopVisuals(this.scene);
  private roomMission: import('./Multiplayer').MissionState | null = null;
  private readonly roomStatus: HTMLElement | null;
  private readonly roomCode: HTMLInputElement | null;
  private networkTimer = 0;

  private antidotePending = false;

  private readonly drops: Loot[] = [];
  private dropSequence = 0;
  private readonly lootHint: HTMLElement | null;
  private readonly bondStrainFill: HTMLElement | null;
  private readonly bondStrainLabel: HTMLElement | null;
  private readonly radioPanel: HTMLElement | null;
  private readonly radioLine: HTMLElement | null;
  private radioTimer = 0;
  private radioIndex = 0;
  private bondStrain = 0;
  private recoveringBond = false;
  private readonly bondRetreatKey = 'murk-mettle-v05-bond-retreat';
  private readonly radioLines = {
    intro: 'Rook: Signal is clear. Mostly. Stay sharp out there.',
    bond: 'Rook: Look at that. It chose you. Try not to disappoint it.',
    pulse: 'Rook: That light leaves a trail. Watch the strain.',
    loot: 'Rook: If it glows and it is not trying to eat you, bag it.',
    lost: 'Rook: Bond signal lost. It is not gone forever. Find it.',
    recovered: 'Rook: Signal restored. Second chances are rare out here.',
    defeat: 'Rook: I am not writing your obituary. Get back up.',
  } as const;
  private readonly progression = new Progression();
  private readonly playerLevelText: HTMLElement | null;
  private readonly playerXpFill: HTMLElement | null;
  private readonly playerXpText: HTMLElement | null;
  private readonly creatureLevelText: HTMLElement | null;
  private readonly creatureXpFill: HTMLElement | null;
  private readonly creatureXpText: HTMLElement | null;
  private readonly killText: HTMLElement | null;
  private readonly positionElement: HTMLElement | null;
  private readonly playerHealthFill: HTMLElement | null;
  private readonly playerHealthText: HTMLElement | null;
  private readonly enemyPanel: HTMLElement | null;
  private readonly enemyHealthFill: HTMLElement | null;
  private readonly enemyHealthText: HTMLElement | null;
  private readonly enemyStateText: HTMLElement | null;
  private readonly combatToast: HTMLElement | null;
  private readonly damageFlash: HTMLElement | null;
  private readonly defeatOverlay: HTMLElement | null;

  private cameraYaw = 0;
  private cameraPitch = 0.2;
  private resizeObserver: ResizeObserver | null = null;
  private hudTimer = 0;
  private attackCooldown = 0;

  private toastTimer = 0;
  private damageFlashTimer = 0;
  private running = false;

  constructor(private readonly viewport: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(viewport.clientWidth, viewport.clientHeight, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'game-canvas';
    this.renderer.domElement.setAttribute('aria-label', '3D game view. Click to capture the mouse.');
    this.renderer.domElement.tabIndex = 0;
    this.viewport.prepend(this.renderer.domElement);

    this.scene.background = new THREE.Color(0xa6aea7);
    this.scene.fog = new THREE.FogExp2(0xa6aea7, 0.0065);
    this.createLighting();

    this.world = new World(this.scene);
    this.createExtractionBeacon();
    this.player = new Player(this.scene);
    this.infected = new InfectedGroup(this.scene, (position) => this.feedback.impact(position));
    this.companion = new Companion(this.scene);
    this.firearms = new Firearms(this.scene, this.player, this.feedback);
    this.collection = new Collection(this.progression.state);
    this.recoveringBond = progressStore.getItem(this.bondRetreatKey) === '1';
    for (const id of SPECIES_IDS) {
      const wild = new Companion(this.scene, id);
      this.wildCreatures.set(id, wild);
    }
    document.querySelector('#creature-roster')?.addEventListener('click', this.handleRosterClick);
    document.querySelector('#graphics-quality')?.addEventListener('change', this.handleGraphicsQuality);
    document.querySelector('#photo-materials')?.addEventListener('change', this.handlePhotoMaterials);
    let saved: { quality?: QualityId; photo?: boolean } = {};
    try {
      saved = JSON.parse(localStorage.getItem('murk-mettle-graphics') || '{}') || {};
    } catch {
      /* Defaults work without browser storage. */
    }
    const initialQuality = ['mobile', 'low', 'balanced', 'cinematic'].includes(saved.quality || '')
      ? saved.quality!
      : this.mobileDevice
        ? 'mobile'
        : 'balanced';
    this.setQuality(initialQuality);
    const photo = typeof saved.photo === 'boolean' ? saved.photo : !this.mobileDevice;
    const photoToggle = document.querySelector<HTMLInputElement>('#photo-materials');
    if (photoToggle) photoToggle.checked = photo;
    this.updatePhotoMaterials(photo);
    this.syncCollectionVisuals();
    void this.loadOptionalModels();
    if (this.progression.state.lanternkinBonded) {
      try {
        this.recoveringBond = progressStore.getItem(this.bondRetreatKey) === '1';
      } catch {
        /* Storage disabled. */
      }
      if (!this.recoveringBond) this.companion.bond();
    }
    this.missionStatus = document.querySelector('#mission-status');
    this.missionKills = document.querySelector('#mission-kills');
    this.missionSalvage = document.querySelector('#mission-salvage');
    this.missionTotal = document.querySelector('#mission-total');
    this.missionHint = document.querySelector('#mission-hint');
    this.roomStatus = document.querySelector('#room-status');
    this.roomCode = document.querySelector<HTMLInputElement>('#room-code');
    document.querySelector('#room-join')?.addEventListener('click', this.handleJoinRoom);
    document.querySelector('#room-leave')?.addEventListener('click', this.handleLeaveRoom);
    this.multiplayer.onEvent = this.onRoomEvent;
    this.input = new InputController(this.renderer.domElement, (locked) => {
      document.body.classList.toggle('is-pointer-locked', locked);
    });

    this.touch = new TouchControls(this.viewport, this.renderer.domElement, this.input);
    this.positionElement = document.querySelector<HTMLElement>('#player-position');
    this.playerLevelText = document.querySelector<HTMLElement>('#player-level');
    this.playerXpFill = document.querySelector<HTMLElement>('#player-xp-fill');
    this.playerXpText = document.querySelector<HTMLElement>('#player-xp-text');
    this.creatureLevelText = document.querySelector<HTMLElement>('#creature-level');
    this.creatureXpFill = document.querySelector<HTMLElement>('#creature-xp-fill');
    this.creatureXpText = document.querySelector<HTMLElement>('#creature-xp-text');
    this.killText = document.querySelector<HTMLElement>('#lifetime-kills');
    this.playerHealthFill = document.querySelector<HTMLElement>('#player-health-fill');
    this.playerHealthText = document.querySelector<HTMLElement>('#player-health-text');
    this.enemyPanel = document.querySelector<HTMLElement>('#enemy-panel');
    this.enemyHealthFill = document.querySelector<HTMLElement>('#enemy-health-fill');
    this.enemyHealthText = document.querySelector<HTMLElement>('#enemy-health-text');
    this.enemyStateText = document.querySelector<HTMLElement>('#enemy-state');
    this.combatToast = document.querySelector<HTMLElement>('#combat-toast');
    this.damageFlash = document.querySelector<HTMLElement>('#damage-flash');
    this.defeatOverlay = document.querySelector<HTMLElement>('#defeat-overlay');
    this.creaturePanel = document.querySelector<HTMLElement>('#creature-panel');
    this.bondHint = document.querySelector<HTMLElement>('#bond-hint');
    this.abilityButton = document.querySelector<HTMLButtonElement>('#ability-button');
    this.abilityButton?.addEventListener('click', this.handleAbilityClick);
    document.querySelector('#heal-button')?.addEventListener('click', this.handleHealClick);
    this.lootHint = document.querySelector<HTMLElement>('#loot-hint');
    this.bondStrainFill = document.querySelector<HTMLElement>('#bond-strain-fill');
    this.bondStrainLabel = document.querySelector<HTMLElement>('#bond-strain-label');
    this.radioPanel = document.querySelector<HTMLElement>('#radio-panel');
    this.radioLine = document.querySelector<HTMLElement>('#radio-line');
    this.updateInventoryHud();
    this.updateCraftingHud();
    this.say('intro');
    this.updateCompanionHud();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.viewport);
    this.resize();
    this.updateCamera(1);
    this.updateHud(1);
    this.updateProgressHud();
    this.updateMissionHud();
    this.showToast(
      this.touch.enabled
        ? 'TOUCH READY  //  Left thumb move · drag the view or FIRE to look · USE to interact.'
        : 'FIELD READY  //  RMB aim · LMB fire · R reload · E bond / resupply.',
      'info',
    );
  }

  private async loadOptionalModels(): Promise<void> {
    this.assetManifest = await readModelManifest();
    const models = this.assetManifest;
    if (models.survivor?.url) {
      void this.player.installModel(models.survivor);
      this.coopVisuals.installSurvivorModel(models.survivor);
    }
    if (models.zombie?.url) this.infected.installModel(models.zombie);
    if (models.lanternkin?.url) void this.companion.installModel(models.lanternkin);
  }

  private createLighting(): void {
    const sky = createAtmosphere();
    this.sky = sky;
    sky.material.uniforms.cloudLayers.value = this.mobileDevice ? 3 : 5;
    this.scene.add(sky);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const environment = new THREE.Scene();
    const environmentSky = sky.clone();
    environment.add(environmentSky);
    this.environmentTarget = pmrem.fromScene(environment, 0.06);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = 1.0;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xb8c7d1, 0x66604e, 2.15));
    const sun = this.sun;
    sun.position.set(-25, 35, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -35;
    sun.shadow.camera.right = 35;
    sun.shadow.camera.top = 35;
    sun.shadow.camera.bottom = -35;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 100;
    sun.shadow.bias = -0.00015;
    sun.shadow.normalBias = 0.025;
    this.scene.add(sun, sun.target);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.renderer.setAnimationLoop(this.tick);
  }

  enterField(): void {
    this.fieldEntered = true;
    this.touch.setActive(true);
  }

  requestMouseCapture(): void {
    this.input.requestCapture();
  }

  private readonly tick = (): void => {
    if (!this.running) return;
    const frameNow = performance.now();
    if (this.quality === 'mobile' && frameNow - this.lastFrameAt < 32) return;
    this.lastFrameAt = frameNow;
    if (!this.fieldEntered) {
      this.clock.getDelta(); // Do not accumulate a large first gameplay frame.
      this.renderScene();
      return;
    }
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05);
    this.renderDelta = deltaSeconds;
    this.feedback.update(deltaSeconds);
    this.evolutionTime = Math.max(0, this.evolutionTime - deltaSeconds);
    document.querySelector('#evolution-announcement')?.classList.toggle('visible', this.evolutionTime > 0);
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaSeconds);
    this.abilityCooldown = Math.max(0, this.abilityCooldown - deltaSeconds);
    this.toastTimer = Math.max(0, this.toastTimer - deltaSeconds);
    this.radioTimer = Math.max(0, this.radioTimer - deltaSeconds);
    this.radioPanel?.classList.toggle('visible', this.radioTimer > 0);
    for (const drop of this.drops) drop.update(deltaSeconds);
    this.extractionBeacon.rotation.y += deltaSeconds * 0.28;
    const beam = this.extractionBeacon.getObjectByName('extract-ring');
    if (beam) beam.scale.setScalar(1 + 0.055 * Math.sin(this.clock.elapsedTime * 2.2));
    // Low-strain resting is a deliberate choice, not an unlimited damage-free pulse.
    if (this.companion.isBound()) this.bondStrain = Math.max(0, this.bondStrain - deltaSeconds * 2.5);
    this.damageFlashTimer = Math.max(0, this.damageFlashTimer - deltaSeconds);

    const mouse = this.input.consumeMouseDelta();
    this.cameraYaw -= mouse.x * 0.0024;
    this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + mouse.y * 0.0018, -0.65, 0.95);

    const axes = this.input.getMovementAxes();
    const forward = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
    const movement = forward.multiplyScalar(axes.forward).addScaledVector(right, axes.right);
    if (movement.lengthSq() > 1) movement.normalize();
    if (this.player.getHealth() <= 0) movement.set(0, 0, 0);

    const moving = movement.lengthSq() > 0.0001;
    const sprintRequested = this.input.isSprinting() && !this.input.isAiming() && this.player.getHealth() > 0;
    const healed = stepVitals(this.vitals, deltaSeconds, Date.now(), { moving, sprint: sprintRequested });
    if (healed && !this.multiplayer.connected && this.player.getHealth() > 0) {
      this.player.heal(healed);
      this.showToast('BANDAGED  //  +40 vitality.', 'success');
      this.feedback.audio.play('heal');
    }
    this.aiming = this.input.isAiming() && this.player.getHealth() > 0;
    this.player.aiming = this.aiming;
    this.player.aimPitch = this.cameraPitch;
    this.player.weapon = this.firearms.selected;
    const gunState = this.firearms.arsenal[this.firearms.selected];
    this.player.reloading = gunState.reloadAt > Date.now();
    this.player.reloadProgress = this.player.reloading
      ? THREE.MathUtils.clamp(1 - (gunState.reloadAt - Date.now()) / WEAPONS[this.firearms.selected].reload, 0, 1)
      : 0;
    this.player.aimYaw = this.cameraYaw;
    this.player.bandaging = this.vitals.healEndsAt > Date.now();
    this.firearms.aiming = this.aiming;
    this.player.update(movement, deltaSeconds, this.vitals.sprinting, this.world);
    if (this.input.consumeSwapPressed())
      this.firearms.switchWeapon(this.firearms.selected === 'pistol' ? 'rifle' : 'pistol');
    const weapon = this.input.consumeWeaponPressed();
    if (weapon) this.firearms.switchWeapon(weapon === 1 ? 'pistol' : 'rifle');
    if (this.input.consumeCyclePressed()) this.cycleCreature();
    const pressed = this.input.consumeFirePressed();
    if (pressed || (WEAPONS[this.firearms.selected].automatic && this.input.isFiring())) this.handleShooting();
    this.firearms.update(deltaSeconds);
    this.world.update(deltaSeconds, this.player.getPosition());
    if (this.sky)
      this.sky.material.uniforms.cloudTime.value = (this.sky.material.uniforms.cloudTime.value + deltaSeconds) % 3600;
    this.updateWildCreatures(deltaSeconds);
    this.syncCollectionVisuals();
    if (this.multiplayer.connected) {
      this.networkTimer += deltaSeconds;
      if (this.networkTimer >= 0.065) {
        this.networkTimer = 0;
        const pos = this.player.getPosition();
        this.multiplayer.send('move', {
          x: pos.x,
          z: pos.z,
          yaw: this.player.root.rotation.y,
          aiming: this.aiming,
          pitch: this.cameraPitch,
          weapon: this.firearms.selected,
          sprinting: this.input.isSprinting() && !this.aiming,
        });
      }
      this.multiplayer.updateVisuals();
      this.coopVisuals.updatePlayers(this.multiplayer.peers, deltaSeconds);
      if (this.roomStatus && this.multiplayer.code)
        this.roomStatus.textContent = `Room ${this.multiplayer.code} · ${this.multiplayer.peers.size + 1}/4 players`;
      if (this.multiplayer.self?.survival && this.multiplayer.self.survival !== this.lastServerVitals) {
        this.lastServerVitals = this.multiplayer.self.survival;
        this.vitals = { ...this.lastServerVitals };
      }
      if (this.multiplayer.horde) this.infected.sync(this.multiplayer.horde, deltaSeconds);
    }

    this.companion.update(deltaSeconds, this.player.getPosition(), this.player.root.rotation.y, this.world);
    if (this.input.consumeInventoryPressed()) this.toggleInventory();
    if (this.input.consumeInteractPressed()) this.handleInteract();
    if (this.input.consumeAbilityPressed()) this.handleCreatureAbility();
    if (this.input.consumeHealPressed()) this.handleHealClick();
    if (this.input.consumeAttackPressed()) this.handlePlayerAttack();
    if (this.input.consumeRestartPressed()) {
      if (this.player.getHealth() <= 0) this.resetEncounter();
      else if (this.firearms.reload() && this.multiplayer.connected)
        this.multiplayer.send('reload', { weapon: this.firearms.selected });
    }

    if (!this.multiplayer.connected) {
      const position = this.player.getPosition();
      Object.assign(this.soloTarget, {
        x: position.x,
        z: position.z,
        yaw: this.player.root.rotation.y,
        hp: this.player.getHealth(),
        sprinting: this.vitals.sprinting,
      });
      const hits = this.infected.stepSolo(this.soloTarget, deltaSeconds, Date.now());
      for (const hit of hits) {
        this.player.takeDamage(hit.damage);
        cancelHealing(this.vitals);
        this.damageFlashTimer = 0.2;
        this.feedback.hurt();
        if (this.companion.isBound()) this.addBondStrain(18);
        this.showToast(`YOU WERE HIT  //  -${hit.damage} VITALITY`, 'danger');
      }
      if (this.player.getHealth() <= 0) {
        this.defeatOverlay?.classList.add('visible');
      }
    }

    this.damageFlash?.classList.toggle('active', this.damageFlashTimer > 0);
    this.updateCamera(deltaSeconds);
    this.updateHud(deltaSeconds);
    this.minimap.update(
      this.player.getPosition(),
      this.infected.alive,
      this.player.root.rotation.y,
      this.trackedCreature ? CREATURES[this.trackedCreature] : null,
    );
    this.renderScene();
  };

  private readonly handleAbilityClick = (): void => {
    this.handleCreatureAbility();
  };
  private toggleInventory(): void {
    this.inventoryUI.toggle();
  }
  private updateInventoryHud(): void {
    this.inventoryUI.renderInventory();
  }
  private updateCraftingHud(): void {
    this.inventoryUI.renderCrafting();
  }

  private readonly handleJoinRoom = (): void => {
    const code = this.roomCode?.value.trim().toUpperCase() || 'BLOOM';
    this.coopCollection = null;
    this.multiplayer.connect(code);
    // Prevent remaining solo loot from being mistaken for account-owned co-op salvage.
    for (const drop of this.drops) drop.dispose(this.scene);
    this.drops.length = 0;
    this.updateCraftingHud();
    void this.coopProgress.refresh();
    this.updateMissionHud();
    if (this.roomStatus) this.roomStatus.textContent = `Connecting to ${code}…`;
  };
  private readonly handleLeaveRoom = (): void => {
    this.multiplayer.disconnect();
    this.wasCoop = false;
    this.feedback.reset();
    this.player.reset();
    this.firearms.reset();
    this.vitals = newVitals();
    this.lastServerVitals = null;
    this.infected.resetSolo({ ...this.soloTarget, x: 0, z: 0, hp: 100, hurtUntil: 0 });
    this.defeatOverlay?.classList.remove('visible');
    this.coopCollection = null;
    this.collectionSignature = '';
    this.syncCollectionVisuals();
    if (this.currentCollection.creatures[this.currentCollection.active].owned && !this.recoveringBond)
      this.companion.bond();
    else this.companion.retreat();
    this.updateCraftingHud();
    this.clearRemotePlayers();
    if (this.roomStatus) this.roomStatus.textContent = 'Solo · Cloud account';
    this.updateMissionHud();
    this.updateProgressHud();
  };
  private readonly onRoomEvent = (event: RoomEvent): void => {
    if (event.type === 'correction') {
      this.player.root.position.set(event.x, 0, event.z);
    } else if (event.type === 'survival') {
      this.vitals = { ...event.survival };
    } else if (event.type === 'respawn') {
      this.feedback.reset();
      this.player.reset();
      this.player.root.position.set(event.x, 0, event.z);
      this.vitals = { ...event.survival };
      this.lastServerVitals = null;
      this.soloTarget.hurtUntil = 0;
      this.defeatOverlay?.classList.remove('visible');
      this.cameraYaw = 0;
      this.showToast('SURVIVOR RECOVERED  //  Back at field camp.', 'success');
    } else if (event.type === 'action') {
      if (event.by !== this.multiplayer.id) this.coopVisuals.triggerAction(event.by, event.action);
    } else if (event.type === 'arsenal') {
      this.firearms.arsenal = event.arsenal;
    } else if (event.type === 'shot') {
      if (event.by !== this.multiplayer.id) this.coopVisuals.triggerShot(event.by, event.weapon || 'pistol');
      if (event.by !== this.multiplayer.id)
        this.firearms.effect(
          new THREE.Vector3(event.origin.x, event.origin.y, event.origin.z),
          new THREE.Vector3(event.direction.x, event.direction.y, event.direction.z),
          event.distance,
        );
      else if (event.hit) this.firearms.markHit();
      if (event.hit)
        this.feedback.impact(
          new THREE.Vector3(event.origin.x, event.origin.y, event.origin.z).addScaledVector(
            new THREE.Vector3(event.direction.x, event.direction.y, event.direction.z),
            event.distance,
          ),
        );
    } else if (event.type === 'collection-state') {
      const before = this.coopCollection;
      this.coopCollection = event.collection;
      if (before) {
        const id = event.collection.active;
        if (evolutionStage(event.collection.creatures[id].xp) > evolutionStage(before.creatures[id].xp))
          this.showEvolution(this.activePower.name);
      }
      if (
        event.bonded ||
        !before ||
        before.active !== event.collection.active ||
        !before.creatures[event.collection.active].owned
      ) {
        this.recoveringBond = false;
        this.bondStrain = 0;
      }
      this.syncCollectionVisuals();
      if (this.currentCollection.creatures[this.currentCollection.active].owned) this.companion.bond();
    } else if (event.type === 'creature-state') {
      if (event.owned) {
        this.companion.bond();
        this.showToast('LANTERNKIN  //  Bond verified by Cloudflare.', 'success');
      } else {
        this.companion.retreat();
      }
      this.updateCompanionHud();
      void this.coopProgress.refresh().then(() => this.updateProgressHud());
    } else if (event.type === 'welcome') {
      this.wasCoop = true;
      this.feedback.reset();
      this.player.reset();
      this.vitals = { ...(event.survival || newVitals()) };
      this.lastServerVitals = null;
      this.infected.clear();
      this.soloTarget.hurtUntil = 0;
      this.defeatOverlay?.classList.remove('visible');
      if (this.roomStatus) this.roomStatus.textContent = `Room ${event.code} · connected`;
      this.showToast(`ROOM JOINED  //  ${event.code}`, 'success');
      this.updateMissionHud();
      this.updateCraftingHud();
      void this.coopProgress.refresh().then(() => this.updateProgressHud());
    } else if (event.type === 'mission-state') {
      this.roomMission = event;
      this.refreshRoomPickups();
      this.updateMissionHud();
    } else if (event.type === 'mission-extracted') {
      this.showToast(`TEAM EXTRACTION  //  Expedition ${event.completed} complete!`, 'success');
      this.sayMissionComplete();
    } else if (event.type === 'mission-reward') {
      this.showToast(`PARTY REWARD  //  +${event.xp} trusted XP`, 'success');
      void this.coopProgress.refresh().then(() => this.updateProgressHud());
    } else if (event.type === 'error') {
      if (this.roomStatus) this.roomStatus.textContent = event.message;
      this.showToast(event.message, 'warning');
      if (!this.multiplayer.connected) {
        this.clearRemotePlayers();
        if (this.wasCoop) this.handleLeaveRoom();
      }
    } else if (event.type === 'damage') {
      const lost = this.player.getHealth() - event.hp;
      if (lost > 0) {
        this.player.takeDamage(lost);
        cancelHealing(this.vitals);
        this.damageFlashTimer = 0.2;
        this.feedback.hurt();
        if (this.companion.isBound()) this.addBondStrain(18);
        if (event.hp <= 0) {
          this.defeatOverlay?.classList.add('visible');
          this.say('defeat');
        }
      }
      if (event.hp > this.player.getHealth()) {
        this.player.heal(event.hp - this.player.getHealth());
        this.feedback.audio.play('heal');
      }
    } else if (event.type === 'kill') {
      // In co-op the server credits materials to the verified killer; never spawn local salvage.
      if (event.by === this.multiplayer.id) this.feedback.confirm(true);
      if (event.by === this.multiplayer.id)
        this.showToast('KILL CONFIRMED  //  Crediting Cloudflare account…', 'success');
      else this.showToast('TEAM KILL  //  Salvage available!', 'success');
    } else if (event.type === 'reward') {
      if (!event.duplicate)
        this.showToast(
          `CLOUD REWARD  //  +${event.xp} co-op XP · ${event.material ?? 'material'} · ${event.totals.kills} trusted kills`,
          'success',
        );
      this.coopProgress.applyReward(event.totals);
      void this.coopProgress.refresh();
      this.updateProgressHud();
    }
  };
  private clearRemotePlayers(): void {
    this.coopVisuals.clear();
    this.roomMission = null;
  }
  private refreshRoomPickups(): void {
    this.coopVisuals.updateSamples(this.roomMission);
  }
  private photoRequest = 0;
  private readonly handlePhotoMaterials = (event: Event): void => {
    this.updatePhotoMaterials((event.target as HTMLInputElement).checked);
    this.saveGraphics();
  };
  private updatePhotoMaterials(enabled: boolean): void {
    const request = ++this.photoRequest;
    const status = document.querySelector('#photo-materials-status');
    if (status) status.textContent = enabled ? 'Loading photo surfaces…' : 'Offline surfaces';
    void this.world
      .photographic(enabled, (loaded, total) => {
        if (status) status.textContent = `Photo surfaces ${loaded}/${total}`;
      })
      .then(() => {
        if (request !== this.photoRequest) return;
        if (enabled && status && status.textContent !== 'Photo surfaces 4/4')
          status.textContent = 'Photo surfaces partly unavailable · offline fallback active';
      });
  }
  private readonly handleGraphicsQuality = (event: Event): void => {
    this.setQuality((event.target as HTMLSelectElement).value as QualityId);
    this.saveGraphics();
  };
  private setQuality(quality: QualityId): void {
    this.quality = quality;
    const profile = renderProfile(quality);
    const selection = document.querySelector<HTMLSelectElement>('#graphics-quality');
    if (selection) selection.value = quality;
    this.cinematic = quality === 'cinematic';
    if (this.cinematic && !this.effects)
      this.effects = new SceneEffects(this.renderer, this.scene, this.feedback.camera);
    if (!this.cinematic && this.effects) {
      this.effects.dispose();
      this.effects = null;
    }
    this.renderer.shadowMap.enabled = profile.shadows;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.pixelRatio));
    this.world.setQuality(profile);
    this.feedback.setQuality(quality);
    this.player.setEffectsLights(profile.pointLights);
    this.scene.traverse((node) => {
      if (node instanceof THREE.PointLight) node.visible = profile.pointLights;
    });
    this.coopVisuals.lightsEnabled = profile.pointLights;
    if (this.sky) this.sky.material.uniforms.cloudLayers.value = profile.cloudLayers;
    this.resize();
  }
  private saveGraphics(): void {
    try {
      localStorage.setItem(
        'murk-mettle-graphics',
        JSON.stringify({
          quality: this.quality,
          photo: document.querySelector<HTMLInputElement>('#photo-materials')?.checked === true,
        }),
      );
    } catch {
      /* Preferences are optional. */
    }
  }
  private get currentCollection(): CollectionState {
    return this.multiplayer.connected ? (this.coopCollection ?? emptyCollection()) : this.collection.state;
  }

  private get activePower() {
    const c = this.currentCollection;
    return creaturePower(c.active, c.creatures[c.active].xp);
  }
  private showEvolution(name: string): void {
    this.evolutionTime = 5;
    const label = document.querySelector('#evolution-announcement');
    if (label) label.textContent = `EVOLUTION / ${name.toUpperCase()}`;
    this.companion.triggerPulse();
  }
  private readonly handleRosterClick = (event: Event): void => {
    const target = (event.target as Element).closest<HTMLButtonElement>('[data-species]');
    if (!target) return;
    const id = target.dataset.species as SpeciesId;
    if (!SPECIES_IDS.includes(id)) return;
    if (this.currentCollection.creatures[id].owned) this.selectCreature(id);
    else {
      this.trackedCreature = this.trackedCreature === id ? null : id;
      this.collectionSignature = '';
      this.syncCollectionVisuals();
    }
  };
  private selectCreature(id: SpeciesId): void {
    if (!SPECIES_IDS.includes(id) || !this.currentCollection.creatures[id].owned) return;
    if (this.recoveringBond) {
      this.showToast('Recover your companion before switching.', 'warning');
      return;
    }
    if (this.multiplayer.connected) this.multiplayer.send('select-creature', { species: id });
    else if (this.collection.select(id)) {
      this.syncCollectionVisuals();
      this.companion.bond();
    }
  }
  private cycleCreature(): void {
    const c = this.currentCollection;
    const owned = SPECIES_IDS.filter((id) => c.creatures[id].owned);
    if (owned.length) this.selectCreature(owned[(owned.indexOf(c.active) + 1) % owned.length]);
  }
  private syncCollectionVisuals(): void {
    const c = this.currentCollection,
      entry = c.creatures[c.active];
    this.companion.setForm(c.active, entry.xp);
    if (entry.owned && !this.recoveringBond) this.companion.bond();
    else this.companion.retreat();
    this.companion.root.visible = entry.owned;
    for (const [id, wild] of this.wildCreatures) {
      wild.root.visible = !c.creatures[id].owned;
    }
    if (this.trackedCreature && c.creatures[this.trackedCreature].owned) this.trackedCreature = null;
    const signature = JSON.stringify([c, this.trackedCreature]);
    if (signature === this.collectionSignature) return;
    this.collectionSignature = signature;
    const roster = document.querySelector('#creature-roster');
    if (roster) {
      roster.replaceChildren();
      for (const id of SPECIES_IDS) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.species = id;
        button.className =
          id === c.active && c.creatures[id].owned ? 'selected' : this.trackedCreature === id ? 'tracking' : '';
        const entry = c.creatures[id],
          journal = journalEntry(id, entry.xp);
        const title = document.createElement('strong');
        title.textContent = entry.owned
          ? `${journal.power.name} · ${journal.stage + 1}/3${id === c.active ? ' · ACTIVE' : ''}`
          : `${CREATURES[id].name} · ${this.trackedCreature === id ? 'TRACKING' : 'TRACK'}`;
        const habitat = document.createElement('small');
        habitat.textContent = CREATURES[id].habitat;
        const chain = document.createElement('small');
        chain.textContent = journal.forms.map((f) => `${f.name} (${f.threshold} XP)`).join(' → ');
        const stats = document.createElement('small');
        stats.textContent = `Q PULSE · ${journal.power.damage} damage · ${journal.power.range}m · ${journal.power.cooldown}s cooldown`;
        const progress = document.createElement('progress');
        progress.max = 1;
        progress.value = entry.owned ? journal.fraction : 0;
        progress.setAttribute('aria-label', `${CREATURES[id].name} evolution progress`);
        const hint = document.createElement('small');
        hint.textContent = entry.owned
          ? journal.next === null
            ? 'Final form reached'
            : `${journal.remaining} XP to next form · ${entry.xp} total XP`
          : 'Track, approach and press E to bond';
        button.append(title, habitat, chain, stats, progress, hint);
        button.title = entry.owned
          ? 'Select companion'
          : this.trackedCreature === id
            ? 'Stop tracking'
            : 'Track habitat on the map';
        button.setAttribute('aria-pressed', String(entry.owned ? id === c.active : this.trackedCreature === id));
        roster.append(button);
      }
    }
    const name = document.querySelector('#creature-name');
    if (name) name.textContent = this.activePower.name.toUpperCase();
    const evolution = document.querySelector('#evolution-status');
    if (evolution)
      evolution.textContent = entry.owned
        ? this.activePower.stage === 2
          ? 'FINAL EVOLUTION'
          : `EVOLUTION ${this.activePower.stage + 1}/3 · ${entry.xp} / ${this.activePower.stage === 0 ? 120 : 400} XP`
        : 'Explore, approach a creature and press E to bond.';
  }
  private updateWildCreatures(dt: number): void {
    const pos = this.player.getPosition();
    for (const wild of this.wildCreatures.values()) if (wild.root.visible) wild.update(dt, pos, 0, this.world);
    const region = document.querySelector('#region-name');
    if (region) region.textContent = this.world.region(pos);
    const nearby = SPECIES_IDS.find(
      (id) =>
        !this.currentCollection.creatures[id].owned &&
        Math.hypot(CREATURES[id].x - pos.x, CREATURES[id].z - pos.z) < 2.7,
    );
    const tracker = document.querySelector('#creature-tracker');
    if (tracker) {
      const id = this.trackedCreature,
        def = id ? CREATURES[id] : null;
      const distance = def ? Math.hypot(def.x - pos.x, def.z - pos.z) : 0;
      const direction = def
        ? [
            def.z < pos.z - 2 ? 'N' : def.z > pos.z + 2 ? 'S' : '',
            def.x > pos.x + 2 ? 'E' : def.x < pos.x - 2 ? 'W' : '',
          ].join('')
        : '';
      tracker.textContent = def
        ? `TRACKING ${def.name.toUpperCase()} · ${Math.round(distance)}m ${direction} · ${distance < 2.7 ? 'E TO BOND' : 'Follow the gold map ring'}`
        : '';
    }
    const phoneNavigation = document.querySelector('#touch-navigation');
    if (phoneNavigation) phoneNavigation.textContent = tracker?.textContent || '';
    const hint = document.querySelector('#exploration-hint');
    if (hint)
      hint.textContent =
        this.player.getHealth() <= 0
          ? ''
          : nearby
            ? `E · BOND WITH ${CREATURES[nearby].name.toUpperCase()}`
            : this.firearms.nearSupply(pos)
              ? 'E · RESUPPLY AMMO + BANDAGES (45s RESTOCK)'
              : '';
  }
  private readonly handleHealClick = (): void => {
    if (!this.fieldEntered || this.player.getHealth() <= 0) return;
    const axes = this.input.getMovementAxes();
    if (axes.forward || axes.right) {
      this.showToast('STAND STILL  //  Bandaging takes 2.6 seconds.', 'warning');
      return;
    }
    if (this.multiplayer.connected) {
      this.multiplayer.send('heal');
      return;
    }
    if (beginHealing(this.vitals, this.player.getHealth(), Date.now()))
      this.showToast('BANDAGING  //  Stay still. Hits and attacks interrupt healing.', 'info');
    else this.showToast(this.player.getHealth() >= 100 ? 'VITALITY FULL' : 'NO BANDAGE AVAILABLE', 'warning');
  };
  private handleShooting(): void {
    if (this.player.getHealth() <= 0) return;
    // Shoot in the camera direction even when moving sideways.
    this.player.root.rotation.y = this.cameraYaw;
    this.aimRay.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const weapon = WEAPONS[this.firearms.selected];
    const camOrigin = this.aimRay.ray.origin,
      camDirection = this.aimRay.ray.direction;
    const camHit = bulletTarget(this.infected.alive, camOrigin, camDirection, weapon.range);
    const camDistance = camHit?.distance ?? obstacleDistance(camOrigin, camDirection, weapon.range);
    const aimPoint = camOrigin.clone().addScaledVector(camDirection, camDistance);
    const origin = this.player.getPosition().clone();
    origin.y = 1.32;
    const direction = aimPoint.sub(origin).normalize();
    if (!this.firearms.tryFire()) return;
    this.feedback.shot(this.firearms.selected);
    cancelHealing(this.vitals);
    const hit = bulletTarget(this.infected.alive, origin, direction, weapon.range);
    if (!this.multiplayer.connected)
      alertHorde(this.infected.simulation.enemies, this.player.getPosition(), Date.now());
    const visualOrigin = this.firearms.muzzle();
    const visualTarget = origin
      .clone()
      .addScaledVector(direction, hit?.distance ?? obstacleDistance(origin, direction, weapon.range));
    const visualDirection = visualTarget.sub(visualOrigin);
    this.firearms.effect(visualOrigin, visualDirection.clone().normalize(), visualDirection.length());
    if (this.multiplayer.connected)
      this.multiplayer.send('shoot', {
        weapon: this.firearms.selected,
        direction: { x: direction.x, y: direction.y, z: direction.z },
      });
    else if (hit !== null) {
      this.firearms.markHit();
      if (this.infected.damage(hit.enemy.id, weapon.damage))
        this.registerKill(false, new THREE.Vector3(hit.enemy.x, 0, hit.enemy.z));
    }
  }

  private say(key: keyof Game['radioLines']): void {
    // Rook is an original radio operator, not a character or voice from another game.
    if (this.radioLine) this.radioLine.textContent = this.radioLines[key];
    this.radioTimer = 4.8;
    this.radioPanel?.classList.add('visible');
  }

  private spawnLoot(position: THREE.Vector3): void {
    const ids: ItemId[] = ['spore', 'scrap', 'fiber'];
    const id = ids[this.dropSequence % ids.length];
    this.dropSequence++;
    const drop = new Loot(this.scene, id, position.clone());
    this.drops.push(drop);
    // Keep the prototype from accumulating unbounded 3D meshes.
    if (this.drops.length > 12) this.drops.shift()?.dispose(this.scene);
  }

  private handleInteract(): void {
    if (this.player.getHealth() <= 0) return;
    const playerPos = this.player.getPosition();
    const supply = this.firearms.nearSupply(playerPos);
    if (supply) {
      if (this.multiplayer.connected) this.multiplayer.send('resupply', { id: supply.id });
      else {
        const refilled = this.firearms.resupply(playerPos);
        if (refilled) refillVitals(this.vitals);
        this.showToast(
          refilled
            ? 'SUPPLIES RECOVERED  //  Ammo and bandages restored.'
            : 'CACHE RESTOCKING  //  Returns after 45 seconds.',
          'info',
        );
      }
      return;
    }
    const wild = SPECIES_IDS.find(
      (id) =>
        !this.currentCollection.creatures[id].owned &&
        Math.hypot(CREATURES[id].x - playerPos.x, CREATURES[id].z - playerPos.z) < 2.7,
    );
    if (wild) {
      if (this.multiplayer.connected) this.multiplayer.send('bond', { species: wild });
      else {
        this.collection.bond(wild);
        if (wild === 'lanternkin') this.progression.bondLanternkin();
        this.recoveringBond = false;
        progressStore.removeItem(this.bondRetreatKey);
        this.bondStrain = 0;
        this.companion.bond();
        this.showToast(`NEW BOND  //  ${CREATURES[wild].name} joined your collection. C to switch.`, 'success');
      }
      this.syncCollectionVisuals();
      return;
    }
    if (!this.multiplayer.connected && this.expedition.ready && this.isNearExtraction(playerPos)) {
      if (this.expedition.extract()) {
        const levelUp = this.progression.grantPlayerXp(150);
        this.showToast(
          levelUp ? 'EXTRACTED  //  +150 XP · LEVEL UP!' : 'EXTRACTED  //  +150 XP · Mission complete!',
          'success',
        );
        this.sayMissionComplete();
        this.updateMissionHud();
      }
      return;
    }
    if (this.multiplayer.connected) {
      if (this.roomMission?.ready && this.isNearExtraction(playerPos)) {
        this.multiplayer.send('extract');
        return;
      }
      const sample = this.roomMission?.pickups.find((p) => Math.hypot(p.x - playerPos.x, p.z - playerPos.z) < 2.7);
      if (sample) {
        this.multiplayer.send('pickup', { id: sample.id });
        return;
      }
    }
    // Co-op item economy is wholly server-owned; local pickup is solo-only.
    const candidate = this.multiplayer.connected ? undefined : this.drops.find((drop) => drop.canPickUp(playerPos));
    if (candidate) {
      if (!this.inventory.add(candidate.id)) {
        this.showToast(`PACK FULL  //  ${ITEM_DEFINITIONS[candidate.id].name} has reached 20 / 20.`, 'warning');
        return;
      }
      this.drops.splice(this.drops.indexOf(candidate), 1);
      candidate.dispose(this.scene);
      if (!this.multiplayer.connected) this.expedition.recordSalvage();
      this.updateInventoryHud();
      this.updateCraftingHud();
      this.updateMissionHud();
      this.showToast(`SALVAGED  //  +1 ${ITEM_DEFINITIONS[candidate.id].name}. Press I for pack.`, 'success');
      if (++this.radioIndex === 1) this.say('loot');
      return;
    }
    this.handleBond();
  }

  private addBondStrain(amount: number): void {
    if (!this.companion.isBound()) return;
    this.bondStrain = Math.min(100, this.bondStrain + amount);
    if (this.bondStrain >= 100) {
      this.recoveringBond = true;
      try {
        progressStore.setItem(this.bondRetreatKey, '1');
      } catch {
        /* Storage disabled. */
      }
      this.companion.retreat();
      this.abilityCooldown = 0;
      this.showToast('BOND FRACTURED  //  Lanternkin retreated. Find it and press E.', 'warning');
      this.say('lost');
    }
  }

  private handleBond(): void {
    if (this.player.getHealth() <= 0 || this.companion.isBound()) return;
    if (!this.companion.canBond(this.player.getPosition())) {
      this.showToast('GET CLOSER  //  Approach the glowing creature.', 'info');
      return;
    }
    if (this.multiplayer.connected) {
      this.multiplayer.send('bond', { species: this.currentCollection.active });
      this.showToast('BOND REQUESTED  //  Awaiting Cloudflare confirmation.', 'info');
      return;
    }
    this.companion.bond();
    if (this.recoveringBond) {
      this.recoveringBond = false;
      try {
        progressStore.removeItem(this.bondRetreatKey);
      } catch {
        /* Storage disabled. */
      }
      this.bondStrain = this.antidotePending ? 0 : 25;
      this.antidotePending = false;
      this.say('recovered');
      this.showToast('BOND RESTORED  //  Lanternkin is safe. Its levels were preserved.', 'success');
    } else {
      this.progression.bondLanternkin();
      this.say('bond');
      this.showToast('NEW BOND  //  Lanternkin joined your field collection! Press Q to pulse.', 'success');
    }
    this.updateCompanionHud();
  }

  private handleCreatureAbility(): void {
    if (this.player.getHealth() <= 0 || !this.companion.isBound()) return;
    if (this.abilityCooldown > 0) return;
    cancelHealing(this.vitals);
    const power = this.activePower;
    this.abilityCooldown = power.cooldown;
    this.companion.triggerPulse();
    if (this.companion.isBound() && this.bondStrain >= 20 && this.radioIndex <= 1) {
      this.radioIndex = 2;
      this.say('pulse');
    }
    if (this.multiplayer.connected) {
      this.multiplayer.send('pulse');
      this.showToast('PULSE RELEASED  //  Server checks target distance.', 'info');
    } else {
      const targets = pulseTargets(this.infected.alive, this.player.getPosition(), power.range);
      let kills = 0;
      for (const target of targets) {
        if (this.infected.damage(target.id, power.damage)) {
          this.registerKill(true, new THREE.Vector3(target.x, 0, target.z));
          kills++;
        } else {
          const evolved = this.collection.grant(CREATURE_XP_PER_PULSE_HIT);
          if (evolved) this.showEvolution(evolved);
          if (this.currentCollection.active === 'lanternkin')
            this.progression.grantCreatureXp(CREATURE_XP_PER_PULSE_HIT);
        }
      }
      alertHorde(this.infected.simulation.enemies, this.player.getPosition(), Date.now(), 18);
      this.showToast(
        targets.length
          ? `PULSE  //  ${targets.length} infected hit · ${kills} eliminated`
          : 'PULSE  //  No visible infected within range.',
        'info',
      );
    }
    this.addBondStrain(35);
    this.updateCompanionHud();
  }

  private updateCompanionHud(): void {
    this.creaturePanel?.classList.toggle('bonded', this.companion.isBound());
    this.creaturePanel?.classList.toggle('retreated', this.recoveringBond);
    if (this.bondStrainFill) this.bondStrainFill.style.width = `${this.bondStrain}%`;
    if (this.bondStrainLabel)
      this.bondStrainLabel.textContent = this.recoveringBond
        ? 'SIGNAL LOST · RECOVER COMPANION'
        : `${Math.round(this.bondStrain)}% STRAIN`;
    if (this.bondHint) {
      const near = this.companion.canBond(this.player.getPosition());
      this.bondHint.classList.toggle('visible', near && this.player.getHealth() > 0);
      this.bondHint.textContent = this.recoveringBond
        ? `PRESS E TO RECOVER ${this.activePower.name.toUpperCase()}`
        : `PRESS E TO BOND WITH ${this.activePower.name.toUpperCase()}`;
    }
    if (this.abilityButton) {
      this.abilityButton.disabled =
        !this.companion.isBound() || this.abilityCooldown > 0 || this.player.getHealth() <= 0;
      this.abilityButton.textContent = !this.companion.isBound()
        ? this.recoveringBond
          ? 'BOND LOST · RECOVER COMPANION'
          : 'LOCKED · BOND WITH A CREATURE'
        : this.abilityCooldown > 0
          ? `PULSE RECHARGING · ${Math.ceil(this.abilityCooldown)}s`
          : `Q · ${this.activePower.name.toUpperCase()} PULSE`;
    }
  }

  private handlePlayerAttack(): void {
    if (this.player.getHealth() <= 0 || this.attackCooldown > 0) return;
    this.attackCooldown = 0.48;
    this.player.triggerAttack();
    this.feedback.audio.play('melee');

    cancelHealing(this.vitals);
    if (this.multiplayer.connected) {
      this.multiplayer.send('attack');
      return;
    }
    const position = this.player.getPosition(),
      target = meleeTarget(
        this.infected.alive,
        { x: position.x, z: position.z, yaw: this.player.root.rotation.y },
        this.crafting.upgrades.balanced ? 3.35 : 2.65,
      );
    if (!target) {
      this.showToast('SWING MISSED  //  Face a nearby infected.', 'info');
      return;
    }
    this.firearms.markHit();
    if (this.infected.damage(target.id, this.crafting.upgrades.sharpened ? 55 : 40)) {
      this.registerKill(false, new THREE.Vector3(target.x, 0, target.z));
      this.showToast('INFECTED ELIMINATED  //  +50 XP', 'success');
    } else this.showToast(`HIT CONFIRMED  //  ${target.hp} infected health`, 'success');
  }

  private registerKill(fromPulse: boolean, position: THREE.Vector3): void {
    this.feedback.confirm(true);
    this.spawnLoot(position);
    if (!this.multiplayer.connected) this.expedition.recordKill();
    this.updateMissionHud();
    const leveled = this.progression.recordKill();
    const evolved = this.collection.grant(fromPulse ? 40 : 12);
    if (evolved) this.showEvolution(evolved);
    const creatureLeveled =
      fromPulse &&
      this.currentCollection.active === 'lanternkin' &&
      this.progression.grantCreatureXp(CREATURE_XP_PER_PULSE_KILL);
    if (leveled || creatureLeveled) {
      this.showToast(leveled ? 'LEVEL UP  //  Your survivor grew stronger!' : 'LANTERNKIN LEVEL UP!', 'success');
    }
  }

  private resetEncounter(): void {
    if (this.multiplayer.connected) {
      this.multiplayer.send('restart');
      return;
    }
    this.feedback.reset();
    this.player.reset();
    this.firearms.reset();
    this.vitals = newVitals();
    this.soloTarget.hurtUntil = 0;
    this.infected.resetSolo({ ...this.soloTarget, x: 0, z: 0, hp: 100, yaw: 0 });
    this.expedition.resetMission();
    this.updateMissionHud();
    if (this.companion.isBound()) this.bondStrain = Math.max(0, this.bondStrain - 20);
    this.cameraYaw = 0;
    this.attackCooldown = 0;
    this.defeatOverlay?.classList.remove('visible');
    this.showToast('EXPEDITION RESTARTED  //  Restocked and ready.', 'info');
  }

  private showToast(message: string, type: 'info' | 'success' | 'warning' | 'danger'): void {
    if (!this.combatToast) return;
    this.combatToast.textContent = message;
    this.combatToast.dataset.type = type;
    this.combatToast.classList.add('visible');
    this.toastTimer = 2.6;
  }

  private updateCamera(deltaSeconds: number): void {
    const playerPosition = this.player.getPosition();
    const distance = this.aiming ? 3.0 : 5.8;
    const pitch = this.cameraPitch;
    const forward = new THREE.Vector3(
      -Math.sin(this.cameraYaw) * Math.cos(pitch),
      -Math.sin(pitch),
      -Math.cos(this.cameraYaw) * Math.cos(pitch),
    );
    const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
    const anchor = playerPosition.clone().add(new THREE.Vector3(0, 1.65, 0));
    const offset = forward
      .clone()
      .multiplyScalar(-distance)
      .addScaledVector(right, this.aiming ? 0.6 : 0.75);
    const safe = this.world.cameraDistance(anchor, offset.clone().normalize(), offset.length());
    const desired = anchor.clone().addScaledVector(offset.normalize(), Math.max(0.25, safe - 0.25));
    this.camera.position.lerp(desired, 1 - Math.exp(-14 * Math.max(deltaSeconds, 0)));
    const smoothedOffset = this.camera.position.clone().sub(anchor),
      smoothedDistance = smoothedOffset.length();
    if (smoothedDistance > 0.001) {
      const allowed = this.world.cameraDistance(anchor, smoothedOffset.clone().normalize(), smoothedDistance);
      if (allowed < smoothedDistance)
        this.camera.position.copy(anchor).addScaledVector(smoothedOffset.normalize(), Math.max(0.08, allowed - 0.18));
    }
    this.camera.lookAt(this.camera.position.clone().addScaledVector(forward, 50));
    const fov = this.aiming ? 43 : 62;
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, fov, 10, deltaSeconds);
    this.camera.updateProjectionMatrix();
    const shadowTarget = this.sun.target.position;
    if (shadowTarget.distanceTo(playerPosition) > 4) {
      shadowTarget.copy(playerPosition);
      this.sun.position.copy(playerPosition).add(new THREE.Vector3(-25, 35, 18));
    }
  }

  private updateHud(deltaSeconds: number): void {
    this.hudTimer += deltaSeconds;
    if (this.hudTimer < 0.1) return;
    this.hudTimer = 0;

    const position = this.player.getPosition();
    if (this.positionElement) {
      this.positionElement.innerHTML = `X ${position.x.toFixed(1)} <span>·</span> Z ${position.z.toFixed(1)}`;
    }

    const health = this.player.getHealth();
    if (this.playerHealthFill) this.playerHealthFill.style.width = `${health}%`;
    if (this.playerHealthText) this.playerHealthText.textContent = `${health} / 100`;
    this.playerHealthFill?.classList.toggle('low', health <= 35);
    document.body.classList.toggle('stamina-exhausted', this.vitals.exhausted);
    document.body.classList.toggle('is-bandaging', this.vitals.healEndsAt > Date.now());

    const focus = this.infected.focus(position);
    const enemyNearby = focus && Math.hypot(focus.x - position.x, focus.z - position.z) <= 35;
    this.enemyPanel?.classList.toggle('visible', !!enemyNearby);
    if (focus) {
      if (this.enemyHealthFill) this.enemyHealthFill.style.width = `${(focus.hp / focus.max) * 100}%`;
      if (this.enemyHealthText) this.enemyHealthText.textContent = `${focus.hp} / ${focus.max}`;
      if (this.enemyStateText)
        this.enemyStateText.textContent = `${infectedName(focus.strain).toUpperCase()}${focus.state === 'windup' ? ' · STRIKING' : ''}`;
    }
    const stamina = document.querySelector<HTMLElement>('#stamina-fill'),
      staminaLabel = document.querySelector('#stamina-text');
    if (stamina) stamina.style.width = `${this.vitals.stamina}%`;
    if (staminaLabel)
      staminaLabel.textContent = this.vitals.exhausted ? 'EXHAUSTED' : `${Math.round(this.vitals.stamina)} / 100`;
    const heal = document.querySelector<HTMLButtonElement>('#heal-button'),
      progress = document.querySelector<HTMLElement>('#heal-fill');
    const remaining = Math.max(0, this.vitals.healEndsAt - Date.now());
    if (heal) {
      heal.textContent = remaining
        ? `BANDAGING · ${(remaining / 1000).toFixed(1)}s`
        : `H · BANDAGE (${this.vitals.bandages})`;
      heal.disabled = health <= 0 || health >= 100 || !this.vitals.bandages || remaining > 0;
    }
    if (progress) progress.style.width = remaining ? `${100 * (1 - remaining / SURVIVAL.healDuration)}%` : '0%';
    const status = document.querySelector('#horde-status');
    if (status)
      status.textContent = this.infected.nextWaveAt
        ? `AREA CLEAR · NEXT GROUP IN ${Math.max(0, Math.ceil((this.infected.nextWaveAt - Date.now()) / 1000))}s`
        : `GROUP ${this.infected.wave || 1} · ${this.infected.alive.length} INFECTED ACTIVE`;

    const touchHeal = document.querySelector<HTMLButtonElement>('[data-touch="heal"]');
    if (touchHeal) {
      touchHeal.disabled = health <= 0 || health >= 100 || !this.vitals.bandages || remaining > 0;
      touchHeal.textContent = remaining ? 'HEALING' : `HEAL ${this.vitals.bandages}`;
    }
    const touchReload = document.querySelector('[data-touch="reload"]');
    if (touchReload) touchReload.textContent = health <= 0 ? 'RESTART' : this.player.reloading ? 'LOADING' : 'RELOAD';
    const phoneEncounter = document.querySelector('#touch-encounter');
    if (phoneEncounter) phoneEncounter.textContent = status?.textContent || '';
    this.updateCompanionHud();
    const nearestDrop = this.multiplayer.connected ? undefined : this.drops.find((drop) => drop.canPickUp(position));
    if (this.missionHint) {
      const extractionPossible =
        (this.multiplayer.connected ? !!this.roomMission?.ready : this.expedition.ready) &&
        this.isNearExtraction(position) &&
        health > 0;
      this.missionHint.textContent = extractionPossible ? 'PRESS E · EXTRACT · +150 XP' : '';
      this.missionHint.classList.toggle('visible', extractionPossible);
    }
    if (this.lootHint) {
      const sample = this.multiplayer.connected
        ? this.roomMission?.pickups.find((p) => Math.hypot(position.x - p.x, position.z - p.z) < 2.7)
        : undefined;
      this.lootHint.textContent = sample
        ? 'PRESS E · COLLECT TEAM SAMPLE'
        : nearestDrop
          ? `PRESS E · COLLECT ${ITEM_DEFINITIONS[nearestDrop.id].name.toUpperCase()}`
          : '';
      this.lootHint.classList.toggle(
        'visible',
        Boolean(
          nearestDrop ||
          (this.multiplayer.connected &&
            this.roomMission?.pickups.some((p) => Math.hypot(position.x - p.x, position.z - p.z) < 2.7)),
        ) && health > 0,
      );
    }
    this.updateProgressHud();
    this.updateMissionHud();
    if (this.toastTimer <= 0) this.combatToast?.classList.remove('visible');
  }

  private updateProgressHud(): void {
    const state = this.progression.state;
    // While playing co-op, the main HUD is backed by server-verified account XP.
    // Solo kills remain browser-simulated, and are never presented as verified XP.
    const verified = this.multiplayer.connected ? this.coopProgress.verified : null;
    const playerXpTotal = verified?.stats.xp ?? state.playerXp;
    const active = this.currentCollection.creatures[this.currentCollection.active];
    const creatureXpTotal = active.xp;
    const playerXp = xpInLevel(playerXpTotal);
    const companionXp = xpInLevel(creatureXpTotal);
    if (this.playerLevelText)
      this.playerLevelText.textContent = `LV ${levelFromXp(playerXpTotal)}${verified ? ' · CLOUD' : ' · SOLO'}`;
    if (this.playerXpFill) this.playerXpFill.style.width = `${playerXp.ratio * 100}%`;
    if (this.playerXpText)
      this.playerXpText.textContent = playerXp.required ? `${playerXp.current} / ${playerXp.required} XP` : 'MAX LEVEL';
    if (this.creatureLevelText)
      this.creatureLevelText.textContent = active.owned ? `LV ${levelFromXp(creatureXpTotal)}` : 'UNBONDED';
    if (this.creatureXpFill) this.creatureXpFill.style.width = `${active.owned ? companionXp.ratio * 100 : 0}%`;
    if (this.creatureXpText)
      this.creatureXpText.textContent = !active.owned
        ? 'BOND TO EARN XP'
        : companionXp.required
          ? `${companionXp.current} / ${companionXp.required} XP`
          : 'MAX LEVEL';
    if (this.killText)
      this.killText.textContent = verified
        ? `${verified.stats.kills} VERIFIED KILLS`
        : `${state.totalKills} SOLO KILLS`;
  }

  private isNearExtraction(position: THREE.Vector3): boolean {
    return Math.hypot(position.x - EXTRACTION_X, position.z - EXTRACTION_Z) <= EXTRACTION_RADIUS;
  }

  private createExtractionBeacon(): void {
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0x9beddc,
      emissive: 0x157a71,
      emissiveIntensity: 1.6,
      transparent: true,
      opacity: 0.9,
      roughness: 0.35,
    });
    const disk = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.08, 8, 36), ringMat);
    disk.rotation.x = Math.PI / 2;
    disk.position.y = 0.12;
    disk.name = 'extract-ring';
    this.extractionBeacon.add(disk);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 3.8, 8), ringMat);
    pillar.position.y = 2;
    this.extractionBeacon.add(pillar);
    const cap = new THREE.Mesh(new THREE.OctahedronGeometry(0.43), ringMat);
    cap.position.y = 4.05;
    this.extractionBeacon.add(cap);
    this.extractionBeacon.position.set(EXTRACTION_X, 0, EXTRACTION_Z);
    this.scene.add(this.extractionBeacon);
  }

  private sayMissionComplete(): void {
    if (this.radioLine)
      this.radioLine.textContent = 'Rook: Samples secured, extraction confirmed. That is one more trip home.';
    this.radioTimer = 5;
    this.radioPanel?.classList.add('visible');
  }

  private updateMissionHud(): void {
    const coOp = this.multiplayer.connected;
    if (this.missionStatus)
      this.missionStatus.textContent = coOp
        ? this.roomMission?.ready
          ? 'TEAM OBJECTIVES COMPLETE · EXTRACT'
          : 'CO-OP EXPEDITION · ACTIVE'
        : this.expedition.ready
          ? 'OBJECTIVES COMPLETE · REACH BEACON'
          : 'SOLO EXPEDITION · ACTIVE';
    if (this.missionKills)
      this.missionKills.textContent = `${coOp ? (this.roomMission?.kills ?? 0) : this.expedition.kills}/${KILLS_REQUIRED} infected eliminated`;
    if (this.missionSalvage)
      this.missionSalvage.textContent = `${coOp ? (this.roomMission?.salvage ?? 0) : this.expedition.salvage}/${SALVAGE_REQUIRED} salvage collected`;
    if (this.missionTotal)
      this.missionTotal.textContent = `${coOp ? (this.roomMission?.completed ?? 0) : this.expedition.completed} successful extractions`;
    this.extractionBeacon.visible = !coOp || !!this.roomMission?.ready;
  }

  private renderScene(): void {
    // Only the presentation camera receives spring lag/recoil. Gameplay rays use this.camera.
    this.feedback.prepareCamera(this.camera, this.renderDelta);
    const anchor = this.player
      .getPosition()
      .clone()
      .add(new THREE.Vector3(0, 1.65, 0));
    const offset = this.feedback.camera.position.clone().sub(anchor);
    const length = offset.length();
    if (length > 0.001) {
      const allowed = this.world.cameraDistance(anchor, offset.clone().normalize(), length);
      if (allowed < length)
        this.feedback.camera.position.copy(anchor).addScaledVector(offset.normalize(), Math.max(0.08, allowed - 0.18));
    }
    this.feedback.camera.updateMatrixWorld();
    const reticle = document.querySelector<HTMLElement>('.reticle');
    const target = this.camera
      .getWorldDirection(new THREE.Vector3())
      .multiplyScalar(50)
      .add(this.camera.position)
      .project(this.feedback.camera);
    if (reticle) {
      reticle.style.left = `${(target.x * 0.5 + 0.5) * 100}%`;
      reticle.style.top = `${(-target.y * 0.5 + 0.5) * 100}%`;
    }
    if (this.cinematic && this.effects) this.effects.render();
    else this.renderer.render(this.scene, this.feedback.camera);
  }

  private resize(): void {
    const width = Math.max(1, this.viewport.clientWidth);
    const height = Math.max(1, this.viewport.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.effects?.resize(width, height, this.renderer.getPixelRatio());
  }

  dispose(): void {
    if (!this.running) return;
    this.running = false;
    this.renderer.setAnimationLoop(null);
    this.touch.dispose();
    this.input.dispose();
    this.abilityButton?.removeEventListener('click', this.handleAbilityClick);
    document.querySelector('#heal-button')?.removeEventListener('click', this.handleHealClick);
    document.querySelector('#room-join')?.removeEventListener('click', this.handleJoinRoom);
    document.querySelector('#room-leave')?.removeEventListener('click', this.handleLeaveRoom);
    this.multiplayer.disconnect();
    this.wasCoop = false;
    this.feedback.reset();
    this.player.reset();
    this.firearms.reset();
    this.vitals = newVitals();
    this.lastServerVitals = null;
    this.infected.resetSolo({ ...this.soloTarget, x: 0, z: 0, hp: 100, hurtUntil: 0 });
    this.defeatOverlay?.classList.remove('visible');
    this.coopCollection = null;
    this.collectionSignature = '';
    this.syncCollectionVisuals();
    if (this.currentCollection.creatures[this.currentCollection.active].owned && !this.recoveringBond)
      this.companion.bond();
    else this.companion.retreat();
    this.updateCraftingHud();
    this.clearRemotePlayers();
    this.inventoryUI.dispose();
    for (const drop of this.drops) drop.dispose(this.scene);
    this.drops.length = 0;
    this.companion.dispose();
    this.resizeObserver?.disconnect();
    this.player.dispose();
    this.infected.dispose();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
    this.feedback.dispose();
    this.firearms.dispose();
    this.world.dispose();
    this.environmentTarget?.dispose();
    for (const wild of this.wildCreatures.values()) wild.dispose();
    document.querySelector('#creature-roster')?.removeEventListener('click', this.handleRosterClick);
    document.querySelector('#graphics-quality')?.removeEventListener('change', this.handleGraphicsQuality);
    document.querySelector('#photo-materials')?.removeEventListener('change', this.handlePhotoMaterials);
    this.effects?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    document.body.classList.remove('is-pointer-locked');
  }
}
