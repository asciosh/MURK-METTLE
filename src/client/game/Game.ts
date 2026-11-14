import { progressStore } from './ProgressStore';
import { Firearms } from './Firearms';
import { Collection, type CollectionState } from './Collection';
import { Sky } from 'three/addons/objects/Sky.js';
import { SceneEffects } from './SceneEffects';
import {
  CREATURES,
  SPECIES_IDS,
  WEAPONS,
  creaturePower,
  evolutionStage,
  shotDistance,
  obstacleDistance,
  type SpeciesId,
} from '../../../shared/expansion.mjs';
import * as THREE from 'three';
import { InputController } from './InputController';
import { Player } from './Player';
import { readModelManifest, type ModelManifest } from './AnimationController';
import { World } from './World';
import { Minimap } from './Minimap';
import { Zombie } from './Zombie';
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
  private effects: SceneEffects | null = null;
  private cinematic = false;
  private environmentMap: THREE.Texture | null = null;
  private readonly sun = new THREE.DirectionalLight(0xffead2, 3.1);
  private readonly firearms: Firearms;
  private readonly collection: Collection;
  private coopCollection: CollectionState | null = null;
  private readonly wildCreatures = new Map<SpeciesId, Companion>();
  private readonly aimRay = new THREE.Raycaster();
  private collectionSignature = '';
  private aiming = false;
  private recoilOffset = 0;
  private evolutionTime = 0;
  private encounterRelocateTime = 0;
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 350);
  private readonly renderer: THREE.WebGLRenderer;
  private assetManifest: ModelManifest = {};
  private readonly clock = new THREE.Clock();
  private fieldEntered = false;
  private readonly world: World;
  private readonly minimap = new Minimap();
  private readonly player: Player;
  private readonly input: InputController;
  private zombie: Zombie;
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
  private remoteZombieGeneration = -1;
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
  private zombieRespawnTimer = 0;
  private toastTimer = 0;
  private damageFlashTimer = 0;
  private running = false;

  constructor(private readonly viewport: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'game-canvas';
    this.renderer.domElement.setAttribute('aria-label', '3D game view. Click to capture the mouse.');
    this.renderer.domElement.tabIndex = 0;
    this.viewport.prepend(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x9ba9a5);
    this.scene.fog = new THREE.FogExp2(0x9ba9a5, 0.008);
    this.createLighting();

    this.world = new World(this.scene);
    this.createExtractionBeacon();
    this.player = new Player(this.scene);
    this.zombie = new Zombie(this.scene, new THREE.Vector3(0.7, 0, -9.5));
    this.companion = new Companion(this.scene);
    this.firearms = new Firearms(this.scene, this.player);
    this.collection = new Collection(this.progression.state);
    this.recoveringBond = progressStore.getItem(this.bondRetreatKey) === '1';
    for (const id of SPECIES_IDS) {
      const wild = new Companion(this.scene, id);
      this.wildCreatures.set(id, wild);
    }
    document.querySelector('#creature-roster')?.addEventListener('click', this.handleRosterClick);
    document.querySelector('#graphics-quality')?.addEventListener('change', this.handleGraphicsQuality);
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
    this.showToast('FIELD READY  //  RMB aim · LMB fire · R reload · E bond / resupply.', 'info');
  }

  private async loadOptionalModels(): Promise<void> {
    this.assetManifest = await readModelManifest();
    const models = this.assetManifest;
    if (models.survivor?.url) void this.player.installModel(models.survivor);
    if (models.zombie?.url) void this.zombie.installModel(models.zombie);
    if (models.lanternkin?.url) void this.companion.installModel(models.lanternkin);
  }

  private createLighting(): void {
    const sky = new Sky();
    sky.scale.setScalar(1000);
    const uniforms = sky.material.uniforms;
    uniforms.turbidity.value = 5;
    uniforms.rayleigh.value = 1.7;
    uniforms.mieCoefficient.value = 0.006;
    uniforms.mieDirectionalG.value = 0.78;
    const sunPosition = new THREE.Vector3().setFromSphericalCoords(
      1,
      THREE.MathUtils.degToRad(67),
      THREE.MathUtils.degToRad(235),
    );
    uniforms.sunPosition.value.copy(sunPosition);
    this.scene.add(sky);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const environment = new THREE.Scene();
    const environmentSky = sky.clone();
    environment.add(environmentSky);
    this.environmentMap = pmrem.fromScene(environment, 0.06).texture;
    this.scene.environment = this.environmentMap;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xc4d0dc, 0x494739, 0.78));
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
    sun.shadow.normalBias = 0.04;
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
  }

  requestMouseCapture(): void {
    this.input.requestCapture();
  }

  private readonly tick = (): void => {
    if (!this.running) return;
    if (!this.fieldEntered) {
      this.clock.getDelta(); // Do not accumulate a large first gameplay frame.
      this.renderScene();
      return;
    }
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05);
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
    this.recoilOffset *= Math.exp(-9 * deltaSeconds);

    const mouse = this.input.consumeMouseDelta();
    this.cameraYaw -= mouse.x * 0.0024;
    this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + mouse.y * 0.0018, -0.65, 0.95);

    const axes = this.input.getMovementAxes();
    const forward = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
    const movement = forward.multiplyScalar(axes.forward).addScaledVector(right, axes.right);
    if (movement.lengthSq() > 1) movement.normalize();
    if (this.player.getHealth() <= 0) movement.set(0, 0, 0);

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
    this.firearms.aiming = this.aiming;
    this.player.update(movement, deltaSeconds, !this.aiming && this.input.isSprinting(), this.world);
    const weapon = this.input.consumeWeaponPressed();
    if (weapon) this.firearms.switchWeapon(weapon === 1 ? 'pistol' : 'rifle');
    if (this.input.consumeCyclePressed()) this.cycleCreature();
    const pressed = this.input.consumeFirePressed();
    if (pressed || (WEAPONS[this.firearms.selected].automatic && this.input.isFiring())) this.handleShooting();
    this.firearms.update(deltaSeconds);
    this.world.update(deltaSeconds);
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
      this.syncRoomZombie(deltaSeconds);
    }

    if (
      !this.multiplayer.connected &&
      !this.zombie.isDead() &&
      this.zombie.getPosition().distanceTo(this.player.getPosition()) > 40
    ) {
      this.encounterRelocateTime += deltaSeconds;
      if (this.encounterRelocateTime > 3) {
        this.spawnZombie();
        this.encounterRelocateTime = 0;
      }
    } else this.encounterRelocateTime = 0;
    this.companion.update(deltaSeconds, this.player.getPosition(), this.player.root.rotation.y, this.world);
    if (this.input.consumeInventoryPressed()) this.toggleInventory();
    if (this.input.consumeInteractPressed()) this.handleInteract();
    if (this.input.consumeAbilityPressed()) this.handleCreatureAbility();
    if (this.input.consumeAttackPressed()) this.handlePlayerAttack();
    if (this.input.consumeRestartPressed()) {
      if (this.player.getHealth() <= 0) this.resetEncounter();
      else if (this.firearms.reload() && this.multiplayer.connected)
        this.multiplayer.send('reload', { weapon: this.firearms.selected });
    }

    if (!this.multiplayer.connected && !this.zombie.isDead()) {
      const landedHit = this.zombie.update(this.player.getPosition(), deltaSeconds, this.world);
      if (landedHit && this.player.getHealth() > 0) {
        const appliedDamage = this.player.takeDamage(this.zombie.damage);
        if (appliedDamage > 0) {
          this.damageFlashTimer = 0.2;
          if (this.companion.isBound()) this.addBondStrain(18);
          this.showToast(`YOU WERE HIT  //  -${appliedDamage} VITALITY`, 'danger');
          if (this.player.getHealth() <= 0) {
            this.defeatOverlay?.classList.add('visible');
            this.say('defeat');
            this.showToast('EXPEDITION FAILED  //  Press R to try again.', 'danger');
          }
        }
      }
    } else if (!this.multiplayer.connected && this.player.getHealth() > 0) {
      this.zombieRespawnTimer += deltaSeconds;
      if (this.zombieRespawnTimer >= 6) {
        this.spawnZombie();
        this.showToast(`NEW STRAIN  //  ${this.zombie.displayName.toUpperCase()} detected.`, 'warning');
      }
    }

    this.damageFlash?.classList.toggle('active', this.damageFlashTimer > 0);
    this.updateCamera(deltaSeconds);
    this.updateHud(deltaSeconds);
    this.minimap.update(
      this.player.getPosition(),
      this.zombie.isDead() ? null : this.zombie.getPosition(),
      this.player.root.rotation.y,
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
    this.coopCollection = null;
    this.collectionSignature = '';
    this.syncCollectionVisuals();
    if (this.currentCollection.creatures[this.currentCollection.active].owned && !this.recoveringBond)
      this.companion.bond();
    else this.companion.retreat();
    this.updateCraftingHud();
    this.clearRemotePlayers();
    this.remoteZombieGeneration = -1;
    this.zombie.dispose();
    this.zombie = new Zombie(this.scene, new THREE.Vector3(0.7, 0, -9.5));
    if (this.roomStatus) this.roomStatus.textContent = 'Solo · Cloud account';
    this.updateMissionHud();
    this.updateProgressHud();
  };
  private readonly onRoomEvent = (event: RoomEvent): void => {
    if (event.type === 'arsenal') {
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
      if (this.roomStatus) this.roomStatus.textContent = `Room ${event.code} · connected`;
      this.showToast(`ROOM JOINED  //  ${event.code}`, 'success');
      this.remoteZombieGeneration = -1;
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
      if (!this.multiplayer.connected) this.clearRemotePlayers();
    } else if (event.type === 'damage') {
      const lost = this.player.getHealth() - event.hp;
      if (lost > 0) {
        this.player.takeDamage(lost);
        this.damageFlashTimer = 0.2;
        if (this.companion.isBound()) this.addBondStrain(18);
        if (event.hp <= 0) {
          this.defeatOverlay?.classList.add('visible');
          this.say('defeat');
        }
      }
      if (event.hp === 100 && this.player.getHealth() < 100) this.player.reset();
    } else if (event.type === 'kill') {
      // In co-op the server credits materials to the verified killer; never spawn local salvage.
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
  private syncRoomZombie(dt: number): void {
    const state = this.multiplayer.zombie;
    if (!state) return;
    if (state.generation !== this.remoteZombieGeneration) {
      this.zombie.dispose();
      this.zombie = new Zombie(
        this.scene,
        new THREE.Vector3(state.x, 0, state.z),
        state.strain as import('./Zombie').InfectedStrain,
        state.generation,
      );
      this.remoteZombieGeneration = state.generation;
    }
    const motion = new THREE.Vector3(state.x - this.zombie.root.position.x, 0, state.z - this.zombie.root.position.z);
    this.zombie.updateNetworkVisual(dt, motion);
    this.zombie.root.position.set(state.x, 0, state.z);
    const damageNeeded = this.zombie.getHealth() - state.hp;
    if (damageNeeded > 0) this.zombie.takeDamage(damageNeeded);
  }

  private readonly handleGraphicsQuality = (event: Event): void => {
    const quality = (event.target as HTMLSelectElement).value;
    const low = quality === 'low';
    this.cinematic = quality === 'cinematic';
    if (this.cinematic && !this.effects) this.effects = new SceneEffects(this.renderer, this.scene, this.camera);
    this.renderer.shadowMap.enabled = !low;
    this.renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    this.resize();
  };
  private get currentCollection(): CollectionState {
    return this.multiplayer.connected
      ? (this.coopCollection ?? {
          ...this.collection.state,
          creatures: {
            lanternkin: { owned: false, xp: 0 },
            emberling: { owned: false, xp: 0 },
            reedwisp: { owned: false, xp: 0 },
          },
        })
      : this.collection.state;
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
    if (target) this.selectCreature(target.dataset.species as SpeciesId);
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
    const signature = JSON.stringify(c);
    if (signature === this.collectionSignature) return;
    this.collectionSignature = signature;
    const roster = document.querySelector('#creature-roster');
    if (roster) {
      roster.replaceChildren();
      for (const id of SPECIES_IDS) {
        const button = document.createElement('button');
        button.type = 'button';
        button.dataset.species = id;
        button.disabled = !c.creatures[id].owned;
        button.className = id === c.active ? 'selected' : '';
        const power = creaturePower(id, c.creatures[id].xp);
        button.textContent = c.creatures[id].owned
          ? `${power.name} · ${power.stage + 1}/3`
          : `? ${CREATURES[id].habitat}`;
        button.title = c.creatures[id].owned
          ? 'Select companion'
          : `Find ${CREATURES[id].name} at ${CREATURES[id].habitat}`;
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
    const hint = document.querySelector('#exploration-hint');
    if (hint)
      hint.textContent =
        this.player.getHealth() <= 0
          ? ''
          : nearby
            ? `E · BOND WITH ${CREATURES[nearby].name.toUpperCase()}`
            : this.firearms.nearSupply(pos)
              ? 'E · RESUPPLY AMMO (45s RESTOCK)'
              : '';
  }
  private handleShooting(): void {
    if (this.player.getHealth() <= 0) return;
    // Shoot in the camera direction even when moving sideways.
    this.player.root.rotation.y = this.cameraYaw;
    this.aimRay.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const weapon = WEAPONS[this.firearms.selected];
    const camOrigin = this.aimRay.ray.origin,
      camDirection = this.aimRay.ray.direction;
    const camHit = shotDistance(camOrigin, camDirection, this.zombie.getPosition(), weapon.range);
    const camDistance = camHit ?? obstacleDistance(camOrigin, camDirection, weapon.range);
    const aimPoint = camOrigin.clone().addScaledVector(camDirection, camDistance);
    const origin = this.player.getPosition().clone();
    origin.y = 1.32;
    const direction = aimPoint.sub(origin).normalize();
    if (!this.firearms.tryFire()) return;
    this.recoilOffset += this.firearms.selected === 'rifle' ? 0.009 : 0.022;
    const hit = !this.zombie.isDead() ? shotDistance(origin, direction, this.zombie.getPosition(), weapon.range) : null;
    const visualOrigin = this.firearms.muzzle();
    const visualTarget = origin
      .clone()
      .addScaledVector(direction, hit ?? obstacleDistance(origin, direction, weapon.range));
    const visualDirection = visualTarget.sub(visualOrigin);
    this.firearms.effect(visualOrigin, visualDirection.clone().normalize(), visualDirection.length());
    if (this.multiplayer.connected)
      this.multiplayer.send('shoot', {
        weapon: this.firearms.selected,
        direction: { x: direction.x, y: direction.y, z: direction.z },
      });
    else if (hit !== null) {
      this.firearms.markHit();
      if (this.zombie.takeDamage(weapon.damage)) {
        this.registerKill(false);
        this.zombieRespawnTimer = 0;
      }
    }
  }

  private say(key: keyof Game['radioLines']): void {
    // Rook is an original radio operator, not a character or voice from another game.
    if (this.radioLine) this.radioLine.textContent = this.radioLines[key];
    this.radioTimer = 4.8;
    this.radioPanel?.classList.add('visible');
  }

  private spawnLoot(): void {
    const ids: ItemId[] = ['spore', 'scrap', 'fiber'];
    const id = ids[this.dropSequence % ids.length];
    this.dropSequence++;
    const drop = new Loot(this.scene, id, this.zombie.getPosition().clone());
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
      else
        this.showToast(
          this.firearms.resupply(playerPos)
            ? 'SUPPLIES RECOVERED  //  Ammo reserves restored.'
            : 'CACHE RESTOCKING  //  Returns after 45 seconds.',
          'info',
        );
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
    } else if (
      !this.zombie.isDead() &&
      this.zombie.getPosition().distanceTo(this.player.getPosition()) <= power.range
    ) {
      const killed = this.zombie.takeDamage(power.damage);
      if (killed) {
        this.registerKill(true);
        this.zombieRespawnTimer = 0;
        this.showToast('LANTERN PULSE  //  Infected eliminated! +50 XP / +40 companion XP', 'success');
      } else {
        const evolved = this.collection.grant(CREATURE_XP_PER_PULSE_HIT);
        if (evolved) this.showEvolution(evolved);
        const leveled = this.progression.grantCreatureXp(CREATURE_XP_PER_PULSE_HIT);
        this.showToast(
          leveled
            ? 'LANTERNKIN LEVEL UP!'
            : `${power.name.toUpperCase()} PULSE  //  ${power.damage} damage / +10 companion XP`,
          'success',
        );
      }
    } else {
      this.showToast('LANTERN PULSE  //  No infected within range.', 'info');
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
          : 'LOCKED · FIND LANTERNKIN'
        : this.abilityCooldown > 0
          ? `PULSE RECHARGING · ${Math.ceil(this.abilityCooldown)}s`
          : `Q · ${this.activePower.name.toUpperCase()} PULSE`;
    }
  }

  private handlePlayerAttack(): void {
    if (this.player.getHealth() <= 0 || this.attackCooldown > 0) return;
    this.attackCooldown = 0.48;
    this.player.triggerAttack();

    if (this.zombie.isDead()) {
      this.showToast('NO TARGET  //  Wait for the next infected.', 'info');
      return;
    }

    if (this.multiplayer.connected) {
      this.multiplayer.send('attack', { sharpened: this.crafting.upgrades.sharpened });
      return;
    }
    const toEnemy = this.zombie.getPosition().clone().sub(this.player.getPosition());
    toEnemy.y = 0;
    const distance = toEnemy.length();
    const facing = new THREE.Vector3(-Math.sin(this.player.root.rotation.y), 0, -Math.cos(this.player.root.rotation.y));
    const directionToEnemy = distance > 0.001 ? toEnemy.clone().normalize() : facing.clone();
    const facingDot = facing.dot(directionToEnemy);

    if (distance > (this.crafting.upgrades.balanced ? 3.35 : 2.65) || facingDot < -0.15) {
      this.showToast('SWING MISSED  //  Get closer and face the infected.', 'info');
      return;
    }

    const killed = this.zombie.takeDamage(this.crafting.upgrades.sharpened ? 55 : 40);
    if (killed) {
      this.registerKill(false);
      this.zombieRespawnTimer = 0;
      this.showToast('INFECTED ELIMINATED  //  +50 PLAYER XP', 'success');
    } else {
      this.showToast(`HIT CONFIRMED  //  ${this.zombie.getHealth()} INFECTED HEALTH`, 'success');
    }
  }

  private registerKill(fromPulse: boolean): void {
    this.spawnLoot();
    if (!this.multiplayer.connected) this.expedition.recordKill();
    this.updateMissionHud();
    const leveled = this.progression.recordKill();
    const evolved = this.collection.grant(fromPulse ? 40 : 12);
    if (evolved) this.showEvolution(evolved);
    const creatureLeveled = fromPulse && this.progression.grantCreatureXp(CREATURE_XP_PER_PULSE_KILL);
    if (leveled || creatureLeveled) {
      this.showToast(leveled ? 'LEVEL UP  //  Your survivor grew stronger!' : 'LANTERNKIN LEVEL UP!', 'success');
    }
  }

  private spawnZombie(): void {
    this.zombie.dispose();
    const playerPosition = this.player.getPosition();
    const spawnDirection = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    const spawnPosition = playerPosition.clone().addScaledVector(spawnDirection, 9.5);
    spawnPosition.y = 0;
    this.world.constrainActorPosition(spawnPosition, 0.5);
    this.zombie = new Zombie(this.scene, spawnPosition);
    if (this.assetManifest.zombie?.url) void this.zombie.installModel(this.assetManifest.zombie);
    this.zombieRespawnTimer = 0;
  }

  private resetEncounter(): void {
    this.player.reset();
    if (!this.multiplayer.connected) this.firearms.reset();
    if (!this.multiplayer.connected) this.expedition.resetMission();
    this.updateMissionHud();
    if (this.multiplayer.connected) this.multiplayer.send('restart');
    // On defeat, strain is reset but a retreating companion remains recoverable.
    if (this.companion.isBound()) this.bondStrain = Math.max(0, this.bondStrain - 20);
    this.cameraYaw = 0;
    this.attackCooldown = 0;
    this.zombieRespawnTimer = 0;
    this.defeatOverlay?.classList.remove('visible');
    this.zombie.dispose();
    this.zombie = new Zombie(this.scene, new THREE.Vector3(0.7, 0, -9.5));
    this.remoteZombieGeneration = -1;
    this.showToast(`EXPEDITION RESTARTED  //  ${this.zombie.displayName.toUpperCase()} ahead.`, 'info');
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
    const pitch = this.cameraPitch - this.recoilOffset;
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

    if (!this.zombie.isDead()) {
      const enemyHealth = this.zombie.getHealth();
      this.enemyPanel?.classList.add('visible');
      if (this.enemyHealthFill)
        this.enemyHealthFill.style.width = `${(enemyHealth / this.zombie.getMaxHealth()) * 100}%`;
      if (this.enemyHealthText) this.enemyHealthText.textContent = `${enemyHealth} / ${this.zombie.getMaxHealth()}`;
      if (this.enemyStateText) this.enemyStateText.textContent = this.zombie.displayName.toUpperCase();
    } else {
      this.enemyPanel?.classList.remove('visible');
    }

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
    if (this.cinematic && this.effects) this.effects.render();
    else this.renderer.render(this.scene, this.camera);
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
    this.input.dispose();
    this.abilityButton?.removeEventListener('click', this.handleAbilityClick);
    document.querySelector('#room-join')?.removeEventListener('click', this.handleJoinRoom);
    document.querySelector('#room-leave')?.removeEventListener('click', this.handleLeaveRoom);
    this.multiplayer.disconnect();
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
    this.zombie.dispose();
    this.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material.dispose();
    });
    this.firearms.dispose();
    this.world.dispose();
    this.environmentMap?.dispose();
    for (const wild of this.wildCreatures.values()) wild.dispose();
    document.querySelector('#creature-roster')?.removeEventListener('click', this.handleRosterClick);
    document.querySelector('#graphics-quality')?.removeEventListener('change', this.handleGraphicsQuality);
    this.effects?.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    document.body.classList.remove('is-pointer-locked');
  }
}
