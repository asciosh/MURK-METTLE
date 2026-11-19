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

import { findWeaponHits, findMeleeTarget } from '../core/ShotQuery';
import { LootField, type LootItem } from '../core/LootField';
import { PickupController, PICKUP } from '../core/PickupController';
import { CombatFeedback } from '../core/CombatFeedback';
import { CompanionController } from '../core/CompanionController';
import { CompanionAvatar } from '../core/CompanionAvatar';
import { NextgenModBridge } from '../modding/NextgenModBridge';
import { WEAPONS, ammoKind, fullLootNotice, lootLabel, INVENTORY_ROWS, inventoryDropKind, type WeaponId, type LootKind } from '../core/EquipmentInventory';
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
  private fireHeld = false;
  private reloadPressed = false;
  private meleePressed = false;
  private bandagePressed = false;
  private pickupPressed = false;
  private pulsePressed = false;
  private readonly companion:CompanionController|null;
  private readonly companionAvatar:CompanionAvatar|null;
  private readonly companionCosmetic:NextgenModBridge|null;
  private readonly companionHeight=(x:number,z:number)=>x>=0&&z>=0&&x<=this.terrain.size&&z<=this.terrain.size?this.terrain.heightAt(x,z):NaN;
  private inventoryOpen = false;
  private inventoryIndex = 0;
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

    const companionEnabled=!this.benchmark&&(!this.training||new URLSearchParams(window.location.search).get('companion')==='1');
    this.companion=companionEnabled?new CompanionController():null;
    this.companionAvatar=companionEnabled?new CompanionAvatar():null;
    this.companionCosmetic=companionEnabled?new NextgenModBridge(scene, 'lanternkin'):null;
    this.companion?.reset(this.state.position,this.state.facing,this.companionHeight);
    if(this.companionAvatar&&this.companion){scene.add(this.companionAvatar.root);this.companionAvatar.update(0,this.companion.getState());}

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
  this.seedEquipment();

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
  this.companion?.reset(this.state.position,this.state.facing,this.companionHeight);
  if(this.companion&&this.companionAvatar)this.companionAvatar.update(0,this.companion.getState());

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
  this.inventoryIndex = 0;
  this.avatar.setEquipment('pistol',null);
  this.infectedAttackHits = 0;

  this.spawnWave();
  this.seedEquipment();

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

    if (event.code === 'KeyI') {
      if (!event.repeat) {
        this.inventoryOpen = !this.inventoryOpen;
        this.keyboard.reset(); this.clearAim(); this.combat.interruptActions();
        if(this.pickup.active)this.cancelPickup();
        this.meleePressed=this.bandagePressed=this.pickupPressed=false;
      }
      event.preventDefault();return;
    }
    if (event.code === 'Digit1' || event.code === 'Digit2') {
      if (!event.repeat) this.requestWeapon(event.code==='Digit1'?'pistol':this.combat.getState().equipment.primary);
      event.preventDefault();return;
    }
    if(this.inventoryOpen){
      if(!event.repeat && (event.code==='ArrowUp'||event.code==='ArrowDown')) {
        this.inventoryIndex=(this.inventoryIndex+(event.code==='ArrowUp'?-1:1)+INVENTORY_ROWS.length)%INVENTORY_ROWS.length;
      }
      if(!event.repeat&&event.code==='KeyG')this.dropSelectedItem();
      event.preventDefault();return;
    }
    if(['KeyQ','KeyC','KeyX'].includes(event.code)){
      if(!event.repeat){
        if(event.code==='KeyQ'){
          if(this.pickup.active||this.state.airborne||this.state.dodging||this.avatar.getActiveClip()==='hit'||this.avatar.getWeaponAction()!==null||!this.combat.toggleResonance())this.showLootNotice('RESONANCE NOT READY');
          else {this.clearAim();this.feedback.sound('resonance');this.showLootNotice(this.combat.getState().resonance.active?'RESONANCE FORM':'STANDARD FORM');}
        }
        if(event.code==='KeyC'&&this.companion)this.showLootNotice(this.companion.toggleAssist()?'LANTERNKIN: ENGAGE':'LANTERNKIN: FOLLOW');
        if(event.code==='KeyX'&&this.companion)this.pulsePressed=true;
      }
      event.preventDefault();return;
    }
    if (['KeyF', 'KeyH', 'KeyE'].includes(event.code)) {
      if (!event.repeat) {
        if (event.code === 'KeyF') this.meleePressed = true;
        if (event.code === 'KeyH') this.bandagePressed = true;
        if (event.code === 'KeyE') this.pickupPressed = true;
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
    if (!this.isLocked() || this.inventoryOpen) return;

    this.followCamera.rotate(
      event.movementX,
      event.movementY
    );
  };

private readonly onMouseDown = (event: MouseEvent) => {
  if (this.disposed || !this.isLocked() || this.inventoryOpen) return;

  if (event.button === 2) {
    event.preventDefault();
    this.aimPressed = true;
  }

  if (event.button === 0 && this.aimPressed) {
    event.preventDefault();
    this.shootPressed = true;
    this.fireHeld = true;
  }
};

private readonly onMouseUp = (event: MouseEvent) => {
  if(event.button===0)this.fireHeld=false;
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
  this.fireHeld = false;
  this.reloadPressed = false;

  this.controller.resetAim();
  this.state.aiming = false;
}

private readonly onReset = () => {
  this.inventoryOpen = false;
  this.pickup.cancel();
  this.pickupFacing = null;
  this.avatar.setHeldLoot(null);
  this.keyboard.reset();
  this.clearAim();
  this.meleePressed = false;
  this.bandagePressed = false;
  this.pickupPressed = false;
  this.pulsePressed = false;
  this.combat.interruptActions();
};

private readonly onPointerLockChange = () => {
  if (!this.isLocked()) {
    this.onReset();
  }
};

private fireShot(resonant=false): void {
  this.camera.getWorldDirection(this.shotDirection);

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

  const targets=this.infected.map(enemy=>enemy.getState());
  const impacts=findWeaponHits(this.combat.weaponId,origin,
    [this.shotDirection.x,this.shotDirection.y,this.shotDirection.z],shooter,targets,
    (x,z)=>this.terrain.heightAt(x,z),resonant);
  let hit=false;const killed:InfectedAvatar[]=[];
  for(const {index,damage} of impacts){
    const enemy=this.infected[index];if(!enemy||!enemy.damage(damage))continue;
    hit=true;this.feedback.impact(enemy.getState().position,this.state.position,false);
    if(enemy.getState().health===0)killed.push(enemy);
  }
  if(hit){this.combat.recordShotHits(killed.length);for(const enemy of killed)this.dropLoot(enemy);}
  if(this.combat.weaponId!=='pistol')this.followCamera.rotate(0,this.combat.weaponId==='shotgun'?-10:-3);
}

private stepCompanion(delta:number):void {
  if(!this.companion)return;
  const pulse=this.pulsePressed&&this.isLocked()&&!this.inventoryOpen&&this.combat.alive;
  const strikes=this.companion.step(delta,this.combat.alive?this.state.position:null,this.state.facing,
    this.infected.map(enemy=>enemy.getState()),pulse,this.companionHeight);
  if(pulse){const s=this.companion.getState();this.showLootNotice(strikes.some(hit=>hit.kind==='pulse')?'LANTERNKIN: LUMEN PULSE':s.pulseCooldownMs>0?'ABILITY COOLING DOWN':'NO VISIBLE TARGET IN RANGE');}
  if(strikes.some(hit=>hit.kind==='pulse'))this.feedback.sound('pulse');
  const from=this.companion.getState().position;
  for(const strike of strikes){const enemy=this.infected[strike.index];if(!enemy||!enemy.damage(strike.damage))continue;
    const dead=enemy.getState().health===0;this.combat.recordCompanionHit(dead);this.feedback.impact(enemy.getState().position,from,strike.kind==='basic');if(dead)this.dropLoot(enemy);}
  this.companionAvatar?.update(delta,this.companion.getState());
  if (this.companionAvatar) {
    const hasCosmetic = this.companionCosmetic?.update(this.companionAvatar.root, delta, this.companion.getState().moving, true) ?? false;
    this.companionAvatar.root.visible = !hasCosmetic;
  }
  if (strikes.some(hit => hit.kind === 'pulse')) this.companionCosmetic?.pulse();
  else if (strikes.some(hit => hit.kind === 'basic')) this.companionCosmetic?.attack();
}

private requestWeapon(id:WeaponId|null):void {
  if(!id){this.showLootNotice('NO PRIMARY WEAPON');return;}
  if(id===this.combat.weaponId)return;
  if(this.pickup.active||this.state.airborne||this.state.dodging||this.avatar.getActiveClip()==='hit'||this.avatar.getWeaponAction()!==null||!this.combat.selectWeapon(id)){
    this.showLootNotice('WEAPON BUSY');return;
  }
  this.clearAim();this.feedback.sound('reload');this.showLootNotice('EQUIPPING '+WEAPONS[id].label.toUpperCase());
}

private dropSelectedItem():void {
  const kind=inventoryDropKind(this.inventoryIndex,this.combat.getState().equipment.primary);
  if(!kind){this.showLootNotice('EMPTY SLOT');return;}
  const p=this.state.position, f=this.state.facing;
  const x=p[0]+f[0]*.65,z=p[2]+f[2]*.65,y=this.terrain.heightAt(x,z);
  const amount=kind==='ammo'?12:kind==='rifle-ammo'?24:kind==='shotgun-ammo'?5:1;
  const ok=Number.isFinite(y)&&this.combat.dropItem(kind,amount,(k,n,loaded)=>this.loot.spawn(k,n,[x,y,z],loaded));
  this.showLootNotice(ok?'DROPPED '+lootLabel(kind):'CANNOT DROP ITEM');
}

private seedEquipment():void {
  if(this.benchmark||(this.training&&new URLSearchParams(window.location.search).get('equipment')!=='1'))return;
  const p=this.state.position;
  const drops: [LootKind,number,number,number][]=[['rifle',1,-1.7,-3.2],['rifle-ammo',48,-2.1,-3.5],['shotgun',1,1.7,-3.2],['shotgun-ammo',15,2.1,-3.5]];
  for(const [kind,count,dx,dz] of drops){const x=p[0]+dx,z=p[2]+dz,y=this.terrain.heightAt(x,z);if(Number.isFinite(y))this.loot.spawn(kind,count,[x,y,z]);}
}

private dropLoot(enemy: InfectedAvatar): void {
  const position = enemy.getState().position;
  const ground = this.terrain.heightAt(position[0], position[2]);
  if (!Number.isFinite(ground)) return;
  const bandage = this.combat.getState().kills % 2 === 0;
  const activeAmmo=ammoKind(this.combat.weaponId);
  this.loot.spawn(bandage ? 'bandage' : activeAmmo, bandage ? 1 : activeAmmo==='shotgun-ammo'?5:12,
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
    this.isLocked() && !this.inventoryOpen && !this.combat.switching && !this.combat.transforming;

  const weaponReady =
    this.avatar.getWeaponAction() === null;

  const actionAllowed = this.combat.alive &&
    this.avatar.getActiveClip() !== 'hit' &&
    !this.state.airborne && !this.state.dodging && !this.inventoryOpen && !this.combat.switching && !this.combat.transforming;

  const combat = this.combat.step(deltaTimeMs, {
    enabled:
      !this.pickup.active && aiming &&
      this.avatar.getActiveClip() !== 'hit' &&
      !this.state.airborne &&
      !this.state.dodging,

    shoot: (this.shootPressed || (this.fireHeld && this.combat.weaponSpec.automatic)) && weaponReady,
    reload: this.reloadPressed && weaponReady,
    melee: this.meleePressed && weaponReady,
    bandage: this.bandagePressed && weaponReady,
    actionAllowed: actionAllowed && !this.pickup.active,
    aiming,
    moving: distance > 0.001 || characterInput.forward !== 0 ||
      characterInput.strafe !== 0 || characterInput.jump || characterInput.dodge
  });

  if (combat.shot) {
    this.feedback.shot(this.combat.weaponId,combat.resonantShot);
    this.fireShot(combat.resonantShot);
  }
  if (combat.meleeStarted) this.feedback.sound('swing');
  if (combat.reloadStarted) this.feedback.sound('reload');
  if (combat.healStarted) this.feedback.sound('bandage');
  if (combat.healed > 0) this.feedback.sound('healed');

  if (combat.meleeHit) this.meleeStrike();
  this.stepCompanion(deltaTimeMs);


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
  if(damaged&&this.inventoryOpen)this.inventoryOpen=false;
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
        fullLootNotice(near.kind));
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
    const picked = this.loot.collectById(contact, this.state.position, (kind, amount, item) =>
      this.combat.collectLoot(kind,amount,item.loadedRounds),
      PICKUP.reach);
    if (picked.status === 'collected') {
      this.pickup.markCollected();
      this.showLootNotice('+' + picked.amount + ' ' + lootLabel(picked.kind!,picked.amount));
      this.feedback.sound('pickup');
    } else {
      this.pickup.cancel();
      this.showLootNotice(picked.status === 'full'
        ? fullLootNotice(picked.kind!)
        : 'LOOT NO LONGER AVAILABLE');
    }
  }
  // Animate using the updated combat state.
  const equipped=this.combat.getState().equipment;
  this.avatar.setEquipment(equipped.active,equipped.primary,this.combat.switching,this.combat.getState().resonance.active);
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
  this.pulsePressed = false;
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
      this.pickup.active,
      this.inventoryIndex,
      this.companion?.getState()??null
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
    inventoryOpen: this.inventoryOpen,
    companionAppearance: this.companionCosmetic?.appearanceKind ?? 'original',
    companion: this.companion?.getState()??null
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
    this.companionCosmetic?.dispose();
    this.companionAvatar?.dispose();
    this.avatar.dispose();
    this.hud.dispose();
  }
}
