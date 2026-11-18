import * as THREE from 'three/webgpu';
import { SURVIVAL } from '../../../shared/survival.mjs';

import {
  CharacterController,
  type CharacterControllerResult
} from '../core/CharacterController';

import { KeyboardInput } from '../core/KeyboardInput';
import { ThirdPersonCamera } from '../core/ThirdPersonCamera';
import { PlayerAvatar } from '../core/PlayerAvatar';
import { InfectedController } from '../core/InfectedController';
import { InfectedModelPool } from '../core/InfectedModel';
import { InfectedAvatar } from '../core/InfectedAvatar';
import { selectSurvivorSkin, selectInfectedSkin, infectedSkinForSpawn, characterSkinFile, type SurvivorSkin, type InfectedSkin } from '../core/CharacterSkins';
import { TerrainGenerator } from '../core/TerrainGenerator';
import { PlayableHud } from './PlayableHud';
import {
  COMBAT,
  CombatController
} from '../core/CombatController';

import { findShotTarget, findMeleeTarget } from '../core/ShotQuery';
import { LootField, type LootItem } from '../core/LootField';
import { PickupController, PICKUP } from '../core/PickupController';
import { CombatFeedback } from '../core/CombatFeedback';
import {
  HordeDirector,
  createWaveSpawns,
  separateInfected
} from '../core/HordeDirector';

export class PlayableSession {
  private readonly keyboard = new KeyboardInput();
  private followCamera = new ThirdPersonCamera();
  private readonly avatar = new PlayerAvatar();
  private readonly infectedPools = new Map<InfectedSkin, InfectedModelPool>();
  private readonly infectedLoads = new Map<InfectedSkin, Promise<boolean>>();
  private readonly infectedVariants = new Map<InfectedAvatar, InfectedSkin>();
  private survivorVariant: SurvivorSkin = selectSurvivorSkin(new URLSearchParams(window.location.search).get('skin'));
  private readonly infectedSelection = selectInfectedSkin(new URLSearchParams(window.location.search).get('infected'));
  private readonly infected: InfectedAvatar[] = [];
  private infectedAttackHits = 0;
  private readonly hud = new PlayableHud();
  private combat = new CombatController();
  private readonly shotDirection = new THREE.Vector3();
  private readonly horde = new HordeDirector(
  SURVIVAL.waveDelay,
  SURVIVAL.maxEnemies
);

  private controller: CharacterController;
  private state: CharacterControllerResult;

  private previousPosition: [number, number, number];
  private aimPressed = false;
  private shootPressed = false;
  private reloadPressed = false;
  private meleePressed = false;
  private bandagePressed = false;
  private pickupPressed = false;
  private inventoryOpen = false;
  private readonly loot = new LootField();
  private readonly pickup = new PickupController();
  private pickupFacing: [number, number, number] | null = null;
  private lootNotice = '';
  private lootNoticeMs = 0;
  private readonly canCollectLoot = (item: Readonly<LootItem>) =>
    this.combat.pickupCapacity(item.kind) > 0;
  private readonly feedback = new CombatFeedback();
  private readonly muzzlePosition = new THREE.Vector3();

