import type { CharacterInput } from './CharacterController.ts';

export class KeyboardInput {
  private readonly pressed = new Set<string>();

  private jumpPending = false;
  private dodgePending = false;

  private lastJump = false;
  private lastDodge = false;

  private static readonly KEYS = new Set([
    'KeyW',
    'KeyA',
    'KeyS',
    'KeyD',
    'ShiftLeft',
    'ShiftRight',
    'ControlLeft',
    'Space'
  ]);

  keyDown(code: string, repeat = false): boolean {
    if (!KeyboardInput.KEYS.has(code)) {
      return false;
    }

    if (!repeat && !this.pressed.has(code)) {
      this.pressed.add(code);

      if (code === 'Space') {
        this.jumpPending = true;
      }

      if (code === 'ControlLeft') {
        this.dodgePending = true;
      }
    }

    return true;
  }

  keyUp(code: string): boolean {
    if (!KeyboardInput.KEYS.has(code)) {
      return false;
    }

    this.pressed.delete(code);

    return true;
  }

  read(): CharacterInput {
    const jump = this.jumpPending && !this.lastJump;
    const dodge = this.dodgePending && !this.lastDodge;

    if (jump) this.jumpPending = false;
    if (dodge) this.dodgePending = false;

    this.lastJump = jump;
    this.lastDodge = dodge;

    return {
      forward:
        Number(this.pressed.has('KeyW')) -
        Number(this.pressed.has('KeyS')),

      strafe:
        Number(this.pressed.has('KeyD')) -
        Number(this.pressed.has('KeyA')),

      sprint:
        this.pressed.has('ShiftLeft') ||
        this.pressed.has('ShiftRight'),

      jump,
      dodge
    };
  }

  reset(): void {
    this.pressed.clear();

    this.jumpPending = false;
    this.dodgePending = false;

    this.lastJump = false;
    this.lastDodge = false;
  }
}