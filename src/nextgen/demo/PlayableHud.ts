import type {
  CharacterControllerResult
} from '../core/CharacterController';

export class PlayableHud {
  private readonly root = document.createElement('div');
  private readonly fill = document.createElement('div');
  private readonly value = document.createElement('div');
  private readonly status = document.createElement('div');
  private readonly prompt = document.createElement('div');
  private readonly crosshair = document.createElement('div');

  constructor() {
    this.root.style.cssText = `
      position:fixed;
      inset:0;
      pointer-events:none;
      z-index:100;
      font-family:Arial,sans-serif;
      color:#fff;
    `;

    const panel = document.createElement('div');

    panel.style.cssText = `
      position:absolute;
      bottom:28px;
      left:28px;
      width:260px;
      padding:16px;
      background:rgba(10,18,15,0.85);
      border:1px solid #617b5c;
      border-radius:6px;
    `;

    const title = document.createElement('div');

    title.textContent = 'STAMINA';
    title.style.cssText =
      'font-size:12px;letter-spacing:2px;color:#a9c69a;';

    this.value.style.cssText =
      'font-size:22px;font-weight:bold;margin:6px 0;';

    const track = document.createElement('div');

    track.style.cssText = `
      height:8px;
      background:#25312a;
      border-radius:3px;
      overflow:hidden;
    `;

    this.fill.style.cssText = `
      width:100%;
      height:100%;
      background:#91c76a;
      transform-origin:left;
    `;

    this.status.style.cssText =
      'font-size:12px;margin-top:10px;color:#c7d5bd;';

    this.prompt.style.cssText = `
      position:absolute;
      top:24px;
      left:50%;
      transform:translateX(-50%);
      background:rgba(10,18,15,0.8);
      padding:12px 20px;
      border-radius:6px;
      font-size:13px;
      text-align:center;
    `;

    this.crosshair.className = 'aim-crosshair';
    this.crosshair.setAttribute('aria-hidden', 'true');
    this.crosshair.textContent = '+';

  this.crosshair.style.cssText = `
    position:absolute;
    left:50%;
    top:50%;
    transform:translate(-50%, -50%);
    font-size:26px;
    font-weight:bold;
    line-height:1;
    color:rgba(255,255,255,0.9);
    text-shadow:0 0 4px #000;
    pointer-events:none;
    display:none;
  `;

    track.appendChild(this.fill);

    panel.append(
      title,
      this.value,
      track,
      this.status
    );

    this.root.append(
      panel,
      this.prompt,
      this.crosshair
    );

    document.body.appendChild(this.root);
  }

  update(
    state: CharacterControllerResult,
    locked: boolean
  ): void {
    const fraction = Math.max(
      0,
      Math.min(1, state.stamina / state.maxStamina)
    );

    this.fill.style.transform = `scaleX(${fraction})`;

    this.fill.style.background =
      state.exhausted ? '#cb5656' : '#91c76a';

    this.value.textContent =
      `${Math.ceil(state.stamina)} / ${state.maxStamina}`;

    this.status.textContent =
      state.dodging ? 'DODGING' :
      state.airborne ? 'AIRBORNE' :
      state.exhausted ? 'EXHAUSTED' :
      state.sprinting ? 'SPRINTING' :
      'READY';

    this.prompt.textContent = locked
      ? 'WASD | Shift Sprint | Ctrl Dodge | Space Jump | RMB Aim | Esc Release'
      : 'CLICK TO PLAY';

    this.crosshair.style.display =
      locked && state.aiming ? 'block' : 'none';
  }

  dispose(): void {
    this.root.remove();
  }
}