  private disposed = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly canvas: HTMLCanvasElement,
    private readonly terrain: TerrainGenerator,
    private readonly training = false,
    private readonly benchmark = false
  ) {
    this.controller = new CharacterController({
      speed: SURVIVAL.walkSpeed,
      radius: 0.4,
      terrain
    });

    this.state = this.controller.update(
      0,
      this.keyboard.read(),
      this.followCamera.getOrientation()
    );

    this.previousPosition = [...this.state.position];

    scene.add(this.avatar.root);
    scene.add(this.loot.root);
    scene.add(this.feedback.root);

    void this.loadSelectedSurvivor().then(loaded => {
      if (!loaded || this.disposed) return;

      const timing = this.avatar.getWeaponTiming();

      this.combat.configureWeapon(
        timing.shootMs,
        timing.reloadMs
      );
    });

  this.spawnWave();

    this.canvas.addEventListener('click', this.onClick);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onReset);
    window.addEventListener('mousedown', this.onMouseDown, true);
    window.addEventListener('mouseup', this.onMouseUp, true);

    this.canvas.addEventListener(
      'contextmenu',
      this.onContextMenu
    );

    document.addEventListener(
      'mousemove',
      this.onMouseMove
    );

    document.addEventListener(
      'pointerlockchange',
      this.onPointerLockChange
    );

    document.addEventListener(
      'visibilitychange',
      this.onReset
    );

    this.present(0, 1);
  }

  private async loadSelectedSurvivor(): Promise<boolean> {
    const url = (skin: SurvivorSkin) => `${import.meta.env.BASE_URL}models/nextgen/${characterSkinFile('survivor', skin)}`;
    const loaded = await this.avatar.loadModel(url(this.survivorVariant));
    if (loaded || this.disposed || this.survivorVariant === 'classic') return loaded;
    this.survivorVariant = 'classic';
    return this.avatar.loadModel(url('classic'));
  }

  private async attachInfectedVariant(enemy: InfectedAvatar, skin: InfectedSkin): Promise<void> {
    if (this.disposed || !this.infected.includes(enemy)) return;
    this.infectedVariants.set(enemy, skin);
    let pool = this.infectedPools.get(skin);
    if (!pool) {
      pool = new InfectedModelPool();
      this.infectedPools.set(skin, pool);
      this.infectedLoads.set(skin, pool.load(`${import.meta.env.BASE_URL}models/nextgen/${characterSkinFile('infected', skin)}`));
    }
    const loaded = await this.infectedLoads.get(skin);
    if (this.disposed || !this.infected.includes(enemy)) return;
    if (loaded && enemy.attachModel(pool)) return;
    if (skin !== 'classic') await this.attachInfectedVariant(enemy, 'classic');
  }

  private clearInfected(): void {
    this.infectedVariants.clear();
  for (const enemy of this.infected) {
    enemy.dispose();
  }

  this.infected.length = 0;
}

private spawnWave(): void {
  this.clearInfected();

  const wave = this.horde.getState(0, 0).wave;

  const spawns = this.training
    ? [{
        x: this.state.position[0],
        z: this.state.position[2] - 12
      }]
    : createWaveSpawns(
        this.state.position,
        this.terrain,
        this.horde.spawnCount,
        wave
      );

  for (const [index, spawn] of spawns.entries()) {
    const enemy = new InfectedAvatar(
      new InfectedController({
        terrain: this.terrain,
        spawn
      })
    );

    this.infected.push(enemy);
    this.scene.add(enemy.root);

    // Reuse the already loaded shared model.
    void this.attachInfectedVariant(enemy, infectedSkinForSpawn(this.infectedSelection, wave, index));
  }
}

restart(): void {
  if (this.disposed || this.combat.alive) return;

  this.onReset();

  this.followCamera = new ThirdPersonCamera();

  this.controller = new CharacterController({
    speed: SURVIVAL.walkSpeed,
    radius: 0.4,
    terrain: this.terrain
  });

  this.state = this.controller.update(
    0,
    this.keyboard.read(),
    this.followCamera.getOrientation()
  );

  this.previousPosition = [...this.state.position];

  this.combat = new CombatController();

  const timing = this.avatar.getWeaponTiming();

  this.combat.configureWeapon(
    timing.shootMs,
    timing.reloadMs
  );

  this.horde.reset();
  this.loot.clear();
  this.pickup.cancel();
  this.pickupFacing = null;
  this.avatar.setHeldLoot(null);
  this.lootNotice = '';
  this.lootNoticeMs = 0;
  this.feedback.reset();
  this.inventoryOpen = false;
  this.infectedAttackHits = 0;

  this.spawnWave();

  this.avatar.animate(16, {
    speed: 0,
    sprinting: false,
    airborne: false,
    dodging: false,
    aiming: false,
    aimPitch: 0,
    shoot: false,
    reload: false
  });

  this.present(0, 1);
}

