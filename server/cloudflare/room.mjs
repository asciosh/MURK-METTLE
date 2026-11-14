// Cloudflare Durable Object — shared four-player session state.
// This is an authoritative combat prototype, not yet an account/inventory server.
import { DurableObject } from 'cloudflare:workers';
import { sanitizeActorPose } from '../../shared/actor-pose.mjs';
import {
  WORLD_BOUNDARY,
  CREATURES,
  SPECIES_IDS,
  SUPPLIES,
  WEAPONS,
  constrainPosition,
  newArsenal,
  fireWeapon,
  reloadWeapon,
  settleReload,
  shotDistance,
  obstacleDistance,
  creaturePower,
} from '../../shared/expansion.mjs';

import {
  INFECTION_TYPES,
  MISSION_KILLS,
  MISSION_SALVAGE,
  PICKUPS,
  EXTRACTION,
  MAX_PLAYERS,
  SNAPSHOT_MS,
  isFiniteNumber as isNumber,
  validRoomCode,
  validUsername,
} from '../../shared/coop-rules.mjs';

const selectZombie = (last = null, generation = 0) => {
  const options = INFECTION_TYPES.filter((type) => type.id !== last);
  const type = options[Math.floor(Math.random() * options.length)];
  return {
    x: 0.7,
    z: -9.5,
    hp: type.hp,
    max: type.hp,
    strain: type.id,
    speed: type.speed,
    damage: type.damage,
    generation,
    encounterId: crypto.randomUUID(),
    lastHit: 0,
    deadAt: 0,
  };
};

