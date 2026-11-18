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
import { TerrainGenerator } from '../core/TerrainGenerator';
import { PlayableHud } from './PlayableHud';
import {
  COMBAT,
  CombatController
} from '../core/CombatController';

import { findShotTarget } from '../core/ShotQuery';
import {
  HordeDirector,
  createWaveSpawns,
  separateInfected
} from '../core/HordeDirector';

export class PlayableSession {
  private readonly keyboard = new KeyboardInput();
  private followCamera = new ThirdPersonCamera();
  private readonly avatar = new PlayerAvatar();
  private readonly infectedPool = new InfectedModelPool();
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

  private disposed = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly canvas: HTMLCanvasElement,
    private readonly terrain: TerrainGenerator,
    private readonly training = false
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

    void this.avatar.loadModel(
      `${import.meta.env.BASE_URL}models/nextgen/survivor.glb`
    ).then(loaded => {
      if (!loaded || this.disposed) return;

      const timing = this.avatar.getWeaponTiming();

      this.combat.configureWeapon(
        timing.shootMs,
        timing.reloadMs
      );
    });

  this.spawnWave();

  void this.infectedPool.load(
    `${import.meta.env.BASE_URL}models/nextgen/infected.glb`
  ).then(loaded => {
    if (!loaded || this.disposed) return;

    for (const infected of this.infected) {
      infected.attachModel(this.infectedPool);
    }
  });

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

  private clearInfected(): void {
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

  for (const spawn of spawns) {
    const enemy = new InfectedAvatar(
      new InfectedController({
        terrain: this.terrain,
        spawn
      })
    );

    this.infected.push(enemy);
    this.scene.add(enemy.root);

    // Reuse the already loaded shared model.
    enemy.attachModel(this.infectedPool);
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
  this.keyboard.reset();
  this.clearAim();
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
    this.combat.recordHit(
      enemy.getState().health === 0
    );
  }
}

step(deltaTimeMs: number): void {
  if (this.disposed) return;

  this.previousPosition = [...this.state.position];

  if (this.combat.alive) {
    this.state = this.controller.update(
      deltaTimeMs,
      {
        ...this.keyboard.read(),
        aim: this.aimPressed && this.isLocked()
      },
      this.followCamera.getOrientation()
    );
  }

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

  const combat = this.combat.step(deltaTimeMs, {
    enabled:
      aiming &&
      !this.state.airborne &&
      !this.state.dodging,

    shoot: this.shootPressed && weaponReady,
    reload: this.reloadPressed && weaponReady
  });

  if (combat.shot) {
    this.fireShot();
  }

  this.avatar.animate(deltaTimeMs, {
    speed: this.combat.alive ? speed : 0,
    sprinting: this.combat.alive && this.state.sprinting,
    airborne: this.combat.alive && this.state.airborne,
    dodging: this.combat.alive && this.state.dodging,
    aiming,
    aimPitch: this.followCamera.getAimPitch(),
    shoot: combat.shot,
    reload: combat.reloadStarted
  });

  // Accumulate damage from every successful infected attack.
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

  // Apply combined damage without shared damage immunity.
  if (!this.training && totalDamage > 0) {
    this.combat.takeDamage(totalDamage, 0);

    if (!this.combat.alive) {
      this.onReset();

      if (this.isLocked()) {
        document.exitPointerLock();
      }
    }
  }

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
      this.getHordeInfo()
    );
  }

  getModelInfo() {
    return this.avatar.getModelInfo();
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
    training: this.training
  };
}

  getInfectedInfo() {
  return this.infected.map(enemy => ({
    ...enemy.getState(),
    ...enemy.getModelInfo()
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
    this.infectedPool.dispose();

    this.infected.length = 0;
    this.infectedPool.dispose();

    this.avatar.dispose();
    this.hud.dispose();
  }
}