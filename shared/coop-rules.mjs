/** Pure, server-enforced multiplayer rules. No Cloudflare or browser dependencies. */
export const INFECTION_TYPES = Object.freeze([
  { id: 'runner', hp: 80, speed: 3.05, damage: 10 },
  { id: 'barkhide', hp: 145, speed: 1.58, damage: 17 },
  { id: 'sporeling', hp: 65, speed: 2.75, damage: 8 },
  { id: 'ashwalker', hp: 110, speed: 2.08, damage: 13 },
]);
export const MISSION_KILLS = 3;
export const MISSION_SALVAGE = 2;
export const PICKUPS = Object.freeze([{ id: 'sample-a', x: -5, z: -7 }, { id: 'sample-b', x: 6, z: -13 }]);
export const EXTRACTION = Object.freeze({ x: 0, z: -18, radius: 3.3 });
export const MAX_PLAYERS = 4;
export const SNAPSHOT_MS = 100;
export const isFiniteNumber = value => typeof value === 'number' && Number.isFinite(value);
export const validRoomCode = code => /^[A-Z0-9]{3,12}$/.test(code);
export const validUsername = username => /^[a-z0-9_]{3,20}$/.test(username);