getHordeInfo() {
  const living = this.infected.filter(
    enemy => enemy.getState().health > 0
  ).length;

  return {
    ...this.horde.getState(
      living,
      this.infected.length
    ),
    training: this.training
  };
}

  private isLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  private readonly onClick = () => {
    if (!this.disposed && !this.benchmark) this.feedback.unlockAudio();
    if (
      this.disposed ||
      !this.combat.alive ||
      this.isLocked()
    ) {
      return;
    }

    try {
      void Promise.resolve(
        this.canvas.requestPointerLock()
      ).catch(() => {
        this.keyboard.reset();
      });
    } catch {
      this.keyboard.reset();
    }
  };

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (this.disposed) return;

    if (
      event.code === 'Enter' &&
      !event.repeat &&
      !this.combat.alive
    ) {
      event.preventDefault();
      this.restart();
      return;
    }

    if (!this.isLocked() || !this.combat.alive) return;

    if (['KeyF', 'KeyH', 'KeyE', 'KeyI'].includes(event.code)) {
      if (!event.repeat) {
        if (event.code === 'KeyF') this.meleePressed = true;
        if (event.code === 'KeyH') this.bandagePressed = true;
        if (event.code === 'KeyE') this.pickupPressed = true;
        if (event.code === 'KeyI') this.inventoryOpen = !this.inventoryOpen;
      }
      event.preventDefault();
      return;
    }

    if (event.code === 'KeyR') {
      if (!event.repeat && this.aimPressed) {
        this.reloadPressed = true;
      }

      event.preventDefault();
      return;
    }

    if (
      this.keyboard.keyDown(
        event.code,
        event.repeat
      )
    ) {
      event.preventDefault();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    const handled = this.keyboard.keyUp(event.code);

    if (handled && this.isLocked()) {
      event.preventDefault();
    }
  };

  private readonly onMouseMove = (event: MouseEvent) => {
    if (!this.isLocked()) return;

    this.followCamera.rotate(
      event.movementX,
      event.movementY
    );
  };

private readonly onMouseDown = (event: MouseEvent) => {
  if (this.disposed || !this.isLocked()) return;

  if (event.button === 2) {
    event.preventDefault();
    this.aimPressed = true;
  }

  if (event.button === 0 && this.aimPressed) {
    event.preventDefault();
    this.shootPressed = true;
  }
};

private readonly onMouseUp = (event: MouseEvent) => {
  if (event.button === 2) {
    this.clearAim();
  }
};

private readonly onContextMenu = (event: MouseEvent) => {
  event.preventDefault();
};

private clearAim(): void {
  this.aimPressed = false;
  this.shootPressed = false;
  this.reloadPressed = false;

  this.controller.resetAim();
  this.state.aiming = false;
}

private readonly onReset = () => {
  this.pickup.cancel();
  this.pickupFacing = null;
  this.avatar.setHeldLoot(null);
  this.keyboard.reset();
  this.clearAim();
  this.meleePressed = false;
  this.bandagePressed = false;
  this.pickupPressed = false;
  this.combat.interruptActions();
};

private readonly onPointerLockChange = () => {
  if (!this.isLocked()) {
    this.onReset();
  }
};

private fireShot(): void {
  this.camera.getWorldDirection(this.shotDirection);

  const direction: [number, number, number] = [
    this.shotDirection.x,
    this.shotDirection.y,
    this.shotDirection.z
  ];

  const origin: [number, number, number] = [
    this.camera.position.x,
    this.camera.position.y,
    this.camera.position.z
  ];

  const shooter: [number, number, number] = [
    this.state.position[0],
    this.state.position[1] + 1.35,
    this.state.position[2]
  ];

  const target = findShotTarget(
    origin,
    direction,
    shooter,
    this.infected.map(enemy => enemy.getState()),
    COMBAT.range,
    (x, z) => this.terrain.heightAt(x, z)
  );

  if (target === null) return;

  const enemy = this.infected[target];

  if (enemy.damage(COMBAT.bulletDamage)) {
    const killed = enemy.getState().health === 0;
    this.combat.recordHit(killed);
    this.feedback.impact(enemy.getState().position, this.state.position, false);
    if (killed) this.dropLoot(enemy);
  }
}

