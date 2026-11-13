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
import { Crafting, RECIPES, type RecipeId } from './Crafting';
import { Multiplayer, type RoomEvent } from './Multiplayer';
import { Expedition, EXTRACTION_X, EXTRACTION_Z, EXTRACTION_RADIUS, KILLS_REQUIRED, SALVAGE_REQUIRED } from './Expedition';
import { Progression, levelFromXp, xpInLevel, CREATURE_XP_PER_PULSE_HIT, CREATURE_XP_PER_PULSE_KILL } from './Progression';

export class Game {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 120);
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
  private readonly multiplayer = new Multiplayer();
  private readonly remotePlayers = new Map<string, Player>();
  private readonly roomStatus: HTMLElement | null;
  private readonly roomCode: HTMLInputElement | null;
  private readonly craftingList: HTMLElement | null;
  private networkTimer = 0;
  private remoteZombieGeneration = -1;
  private antidotePending = false;

  private readonly drops: Loot[] = [];
  private dropSequence = 0;
  private readonly inventoryPanel: HTMLElement | null;
  private readonly inventoryGrid: HTMLElement | null;
  private readonly inventoryButton: HTMLButtonElement | null;
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
  private inventoryOpen = false;
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
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'game-canvas';
    this.renderer.domElement.setAttribute('aria-label', '3D game view. Click to capture the mouse.');
    this.renderer.domElement.tabIndex = 0;
    this.viewport.prepend(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x283c32);
    this.scene.fog = new THREE.FogExp2(0x283c32, 0.014);
    this.createLighting();

    this.world = new World(this.scene);
    this.createExtractionBeacon();
    this.player = new Player(this.scene);
    this.zombie = new Zombie(this.scene, new THREE.Vector3(0.7, 0, -9.5));
    this.companion = new Companion(this.scene);
    void this.loadOptionalModels();
    if (this.progression.state.lanternkinBonded) {
      try { this.recoveringBond = localStorage.getItem(this.bondRetreatKey) === '1'; } catch { /* Storage disabled. */ }
      if (!this.recoveringBond) this.companion.bond();
    }
    this.missionStatus = document.querySelector('#mission-status');
    this.missionKills = document.querySelector('#mission-kills');
    this.missionSalvage = document.querySelector('#mission-salvage');
    this.missionTotal = document.querySelector('#mission-total');
    this.missionHint = document.querySelector('#mission-hint');
    this.roomStatus = document.querySelector('#room-status');
    this.roomCode = document.querySelector<HTMLInputElement>('#room-code');
    this.craftingList = document.querySelector('#crafting-list');
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
    this.inventoryPanel = document.querySelector<HTMLElement>('#inventory-panel');
    this.inventoryGrid = document.querySelector<HTMLElement>('#inventory-grid');
    this.inventoryButton = document.querySelector<HTMLButtonElement>('#inventory-button');
    this.lootHint = document.querySelector<HTMLElement>('#loot-hint');
    this.bondStrainFill = document.querySelector<HTMLElement>('#bond-strain-fill');
    this.bondStrainLabel = document.querySelector<HTMLElement>('#bond-strain-label');
    this.radioPanel = document.querySelector<HTMLElement>('#radio-panel');
    this.radioLine = document.querySelector<HTMLElement>('#radio-line');
    this.inventoryButton?.addEventListener('click', this.handleInventoryClick);
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
    this.showToast('INFECTED CONTACT  //  Close the distance. SPACE or left-click to strike.', 'info');
  }

  private async loadOptionalModels(): Promise<void> {
    this.assetManifest = await readModelManifest();
    const models = this.assetManifest;
    if (models.survivor?.url) void this.player.installModel(models.survivor);
    if (models.zombie?.url) void this.zombie.installModel(models.zombie);
    if (models.lanternkin?.url) void this.companion.installModel(models.lanternkin);
  }

  private createLighting(): void {
    const hemisphere = new THREE.HemisphereLight(0xd7e9d5, 0x384236, 2.05);
    this.scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xffe3bd, 2.35);
    sun.position.set(-14, 24, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 70;
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.renderer.setAnimationLoop(this.tick);
  }

  enterField(): void { this.fieldEntered = true; }

  requestMouseCapture(): void { this.input.requestCapture(); }

  private readonly tick = (): void => {
    if (!this.running) return;
    if (!this.fieldEntered) {
      this.clock.getDelta(); // Do not accumulate a large first gameplay frame.
      this.renderer.render(this.scene, this.camera);
      return;
    }
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05);
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
    this.cameraPitch = THREE.MathUtils.clamp(this.cameraPitch + mouse.y * 0.0018, -0.18, 0.72);

    const axes = this.input.getMovementAxes();
    const forward = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
    const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
    const movement = forward.multiplyScalar(axes.forward).addScaledVector(right, axes.right);
    if (movement.lengthSq() > 1) movement.normalize();
    if (this.player.getHealth() <= 0) movement.set(0, 0, 0);

    this.player.update(movement, deltaSeconds, this.input.isSprinting(), this.world);
    if (this.multiplayer.connected) {
      this.networkTimer += deltaSeconds;
      if (this.networkTimer >= 0.12) {
        this.networkTimer = 0;
        const pos = this.player.getPosition();
        this.multiplayer.send('move', { x: pos.x, z: pos.z, yaw: this.player.root.rotation.y });
      }
      this.updateRemotePlayers(deltaSeconds);
      this.syncRoomZombie();
    }

    this.companion.update(deltaSeconds, this.player.getPosition(), this.player.root.rotation.y, this.world);
    if (this.input.consumeInventoryPressed()) this.toggleInventory();
    if (this.input.consumeInteractPressed()) this.handleInteract();
    if (this.input.consumeAbilityPressed()) this.handleCreatureAbility();
    if (this.input.consumeAttackPressed()) this.handlePlayerAttack();
    if (this.input.consumeRestartPressed() && this.player.getHealth() <= 0) this.resetEncounter();

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
    this.minimap.update(this.player.getPosition(), this.zombie.isDead() ? null : this.zombie.getPosition(), this.player.root.rotation.y);
    this.renderer.render(this.scene, this.camera);
  };

  private readonly handleAbilityClick = (): void => { this.handleCreatureAbility(); };
  private readonly handleInventoryClick = (): void => { this.toggleInventory(); };

  private toggleInventory(): void {
    this.inventoryOpen = !this.inventoryOpen;
    this.inventoryPanel?.classList.toggle('visible', this.inventoryOpen);
    if (this.inventoryButton) this.inventoryButton.setAttribute('aria-expanded', String(this.inventoryOpen));
    this.updateInventoryHud();
  }

  private updateInventoryHud(): void {
    if (!this.inventoryGrid) return;
    this.inventoryGrid.replaceChildren();
    for (const [id, def] of Object.entries(ITEM_DEFINITIONS) as [ItemId, typeof ITEM_DEFINITIONS[ItemId]][]) {
      const row = document.createElement('div');
      row.className = 'inventory-item';
      const title = document.createElement('span');
      title.textContent = def.name;
      title.title = def.description;
      const count = document.createElement('strong');
      count.textContent = `${this.inventory.state[id]} / 20`;
      row.append(title, count);
      this.inventoryGrid.append(row);
    }
  }

  private updateCraftingHud(): void {
    if (!this.craftingList) return;
    this.craftingList.replaceChildren();
    for (const [id, recipe] of Object.entries(RECIPES) as [RecipeId, typeof RECIPES[RecipeId]][]) {
      const button = document.createElement('button');
      button.className = 'craft-button';
      const completed = id !== 'restorative' && this.crafting.upgrades[id];
      const cost = Object.entries(recipe.cost).map(([item, count]) => `${count} ${item}`).join(' + ');
      button.textContent = `${recipe.name} · ${recipe.description} · ${completed ? 'CRAFTED' : cost}`;
      button.disabled = !this.crafting.canCraft(id);
      button.addEventListener('click', () => {
        if (!this.crafting.craft(id)) return;
        if (id === 'restorative') {
          this.bondStrain = Math.max(0, this.bondStrain - 60);
          if (this.recoveringBond) this.antidotePending = true;
        }
        this.updateInventoryHud();
        this.updateCraftingHud();
        this.showToast(`CRAFTED  //  ${recipe.name}`, 'success');
      });
      this.craftingList.append(button);
    }
  }

  private readonly handleJoinRoom = (): void => {
    const code = this.roomCode?.value.trim().toUpperCase() || 'BLOOM';
    this.multiplayer.connect(code);
    this.updateMissionHud();
    if (this.roomStatus) this.roomStatus.textContent = `Connecting to ${code}…`;
  };
  private readonly handleLeaveRoom = (): void => {
    this.multiplayer.disconnect();
    this.clearRemotePlayers();
    this.remoteZombieGeneration = -1;
    this.zombie.dispose();
    this.zombie = new Zombie(this.scene, new THREE.Vector3(0.7, 0, -9.5));
    if (this.roomStatus) this.roomStatus.textContent = 'Solo · local save';
    this.updateMissionHud();
  };
  private readonly onRoomEvent = (event: RoomEvent): void => {
    if (event.type === 'welcome') {
      if (this.roomStatus) this.roomStatus.textContent = `Room ${event.code} · connected`;
      this.showToast(`ROOM JOINED  //  ${event.code}`, 'success');
      this.remoteZombieGeneration = -1;
      this.updateMissionHud();
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
        if (event.hp <= 0) { this.defeatOverlay?.classList.add('visible'); this.say('defeat'); }
      }
      if (event.hp === 100 && this.player.getHealth() < 100) this.player.reset();
    } else if (event.type === 'kill') {
      // Prototype: shared enemy kill; each player receives an individual salvage drop.
      this.spawnLoot();
      if (event.by === this.multiplayer.id) {
        const leveled = this.progression.recordKill();
        if (event.pulse) this.progression.grantCreatureXp(CREATURE_XP_PER_PULSE_KILL);
        this.showToast(leveled ? 'LEVEL UP  //  Co-op kill!' : 'INFECTED ELIMINATED  //  +50 XP', 'success');
      } else this.showToast('TEAM KILL  //  Salvage available!', 'success');
    }
  };
  private updateRemotePlayers(deltaSeconds: number): void {
    for (const [id, state] of this.multiplayer.peers) {
      let actor = this.remotePlayers.get(id);
      if (!actor) { actor = new Player(this.scene); actor.root.name = `ally-${id}`; this.remotePlayers.set(id, actor); }
      actor.root.position.lerp(new THREE.Vector3(state.x, 0, state.z), Math.min(1, deltaSeconds * 14));
      actor.root.rotation.y = state.yaw;
      actor.root.visible = state.hp > 0;
    }
    for (const [id, actor] of this.remotePlayers) {
      if (!this.multiplayer.peers.has(id)) { actor.dispose(); this.remotePlayers.delete(id); }
    }
    if (this.roomStatus && this.multiplayer.code) this.roomStatus.textContent = `Room ${this.multiplayer.code} · ${this.multiplayer.peers.size + 1}/4 players`;
  }
  private clearRemotePlayers(): void {
    for (const actor of this.remotePlayers.values()) actor.dispose();
    this.remotePlayers.clear();
  }
  private syncRoomZombie(): void {
    const state = this.multiplayer.zombie;
    if (!state) return;
    if (state.generation !== this.remoteZombieGeneration) {
      this.zombie.dispose();
      this.zombie = new Zombie(this.scene, new THREE.Vector3(state.x, 0, state.z), state.strain as import('./Zombie').InfectedStrain, state.generation);
      this.remoteZombieGeneration = state.generation;
    }
    this.zombie.root.position.lerp(new THREE.Vector3(state.x, 0, state.z), 0.3);
    const damageNeeded = this.zombie.getHealth() - state.hp;
    if (damageNeeded > 0) this.zombie.takeDamage(damageNeeded);
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
    if (!this.multiplayer.connected && this.expedition.ready && this.isNearExtraction(playerPos)) {
      if (this.expedition.extract()) {
        const levelUp = this.progression.grantPlayerXp(150);
        this.showToast(levelUp ? 'EXTRACTED  //  +150 XP · LEVEL UP!' : 'EXTRACTED  //  +150 XP · Mission complete!', 'success');
        this.sayMissionComplete();
        this.updateMissionHud();
      }
      return;
    }
    const candidate = this.drops.find(drop => drop.canPickUp(playerPos));
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
      try { localStorage.setItem(this.bondRetreatKey, '1'); } catch { /* Storage disabled. */ }
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
    this.companion.bond();
    if (this.recoveringBond) {
      this.recoveringBond = false;
      try { localStorage.removeItem(this.bondRetreatKey); } catch { /* Storage disabled. */ }
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
    this.abilityCooldown = 8;
    this.companion.triggerPulse();
    if (this.companion.isBound() && this.bondStrain >= 20 && this.radioIndex <= 1) {
      this.radioIndex = 2;
      this.say('pulse');
    }
    if (this.multiplayer.connected) {
      this.multiplayer.send('pulse');
      this.showToast('PULSE RELEASED  //  Server checks target distance.', 'info');
    } else if (!this.zombie.isDead() && this.zombie.getPosition().distanceTo(this.companion.getPosition()) <= 7.5) {
      const killed = this.zombie.takeDamage(35);
      if (killed) {
        this.registerKill(true);
        this.zombieRespawnTimer = 0;
        this.showToast('LANTERN PULSE  //  Infected eliminated! +50 XP / +40 companion XP', 'success');
      } else {
        const leveled = this.progression.grantCreatureXp(CREATURE_XP_PER_PULSE_HIT);
        this.showToast(leveled ? 'LANTERNKIN LEVEL UP!' : 'LANTERN PULSE  //  35 damage / +10 companion XP', 'success');
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
    if (this.bondStrainLabel) this.bondStrainLabel.textContent = this.recoveringBond ? 'SIGNAL LOST · RECOVER LANTERNKIN' : `${Math.round(this.bondStrain)}% STRAIN`;
    if (this.bondHint) {
      const near = this.companion.canBond(this.player.getPosition());
      this.bondHint.classList.toggle('visible', near && this.player.getHealth() > 0);
      this.bondHint.textContent = this.recoveringBond ? 'PRESS E TO RECOVER LANTERNKIN' : 'PRESS E TO BOND WITH LANTERNKIN';
    }
    if (this.abilityButton) {
      this.abilityButton.disabled = !this.companion.isBound() || this.abilityCooldown > 0 || this.player.getHealth() <= 0;
      this.abilityButton.textContent = !this.companion.isBound()
        ? (this.recoveringBond ? 'BOND LOST · RECOVER COMPANION' : 'LOCKED · FIND LANTERNKIN')
        : this.abilityCooldown > 0
          ? `PULSE RECHARGING · ${Math.ceil(this.abilityCooldown)}s`
          : 'Q · LANTERN PULSE READY';
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
    this.zombie = new Zombie(this.scene, spawnPosition);
    if (this.assetManifest.zombie?.url) void this.zombie.installModel(this.assetManifest.zombie);
    this.zombieRespawnTimer = 0;
  }

  private resetEncounter(): void {
    this.player.reset();
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
    const horizontalDistance = 7.4;
    const desiredPosition = new THREE.Vector3(
      playerPosition.x + Math.sin(this.cameraYaw) * horizontalDistance,
      playerPosition.y + 2.25 + this.cameraPitch * 3.0,
      playerPosition.z + Math.cos(this.cameraYaw) * horizontalDistance,
    );
    const smoothing = 1 - Math.exp(-9 * Math.max(deltaSeconds, 0));
    this.camera.position.lerp(desiredPosition, smoothing);
    this.camera.lookAt(playerPosition.x, playerPosition.y + 1.12, playerPosition.z);
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
      if (this.enemyHealthFill) this.enemyHealthFill.style.width = `${(enemyHealth / this.zombie.getMaxHealth()) * 100}%`;
      if (this.enemyHealthText) this.enemyHealthText.textContent = `${enemyHealth} / ${this.zombie.getMaxHealth()}`;
      if (this.enemyStateText) this.enemyStateText.textContent = this.zombie.displayName.toUpperCase();
    } else {
      this.enemyPanel?.classList.remove('visible');
    }

    this.updateCompanionHud();
    const nearestDrop = this.drops.find(drop => drop.canPickUp(position));
    if (this.missionHint) {
      const extractionPossible = !this.multiplayer.connected && this.expedition.ready && this.isNearExtraction(position) && health > 0;
      this.missionHint.textContent = extractionPossible ? 'PRESS E · EXTRACT · +150 XP' : '';
      this.missionHint.classList.toggle('visible', extractionPossible);
    }
    if (this.lootHint) {
      this.lootHint.textContent = nearestDrop ? `PRESS E · COLLECT ${ITEM_DEFINITIONS[nearestDrop.id].name.toUpperCase()}` : '';
      this.lootHint.classList.toggle('visible', Boolean(nearestDrop) && health > 0);
    }
    this.updateProgressHud();
    this.updateMissionHud();
    if (this.toastTimer <= 0) this.combatToast?.classList.remove('visible');
  }

  private updateProgressHud(): void {
    const state = this.progression.state;
    const playerXp = xpInLevel(state.playerXp);
    const companionXp = xpInLevel(state.lanternkinXp);
    if (this.playerLevelText) this.playerLevelText.textContent = `LV ${levelFromXp(state.playerXp)}`;
    if (this.playerXpFill) this.playerXpFill.style.width = `${playerXp.ratio * 100}%`;
    if (this.playerXpText) this.playerXpText.textContent = playerXp.required ? `${playerXp.current} / ${playerXp.required} XP` : 'MAX LEVEL';
    if (this.creatureLevelText) this.creatureLevelText.textContent = state.lanternkinBonded ? `LV ${levelFromXp(state.lanternkinXp)}` : 'UNBONDED';
    if (this.creatureXpFill) this.creatureXpFill.style.width = `${state.lanternkinBonded ? companionXp.ratio * 100 : 0}%`;
    if (this.creatureXpText) this.creatureXpText.textContent = !state.lanternkinBonded ? 'BOND TO EARN XP' : companionXp.required ? `${companionXp.current} / ${companionXp.required} XP` : 'MAX LEVEL';
    if (this.killText) this.killText.textContent = `${state.totalKills} TOTAL CLEARED`;
  }


  private isNearExtraction(position: THREE.Vector3): boolean {
    return Math.hypot(position.x - EXTRACTION_X, position.z - EXTRACTION_Z) <= EXTRACTION_RADIUS;
  }

  private createExtractionBeacon(): void {
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x9beddc, emissive: 0x157a71, emissiveIntensity: 1.6, transparent: true, opacity: 0.9, roughness: 0.35 });
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
    if (this.radioLine) this.radioLine.textContent = 'Rook: Samples secured, extraction confirmed. That is one more trip home.';
    this.radioTimer = 5;
    this.radioPanel?.classList.add('visible');
  }

  private updateMissionHud(): void {
    const coOp = this.multiplayer.connected;
    if (this.missionStatus) this.missionStatus.textContent = coOp ? 'CO-OP MISSIONS · COMING LATER' : this.expedition.ready ? 'OBJECTIVES COMPLETE · REACH BEACON' : 'SOLO EXPEDITION · ACTIVE';
    if (this.missionKills) this.missionKills.textContent = `${this.expedition.kills}/${KILLS_REQUIRED} infected eliminated`;
    if (this.missionSalvage) this.missionSalvage.textContent = `${this.expedition.salvage}/${SALVAGE_REQUIRED} salvage collected`;
    if (this.missionTotal) this.missionTotal.textContent = `${this.expedition.completed} successful extractions`;
    this.extractionBeacon.visible = !coOp;
  }

  private resize(): void {
    const width = Math.max(1, this.viewport.clientWidth);
    const height = Math.max(1, this.viewport.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
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
    this.clearRemotePlayers();
    this.inventoryButton?.removeEventListener('click', this.handleInventoryClick);
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
    this.renderer.dispose();
    this.renderer.domElement.remove();
    document.body.classList.remove('is-pointer-locked');
  }
}
