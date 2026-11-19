import type {
  CharacterControllerResult
} from '../core/CharacterController';
import type { CombatState } from '../core/CombatController';
import type { HordeState } from '../core/HordeDirector';
import type { LootItem } from '../core/LootField';
import { PICKUP } from '../core/PickupController';
import { WEAPONS, ammoWeapon, lootLabel, fullLootNotice } from '../core/EquipmentInventory';
import type { CompanionState } from '../core/CompanionController';
import type { MoveHud } from '../../../shared/local-creature-moves.mjs';
import type { NativeCompanionSnapshot } from '../../../shared/nextgen-companion-combat.mjs';
import type { NativeTrainingProgress } from '../../../shared/nextgen-creature-roster.mjs';
import type { SquadView } from '../core/RoomSquadState.mjs';
import { extractionStarted, extractionConfirmed, extractionFailed, extractionMessage, type ExtractionReceipt } from '../core/RoomExtractionReceipt.mjs';

/** A read-only view of confirmed room state, not a simulated solo CombatState. */
export interface OnlineHudState {
  connected: boolean;
  room: string;
  roster: number;
  locked: boolean;
  inventoryOpen: boolean;
  alive: boolean;
  hp: number;
  stamina: number;
  exhausted: boolean;
  sprinting: boolean;
  aiming: boolean;
  weapon: string;
  magazine: number | null;
  reserve: number | null;
  reloading: boolean;
  bandages: number;
  healing: boolean;
  wave: number;
  infected: number;
  waveCountdown: number;
  kills: number;
  samples: number;
  killGoal: number;
  sampleGoal: number;
  extractionReady: boolean;
  materials: { scrap: number; fiber: number; spore: number } | null;
  accountXp: number|null;
  accountExtractions: number|null;
  arsenal: Record<'pistol' | 'rifle' | 'shotgun', { magazine: number; reserve: number } | null>;
  charge: number;
  resonant: boolean;
  transitioning: boolean;
  creature: string | null;
  creatureXp: number;
  creatureProgress?: NativeTrainingProgress;
  nativeCompanion?: NativeCompanionSnapshot;
  captureKit?:number;
  captureProgress?:number|null;
  target: string;
  note: string;
  reviveProgress: number | null;
  downedSeconds: number;
  squad: SquadView[];
  objective: string;
}

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
  private lastSquadSignature='';
  private readonly squadPanel=document.createElement('div');
  private readonly squadList=document.createElement('div');
  private readonly missionPanel=document.createElement('div');
  private readonly reviveTrack=document.createElement('div');
  private readonly reconnectButton=document.createElement('button');
  private readonly abilityPanel=document.createElement('div');
  private readonly resonanceLabel=document.createElement('div');
  private readonly resonanceFill=document.createElement('div');
  private readonly companionLabel=document.createElement('div');
  private readonly pulseLabel=document.createElement('div');
  private readonly companionVitals=document.createElement('div');
  private readonly companionHealthFill=document.createElement('div');
  private readonly companionHealthText=document.createElement('div');
  private readonly trainingPanel=document.createElement('div');
  private readonly trainingLabel=document.createElement('div');
  private readonly trainingFill=document.createElement('div');
  private readonly evolutionLabel=document.createElement('div');
  private readonly captureVitals=document.createElement('div');
  private readonly captureFill=document.createElement('div');
  private readonly captureLabel=document.createElement('div');
  private readonly extractionPanel=document.createElement('section');
  private readonly extractionTitle=document.createElement('h2');
  private readonly extractionBody=document.createElement('p');
  private readonly extractionFoot=document.createElement('p');
  private readonly extractionContinue=document.createElement('button');
  private extractionReceipt: ExtractionReceipt|null=null;
  private extractionDismissed=false;

  constructor(private readonly online = false) {
    this.root.className = 'nextgen-hud';
    this.root.dataset.mode = online ? 'coop' : 'solo';
    this.health.className = 'nextgen-health';
    this.ammunition.className = 'nextgen-ammunition';
    this.hordeStatus.className = 'nextgen-horde-status';
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
    const controls=document.createElement('div');controls.textContent=online?'SERVER INVENTORY · Read only · 1/2/3 Equip · I Close (room keeps running)':'1 Secondary · 2 Primary · ↑/↓ Select · G Drop · I Close (combat still running)';controls.style.cssText='font-size:12px;color:#b8c8b0;line-height:1.6;margin-top:14px';this.inventoryOverlay.append(controls);
    if (online) {
      const exit = document.createElement('a');
      exit.href = '/?nextgen=lobby'; exit.textContent = 'Back to NEXTGEN lobby';
      exit.className = 'nextgen-room-exit';
      exit.style.cssText = 'display:inline-block;margin-top:12px;color:#bde5cf;pointer-events:auto';
      this.inventoryOverlay.append(exit);
      const persistentExit = document.createElement('a');
      persistentExit.href = '/?nextgen=lobby'; persistentExit.textContent = 'NEXTGEN lobby';
      persistentExit.className = 'nextgen-room-exit';
      persistentExit.style.cssText = 'position:absolute;right:28px;top:20px;color:#bde5cf;font-size:12px;pointer-events:auto;padding:8px;background:#101b17dd;border-radius:4px';
      this.root.append(persistentExit);
      this.squadPanel.className='nextgen-squad-panel';
      this.squadPanel.style.cssText='position:absolute;right:28px;top:58px;width:min(250px,35vw);max-height:38vh;overflow:auto;padding:13px;background:#101b17e8;border:1px solid #617b5c;border-radius:6px;font-size:12px;line-height:1.5';
      const squadHeading=document.createElement('div');squadHeading.textContent='SQUAD · SERVER HEALTH';squadHeading.style.cssText='font-weight:bold;color:#bde5cf;letter-spacing:1px;margin-bottom:5px';
      this.squadList.className='nextgen-squad-list';this.squadList.setAttribute('role','status');
      this.squadPanel.append(squadHeading,this.squadList);
      this.missionPanel.className='nextgen-objective-banner';
      this.missionPanel.style.cssText='position:absolute;left:50%;top:66px;transform:translateX(-50%);padding:8px 12px;background:#101b17dd;border:1px solid #617b5c;border-radius:5px;font-size:12px;color:#c9dfb4;max-width:min(540px,56vw);text-align:center';
      this.reviveTrack.className='nextgen-revive-track';
      this.reviveTrack.style.cssText='position:absolute;bottom:135px;left:50%;transform:translateX(-50%);width:240px;border:1px solid #e3ad7b;background:#1b201de0;padding:9px 12px;border-radius:5px;text-align:center;font-size:13px;display:none';
      this.reconnectButton.className='nextgen-room-reconnect';this.reconnectButton.type='button';this.reconnectButton.textContent='Reconnect to room';
      this.reconnectButton.style.cssText='position:absolute;top:42%;left:50%;transform:translateX(-50%);padding:12px 22px;border-radius:6px;border:1px solid #9fc68a;background:#1c3225;color:white;cursor:pointer;pointer-events:auto;display:none';
      this.root.append(this.squadPanel,this.missionPanel,this.reviveTrack,this.reconnectButton);
      this.extractionPanel.className='nextgen-extraction-results';
      this.extractionPanel.setAttribute('role','status');
      this.extractionPanel.setAttribute('aria-live','polite');
      this.extractionPanel.style.cssText='position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:min(490px,88vw);max-height:75vh;overflow:auto;padding:25px 28px;background:#102119f5;border:2px solid #9ecc91;border-radius:10px;box-shadow:0 16px 55px #000a;display:none;text-align:center;pointer-events:auto;z-index:5';
      this.extractionTitle.style.cssText='margin:0 0 12px;font-size:26px;letter-spacing:2px;color:#d0f0b8';
      this.extractionBody.style.cssText='font-size:15px;line-height:1.55;color:#e6eddc';
      this.extractionFoot.textContent='The room remains LIVE and the next objectives start automatically. Click Continue to return to the field.';
      this.extractionFoot.style.cssText='font-size:12px;line-height:1.5;color:#c3d1bc;margin:16px 0';
      this.extractionContinue.className='nextgen-extraction-continue';
      this.extractionContinue.type='button';
      this.extractionContinue.textContent='Continue next expedition';
      this.extractionContinue.style.cssText='padding:11px 18px;border:1px solid #c8e5bd;border-radius:6px;background:#52734e;color:white;cursor:pointer;font-size:14px';
      this.extractionContinue.onclick=()=>this.dismissExtraction();
      this.extractionPanel.append(this.extractionTitle,this.extractionBody,this.extractionFoot,this.extractionContinue);
      this.root.append(this.extractionPanel);
    }
    this.root.append(this.inventoryOverlay);
    this.abilityPanel.className='nextgen-ability-panel';
    this.abilityPanel.style.cssText='position:absolute;bottom:28px;right:28px;width:230px;padding:14px;background:rgba(10,18,15,.88);border:1px solid #617b5c;border-radius:6px;color:#c8ebd4;font-size:13px;line-height:1.5';
    this.resonanceLabel.className='nextgen-resonance-label';
    this.resonanceLabel.style.cssText='font-weight:bold;letter-spacing:1px';
    const meter=document.createElement('div');meter.style.cssText='height:6px;background:#263c31;border-radius:3px;overflow:hidden;margin:5px 0 12px';
    this.resonanceFill.style.cssText='height:100%;background:#8fe8b1;transform-origin:left';meter.append(this.resonanceFill);
    this.companionLabel.className='nextgen-companion-label';this.companionLabel.style.fontWeight='bold';
    this.pulseLabel.className='nextgen-pulse-label';
    this.companionVitals.className='nextgen-companion-vitals';this.companionVitals.style.cssText='display:none;margin:6px 0';
    const petMeter=document.createElement('div');petMeter.style.cssText='height:6px;background:#263c31;border-radius:3px;overflow:hidden;margin-top:4px';
    this.companionHealthFill.style.cssText='height:100%;background:#8fe8b1;transform-origin:left';petMeter.append(this.companionHealthFill);
    this.companionVitals.append(this.companionHealthText,petMeter);
    this.trainingPanel.className='nextgen-creature-training';this.trainingPanel.style.cssText='display:none;margin:8px 0;color:#d4e4cd';
    const trainingTrack=document.createElement('div');trainingTrack.style.cssText='height:5px;background:#263c31;border-radius:3px;overflow:hidden;margin:4px 0';
    this.trainingFill.style.cssText='height:100%;background:#e4c67d;transform-origin:left';trainingTrack.append(this.trainingFill);
    this.evolutionLabel.style.cssText='font-size:12px;color:#e4c67d';
    this.trainingPanel.append(this.trainingLabel,trainingTrack,this.evolutionLabel);
    this.captureVitals.className='nextgen-capture-vitals';this.captureVitals.style.cssText='display:none;border-top:1px solid #476657;margin-top:8px;padding-top:8px';
    const captureTrack=document.createElement('div');captureTrack.style.cssText='height:5px;background:#263c31;border-radius:3px;overflow:hidden;margin-top:4px';this.captureFill.style.cssText='height:100%;background:#9de4fa;transform-origin:left';captureTrack.append(this.captureFill);this.captureVitals.append(this.captureLabel,captureTrack);
    this.abilityPanel.append(this.resonanceLabel,meter,this.companionLabel,this.companionVitals,this.trainingPanel,this.pulseLabel,this.captureVitals);this.root.append(this.abilityPanel);

    document.body.appendChild(this.root);
  }

  setReconnectHandler(handler: () => void): void { if (this.online) this.reconnectButton.onclick=handler; }

  startExtraction(expedition:number, eligible:boolean): void {
    if (!this.online) return;
    this.extractionReceipt=extractionStarted(expedition,eligible);
    this.extractionDismissed=false;
    this.refreshExtractionPanel();
  }
  confirmExtraction(event:{xp:number;completed:number;totals:{xp:number}}):void {
    this.extractionReceipt=extractionConfirmed(this.extractionReceipt,event);
    this.refreshExtractionPanel();
  }
  failExtraction():void { this.extractionReceipt=extractionFailed(this.extractionReceipt); this.refreshExtractionPanel(); }
  getExtractionInfo():ExtractionReceipt|null { return this.extractionReceipt ? { ...this.extractionReceipt } : null; }
  dismissExtraction():void { this.extractionDismissed=true; this.extractionPanel.style.display='none'; }
  private refreshExtractionPanel():void {
    if (!this.online || !this.extractionReceipt) return;
    this.extractionTitle.textContent=`EXPEDITION ${this.extractionReceipt.expedition} COMPLETE`;
    this.extractionBody.textContent=extractionMessage(this.extractionReceipt);
    this.extractionPanel.style.display=this.extractionDismissed?'none':'block';
  }

  updateOnline(s: OnlineHudState): void {
    if (!this.online) throw new Error('Online HUD adapter requires a room HUD');
    this.fill.style.transform = `scaleX(${Math.max(0,Math.min(1,s.stamina/100))})`;
    this.fill.style.background = s.exhausted ? '#cb5656' : '#91c76a';
    this.value.textContent = `${Math.round(s.stamina)} / 100`;
    this.missionPanel.textContent=s.objective;
    this.missionPanel.style.borderColor=s.extractionReady?'#92d6a6':'#617b5c';
    const squadSignature=s.squad.map(a=>`${a.id}:${Math.ceil(a.hp)}:${a.downedSeconds}:${a.receivingRevive}:${a.reviving}:${Math.round(a.reviveProgress*20)}`).join('|');
    if(squadSignature!==this.lastSquadSignature){
    this.lastSquadSignature=squadSignature;
    this.squadList.replaceChildren();
    for (const ally of s.squad) {
      const row=document.createElement('div');row.className='nextgen-squad-member';row.dataset.squadId=ally.id;
      const state=ally.downed?`DOWNED · ${ally.downedSeconds}s${ally.receivingRevive?' · BEING REVIVED':''}`:ally.eliminated?'OUT OF ACTION':ally.reviving?`REVIVING ${Math.round(ally.reviveProgress*100)}%`:`${Math.ceil(ally.hp)} HP`;
      row.textContent=`${ally.label} · ${state}`;
      row.style.cssText='padding:5px 0;border-bottom:1px solid #334339;color:'+(ally.downed?'#ffc28b':ally.eliminated?'#e7a19b':'#d8e8ce');
      const bar=document.createElement('div');bar.style.cssText='margin-top:4px;height:4px;background:#344039;border-radius:4px;overflow:hidden';
      const fill=document.createElement('div');fill.style.cssText=`height:100%;width:${ally.hp}%;background:${ally.hp<26?'#e26c66':'#94bd82'}`;bar.append(fill);
      row.append(bar);this.squadList.append(row);
    }
    }
    this.reviveTrack.style.display=s.reviveProgress!==null?'block':'none';
    this.reviveTrack.textContent=s.reviveProgress!==null?`REVIVING TEAMMATE · ${Math.round(Math.max(0,Math.min(1,s.reviveProgress))*100)}% · DO NOT MOVE`:'';
    this.reconnectButton.style.display=s.connected?'none':'block';
    this.status.textContent = s.connected ? `CO-OP · ${s.room} · ${s.roster}/4 · ${s.healing?'BANDAGING':s.sprinting?'SPRINTING':'READY'}` : 'CONNECTING TO ROOM';
    this.health.textContent = `HEALTH  ${Math.ceil(s.hp)} / 100`;
    this.health.style.color = s.hp <= 25 ? '#ff5555' : '#eaa5a5';
    this.ammunition.textContent = `${s.weapon.toUpperCase()}  ${s.magazine ?? '–'} / ${s.reserve ?? '–'}${s.reloading?' · RELOADING':''}`;
    this.hordeStatus.textContent = `WAVE ${s.wave || '–'}${s.waveCountdown>0?' · NEXT '+Math.ceil(s.waveCountdown/1000)+'s':''}\nINFECTED ${s.infected}\nTEAM KILLS ${s.kills} / ${s.killGoal}\nSAMPLES ${s.samples} / ${s.sampleGoal}${s.extractionReady?' · EXTRACTION READY':''}`;
    this.inventory.textContent = `BANDAGES ${s.bandages} / 2\n${s.materials?`SCRAP ${s.materials.scrap} · FIBER ${s.materials.fiber} · SPORE ${s.materials.spore}`:'CLOUD INVENTORY SYNCING…'}`;
    this.lootPrompt.textContent = s.reviveProgress!==null ? `REVIVING ${Math.round(s.reviveProgress*100)}% · Stay still` : s.captureProgress!=null?`CAPTURING ${Math.round(s.captureProgress*100)}% · Stand still · E cancel`:s.target;
    this.lootToast.textContent = s.note;
    // In online mode, the most recent confirmation stays visible in the main status strip.
    this.lootToast.style.display='none';
    this.resonanceLabel.textContent = `Q  ${s.transitioning?'TRANSFORMING':s.resonant?'RESONANCE ACTIVE':'RESONANCE'}  ${Math.round(s.charge)}%`;
    this.resonanceFill.style.transform = `scaleX(${Math.max(0,Math.min(1,s.charge/100))})`;
    const training=s.creatureProgress;
    this.companionLabel.textContent = s.creature ? `C  ${s.creature.toUpperCase()} · ${training ? `LV ${training.level}` : `${s.creatureXp} XP`}` : 'C  NO COMPANION';
    this.trainingPanel.style.display=training?'block':'none';
    if(training) {
      this.trainingPanel.dataset.xp=String(training.xp);this.trainingPanel.dataset.level=String(training.level);
      this.trainingPanel.dataset.form=training.formId;this.trainingPanel.dataset.evolutionReady=String(training.evolutionReady);
      const levelSpan=training.nextLevelXP===null?0:training.nextLevelXP-training.levelStartXP;
      const fraction=levelSpan>0?(training.xp-training.levelStartXP)/levelSpan:1;
      this.trainingFill.style.transform=`scaleX(${Math.max(0,Math.min(1,fraction))})`;
      this.trainingLabel.textContent=training.nextLevelXP===null?`${training.xp} XP · TRAINING MAX`:`${training.xp} / ${training.nextLevelXP} XP · NEXT LEVEL`;
      this.evolutionLabel.textContent=training.evolutionReady?`EVOLUTION READY · ${training.nextFormName} · Collection menu`:
        training.nextXP===null?'FINAL FORM':`${training.nextXP-training.xp} XP TO ${training.nextFormName?.toUpperCase()}`;
    }
    const pet=s.nativeCompanion;
    this.companionVitals.style.display=pet?'block':'none';
    if(pet) {
      this.companionVitals.dataset.mode=pet.mode;
      this.companionVitals.dataset.hp=String(pet.hp);
      this.companionHealthText.textContent=pet.hp>0?`${pet.mode.toUpperCase()} · ${Math.ceil(pet.hp)} / ${pet.maxHp} HP`:'INCAPACITATED · 0 HP';
      this.companionHealthFill.style.transform=`scaleX(${Math.max(0,Math.min(1,pet.hp/pet.maxHp))})`;
      this.companionHealthFill.style.background=pet.hp/pet.maxHp<.3?'#e8877b':'#8fe8b1';
    }
    this.pulseLabel.textContent = pet ? pet.hp>0 ? 'C TACTICS · X PULSE · G STRIKE' : 'E RECOVER AT SUPPLY CACHE' : s.creature ? 'X PULSE · G STRIKE (SERVER VERIFIED)' : 'BOND AT GREEN HABITATS';
    this.captureVitals.style.display=s.captureKit===undefined?'none':'block';
    this.captureVitals.dataset.progress=s.captureProgress==null?'idle':String(s.captureProgress);
    this.captureLabel.textContent=s.captureProgress!=null?`CAPTURING ${Math.round(s.captureProgress*100)}%`:`CAPTURE CAPSULE · ${s.captureKit??0}/1`;
    this.captureFill.style.transform=`scaleX(${s.captureProgress??s.captureKit??0})`;
    this.abilityPanel.style.display = s.alive?'block':'none';
    this.crosshair.style.display = s.locked && s.aiming && !s.inventoryOpen && s.alive ? 'block' : 'none';
    this.prompt.style.color = s.alive ? '#fff' : '#ff6666';
    this.prompt.textContent = !s.connected ? s.note : !s.alive ? s.downedSeconds>0?`DOWNED · ${Math.ceil(s.downedSeconds)}s FOR TEAMMATE REVIVE · ENTER TO RESPAWN`:'OUT OF ACTION · ENTER TO RESPAWN' :
      s.inventoryOpen ? 'I CLOSE INVENTORY · GAME CONTINUES' : !s.locked ? 'CLICK TO PLAY' :
      'WASD / SHIFT MOVE · CTRL DODGE · SPACE JUMP · RMB AIM · LMB FIRE · E INTERACT · I PACK · ESC MENU';
    this.inventoryOverlay.style.display = s.inventoryOpen && s.alive ? 'block' : 'none';
    if (s.inventoryOpen) {
      this.equipmentSummary.textContent = `ACTIVE ${s.weapon.toUpperCase()} · Room ${s.room}\nACCOUNT XP ${s.accountXp ?? 'SYNCING'} · EXTRACTED ${s.accountExtractions ?? 'SYNCING'}\n${s.note}`;
      const ammo = (id: 'pistol'|'rifle'|'shotgun') => s.arsenal[id] ? `${s.arsenal[id]!.magazine} LOADED · ${s.arsenal[id]!.reserve} RESERVE` : 'Awaiting server';
      const rows = [`01   PISTOL · ${ammo('pistol')}`,`02   RIFLE · ${ammo('rifle')}`,`03   SHOTGUN · ${ammo('shotgun')}`,`04   BANDAGES · ${s.bandages} / 2`,`05   CLOUD MATERIALS · ${s.materials?`${s.materials.scrap} SCRAP · ${s.materials.fiber} FIBER · ${s.materials.spore} SPORE`:'SYNCING'}`];
      this.inventoryRows.forEach((r,i)=>{r.textContent=rows[i];r.style.background='#19231e';r.style.borderColor='#31413a';});
    }
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
    inventoryIndex = 0,
    companion:CompanionState|null=null,
    moves:MoveHud[]|null=null
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
    const r=combat.resonance;
    this.resonanceLabel.textContent=`Q  ${r.transitioning?'TRANSFORMING':r.active?'RESONANCE ACTIVE':'RESONANCE'}  ${Math.floor(r.charge)}%`;
    this.resonanceFill.style.transform=`scaleX(${r.charge/r.maxCharge})`;
    this.companionLabel.textContent=companion?`C  ${companion.name.toUpperCase()} · ${companion.assist?'ENGAGE':'FOLLOW'}`:'';
    this.pulseLabel.textContent=companion?`X  LUMEN PULSE · ${companion.pulseCooldownMs>0?(companion.pulseCooldownMs/1000).toFixed(1)+'s':'READY'}`:'';
    if(moves){this.pulseLabel.style.whiteSpace='pre-line';this.pulseLabel.textContent=moves.map((m,i)=>`${i+5}  ${m.name} · ${m.casting?'CASTING':m.remaining>0?(m.remaining/1000).toFixed(1)+'s':'READY'}`).join('\n');}
    this.abilityPanel.style.display=combat.alive?'block':'none';

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
      'WASD / SHIFT MOVE · CTRL DODGE · SPACE JUMP · RMB AIM · LMB FIRE · E LOOT · I PACK · ESC MENU / CONTROLS';
  }
  }

  dispose(): void {
    this.root.remove();
  }
}
