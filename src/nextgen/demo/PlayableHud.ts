import type {
  CharacterControllerResult
} from '../core/CharacterController';
import type { CombatState } from '../core/CombatController';
import type { HordeState } from '../core/HordeDirector';
import type { LootItem } from '../core/LootField';
import { PICKUP } from '../core/PickupController';
import { WEAPONS, ammoWeapon, lootLabel, fullLootNotice } from '../core/EquipmentInventory';

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
  private readonly inventoryOverlay = document.createElement('div');
  private readonly equipmentSummary = document.createElement('div');
  private readonly inventoryRows: HTMLDivElement[] = [];

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

    this.inventoryOverlay.className='nextgen-inventory-panel';
    this.inventoryOverlay.setAttribute('role','region');this.inventoryOverlay.setAttribute('aria-label','Field inventory');
    this.inventoryOverlay.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(520px,90vw);max-height:85vh;overflow:hidden;background:rgba(12,20,17,.96);border:1px solid #74856d;border-radius:8px;padding:22px;box-shadow:0 14px 50px #0009;display:none';
    const heading=document.createElement('div');heading.textContent='FIELD INVENTORY';heading.style.cssText='font-size:20px;font-weight:700;letter-spacing:3px;color:#c7d8b9;margin-bottom:14px';
    this.equipmentSummary.style.cssText='white-space:pre-line;font:14px/1.65 Arial;color:#e2dfc9;padding:10px;background:#202e26;border-radius:4px;margin-bottom:10px';
    const caption=document.createElement('div');caption.textContent='PACK CONTENTS';caption.style.cssText='font-size:11px;letter-spacing:2px;color:#a5b7a0;margin:16px 0 6px';
    this.inventoryOverlay.append(heading,this.equipmentSummary,caption);
    for(let i=0;i<5;i++){
      const row=document.createElement('div');row.style.cssText='padding:12px 10px;margin:4px 0;border:1px solid #31413a;border-radius:4px;font-size:14px;white-space:pre-line';
      row.className='nextgen-inventory-row';this.inventoryRows.push(row);this.inventoryOverlay.append(row);
    }
    const controls=document.createElement('div');controls.textContent='1 Secondary · 2 Primary · ↑/↓ Select · G Drop · I Close (combat still running)';controls.style.cssText='font-size:12px;color:#b8c8b0;line-height:1.6;margin-top:14px';this.inventoryOverlay.append(controls);
    this.root.append(this.inventoryOverlay);

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
    pickingUp = false,
    inventoryIndex = 0
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

    const weapon = combat.weaponName.toUpperCase();
    this.ammunition.textContent = combat.switching ? weapon+' EQUIPPING...' : combat.reloading
      ? weapon+'  RELOADING...'
      : `${weapon}  ${combat.ammo} / ${combat.reserve}`;

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
    this.inventory.textContent += '\nINVENTORY OPEN';
    const e=combat.equipment;
    const main=e.primary?WEAPONS[e.primary].label+' · '+e[e.primary].loaded+'/'+WEAPONS[e.primary].magazine:'EMPTY';
    this.equipmentSummary.textContent='[1] SECONDARY  Pistol · '+e.pistol.loaded+'/12'+(e.active==='pistol'?'  • EQUIPPED':'')+'\n[2] PRIMARY  '+main+(e.primary===e.active?'  • EQUIPPED':'');
    const rows=[
      '01   PRIMARY WEAPON   '+(e.primary?WEAPONS[e.primary].label:'Empty slot'),
      '02   PISTOL ROUNDS   '+e.pistol.reserve+' / '+WEAPONS.pistol.reserve,
      '03   RIFLE ROUNDS   '+e.rifle.reserve+' / '+WEAPONS.rifle.reserve,
      '04   SHOTGUN SHELLS   '+e.shotgun.reserve+' / '+WEAPONS.shotgun.reserve,
      '05   BANDAGES   '+combat.bandages+' / '+combat.maxBandages
    ];
    this.inventoryRows.forEach((r,i)=>{r.textContent=rows[i]??'';r.style.background=i===inventoryIndex?'#394c35':'#19231e';r.style.borderColor=i===inventoryIndex?'#a1bc83':'#31413a';});
  }
  this.inventoryOverlay.style.display=inventoryOpen&&combat.alive?'block':'none';
  this.lootPrompt.textContent = '';
  if (loot && combat.alive) {
    const ammo=ammoWeapon(loot.kind);
    const room = ammo ? WEAPONS[ammo].reserve-combat.equipment[ammo].reserve : loot.kind==='bandage'
      ? combat.maxBandages-combat.bandages : combat.equipment.primary===null?1:0;
    const amount = Math.min(loot.amount, Math.max(0, room));
    this.lootPrompt.textContent = amount > 0
      ? 'E: Take ' + amount + ' ' +
        (loot.kind === 'ammo' ? 'rounds' : lootLabel(loot.kind,amount).toLowerCase())
      : fullLootNotice(loot.kind);
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
      'WASD | Shift Sprint | Ctrl Dodge | Space Jump | RMB Aim | LMB Fire | R Reload | F Melee | H Bandage | E Loot | 1/2 Weapon | I Inventory';
  }
  }

  dispose(): void {
    this.root.remove();
  }
}
