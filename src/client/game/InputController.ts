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

export type TouchAction =
  | 'fire'
  | 'aim'
  | 'sprint'
  | 'reload'
  | 'interact'
  | 'pulse'
  | 'melee'
  | 'heal'
  | 'inventory'
  | 'cycle'
  | 'swap';

/** Keyboard, mouse and touch feed the same gameplay actions. */
export class InputController {
  touchEnabled = false;
  private touchMovement: MovementAxes = { right: 0, forward: 0 };
  private readonly touchHeld = new Set<TouchAction>();
  private swapPressed = false;
  setTouchMovement(axes: MovementAxes): void {
    this.touchMovement = axes;
  }
  addTouchLook(x: number, y: number): void {
    this.mouseX += x * (this.isAiming() ? 1.9 : 2.8);
    this.mouseY += y * (this.isAiming() ? 1.9 : 2.8);
  }
  setTouchAction(action: TouchAction, pressed: boolean): void {
    if (pressed) this.touchHeld.add(action);
    else this.touchHeld.delete(action);
    if (!pressed) return;
    if (action === 'fire') this.firePressed = true;
    if (action === 'reload') this.restartPressed = true;
    if (action === 'interact') this.interactPressed = true;
    if (action === 'pulse') this.abilityPressed = true;
    if (action === 'melee') this.attackPressed = true;
    if (action === 'heal') this.healPressed = true;
    if (action === 'inventory') this.inventoryPressed = true;
    if (action === 'cycle') this.cyclePressed = true;
    if (action === 'swap') this.swapPressed = true;
  }
  consumeSwapPressed(): boolean {
    const value = this.swapPressed;
    this.swapPressed = false;
    return value;
  }
  clearHeld(): void {
    this.handleWindowBlur();
  }
  private readonly keys = new Set<string>();
  private mouseX = 0;
  private mouseY = 0;
  private attackPressed = false;
  private restartPressed = false;
  private interactPressed = false;
  private abilityPressed = false;
  private inventoryPressed = false;
  private disposed = false;
  private healPressed = false;
  consumeHealPressed(): boolean {
    const pressed = this.healPressed;
    this.healPressed = false;
    return pressed;
  }
  private firePressed = false;
  private fireHeld = false;
  private aimHeld = false;
  private weaponPressed: 1 | 2 | null = null;
  private cyclePressed = false;
  isAiming(): boolean {
    return this.aimHeld || this.touchHeld.has('aim');
  }
  isFiring(): boolean {
    return this.fireHeld || this.touchHeld.has('fire');
  }
  consumeFirePressed(): boolean {
    const v = this.firePressed;
    this.firePressed = false;
    return v;
  }
  consumeWeaponPressed(): 1 | 2 | null {
    const v = this.weaponPressed;
    this.weaponPressed = null;
    return v;
  }
  consumeCyclePressed(): boolean {
    const v = this.cyclePressed;
    this.cyclePressed = false;
    return v;
  }

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
    document.addEventListener('field-overlay-open', this.handleWindowBlur);
    window.addEventListener('blur', this.handleWindowBlur);
    document.addEventListener('visibilitychange', this.handleVisibility);
    document.addEventListener('mouseup', this.handleMouseUp);
    element.addEventListener('contextmenu', this.handleContextMenu);
  }

  requestCapture(): void {
    if (
      !this.disposed &&
      !this.touchEnabled &&
      !document.querySelector('#field-menu:not([hidden]),#account-panel:not([hidden]),#touch-journal-sheet:not([hidden]),#inventory-panel.visible') &&
      typeof this.element.requestPointerLock === 'function' &&
      document.pointerLockElement !== this.element
    ) {
      void this.element.requestPointerLock().catch(() => {
        /* May be denied; next canvas click retries. */
      });
    }
  }

  getMovementAxes(): MovementAxes {
    const right = Number(this.isDown('KeyD', 'ArrowRight')) - Number(this.isDown('KeyA', 'ArrowLeft'));
    const forward = Number(this.isDown('KeyW', 'ArrowUp')) - Number(this.isDown('KeyS', 'ArrowDown'));
    const x = right + this.touchMovement.right,
      z = forward + this.touchMovement.forward,
      length = Math.max(1, Math.hypot(x, z));
    return { right: x / length, forward: z / length };
  }

  isSprinting(): boolean {
    return this.isDown('ShiftLeft', 'ShiftRight') || this.touchHeld.has('sprint');
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
    this.requestCapture();
  };

  private readonly handleFocusIn = (event: FocusEvent): void => {
    if (this.isEditable(event.target)) this.handleWindowBlur();
  };

  private isEditable(target: EventTarget | null): boolean {
    return (
      target instanceof Element &&
      !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"]')
    );
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (document.querySelector('#field-menu:not([hidden]),#account-panel:not([hidden]),#touch-journal-sheet:not([hidden]),#inventory-panel.visible')) {
      this.handleWindowBlur();
      if (event.code !== 'KeyI' || !document.querySelector('#inventory-panel.visible') || this.isEditable(event.target)) return;
    }
    if ((event.target as Element)?.closest('button,summary') && event.code !== 'KeyI') return;
    if (this.isEditable(event.target) || this.isEditable(document.activeElement)) return;
    if (
      [
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'ShiftLeft',
        'ShiftRight',
        'Space',
      ].includes(event.code)
    ) {
      event.preventDefault();
    }
    if (event.code === 'Space' && !event.repeat) this.attackPressed = true;
    if (event.code === 'KeyR' && !event.repeat) this.restartPressed = true;
    if (event.code === 'KeyE' && !event.repeat) this.interactPressed = true;
    if (event.code === 'KeyQ' && !event.repeat) this.abilityPressed = true;
    if (event.code === 'KeyI' && !event.repeat) this.inventoryPressed = true;
    if (event.code === 'Digit1' && !event.repeat) this.weaponPressed = 1;
    if (event.code === 'Digit2' && !event.repeat) this.weaponPressed = 2;
    if (event.code === 'KeyC' && !event.repeat) this.cyclePressed = true;
    if (event.code === 'KeyH' && !event.repeat) this.healPressed = true;
    this.keys.add(event.code);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly handleMouseDown = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.element) return;
    if (event.button === 0) {
      this.firePressed = true;
      this.fireHeld = true;
    }
    if (event.button === 2) this.aimHeld = true;
  };

  private readonly handleContextMenu = (event: Event): void => {
    event.preventDefault();
  };
  private readonly handleMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) this.fireHeld = false;
    if (event.button === 2) this.aimHeld = false;
  };

  private readonly handleMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.element) return;
    this.mouseX += event.movementX;
    this.mouseY += event.movementY;
  };

  private readonly handlePointerLockChange = (): void => {
    this.onPointerLockChange(document.pointerLockElement === this.element);
    if (document.pointerLockElement !== this.element) this.handleWindowBlur();
  };

  private readonly handleVisibility = (): void => {
    if (document.hidden) this.handleWindowBlur();
  };
  private readonly handleWindowBlur = (): void => {
    this.keys.clear();
    this.touchHeld.clear();
    this.touchMovement = { right: 0, forward: 0 };
    this.swapPressed = false;
    this.healPressed = false;
    this.firePressed = false;
    this.fireHeld = false;
    this.aimHeld = false;
    this.weaponPressed = null;
    this.cyclePressed = false;
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
    document.removeEventListener('field-overlay-open', this.handleWindowBlur);
    window.removeEventListener('blur', this.handleWindowBlur);
    document.removeEventListener('visibilitychange', this.handleVisibility);
    document.removeEventListener('mouseup', this.handleMouseUp);
    this.element.removeEventListener('contextmenu', this.handleContextMenu);
    this.keys.clear();
    this.touchHeld.clear();
    this.touchMovement = { right: 0, forward: 0 };
    this.swapPressed = false;
    this.healPressed = false;
    this.firePressed = false;
    this.fireHeld = false;
    this.aimHeld = false;
    this.weaponPressed = null;
    this.cyclePressed = false;
  }
}
