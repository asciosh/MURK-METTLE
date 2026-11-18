import { WEAPONS, type WeaponId } from './EquipmentInventory.ts';

export const RESONANCE = Object.freeze({ capacity:100, minimum:25, rechargePerSecond:12,
  rechargeDelayMs:1200, transitionMs:420, cost:{pistol:25,rifle:8,shotgun:30} });

export function resonantBallistics(weapon: WeaponId, active = false) {
  const base=WEAPONS[weapon];
  return {damage:active?Math.round(base.damage*1.4):base.damage,
    range:active?base.range*1.25:base.range, spread:active?.65:1};
}

/** Expedition-local charge; never changes magazines or grants ammunition. */
export class WeaponResonance {
  private charge=RESONANCE.capacity as number;
  private active=false;
  private transition=0;
  private rechargeDelay=0;
  private empoweredShots=0;
  get transitioning(){return this.transition>0;}
  tick(dt:number, alive:boolean):void {
    if(!Number.isFinite(dt)||dt<=0)return;
    dt=Math.min(100,dt);
    this.transition=Math.max(0,this.transition-dt);
    if(!alive){this.cancel();return;}
    const available=Math.max(0,dt-this.rechargeDelay);
    this.rechargeDelay=Math.max(0,this.rechargeDelay-dt);
    if(!this.active&&!this.transitioning)this.charge=Math.min(RESONANCE.capacity,this.charge+available*RESONANCE.rechargePerSecond/1000);
  }
  toggle(weapon:WeaponId):boolean {
    if(this.transitioning)return false;
    if(!this.active&&this.charge<Math.max(RESONANCE.minimum,RESONANCE.cost[weapon]))return false;
    this.active=!this.active;this.transition=RESONANCE.transitionMs;return true;
  }
  consume(weapon:WeaponId):boolean {
    if(!this.active||this.transitioning)return false;
    const cost=RESONANCE.cost[weapon];
    if(this.charge<cost){this.cancel();return false;}
    this.charge-=cost;this.empoweredShots++;this.rechargeDelay=RESONANCE.rechargeDelayMs;
    if(this.charge<cost)this.active=false;
    return true;
  }
  cancel():void {this.active=false;this.transition=0;}
  getState(){return {active:this.active,charge:this.charge,maxCharge:RESONANCE.capacity,
    transitioning:this.transitioning,transitionRemainingMs:this.transition,empoweredShots:this.empoweredShots};}
}
