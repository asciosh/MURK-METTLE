// Optional NEXTGEN room features. Existing WEAPONS, arsenals, account schemas and message fields are unchanged.
import { WEAPONS, obstacleDistance } from './expansion.mjs';
import { bulletTarget } from './survival.mjs';

export const NEXTGEN_SHOTGUN = Object.freeze({ name: 'Shotgun', capacity: 5, reserve: 30, damage: 72, range: 18, interval: 850, reload: 2400, automatic: false });
export const NEXTGEN_WEAPONS = Object.freeze({ ...WEAPONS, shotgun: NEXTGEN_SHOTGUN });
export const RESONANCE_RULES = Object.freeze({ capacity: 100, minimum: 25, rechargePerSecond: 12, rechargeDelay: 1200, transition: 420, costs: Object.freeze({ pistol: 25, rifle: 8, shotgun: 30 }) });
export const REVIVE_RULES = Object.freeze({ downedMs: 25000, duration: 3000, range: 2.7, health: 35, grace: 1500 });
export const COMPANION_STRIKE = Object.freeze({ range: 3.5, damage: 12, interval: 1250 });
export const isNextgenWeapon = id => typeof id === 'string' && Object.hasOwn(NEXTGEN_WEAPONS, id);
export const newNextgenCombat = () => ({ weapon: 'pistol', shotgun: { magazine: 5, reserve: 30, readyAt: 0, reloadAt: 0 }, charge: 100, resonant: false, transitionUntil: 0, rechargeAt: 0, companionAt: 0, downedUntil: 0, revive: null });

export function selectNextgenWeapon(s, weapon) {
  if (!isNextgenWeapon(weapon)) return false;
  if (s.weapon !== weapon) { s.weapon = weapon; s.resonant = false; s.transitionUntil = 0; }
  return true;
}
export function toggleNextgenResonance(s, now) {
  if (s.transitionUntil > now) return false;
  if (!s.resonant && s.charge < Math.max(RESONANCE_RULES.minimum, RESONANCE_RULES.costs[s.weapon])) return false;
  s.resonant = !s.resonant; s.transitionUntil = now + RESONANCE_RULES.transition;
  return true;
}
export function consumeNextgenResonance(s, now) {
  if (!s.resonant || s.transitionUntil > now) return false;
  const cost = RESONANCE_RULES.costs[s.weapon];
  if (s.charge < cost) { s.resonant = false; return false; }
  s.charge -= cost; s.rechargeAt = now + RESONANCE_RULES.rechargeDelay;
  if (s.charge < cost) s.resonant = false;
  return true;
}
export function settleShotgun(s, now) {
  const a = s.shotgun;
  if (!a.reloadAt || now < a.reloadAt) return;
  const amount = Math.min(NEXTGEN_SHOTGUN.capacity - a.magazine, a.reserve);
  a.magazine += amount; a.reserve -= amount; a.reloadAt = 0;
}
export function reloadShotgun(s, now) {
  settleShotgun(s, now);
  const a = s.shotgun;
  if (a.reloadAt || a.magazine >= NEXTGEN_SHOTGUN.capacity || a.reserve <= 0) return false;
  a.reloadAt = now + NEXTGEN_SHOTGUN.reload; return true;
}
export function fireShotgun(s, now) {
  settleShotgun(s, now);
  const a = s.shotgun;
  if (a.reloadAt || now < a.readyAt || a.magazine <= 0) return false;
  a.magazine--; a.readyAt = now + NEXTGEN_SHOTGUN.interval; return true;
}
export function stepNextgenCombat(s, now, dt, alive) {
  settleShotgun(s, now);
  if (!alive) { s.resonant = false; s.transitionUntil = 0; return; }
  if (!s.resonant && now >= Math.max(s.rechargeAt, s.transitionUntil)) s.charge = Math.min(100, s.charge + Math.min(0.25, Math.max(0, dt)) * RESONANCE_RULES.rechargePerSecond);
}
export function nextgenBallistics(weapon, resonant) {
  const base = NEXTGEN_WEAPONS[weapon];
  return { damage: resonant ? Math.round(base.damage * 1.4) : base.damage, range: resonant ? Math.min(120, base.range * 1.25) : base.range, spread: resonant ? 0.65 : 1 };
}
export function nextgenShots(enemies, origin, direction, weapon, resonant,map) {
  const spec = nextgenBallistics(weapon, resonant);
  const offsets = weapon === 'shotgun' ? [[0,0],[-.035,.02],[.035,.02],[-.025,-.025],[.025,-.025]] : [[0,0]];
  const { x: dx, y: dy, z: dz } = direction, horizontal = Math.hypot(dx,dz);
  const rx = horizontal > 1e-6 ? -dz/horizontal : 1, rz = horizontal > 1e-6 ? dx/horizontal : 0;
  const up = { x: -rz*dy, y: rz*dx-rx*dz, z: rx*dy };
  const damage = new Map(), rays = [];
  for (const [x,y] of offsets) {
    const d = { x: dx+(rx*x+up.x*y)*spec.spread, y: dy+up.y*y*spec.spread, z: dz+(rz*x+up.z*y)*spec.spread };
    const len = Math.hypot(d.x,d.y,d.z); d.x /= len; d.y /= len; d.z /= len;
    const hit = bulletTarget(enemies, origin, d, spec.range,map);
    rays.push({ direction: d, distance: hit?.distance ?? (map?.distance??obstacleDistance)(origin,d,spec.range), hit: !!hit });
    if (hit) damage.set(hit.enemy, (damage.get(hit.enemy) || 0) + spec.damage / offsets.length);
  }
  return { rays, damage };
}
export function reviveInRange(from, to,map) {
  if(map){const dx=to.x-from.x,dz=to.z-from.z,dy=map.heightAt(to.x,to.z)-map.heightAt(from.x,from.z),d=Math.hypot(dx,dy,dz);return d<=REVIVE_RULES.range&&(d<0.001||map.distance({x:from.x,y:map.heightAt(from.x,from.z)+0.9,z:from.z},{x:dx/d,y:dy/d,z:dz/d},d)>=d-0.02);}
  const dx = to.x-from.x, dz = to.z-from.z, d = Math.hypot(dx,dz);
  return d <= REVIVE_RULES.range && (d < 0.001 || obstacleDistance({ x: from.x, y: 0.9, z: from.z }, { x: dx/d, y: 0, z: dz/d }, d) >= d - 0.02);
}
export function canRevive(from, to, now,map) {
  return !!(from?.nextgen && to?.nextgen && from !== to && from.hp > 0 && to.hp <= 0 && to.nextgen.downedUntil > now && from.movingUntil <= now && !from.survival.healEndsAt && reviveInRange(from,to,map));
}