private dropLoot(enemy: InfectedAvatar): void {
  const position = enemy.getState().position;
  const ground = this.terrain.heightAt(position[0], position[2]);
  if (!Number.isFinite(ground)) return;
  const bandage = this.combat.getState().kills % 2 === 0;
  this.loot.spawn(bandage ? 'bandage' : 'ammo', bandage ? 1 : 12,
    [position[0], ground, position[2]]);
}

private meleeStrike(): void {
  const target = findMeleeTarget(this.state.position, this.state.facing,
    this.infected.map(enemy => enemy.getState()), COMBAT.meleeRange,
    (x, z) => this.terrain.heightAt(x, z));
  if (target === null) return;
  const enemy = this.infected[target];
  if (enemy.damage(COMBAT.meleeDamage)) {
    const killed = enemy.getState().health === 0;
    this.combat.recordMeleeHit(killed);
    this.feedback.impact(enemy.getState().position, this.state.position, true);
    if (killed) this.dropLoot(enemy);
  }
}

private showLootNotice(message: string): void {
  this.lootNotice = message;
  this.lootNoticeMs = 1800;
}

private cancelPickup(): void {
  const collected = this.pickup.getState().collected;
  this.pickup.cancel();
  this.avatar.setHeldLoot(null);
  if (!collected) this.showLootNotice('PICKUP INTERRUPTED');
}