export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.players = new Map();
    this.zombie = selectZombie();
    this.lastTick = Date.now();
    this.timer = null;
    this.mission = { kills: 0, salvage: [], completed: 0, sequence: 0, phase: 'active' };
    this.ctx.blockConcurrencyWhile(async () => {
      const saved = await this.ctx.storage.get('shared-mission');
      if (saved && typeof saved === 'object' && Array.isArray(saved.salvage)) this.mission = saved;
      if (this.mission.phase === 'extracting') {
        this.mission.phase = 'active'; // Last extraction already consumed before award attempt.
        await this.persistMission();
      }
    });
    // Socket attachments recover player positions when a Durable Object wakes.
    for (const ws of this.ctx.getWebSockets()) {
      const data = ws.deserializeAttachment();
      if (data?.id && this.players.size < MAX_PLAYERS)
        this.players.set(ws, {
          id: data.id,
          username: data.username || '',
          x: data.x ?? 0,
          z: data.z ?? 0,
          yaw: data.yaw ?? 0,
          hp: data.hp ?? 100,
          lastMove: Date.now(),
          attackAt: 0,
          pulseAt: 0,
          messageAt: 0,
          arsenal: data.arsenal || newArsenal(),
          supplies: data.supplies || {},
          pose: sanitizeActorPose(data.pose),
          collection: data.collection || null,
          upgrades: { sharpened: false, balanced: false },
          creatureOwned: data.creatureOwned === true,
        });
    }
    if (this.players.size) this.startTick();
  }

  async fetch(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return new Response('Expected WebSocket', { status: 426 });
    if (this.players.size >= MAX_PLAYERS) return new Response('Room full (4 players)', { status: 429 });
    const url = new URL(request.url);
    const code = (url.searchParams.get('code') || '').trim().toUpperCase();
    if (!validRoomCode(code)) return new Response('Invalid code', { status: 400 });
    const username = request.headers.get('X-MM-Verified-User') || '';
    if (!validUsername(username)) return new Response('Verified account required', { status: 401 });
    // Block two simultaneous sockets for the same account in one room.
    if ([...this.players.values()].some((p) => p.username === username))
      return new Response('Account already connected to this room', { status: 409 });
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    const player = {
      id: crypto.randomUUID(),
      username,
      x: 0,
      z: 0,
      yaw: 0,
      hp: 100,
      lastMove: Date.now(),
      attackAt: 0,
      pulseAt: 0,
      messageAt: 0,
      arsenal: newArsenal(),
      supplies: {},
      pose: sanitizeActorPose(),
    };
    this.players.set(server, player);
    this.saveAttachment(server, player);
    this.send(server, { type: 'welcome', id: player.id, code });
    this.send(server, this.missionPacket());
    // Load server-owned creature state before accepting combat abilities.
    try {
      await this.accountCollection(player);
      this.send(server, { type: 'collection-state', collection: player.collection });
      this.send(server, { type: 'arsenal', arsenal: player.arsenal });
      this.saveAttachment(server, player);
    } catch (error) {
      player.creatureOwned = false;
      this.send(server, { type: 'error', message: 'Could not load cloud creature data.' });
    }
    this.startTick();
    return new Response(null, { status: 101, webSocket: client });
  }

  startTick() {
    if (this.timer || !this.players.size) return;
    this.lastTick = Date.now();
    this.timer = setInterval(() => this.tick(), SNAPSHOT_MS);
  }
  stopTick() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
  send(socket, msg) {
    try {
      socket.send(JSON.stringify(msg));
    } catch {
      /* socket is closing */
    }
  }
  broadcast(msg) {
    for (const socket of this.players.keys()) this.send(socket, msg);
  }
  saveAttachment(socket, player) {
    socket.serializeAttachment({
      id: player.id,
      username: player.username,
      x: player.x,
      z: player.z,
      yaw: player.yaw,
      hp: player.hp,
      creatureOwned: player.creatureOwned === true,
      collection: player.collection,
      arsenal: player.arsenal,
      supplies: player.supplies,
      pose: player.pose,
    });
  }

  missionPacket() {
    return {
      type: 'mission-state',
      kills: this.mission.kills,
      salvage: this.mission.salvage.length,
      completed: this.mission.completed,
      ready: this.mission.kills >= MISSION_KILLS && this.mission.salvage.length >= MISSION_SALVAGE,
      pickups: PICKUPS.filter((item) => !this.mission.salvage.includes(item.id)),
      phase: this.mission.phase,
    };
  }
  async persistMission() {
    await this.ctx.storage.put('shared-mission', this.mission);
  }
  async rewardExpedition(participants, eventId) {
    await Promise.all(
      participants.map(async (player) => {
        try {
          const account = this.env.PLAYER_ACCOUNTS.get(this.env.PLAYER_ACCOUNTS.idFromName(player.username));
          const response = await account.fetch(
            new Request('https://internal/api/account/coop-expedition', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-MM-Account': player.username,
                'X-MM-Reward-Source': 'game-room-v1',
              },
              body: JSON.stringify({ id: eventId }),
            }),
          );
          if (!response.ok) throw new Error(`Party reward HTTP ${response.status}`);
          const result = await response.json();
          const socket = [...this.players].find(([, p]) => p.id === player.id)?.[0];
          if (socket)
            this.send(socket, {
              type: 'mission-reward',
              xp: result.duplicate ? 0 : 150,
              totals: result.stats,
              completed: result.stats.extractions,
            });
        } catch (error) {
          console.error('Party reward failed', error);
          const socket = [...this.players].find(([, p]) => p.id === player.id)?.[0];
          if (socket)
            this.send(socket, { type: 'error', message: 'Party reward could not be credited; report this mission.' });
        }
      }),
    );
  }
  async accountCollection(player, action = null, species = null) {
    const account = this.env.PLAYER_ACCOUNTS.get(this.env.PLAYER_ACCOUNTS.idFromName(player.username));
    const response = await account.fetch(
      new Request('https://internal/api/account/coop-collection', {
        method: action ? 'POST' : 'GET',
        headers: {
          'X-MM-Account': player.username,
          'X-MM-Reward-Source': 'game-room-v1',
          'Content-Type': 'application/json',
        },
        ...(action ? { body: JSON.stringify({ action, species }) } : {}),
      }),
    );
    if (!response.ok) throw new Error(`Collection HTTP ${response.status}`);
    player.collection = (await response.json()).collection;
    player.creatureOwned = player.collection.creatures[player.collection.active].owned;
    return player.collection;
  }
  async accountCreature(player, action = null) {
    const account = this.env.PLAYER_ACCOUNTS.get(this.env.PLAYER_ACCOUNTS.idFromName(player.username));
    const response = await account.fetch(
      new Request('https://internal/api/account/coop-creature', {
        method: action ? 'POST' : 'GET',
        headers: {
          'X-MM-Account': player.username,
          'X-MM-Reward-Source': 'game-room-v1',
          ...(action ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(action ? { body: JSON.stringify({ action }) } : {}),
      }),
    );
    if (!response.ok) throw new Error(`Creature account returned ${response.status}`);
    return (await response.json()).creature;
  }
  async webSocketMessage(socket, raw) {
    const player = this.players.get(socket);
    if (!player || typeof raw !== 'string' || raw.length > 2048) return;
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    if (!msg || typeof msg.type !== 'string') return;
    const now = Date.now();
    if (msg.type === 'move') {
      if (!isNumber(msg.x) || !isNumber(msg.z) || !isNumber(msg.yaw)) return;
      if (Math.abs(msg.x) > WORLD_BOUNDARY || Math.abs(msg.z) > WORLD_BOUNDARY || Math.abs(msg.yaw) > 1000) return;
      // Guard against high packet rates and large impossible teleports.
      if (now - player.messageAt < 45) return;
      player.messageAt = now;
      const dt = Math.min(0.5, (now - player.lastMove) / 1000);
      if (Math.hypot(msg.x - player.x, msg.z - player.z) > 9 * dt + 1.5) return;
      if (player.hp <= 0) return;
      const constrained = constrainPosition({ x: msg.x, z: msg.z });
      if (Math.hypot(constrained.x - msg.x, constrained.z - msg.z) > 0.05) return;
      player.x = msg.x;
      player.z = msg.z;
      player.yaw = msg.yaw;
      player.lastMove = now;
      player.pose = sanitizeActorPose(msg);
      this.saveAttachment(socket, player);
      return;
    }
    if (msg.type === 'reload' || msg.type === 'resupply') {
      if (player.hp <= 0) return;
      if (msg.type === 'reload' && Object.hasOwn(WEAPONS, msg.weapon)) reloadWeapon(player.arsenal, msg.weapon, now);
      if (msg.type === 'resupply') {
        const cache = SUPPLIES.find((p) => p.id === msg.id);
        if (!cache || Math.hypot(player.x - cache.x, player.z - cache.z) > 2.8) return;
        if (now - (player.supplies[cache.id] || 0) < 45000) {
          this.send(socket, { type: 'error', message: 'Supply cache restocking (45 seconds).' });
          return;
        }
        player.supplies[cache.id] = now;
        for (const id of Object.keys(WEAPONS)) player.arsenal[id].reserve = WEAPONS[id].reserve;
      }
      this.send(socket, { type: 'arsenal', arsenal: player.arsenal });
      this.saveAttachment(socket, player);
      return;
    }
    if (msg.type === 'bond' || msg.type === 'select-creature') {
      const species = msg.species || 'lanternkin';
      if (!SPECIES_IDS.includes(species) || player.hp <= 0) return;
      const def = CREATURES[species];
      if (msg.type === 'bond' && Math.hypot(player.x - def.x, player.z - def.z) > 2.7) {
        this.send(socket, { type: 'error', message: 'Move closer to this creature to bond.' });
        return;
      }
      try {
        await this.accountCollection(player, msg.type === 'bond' ? 'bond' : 'select', species);
        this.send(socket, { type: 'collection-state', collection: player.collection, bonded: msg.type === 'bond' });
        this.saveAttachment(socket, player);
      } catch {
        this.send(socket, { type: 'error', message: 'Creature collection could not be updated.' });
      }
      return;
    }
    if (msg.type === 'sync-equipment') {
      // Obtain upgrades from account storage; never accept equipment flags from packets.
      try {
        const target = this.env.PLAYER_ACCOUNTS.get(this.env.PLAYER_ACCOUNTS.idFromName(player.username));
        const response = await target.fetch(
          new Request('https://internal/api/account/coop-equipment', {
            method: 'GET',
            headers: { 'X-MM-Account': player.username, 'X-MM-Reward-Source': 'game-room-v1' },
          }),
        );
        if (response.ok) {
          const data = await response.json();
          player.upgrades = {
            sharpened: data.upgrades?.sharpened === true,
            balanced: data.upgrades?.balanced === true,
          };
        }
      } catch (error) {
        console.warn('Unable to verify equipment', error);
      }
      return;
    }
    if (msg.type === 'pickup') {
      if (player.hp <= 0 || this.mission.phase !== 'active') return;
      const item = PICKUPS.find((item) => item.id === msg.id);
      if (!item || this.mission.salvage.includes(item.id)) return;
      if (Math.hypot(item.x - player.x, item.z - player.z) > 2.7) return;
      this.mission.salvage.push(item.id);
      await this.persistMission();
      this.broadcast(this.missionPacket());
      return;
    }
    if (msg.type === 'extract') {
      if (
        player.hp <= 0 ||
        this.mission.phase !== 'active' ||
        this.mission.kills < MISSION_KILLS ||
        this.mission.salvage.length < MISSION_SALVAGE ||
        Math.hypot(player.x - EXTRACTION.x, player.z - EXTRACTION.z) > EXTRACTION.radius
      )
        return;
      const participants = [...this.players.values()]
        .filter((p) => p.hp > 0)
        .map((p) => ({ id: p.id, username: p.username }));
      if (!participants.length) return;
      this.mission.phase = 'extracting';
      this.mission.sequence++;
      this.mission.completed++;
      const eventId = `mission:${this.ctx.id.toString()}:${this.mission.sequence}`;
      this.mission.kills = 0;
      this.mission.salvage = [];
      await this.persistMission();
      this.broadcast({ type: 'mission-extracted', by: player.id, completed: this.mission.completed });
      await this.rewardExpedition(participants, eventId);
      this.mission.phase = 'active';
      await this.persistMission();
      this.broadcast(this.missionPacket());
      return;
    }
    if (msg.type === 'restart') {
      if (player.hp <= 0) {
        player.hp = 100;
        player.x = 0;
        player.z = 0;
        player.lastMove = now;
        player.arsenal = newArsenal();
        this.send(socket, { type: 'arsenal', arsenal: player.arsenal });
        this.saveAttachment(socket, player);
        this.send(socket, { type: 'damage', hp: 100 });
      }
      return;
    }
    if (msg.type !== 'attack' && msg.type !== 'pulse' && msg.type !== 'shoot') return;
    const zombie = this.zombie;
    if (player.hp <= 0 || (zombie.hp <= 0 && msg.type !== 'shoot')) return;
    const pulse = msg.type === 'pulse';
    const shooting = msg.type === 'shoot';
    const species = player.collection?.active || 'lanternkin';
    const power = creaturePower(species, player.collection?.creatures[species]?.xp || 0);
    if (pulse && !player.creatureOwned) {
      this.send(socket, { type: 'error', message: 'Bond with Lanternkin before using Pulse.' });
      return;
    }
    let damage;
    if (shooting) {
      const d = msg.direction;
      if (
        !Object.hasOwn(WEAPONS, msg.weapon) ||
        !d ||
        ![d.x, d.y, d.z].every(isNumber) ||
        Math.abs(Math.hypot(d.x, d.y, d.z) - 1) > 0.015
      )
        return;
      const weapon = WEAPONS[msg.weapon],
        origin = { x: player.x, y: 1.32, z: player.z };
      if (!fireWeapon(player.arsenal, msg.weapon, now)) {
        this.send(socket, { type: 'arsenal', arsenal: player.arsenal });
        return;
      }
      player.pose = { ...sanitizeActorPose(player.pose), weapon: msg.weapon };
      const hit = zombie.hp > 0 ? shotDistance(origin, d, zombie, weapon.range) : null;
      this.send(socket, { type: 'arsenal', arsenal: player.arsenal });
      this.saveAttachment(socket, player);
      this.broadcast({
        type: 'shot',
        weapon: msg.weapon,
        by: player.id,
        origin,
        direction: d,
        distance: hit ?? obstacleDistance(origin, d, weapon.range),
        hit: hit !== null,
      });
      if (hit === null) return;
      damage = weapon.damage;
    } else {
      const cooldown = pulse ? power.cooldown * 1000 : 480;
      if (now - (pulse ? player.pulseAt : player.attackAt) < cooldown) return;
      if (pulse) player.pulseAt = now;
      else player.attackAt = now;
      const distance = Math.hypot(zombie.x - player.x, zombie.z - player.z);
      if (distance > (pulse ? power.range : player.upgrades?.balanced ? 3.35 : 2.65)) return;
      if (!pulse) {
        const vx = (zombie.x - player.x) / Math.max(distance, 0.001),
          vz = (zombie.z - player.z) / Math.max(distance, 0.001);
        if (-Math.sin(player.yaw) * vx - Math.cos(player.yaw) * vz < -0.15) return;
      }
      damage = pulse ? power.damage : player.upgrades?.sharpened ? 55 : 40;
    }
    zombie.hp = Math.max(0, zombie.hp - damage);
    if (zombie.hp === 0) {
      zombie.deadAt = now;
      // Co-op XP is awarded by the room, never by a player-supplied packet.
      // Account storage uses the unique encounter ID to reject duplicate awards.
      const eventId = `kill:${zombie.encounterId}`;
      try {
        const target = this.env.PLAYER_ACCOUNTS.get(this.env.PLAYER_ACCOUNTS.idFromName(player.username));
        const response = await target.fetch(
          new Request('https://internal/api/account/coop-reward', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-MM-Account': player.username,
              'X-MM-Reward-Source': 'game-room-v1',
            },
            body: JSON.stringify({ id: eventId, pulse, species }),
          }),
        );
        if (!response.ok) throw new Error(`Reward store returned ${response.status}`);
        const result = await response.json();
        if (result.collection) {
          player.collection = result.collection;
          this.send(socket, { type: 'collection-state', collection: player.collection });
          this.saveAttachment(socket, player);
        }
        this.send(socket, {
          type: 'reward',
          xp: 50,
          creatureXp: pulse ? 40 : 0,
          material: result.material || null,
          totals: result.stats,
          duplicate: !!result.duplicate,
        });
      } catch (error) {
        // No client-side award fallback: failure must remain visible and
        // investigated rather than creating untrusted progression.
        this.send(socket, { type: 'error', message: 'Cloud reward could not be saved. Please report this match.' });
        console.error('Co-op reward failed', error);
      }
      this.mission.kills = Math.min(MISSION_KILLS, this.mission.kills + 1);
      await this.persistMission();
      this.broadcast(this.missionPacket());
      this.broadcast({ type: 'kill', by: player.id, pulse, x: zombie.x, z: zombie.z });
    }
  }
  webSocketClose(socket) {
    this.drop(socket);
  }
  webSocketError(socket) {
    this.drop(socket);
    try {
      socket.close(1011, 'Socket error');
    } catch {}
  }
  drop(socket) {
    this.players.delete(socket);
    if (!this.players.size) {
      this.stopTick();
      this.zombie = selectZombie();
    }
  }

  tick() {
    if (!this.players.size) {
      this.stopTick();
      return;
    }
    const now = Date.now();
    const dt = Math.min(0.25, (now - this.lastTick) / 1000);
    this.lastTick = now;
    for (const [socket, p] of this.players) {
      for (const id of Object.keys(WEAPONS)) {
        const prior = p.arsenal[id].reloadAt;
        settleReload(p.arsenal, id, now);
        if (prior && !p.arsenal[id].reloadAt) {
          this.send(socket, { type: 'arsenal', arsenal: p.arsenal });
          this.saveAttachment(socket, p);
        }
      }
    }
    const zombie = this.zombie;
    if (zombie.hp === 0) {
      if (now - zombie.deadAt > 6000) {
        this.zombie = selectZombie(zombie.strain, zombie.generation + 1);
        const alive = [...this.players.values()].find((p) => p.hp > 0);
        if (alive) {
          const spawn = constrainPosition(
            { x: alive.x + Math.sin(alive.yaw) * -12, z: alive.z - Math.cos(alive.yaw) * 12 },
            0.5,
          );
          this.zombie.x = spawn.x;
          this.zombie.z = spawn.z;
        }
      }
    } else {
      const alive = [...this.players.entries()].filter(([, p]) => p.hp > 0);
      alive.sort(
        (a, b) => Math.hypot(zombie.x - a[1].x, zombie.z - a[1].z) - Math.hypot(zombie.x - b[1].x, zombie.z - b[1].z),
      );
      if (alive.length) {
        const [socket, target] = alive[0];
        const dist = Math.hypot(zombie.x - target.x, zombie.z - target.z);
        if (dist > 40) {
          const spawn = constrainPosition(
            { x: target.x - Math.sin(target.yaw) * 12, z: target.z - Math.cos(target.yaw) * 12 },
            0.5,
          );
          zombie.x = spawn.x;
          zombie.z = spawn.z;
        }
        if (dist > 1.62 && dist < 18) {
          const step = Math.min(dist - 1.62, zombie.speed * dt);
          zombie.x += ((target.x - zombie.x) / dist) * step;
          zombie.z += ((target.z - zombie.z) / dist) * step;
          constrainPosition(zombie, 0.43);
        } else if (dist <= 1.62 && now - zombie.lastHit > 1350) {
          zombie.lastHit = now;
          target.hp = Math.max(0, target.hp - zombie.damage);
          this.saveAttachment(socket, target);
          this.send(socket, { type: 'damage', hp: target.hp });
        }
      }
    }
    this.broadcast({
      type: 'snapshot',
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        x: p.x,
        z: p.z,
        yaw: p.yaw,
        hp: p.hp,
        ...sanitizeActorPose(p.pose),
        reloadProgress: (() => {
          const weapon = p.pose?.weapon || 'pistol';
          const end = p.arsenal[weapon].reloadAt;
          return end > now ? Math.max(0.001, Math.min(1, 1 - (end - now) / WEAPONS[weapon].reload)) : 0;
        })(),
        creatureOwned: p.creatureOwned === true,
        species: p.collection?.active || 'lanternkin',
        creatureXp: p.collection?.creatures[p.collection.active]?.xp || 0,
      })),
      zombie: {
        x: this.zombie.x,
        z: this.zombie.z,
        hp: this.zombie.hp,
        max: this.zombie.max,
        strain: this.zombie.strain,
        generation: this.zombie.generation,
      },
    });
  }
}
