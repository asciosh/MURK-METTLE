export interface MovementAxes {
  /** -1 = left, 1 = right */
  right: number;
  /** -1 = backward, 1 = forward */
  forward: number;
}

export interface MouseDelta {
  x: number;
  y: number;
}

/** Owns keyboard and pointer-lock input for the local player. */
export class InputController {
  private readonly keys = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private attackPressed = false;
  private restartPressed = false;
  private interactPressed = false;
  private abilityPressed = false;
  private inventoryPressed = false;
  private disposed = false;

  constructor(
    private readonly element: HTMLElement,
    private readonly onPointerLockChange: (locked: boolean) => void,
  ) {
    element.addEventListener('click', this.handleClick);
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('focusin', this.handleFocusIn);
    document.addEventListener('keyup', this.handleKeyUp);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mousedown', this.handleMouseDown);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    window.addEventListener('blur', this.handleWindowBlur);
  }

  requestCapture(): void {
    if (!this.disposed && document.pointerLockElement !== this.element) {
      void this.element.requestPointerLock().catch(() => { /* May be denied; next canvas click retries. */ });
    }
  }

  getMovementAxes(): MovementAxes {
    const right = Number(this.isDown('KeyD', 'ArrowRight')) - Number(this.isDown('KeyA', 'ArrowLeft'));
    const forward = Number(this.isDown('KeyW', 'ArrowUp')) - Number(this.isDown('KeyS', 'ArrowDown'));
    return { right, forward };
  }

  isSprinting(): boolean {
    return this.isDown('ShiftLeft', 'ShiftRight');
  }

  consumeAttackPressed(): boolean {
    const pressed = this.attackPressed;
    this.attackPressed = false;
    return pressed;
  }

  consumeRestartPressed(): boolean {
    const pressed = this.restartPressed;
    this.restartPressed = false;
    return pressed;
  }

  consumeInteractPressed(): boolean {
    const pressed = this.interactPressed;
    this.interactPressed = false;
    return pressed;
  }

  consumeAbilityPressed(): boolean {
    const pressed = this.abilityPressed;
    this.abilityPressed = false;
    return pressed;
  }

  consumeInventoryPressed(): boolean {
    const pressed = this.inventoryPressed;
    this.inventoryPressed = false;
    return pressed;
  }

  consumeMouseDelta(): MouseDelta {
    const delta = { x: this.mouseX, y: this.mouseY };
    this.mouseX = 0;
    this.mouseY = 0;
    return delta;
  }

  private isDown(...codes: string[]): boolean {
    return codes.some((code) => this.keys.has(code));
  }

  private readonly handleClick = (): void => {
    if (document.pointerLockElement !== this.element && !this.disposed) {
      void this.element.requestPointerLock();
    }
  };

  private readonly handleFocusIn = (event: FocusEvent): void => {
    if (this.isEditable(event.target)) this.handleWindowBlur();
  };

  private isEditable(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]');
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.isEditable(event.target) || this.isEditable(document.activeElement)) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.code === 'Space' && !event.repeat) this.attackPressed = true;
    if (event.code === 'KeyR' && !event.repeat) this.restartPressed = true;
    if (event.code === 'KeyE' && !event.repeat) this.interactPressed = true;
    if (event.code === 'KeyQ' && !event.repeat) this.abilityPressed = true;
    if (event.code === 'KeyI' && !event.repeat) this.inventoryPressed = true;
    this.keys.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly handleMouseDown = (event: MouseEvent): void => {
    if (event.button === 0 && document.pointerLockElement === this.element) {
      this.attackPressed = true;
    }
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.element) return;
    this.mouseX += event.movementX;
    this.mouseY += event.movementY;
  };

  private readonly handlePointerLockChange = (): void => {
    this.onPointerLockChange(document.pointerLockElement === this.element);
  };

  private readonly handleWindowBlur = (): void => {
    this.keys.clear();
    this.mouseX = 0;
    this.mouseY = 0;
    this.attackPressed = false;
    this.restartPressed = false;
    this.interactPressed = false;
    this.abilityPressed = false;
    this.inventoryPressed = false;
  };

  dispose(): void {
    this.disposed = true;
    this.element.removeEventListener('click', this.handleClick);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('focusin', this.handleFocusIn);
    document.removeEventListener('keyup', this.handleKeyUp);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    window.removeEventListener('blur', this.handleWindowBlur);
    this.keys.clear();
  }
}
