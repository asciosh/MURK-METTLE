// NEXTGEN native companion combat. Position, HP, tactics and attack timing belong to the room.
import { creaturePower, constrainPosition } from './expansion.mjs';
import { nativeFormXP } from './nextgen-creature-roster.mjs';
import { pulseTargets } from './survival.mjs';

export const COMPANION_MODES = Object.freeze(['follow', 'defend', 'aggressive']);
export const NATIVE_COMPANION_RULES = Object.freeze({ defendRange: 5, aggressiveRange: 9, leash: 11, speed: 5.6, reach: 1.9, interval: 1500, manualReach: 3.5 });
const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export function nativeCompanionStats(record) {
  const stage = creaturePower(record.familyId,nativeFormXP(record)).stage;
  return { maxHp: 80 + 40*stage, damage: 12 + 6*stage, stage };
}
function followPoint(owner,map) {
  const yaw = owner.yaw || 0;
  return (map?.constrain ?? constrainPosition)({x:owner.x+Math.sin(yaw)*1.6+Math.cos(yaw)*1.1,z:owner.z+Math.cos(yaw)*1.6-Math.sin(yaw)*1.1},.3);
}
export function newNativeCompanion(owner, record, map) {
  const {maxHp} = nativeCompanionStats(record);
  return { id:`companion:${owner.id}`, instanceId:record.id, mode:'follow', hp:maxHp, maxHp, ...followPoint(owner,map), yaw:owner.yaw||0, readyAt:0, hurtUntil:0, targetId:null };
}
/** Legacy bonds never acquire new tactics or HP. Preserve deployed state across snapshots. */
export function ensureNativeCompanion(owner,map) {
  if (!map || !owner.nextgen || !owner.native || owner.native.status !== 'available') return null;
  if (owner.nativeCombat?.instanceId !== owner.native.id) owner.nativeCombat = newNativeCompanion(owner,owner.native,map);
  return owner.nativeCombat;
}
export function setNativeCompanionMode(owner,mode,map) {
  const pet=ensureNativeCompanion(owner,map);
  if (!pet || owner.hp<=0 || pet.hp<=0 || !COMPANION_MODES.includes(mode)) return false;
  pet.mode=mode; pet.targetId=null; return true;
}
export function recoverNativeCompanion(owner,map) {
  const pet=ensureNativeCompanion(owner,map);
  if (!pet) return false;
  pet.hp=pet.maxHp; pet.mode='follow'; pet.targetId=null; Object.assign(pet,followPoint(owner,map)); return true;
}
export function nativeCompanionTargetable(owner,map) {
  const pet=ensureNativeCompanion(owner,map);
  return pet && owner.hp>0 && pet.hp>0 && pet.mode!=='follow' && distance(owner,pet)<=NATIVE_COMPANION_RULES.leash ? pet : null;
}
function nearest(enemies,point) {
  return enemies.sort((a,b)=>distance(a,point)-distance(b,point)||a.id.localeCompare(b.id))[0]??null;
}
function moveTo(pet,target,dt,map,stop=0) {
  const d=distance(pet,target); if (d<=stop || d<.001) return;
  const step=Math.min(d-stop,NATIVE_COMPANION_RULES.speed*Math.min(.25,Math.max(0,dt)));
  const dx=target.x-pet.x,dz=target.z-pet.z;
  const next=(map?.constrain??constrainPosition)({x:pet.x+dx/d*step,z:pet.z+dz/d*step},.3);
  pet.x=next.x;pet.z=next.z;pet.yaw=Math.atan2(-dx,-dz);
}
/** Tick a native pet. Returns at most one legal attack; room applies damage and rewards. */
export function stepNativeCompanion(owner,enemies,dt,now,map) {
  const pet=ensureNativeCompanion(owner,map); if(!pet) return null;
  const follow=followPoint(owner,map);
  if(owner.hp<=0 || pet.hp<=0) { pet.mode='follow';pet.targetId=null;return null; }
  if(distance(owner,pet)>NATIVE_COMPANION_RULES.leash+3) {Object.assign(pet,follow);pet.targetId=null;return null;}
  const range=pet.mode==='defend'?NATIVE_COMPANION_RULES.defendRange:pet.mode==='aggressive'?NATIVE_COMPANION_RULES.aggressiveRange:0;
  const target=range&&distance(owner,pet)<=NATIVE_COMPANION_RULES.leash ? nearest(pulseTargets(enemies,owner,range,map),pet):null;
  pet.targetId=target?.id??null;
  if(!target) {moveTo(pet,follow,dt,map,.35);return null;}
  moveTo(pet,target,dt,map,1.25);
  if(now<pet.readyAt || !pulseTargets([target],pet,NATIVE_COMPANION_RULES.reach,map).length) return null;
  pet.readyAt=now+NATIVE_COMPANION_RULES.interval;
  return {target,damage:nativeCompanionStats(owner.native).damage};
}
export function manualNativeStrike(owner,enemies,now,map) {
  const pet=ensureNativeCompanion(owner,map);
  if(!pet || owner.hp<=0 || pet.hp<=0 || now<pet.readyAt || distance(owner,pet)>NATIVE_COMPANION_RULES.leash) return null;
  const target=nearest(pulseTargets(enemies,pet,NATIVE_COMPANION_RULES.manualReach,map).filter(e=>distance(owner,e)<=NATIVE_COMPANION_RULES.leash),pet);
  if(!target) return null;
  pet.readyAt=now+NATIVE_COMPANION_RULES.interval;
  return {target,damage:nativeCompanionStats(owner.native).damage};
}
export function nativeCompanionSnapshot(pet) {
  return {mode:pet.mode,hp:pet.hp,maxHp:pet.maxHp,x:pet.x,z:pet.z,yaw:pet.yaw,targetId:pet.targetId};
}