step(deltaTimeMs: number): void {
  if (this.disposed) return;
  const lootDt = Number.isFinite(deltaTimeMs) ? Math.max(0, deltaTimeMs) : 0;
  this.lootNoticeMs = Math.max(0, this.lootNoticeMs - lootDt);

  this.previousPosition = [...this.state.position];
  const characterInput = this.keyboard.read();
  const movingInput = characterInput.forward !== 0 || characterInput.strafe !== 0 ||
    characterInput.jump || characterInput.dodge;
  const competingInput = movingInput || this.aimPressed || this.shootPressed ||
    this.reloadPressed || this.meleePressed || this.bandagePressed;
  if (competingInput && this.pickup.active) this.cancelPickup();
  if (movingInput || this.aimPressed) this.pickupFacing = null;

  if (this.combat.alive) {
    this.state = this.controller.update(
      deltaTimeMs,
      {
        ...characterInput,
        aim: this.aimPressed && this.isLocked()
      },
      this.followCamera.getOrientation()
    );
  }

  if (this.pickupFacing) this.state.facing = [...this.pickupFacing];
  const distance = Math.hypot(
    this.state.position[0] - this.previousPosition[0],
    this.state.position[2] - this.previousPosition[2]
  );

  const speed = deltaTimeMs > 0
    ? distance / (deltaTimeMs / 1000)
    : 0;

  const aiming =
    this.combat.alive &&
    this.state.aiming &&
    this.isLocked();

  const weaponReady =
    this.avatar.getWeaponAction() === null;

  const actionAllowed = this.combat.alive &&
    this.avatar.getActiveClip() !== 'hit' &&
    !this.state.airborne && !this.state.dodging;

  const combat = this.combat.step(deltaTimeMs, {
    enabled:
      !this.pickup.active && aiming &&
      this.avatar.getActiveClip() !== 'hit' &&
      !this.state.airborne &&
      !this.state.dodging,

    shoot: this.shootPressed && weaponReady,
    reload: this.reloadPressed && weaponReady,
    melee: this.meleePressed && weaponReady,
    bandage: this.bandagePressed && weaponReady,
    actionAllowed: actionAllowed && !this.pickup.active,
    aiming,
    moving: distance > 0.001 || characterInput.forward !== 0 ||
      characterInput.strafe !== 0 || characterInput.jump || characterInput.dodge
  });

  if (combat.shot) {
    this.feedback.shot();
    this.fireShot();
  }
  if (combat.meleeStarted) this.feedback.sound('swing');
  if (combat.reloadStarted) this.feedback.sound('reload');
  if (combat.healStarted) this.feedback.sound('bandage');
  if (combat.healed > 0) this.feedback.sound('healed');

  if (combat.meleeHit) this.meleeStrike();


  const healthBefore = this.combat.getState().health;

  // Accumulate damage from every infected attack.
  let totalDamage = 0;

  for (const infected of this.infected) {
    const state = infected.update(
      deltaTimeMs,
      this.combat.alive ? this.state.position : null
    );

    if (state.attackHit) {
      this.infectedAttackHits++;
      totalDamage += COMBAT.infectedDamage;
    }
  }

  // Apply combined damage without shared immunity.
  if (!this.training && !this.benchmark && totalDamage > 0) {
      this.combat.takeDamage(totalDamage, 0);

    if (!this.combat.alive) {
      this.onReset();

      if (this.isLocked()) {
        document.exitPointerLock();
      }
    }
  }

  const damaged = this.combat.getState().health < healthBefore ||
    (this.benchmark && totalDamage > 0);
  if (damaged) this.feedback.damage();
  // Contact comes after damage resolution: an interrupted reach never transfers loot.
  const inventory = this.combat.getState();
  if (damaged || !actionAllowed || !this.combat.alive || !this.isLocked()) {
    if (this.pickup.active) this.cancelPickup();
  }
  if (this.pickupPressed && this.combat.alive && !this.pickup.active) {
    if (damaged || !actionAllowed || competingInput || aiming || distance > 0.001 ||
        inventory.healing || inventory.reloading || inventory.meleeCooldownMs > 0 ||
        !weaponReady) {
      this.showLootNotice('STOP TO COLLECT');
    } else {
      const near = this.loot.nearby(this.state.position, this.canCollectLoot);
      if (!near) this.showLootNotice('NO LOOT NEARBY');
      else if (!this.canCollectLoot(near)) this.showLootNotice(
        near.kind === 'ammo' ? 'AMMO RESERVE FULL' : 'BANDAGES FULL');
      else {
        const dx = near.position[0] - this.state.position[0];
        const dz = near.position[2] - this.state.position[2];
        if (Math.hypot(dx, dz, near.position[1] - this.state.position[1]) > PICKUP.reach) {
          this.showLootNotice('MOVE CLOSER TO LOOT');
        } else if (this.pickup.begin(near.id, near.kind)) {
          const length = Math.hypot(dx, dz);
          if (length > 0.08) {
            this.pickupFacing = [dx / length, 0, dz / length];
            this.state.facing = [...this.pickupFacing];
          }
          this.showLootNotice('COLLECTING...');
        }
      }
    }
  }
  const contact = this.pickup.advance(deltaTimeMs);
  if (contact !== null) {
    const picked = this.loot.collectById(contact, this.state.position, (kind, amount) =>
      kind === 'ammo' ? this.combat.addReserveAmmo(amount) : this.combat.addBandages(amount),
      PICKUP.reach);
    if (picked.status === 'collected') {
      this.pickup.markCollected();
      this.showLootNotice('+' + picked.amount +
        (picked.kind === 'ammo' ? ' AMMO' : (picked.amount === 1 ? ' BANDAGE' : ' BANDAGES')));
      this.feedback.sound('pickup');
    } else {
      this.pickup.cancel();
      this.showLootNotice(picked.status === 'full'
        ? (picked.kind === 'ammo' ? 'AMMO RESERVE FULL' : 'BANDAGES FULL')
        : 'LOOT NO LONGER AVAILABLE');
    }
  }
  // Animate using the updated combat state.
  this.avatar.animate(deltaTimeMs, {
    speed: this.combat.alive ? speed : 0,
    sprinting: this.combat.alive && this.state.sprinting,
    airborne: this.combat.alive && this.state.airborne,
    dodging: this.combat.alive && this.state.dodging,
    aiming: this.combat.alive && aiming,
    aimPitch: this.followCamera.getAimPitch(),
    shoot: this.combat.alive && combat.shot,
    reload: this.combat.alive && combat.reloadStarted,
    melee: this.combat.alive && combat.meleeStarted,
    healing: this.combat.alive && this.combat.getState().healing,
    pickingUp: this.pickup.active,
    hit: this.combat.alive && damaged,
    dead: !this.combat.alive
  });

  this.avatar.setHeldLoot(this.pickup.heldKind);
  separateInfected(this.infected, deltaTimeMs);

  if (!this.training && this.combat.alive) {
    const horde = this.getHordeInfo();

    const nextWave = this.horde.step(
      deltaTimeMs,
      horde.living,
      horde.total
    );

    if (nextWave) {
      this.combat.rewardWave();
      this.spawnWave();
    }
  }

  this.shootPressed = false;
  this.reloadPressed = false;
  this.meleePressed = false;
  this.bandagePressed = false;
  this.pickupPressed = false;
}


  present(
    deltaTimeMs: number,
    interpolation: number
  ): void {
    if (this.disposed) return;

    const alpha = Number.isFinite(interpolation)
      ? Math.max(0, Math.min(1, interpolation))
      : 1;

    const position: [number, number, number] = [
      0, 0, 0
    ];

    for (let i = 0; i < 3; i++) {
      position[i] =
        this.previousPosition[i] +
        (
          this.state.position[i] -
          this.previousPosition[i]
        ) * alpha;
    }

    this.avatar.update({
      position,
      facing: this.state.facing
    });
    const muzzle = this.feedback.needsMuzzle &&
      this.avatar.getMuzzlePosition(this.muzzlePosition) ? this.muzzlePosition : null;
    this.feedback.update(deltaTimeMs, muzzle);

  const pose = this.followCamera.update(
    deltaTimeMs,
    position,
    this.terrain,
    this.isLocked() && this.state.aiming
  );

    this.camera.position.set(...pose.position);
    this.camera.lookAt(...pose.target);
    if (this.camera.fov !== pose.fov) {
      this.camera.fov = pose.fov;
      this.camera.updateProjectionMatrix();
    }
    this.hud.update(
      this.state,
      this.isLocked(),
      this.combat.getState(),
      this.getHordeInfo(),
      this.loot.nearby(position, this.canCollectLoot),
      this.inventoryOpen,
      this.lootNoticeMs > 0 ? this.lootNotice : '',
      this.pickup.active
    );
  }

  getModelInfo() {
    return { ...this.avatar.getModelInfo(), variant: this.survivorVariant };
    }

  getState(): CharacterControllerResult {
    return {
      ...this.state,
      position: [...this.state.position],
      facing: [...this.state.facing]
    };
  }

