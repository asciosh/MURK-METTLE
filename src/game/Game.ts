import * as THREE from 'three';
import { InputController } from './InputController';
import { Player } from './Player';
import { World } from './World';
import { Zombie } from './Zombie';
import { Companion } from './Companion';
import { Progression, levelFromXp, xpInLevel, CREATURE_XP_PER_PULSE_HIT, CREATURE_XP_PER_PULSE_KILL } from './Progression';

export class Game {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(58, 1, 0.1, 120);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly clock = new THREE.Clock();
  private readonly world: World;
  private readonly player: Player;
  private readonly input: InputController;
  private zombie: Zombie;
  private readonly companion: Companion;
  private readonly creaturePanel: HTMLElement | null;
  private readonly bondHint: HTMLElement | null;
  private readonly abilityButton: HTMLButtonElement | null;
  private abilityCooldown = 0;
  private hasCollectedLanternkin = false;
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.setSize(viewport.clientWidth, viewport.clientHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'game-canvas';
    this.renderer.domElement.setAttribute('aria-label', '3D game view. Click to capture the mouse.');
    this.renderer.domElement.tabIndex = 0;
    this.viewport.prepend(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x17231c);
    this.scene.fog = new THREE.Fog(0x17231c, 28, 76);
    this.createLighting();

    this.world = new World(this.scene);
    this.player = new Player(this.scene);
    this.zombie = new Zombie(this.scene, new THREE.Vector3(0.7, 0, -9.5));
    this.companion = new Companion(this.scene);
    if (this.progression.state.lanternkinBonded) {
      this.companion.bond();
      this.hasCollectedLanternkin = true;
    }
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
    this.updateCompanionHud();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.viewport);
    this.resize();
    this.updateCamera(1);
    this.updateHud(1);
    this.updateProgressHud();
    this.showToast('INFECTED CONTACT  //  Close the distance. SPACE or left-click to strike.', 'info');
  }

  private createLighting(): void {
    const hemisphere = new THREE.HemisphereLight(0xd7e9d5, 0x384236, 2.05);
    this.scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xffe3bd, 2.35);
    sun.position.set(-14, 24, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
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

  private readonly tick = (): void => {
    if (!this.running) return;
    const deltaSeconds = Math.min(this.clock.getDelta(), 0.05);
    this.attackCooldown = Math.max(0, this.attackCooldown - deltaSeconds);
    this.abilityCooldown = Math.max(0, this.abilityCooldown - deltaSeconds);
    this.toastTimer = Math.max(0, this.toastTimer - deltaSeconds);
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

    this.companion.update(deltaSeconds, this.player.getPosition(), this.player.root.rotation.y, this.world);
    if (this.input.consumeInteractPressed()) this.handleBond();
    if (this.input.consumeAbilityPressed()) this.handleCreatureAbility();
    if (this.input.consumeAttackPressed()) this.handlePlayerAttack();
    if (this.input.consumeRestartPressed() && this.player.getHealth() <= 0) this.resetEncounter();

    if (!this.zombie.isDead()) {
      const landedHit = this.zombie.update(this.player.getPosition(), deltaSeconds, this.world);
      if (landedHit && this.player.getHealth() > 0) {
        const appliedDamage = this.player.takeDamage(12);
        if (appliedDamage > 0) {
          this.damageFlashTimer = 0.2;
          this.showToast(`YOU WERE HIT  //  -${appliedDamage} VITALITY`, 'danger');
          if (this.player.getHealth() <= 0) {
            this.defeatOverlay?.classList.add('visible');
            this.showToast('EXPEDITION FAILED  //  Press R to try again.', 'danger');
          }
        }
      }
    } else if (this.player.getHealth() > 0) {
      this.zombieRespawnTimer += deltaSeconds;
      if (this.zombieRespawnTimer >= 6) {
        this.spawnZombie();
        this.showToast('NEW INFECTED CONTACT  //  Stay alert.', 'warning');
      }
    }

    this.damageFlash?.classList.toggle('active', this.damageFlashTimer > 0);
    this.updateCamera(deltaSeconds);
    this.updateHud(deltaSeconds);
    this.renderer.render(this.scene, this.camera);
  };

  private readonly handleAbilityClick = (): void => { this.handleCreatureAbility(); };

  private handleBond(): void {
    if (this.player.getHealth() <= 0 || this.companion.isBound()) return;
    if (!this.companion.canBond(this.player.getPosition())) {
      this.showToast('GET CLOSER  //  Approach the glowing creature.', 'info');
      return;
    }
    this.companion.bond();
    this.hasCollectedLanternkin = true;
    this.progression.bondLanternkin();
    this.showToast('NEW BOND  //  Lanternkin joined your field collection! Press Q to pulse.', 'success');
    this.updateCompanionHud();
  }

  private handleCreatureAbility(): void {
    if (this.player.getHealth() <= 0 || !this.companion.isBound()) return;
    if (this.abilityCooldown > 0) return;
    this.abilityCooldown = 8;
    this.companion.triggerPulse();
    if (!this.zombie.isDead() && this.zombie.getPosition().distanceTo(this.companion.getPosition()) <= 7.5) {
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
    this.updateCompanionHud();
  }

  private updateCompanionHud(): void {
    this.creaturePanel?.classList.toggle('bonded', this.hasCollectedLanternkin);
    if (this.bondHint) {
      const near = this.companion.canBond(this.player.getPosition());
      this.bondHint.classList.toggle('visible', near && this.player.getHealth() > 0);
    }
    if (this.abilityButton) {
      this.abilityButton.disabled = !this.hasCollectedLanternkin || this.abilityCooldown > 0 || this.player.getHealth() <= 0;
      this.abilityButton.textContent = !this.hasCollectedLanternkin
        ? 'LOCKED · FIND LANTERNKIN'
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

    const toEnemy = this.zombie.getPosition().clone().sub(this.player.getPosition());
    toEnemy.y = 0;
    const distance = toEnemy.length();
    const facing = new THREE.Vector3(-Math.sin(this.player.root.rotation.y), 0, -Math.cos(this.player.root.rotation.y));
    const directionToEnemy = distance > 0.001 ? toEnemy.clone().normalize() : facing.clone();
    const facingDot = facing.dot(directionToEnemy);

    if (distance > 2.65 || facingDot < -0.15) {
      this.showToast('SWING MISSED  //  Get closer and face the infected.', 'info');
      return;
    }

    const killed = this.zombie.takeDamage(40);
    if (killed) {
      this.registerKill(false);
      this.zombieRespawnTimer = 0;
      this.showToast('INFECTED ELIMINATED  //  +50 PLAYER XP', 'success');
    } else {
      this.showToast(`HIT CONFIRMED  //  ${this.zombie.getHealth()} INFECTED HEALTH`, 'success');
    }
  }

  private registerKill(fromPulse: boolean): void {
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
    this.zombieRespawnTimer = 0;
  }

  private resetEncounter(): void {
    this.player.reset();
    this.cameraYaw = 0;
    this.attackCooldown = 0;
    this.zombieRespawnTimer = 0;
    this.defeatOverlay?.classList.remove('visible');
    this.zombie.dispose();
    this.zombie = new Zombie(this.scene, new THREE.Vector3(0.7, 0, -9.5));
    this.showToast('EXPEDITION RESTARTED  //  The infected is ahead.', 'info');
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
      if (this.enemyHealthFill) this.enemyHealthFill.style.width = `${enemyHealth}%`;
      if (this.enemyHealthText) this.enemyHealthText.textContent = `${enemyHealth} / 100`;
      if (this.enemyStateText) this.enemyStateText.textContent = 'INFECTED RUNNER';
    } else {
      this.enemyPanel?.classList.remove('visible');
    }

    this.updateCompanionHud();
    this.updateProgressHud();
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
