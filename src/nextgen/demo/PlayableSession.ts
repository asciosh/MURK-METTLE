import * as THREE from 'three/webgpu';
import { SURVIVAL } from '../../../shared/survival.mjs';

import {
  CharacterController,
  type CharacterControllerResult
} from '../core/CharacterController';

import { KeyboardInput } from '../core/KeyboardInput';
import { ThirdPersonCamera } from '../core/ThirdPersonCamera';
import { PlayerAvatar } from '../core/PlayerAvatar';
import { TerrainGenerator } from '../core/TerrainGenerator';
import { PlayableHud } from './PlayableHud';

export class PlayableSession {
  private readonly keyboard = new KeyboardInput();
  private readonly followCamera = new ThirdPersonCamera();
  private readonly avatar = new PlayerAvatar();
  private readonly hud = new PlayableHud();

  private readonly controller: CharacterController;
  private state: CharacterControllerResult;

  private previousPosition: [number, number, number];

  private disposed = false;

  constructor(
    scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
    private readonly canvas: HTMLCanvasElement,
    private readonly terrain: TerrainGenerator
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
    );

    this.canvas.addEventListener('click', this.onClick);

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onReset);

    document.addEventListener(
      'mousemove',
      this.onMouseMove
    );

    document.addEventListener(
      'pointerlockchange',
      this.onReset
    );

    document.addEventListener(
      'visibilitychange',
      this.onReset
    );

    this.present(0, 1);
  }

  private isLocked(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  private readonly onClick = () => {
    if (this.disposed || this.isLocked()) return;

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
    if (!this.isLocked()) return;

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

  private readonly onReset = () => {
    this.keyboard.reset();
  };

    step(deltaTimeMs: number): void {
    if (this.disposed) return;

    this.previousPosition = [...this.state.position];

    this.state = this.controller.update(
        deltaTimeMs,
        this.keyboard.read(),
        this.followCamera.getOrientation()
    );

    const distance = Math.hypot(
        this.state.position[0] - this.previousPosition[0],
        this.state.position[2] - this.previousPosition[2]
    );

    const speed = deltaTimeMs > 0
        ? distance / (deltaTimeMs / 1000)
        : 0;

    this.avatar.animate(deltaTimeMs, {
        speed,
        sprinting: this.state.sprinting,
        airborne: this.state.airborne,
        dodging: this.state.dodging
    });
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
      this.terrain
    );

    this.camera.position.set(...pose.position);
    this.camera.lookAt(...pose.target);
    this.hud.update(this.state, this.isLocked());
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

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;

    this.canvas.removeEventListener('click', this.onClick);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onReset);

    document.removeEventListener(
      'mousemove',
      this.onMouseMove
    );

    document.removeEventListener(
      'pointerlockchange',
      this.onReset
    );

    document.removeEventListener(
      'visibilitychange',
      this.onReset
    );

    this.keyboard.reset();

    if (this.isLocked()) {
      document.exitPointerLock();
    }

    this.avatar.dispose();
    this.hud.dispose();
  }
}