getCombatInfo() {
  return {
    ...this.combat.getState(),
    training: this.training,
    benchmark: this.benchmark,
    inventoryOpen: this.inventoryOpen
  };
}

  getLootInfo() { return this.loot.getState(); }
  getPickupInfo() { return this.pickup.getState(); }

  getInfectedInfo() {
  return this.infected.map(enemy => ({
    ...enemy.getState(),
    ...enemy.getModelInfo(),
    variant: this.infectedVariants.get(enemy) ?? 'classic'
  }));
}

getInfectedAttackHits(): number {
  return this.infectedAttackHits;
}

damageInfected(index: number, amount: number): boolean {
  return this.infected[index]?.damage(amount) ?? false;
}

  getCameraFov(): number {
  return this.camera.fov;
}

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;

    this.canvas.removeEventListener('click', this.onClick);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onReset);

    window.removeEventListener('mousedown', this.onMouseDown, true);
    window.removeEventListener('mouseup', this.onMouseUp, true);

    this.canvas.removeEventListener(
      'contextmenu',
      this.onContextMenu
    );

    this.clearAim();

    document.removeEventListener(
      'mousemove',
      this.onMouseMove
    );

    document.removeEventListener(
      'pointerlockchange',
      this.onPointerLockChange
    );

    document.removeEventListener(
      'visibilitychange',
      this.onReset
    );

    this.keyboard.reset();

    if (this.isLocked()) {
      document.exitPointerLock();
    }

    this.clearInfected();
    for (const pool of this.infectedPools.values()) pool.dispose();
    this.infectedPools.clear();
    this.infectedLoads.clear();
    this.loot.dispose();
    this.feedback.dispose();
    this.avatar.dispose();
    this.hud.dispose();
  }
}