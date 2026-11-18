/** Ephemeral NEXTGEN-only movement. Never stored in an account or trusted from a client snapshot. */
import { SURVIVAL } from './survival.mjs';
export const NEXTGEN_MOBILITY = Object.freeze({
  dodgeCost: 25, dodgeDuration: 300, dodgeCooldown: 800, dodgeSpeed: 10,
  jumpDuration: 650, jumpCooldown: 850, jumpHeight: 1.25,
});
export const newNextgenMobility = () => ({
  dodgeStarted: 0, dodgeUntil: 0, dodgeCooldownUntil: 0, dodgeLastStep: 0, dx: 0, dz: 0,
  jumpStarted: 0, jumpUntil: 0, jumpCooldownUntil: 0,
});
export function beginNextgenDodge(m, player, dx, dz, now) {
  if (!m || !player || !player.survival || player.hp <= 0 ||
      player.nextgen?.revive || player.survival.healEndsAt ||
      now < m.dodgeCooldownUntil || now < m.jumpUntil ||
      !Number.isFinite(dx) || !Number.isFinite(dz) || Math.abs(dx)>1 || Math.abs(dz)>1 ||
      !Number.isFinite(now) || player.survival.stamina < NEXTGEN_MOBILITY.dodgeCost) return false;
  const length = Math.hypot(dx,dz);
  if (length < 0.25 || length > 1.45) return false;
  m.dx = dx/length; m.dz=dz/length;
  m.dodgeStarted=now; m.dodgeLastStep=now;
  m.dodgeUntil=now+NEXTGEN_MOBILITY.dodgeDuration;
  m.dodgeCooldownUntil=now+NEXTGEN_MOBILITY.dodgeCooldown;
  player.survival.stamina=Math.max(0,player.survival.stamina-NEXTGEN_MOBILITY.dodgeCost);
  player.survival.regenAt=now+SURVIVAL.recoveryDelay;
  player.survival.sprinting=false;
  if (player.survival.stamina===0) player.survival.exhausted=true;
  return true;
}
export function beginNextgenJump(m, player, now) {
  if (!m || !player || player.hp <= 0 || player.nextgen?.revive ||
    player.survival?.healEndsAt || !Number.isFinite(now) ||
    now < m.jumpCooldownUntil || now < m.dodgeUntil) return false;
  m.jumpStarted=now;m.jumpUntil=now+NEXTGEN_MOBILITY.jumpDuration;
  m.jumpCooldownUntil=now+NEXTGEN_MOBILITY.jumpCooldown;
  return true;
}
export function nextgenJumpHeight(m, now) {
  if (!m || !Number.isFinite(now) || now < m.jumpStarted || now >= m.jumpUntil) return 0;
  const fraction=(now-m.jumpStarted)/NEXTGEN_MOBILITY.jumpDuration;
  return Math.max(0,Math.sin(Math.PI*fraction)*NEXTGEN_MOBILITY.jumpHeight);
}
/** Server tick only. Constrain through the room's real map, not an old obstacle layout. */
export function advanceNextgenDodge(m, player, now, constrain) {
  if (!m || !player || player.hp<=0 || !Number.isFinite(now) || typeof constrain!=='function') return false;
  if (now <= m.dodgeStarted || m.dodgeLastStep >= m.dodgeUntil) return false;
  const end=Math.min(now,m.dodgeUntil);
  const dt=Math.max(0,Math.min(100,end-Math.max(m.dodgeStarted,m.dodgeLastStep)));
  m.dodgeLastStep=end;
  if (dt<=0) return false;
  const distance=NEXTGEN_MOBILITY.dodgeSpeed*dt/1000;
  const next=constrain({x:player.x+m.dx*distance,z:player.z+m.dz*distance});
  if (!next || !Number.isFinite(next.x) || !Number.isFinite(next.z)) return false;
  if (Math.hypot(next.x-player.x,next.z-player.z)<0.0001) return false;
  player.x=next.x;player.z=next.z;
  return true;
}
export const nextgenMobilitySnapshot = (m, now) => ({
  dodging: !!m && now >= m.dodgeStarted && now < m.dodgeUntil,
  airborne: nextgenJumpHeight(m,now)>0,
  jumpHeight: nextgenJumpHeight(m,now),
});
