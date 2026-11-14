import * as THREE from 'three';
import { Zombie, type InfectedStrain } from './Zombie';
import type { ModelEntry } from './AnimationController';
import {
  HordeSimulation,
  damageEnemy,
  type Combatant,
  type EnemySnapshot,
  type HordePacket,
} from '../../../shared/survival.mjs';

/** One visual per living infected; simulation rules are shared with the room server. */
export class InfectedGroup {
  readonly simulation = new HordeSimulation();
  states: EnemySnapshot[] = [];
  wave = 0;
  nextWaveAt = 0;
  private readonly actors = new Map<string, Zombie>();
  private readonly fallen: { actor: Zombie; age: number }[] = [];
  private model: ModelEntry | undefined;
  constructor(private readonly scene: THREE.Scene) {}
  resetSolo(player: Combatant): void {
    this.clear();
    this.simulation.reset([player]);
    this.states = this.simulation.enemies;
  }
  stepSolo(player: Combatant, dt: number, now: number) {
    const hits = this.simulation.step([player], dt, now);
    this.states = this.simulation.enemies;
    this.wave = this.simulation.wave;
    this.nextWaveAt = this.simulation.nextWaveAt;
    this.render(dt);
    return hits;
  }
  sync(packet: HordePacket, dt: number): void {
    this.states = packet.enemies;
    this.wave = packet.wave;
    this.nextWaveAt = packet.nextWaveAt;
    this.render(dt);
  }
  private render(dt: number): void {
    const living = new Set(this.states.filter((s) => s.hp > 0).map((s) => s.id));
    for (const [id, actor] of this.actors)
      if (!living.has(id)) {
        if (this.states.some((s) => s.id === id && s.hp <= 0)) this.fallen.push({ actor, age: 0 });
        else actor.dispose();
        this.actors.delete(id);
      }
    for (let i = this.fallen.length - 1; i >= 0; i--) {
      const body = this.fallen[i];
      body.age += dt;
      body.actor.renderDeath(dt, body.age / 0.9);
      if (body.age >= 0.9) {
        body.actor.dispose();
        this.fallen.splice(i, 1);
      }
    }
    for (const state of this.states) {
      if (state.hp <= 0) continue;
      let actor = this.actors.get(state.id);
      if (!actor) {
        actor = new Zombie(
          this.scene,
          new THREE.Vector3(state.x, 0, state.z),
          state.strain as InfectedStrain,
          state.generation,
        );
        this.actors.set(state.id, actor);
        if (this.model) void actor.installModel(this.model);
      }
      const motion = new THREE.Vector3(state.x - actor.root.position.x, 0, state.z - actor.root.position.z);
      actor.updateNetworkVisual(dt, motion, state.state);
      actor.root.position.set(state.x, 0, state.z);
      const difference = actor.getHealth() - state.hp;
      if (difference > 0) actor.takeDamage(difference);
    }
  }
  damage(id: string, amount: number): boolean {
    const enemy = this.simulation.enemies.find((e) => e.id === id);
    if (!enemy) return false;
    const killed = damageEnemy(enemy, amount);
    this.actors.get(id)?.takeDamage(amount);
    return killed;
  }
  focus(position: { x: number; z: number }): EnemySnapshot | null {
    return (
      this.states
        .filter((s) => s.hp > 0)
        .sort(
          (a, b) => Math.hypot(a.x - position.x, a.z - position.z) - Math.hypot(b.x - position.x, b.z - position.z),
        )[0] || null
    );
  }
  get alive(): EnemySnapshot[] {
    return this.states.filter((s) => s.hp > 0);
  }
  installModel(entry: ModelEntry): void {
    this.model = entry;
    for (const actor of this.actors.values()) void actor.installModel(entry);
  }
  clear(): void {
    for (const actor of this.actors.values()) actor.dispose();
    this.actors.clear();
    for (const body of this.fallen) body.actor.dispose();
    this.fallen.length = 0;
    this.states = [];
  }
  dispose(): void {
    this.clear();
  }
}
export function infectedName(strain: string): string {
  return (
    (
      { runner: 'Feral Runner', barkhide: 'Barkhide', sporeling: 'Sporeling', ashwalker: 'Ashwalker' } as Record<
        string,
        string
      >
    )[strain] || 'Infected'
  );
}
