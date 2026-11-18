import { creaturePower } from '../../../shared/expansion.mjs';
import type { ShotTarget } from './ShotQuery.ts';

type Vec3=[number,number,number];
type Position=readonly [number,number,number];
type Height=(x:number,z:number)=>number;
export const COMPANION = Object.freeze({ species:'lanternkin' as const, basicDamage:12,
  attackRange:1.5, attackIntervalMs:1250, detectionRange:8, leash:10, speed:5.8, pulseTargets:3 });
const POWER=creaturePower(COMPANION.species,0);
const distance=(a:Position,b:Position)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const valid=(p:Position)=>p.every(Number.isFinite);
export type CompanionMode='follow'|'chase'|'attack'|'pulse'|'inactive';
export interface CompanionStrike {index:number;damage:number;kind:'basic'|'pulse';}

/** Fixed-step local companion. Default follow mode never attacks automatically. */
export class CompanionController {
  private position:Vec3=[0,0,0];
  private facing:Vec3=[0,0,-1];
  private assist=false;
  private mode:CompanionMode='follow';
  private cooldown=0;
  private pulseCooldown=0;
  private attackPose=0;
  private pulsePose=0;
  private attacks=0;
  private pulses=0;
  private moving=false;
  private initialized=false;
  reset(owner:Position,facing:Position,height:Height):void {
    this.assist=false;this.mode='follow';this.cooldown=this.pulseCooldown=this.attackPose=this.pulsePose=this.attacks=this.pulses=0;
    this.moving=false;this.initialized=false;this.facing=[0,0,-1];
    this.placeBeside(owner,facing,height);
  }
  private placeBeside(owner:Position,facing:Position,height:Height):void {
    const x=owner[0]-facing[2]*1.6-facing[0]*.9,z=owner[2]+facing[0]*1.6-facing[2]*.9;
    const y=height(x,z);
    this.position=Number.isFinite(y)?[x,y,z]:[...owner];this.initialized=true;
  }
  toggleAssist():boolean {this.assist=!this.assist;return this.assist;}
  private visible(target:Position,height:Height):boolean {
    const from=this.position,d=distance(from,target),n=Math.max(1,Math.ceil(d/.25));
    for(let i=1;i<n;i++) {const t=i/n,x=from[0]+(target[0]-from[0])*t,z=from[2]+(target[2]-from[2])*t;
      const y=from[1]+.55+(target[1]+.8-from[1]-.55)*t,h=height(x,z);
      if(!Number.isFinite(h)||h>y)return false;}
    return true;
  }
  step(delta:number,owner:Position|null,facing:Position,targets:readonly ShotTarget[],pulse:boolean,height:Height):CompanionStrike[] {
    if(!Number.isFinite(delta)||delta<=0)return [];
    const dt=Math.min(100,delta);this.cooldown=Math.max(0,this.cooldown-dt);this.pulseCooldown=Math.max(0,this.pulseCooldown-dt);
    this.attackPose=Math.max(0,this.attackPose-dt);this.pulsePose=Math.max(0,this.pulsePose-dt);this.moving=false;
    if(!owner||!valid(owner)||!valid(facing)){this.assist=false;this.mode='inactive';this.attackPose=this.pulsePose=0;return [];}
    if(!this.initialized||distance(owner,this.position)>COMPANION.leash+4)this.placeBeside(owner,facing,height);
    const eligible=targets.map((target,index)=>({target,index,d:distance(target.position,this.position)}))
      .filter(({target})=>Number.isFinite(target.health)&&target.health>0&&valid(target.position)&&distance(target.position,owner)<=COMPANION.leash)
      .sort((a,b)=>a.d-b.d||a.index-b.index);
    if(pulse&&!this.pulseCooldown){
      const inRange=eligible.filter(({target,d})=>d<=POWER.range&&this.visible(target.position,height)).slice(0,COMPANION.pulseTargets);
      if(inRange.length){this.pulseCooldown=POWER.cooldown*1000;this.pulsePose=650;this.pulses++;this.mode='pulse';
        return inRange.map(({index})=>({index,damage:POWER.damage,kind:'pulse'}));}
    }
    if(this.pulsePose>0){this.mode='pulse';return [];}
    const enemy=this.assist?eligible.find(({target})=>distance(target.position,owner)<=COMPANION.detectionRange):undefined;
    if(enemy&&enemy.d<=COMPANION.attackRange&&this.visible(enemy.target.position,height)){
      this.face(enemy.target.position);this.mode='attack';
      if(!this.cooldown){this.cooldown=COMPANION.attackIntervalMs;this.attackPose=320;this.attacks++;
        return [{index:enemy.index,damage:COMPANION.basicDamage,kind:'basic'}];}
      return [];
    }
    this.mode=enemy?'chase':'follow';
    const goal:Position=enemy?enemy.target.position:[owner[0]-facing[2]*1.6-facing[0]*.9,owner[1],owner[2]+facing[0]*1.6-facing[2]*.9];
    const dx=goal[0]-this.position[0],dz=goal[2]-this.position[2],d=Math.hypot(dx,dz);
    const stop=enemy?1.0:.38;
    if(d>stop){const travel=Math.min(d-stop,dt/1000*COMPANION.speed),x=this.position[0]+dx/d*travel,z=this.position[2]+dz/d*travel,y=height(x,z);
      if(Number.isFinite(y)){this.position=[x,y,z];this.face(goal);this.moving=true;}}
    return [];
  }
  private face(target:Position):void {const dx=target[0]-this.position[0],dz=target[2]-this.position[2],d=Math.hypot(dx,dz);if(d>1e-6)this.facing=[dx/d,0,dz/d];}
  getState(){return { species:COMPANION.species,name:POWER.name, position:[...this.position] as Vec3, facing:[...this.facing] as Vec3,
    assist:this.assist,mode:this.mode,moving:this.moving,attackPoseMs:this.attackPose,pulsePoseMs:this.pulsePose,
    pulseCooldownMs:this.pulseCooldown,pulseMaxCooldownMs:POWER.cooldown*1000,pulseRange:POWER.range,attacks:this.attacks,pulses:this.pulses };}
}
export type CompanionState=ReturnType<CompanionController['getState']>;
