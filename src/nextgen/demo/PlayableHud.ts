import type {
  CharacterControllerResult
} from '../core/CharacterController';
import type { CombatState } from '../core/CombatController';
import type { HordeState } from '../core/HordeDirector';
import type { LootItem } from '../core/LootField';
import { PICKUP } from '../core/PickupController';

export class PlayableHud {
  private readonly root = document.createElement('div');
  private readonly fill = document.createElement('div');
  private readonly value = document.createElement('div');
  private readonly status = document.createElement('div');
  private readonly prompt = document.createElement('div');
  private readonly crosshair = document.createElement('div');
  private readonly health = document.createElement('div');
  private readonly ammunition = document.createElement('div');
  private readonly hordeStatus = document.createElement('div');
  private readonly inventory = document.createElement('div');
  private readonly lootPrompt = document.createElement('div');
  private readonly lootToast = document.createElement('div');

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

    this.health.style.cssText = `
  font-size:18px;
  font-weight:bold;
  margin-bottom:10px;
  color:#eaa5a5;
`;

this.ammunition.style.cssText = `
  font-size:16px;
  font-weight:bold;
  margin-top:16px;
  color:#e5d69a;
`;

this.hordeStatus.style.cssText = `
  font-size:14px;
  font-weight:bold;
  margin-top:14px;
  padding-top:12px;
  border-top:1px solid #617b5c;
  color:#e5d69a;
  white-space:pre-line;
`;

  this.inventory.style.cssText = 'margin-top:12px;font-size:13px;white-space:pre-line;color:#d3dfc8';
  this.lootPrompt.style.cssText = 'margin-top:8px;font-size:13px;color:#f3db90';
  panel.append(
    this.health,
    title,
    this.value,
    track,
    this.status,
    this.ammunition,
    this.hordeStatus,
    this.inventory,
    this.lootPrompt
  );

    this.lootPrompt.className = 'nextgen-loot-prompt';
    this.lootToast.className = 'nextgen-loot-toast';
    this.lootToast.style.cssText =
      'position:absolute;left:50%;bottom:22%;transform:translateX(-50%);' +
      'padding:10px 18px;background:rgba(10,18,15,.90);border:1px solid #728b65;' +
      'border-radius:6px;font-weight:bold;font-size:16px;display:none;white-space:nowrap';
    this.root.append(panel, this.prompt, this.crosshair, this.lootToast);

    document.body.appendChild(this.root);
  }

  update(
    state: CharacterControllerResult,
    locked: boolean,
    combat: CombatState,
    horde: HordeState & { training: boolean },
    loot: LootItem | null = null,
    inventoryOpen = false,
    lootNotice = '',
    pickingUp = false
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

      this.health.textContent =
  `HEALTH  ${Math.ceil(combat.health)} / ${combat.maxHealth}`;

    this.health.style.color =
      combat.health <= 25 ? '#ff5555' : '#eaa5a5';

    this.ammunition.textContent = combat.reloading
      ? 'PISTOL  RELOADING...'
      : `PISTOL  ${combat.ammo} / ${combat.reserve}`;

  this.hordeStatus.textContent = horde.training
    ? `TRAINING | KILLS ${horde.kills}`
    : horde.intermission
      ? `WAVE ${horde.wave} CLEARED\nNEXT WAVE IN ${Math.ceil(horde.countdownMs / 1000)}s\nKILLS ${horde.kills}`
      : `WAVE ${horde.wave}\nINFECTED ${horde.living} / ${horde.total}\nKILLS ${horde.kills}`;

  this.inventory.textContent = combat.healing
    ? 'BANDAGING ' + (combat.healRemainingMs / 1000).toFixed(1) + 's'
    : 'BANDAGES ' + combat.bandages + ' / ' + combat.maxBandages;
  if (combat.meleeRemainingMs > 0) this.inventory.textContent += '\nMELEE WINDUP';
  if (inventoryOpen) {
    this.inventory.textContent += '\nINVENTORY\nPistol ammunition: ' + combat.ammo +
      ' loaded / ' + combat.reserve + '/' + combat.reserveCapacity + ' reserve\nMelee hits: ' + combat.meleeHits;
  }
  this.lootPrompt.textContent = '';
  if (loot && combat.alive) {
    const room = loot.kind === 'ammo'
      ? combat.reserveCapacity - combat.reserve
      : combat.maxBandages - combat.bandages;
    const amount = Math.min(loot.amount, Math.max(0, room));
    this.lootPrompt.textContent = amount > 0
      ? 'E: Take ' + amount + ' ' +
        (loot.kind === 'ammo' ? 'rounds' : (amount === 1 ? 'bandage' : 'bandages'))
      : (loot.kind === 'ammo' ? 'AMMO RESERVE FULL' : 'BANDAGES FULL');
    this.lootPrompt.style.color = amount > 0 ? '#f3db90' : '#eaa5a5';
    const distance = Math.hypot(loot.position[0] - state.position[0],
      loot.position[1] - state.position[1], loot.position[2] - state.position[2]);
    if (amount > 0 && distance > PICKUP.reach) this.lootPrompt.textContent = 'MOVE CLOSER TO LOOT';
    if (pickingUp) this.lootPrompt.textContent = 'COLLECTING...';
  }
  const message = combat.alive ? lootNotice : '';
  this.lootToast.textContent = message;
  this.lootToast.style.display = message ? 'block' : 'none';
  this.lootToast.style.color = message.startsWith('+') ? '#9ef5b5' : '#f3db90';

  this.prompt.style.color = '#fff';

  if (!combat.alive) {
    this.prompt.textContent = 'YOU DIED - Press ENTER to restart';
    this.prompt.style.color = '#ff6666';
    this.crosshair.style.display = 'none';
  } else if (locked) {
    this.prompt.textContent =
      'WASD | Shift Sprint | Ctrl Dodge | Space Jump | RMB Aim | LMB Fire | R Reload | F Melee | H Bandage | E Loot | I Inventory';
  }
  }

  dispose(): void {
    this.root.remove();
  }
}