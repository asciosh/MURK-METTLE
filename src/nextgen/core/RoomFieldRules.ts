import { CREATURES, SPECIES_IDS, SUPPLIES, constrainPosition, type SpeciesId } from '../../../shared/expansion.mjs';
import { EXTRACTION } from '../../../shared/coop-rules.mjs';
import type { CollectionState } from '../../../shared/collection.mjs';
import { terrainConstrain } from '../../../shared/nextgen-terrain.mjs';
import { NATIVE_CAPTURE } from '../../../shared/nextgen-creature-roster.mjs';

type Point = { x: number; z: number };
type Mission = { pickups: readonly (Point & { id: string })[]; ready: boolean; phase: string };
export type FieldTarget = Point & { id: string; kind: 'bond' | 'resupply' | 'pickup' | 'extract' | 'capture'; range: number; label: string; species?: SpeciesId; available: boolean };

/** UI hints only: all interactions still require acceptance by the room Durable Object. */
export function roomFieldTargets(collection: CollectionState | null, mission: Mission | null, capture = false): FieldTarget[] {
  const result: FieldTarget[] = SUPPLIES.map(p => ({ ...p, id: p.id, kind: 'resupply', range: 2.8, label: `Open supply cache · ${p.id}`, available: true }));
  if (collection) for (const species of SPECIES_IDS) {
    if (collection.creatures[species]?.owned) continue;
    const d = CREATURES[species];
    result.push({ id: species, species, x: d.x, z: d.z, kind: 'bond', range: 2.7, label: `Bond creature · ${d.name}`, available: true });
  }
  if (mission) {
    if (capture && collection && mission.phase === 'active') result.push({ ...NATIVE_CAPTURE, kind:'capture', label:'Capture wild Lanternkin · once per expedition', available:true });
    for (const p of mission.pickups) result.push({ ...p, kind: 'pickup', range: 2.7, label: `Collect sample · ${p.id}`, available: mission.phase === 'active' });
    result.push({ id: 'extraction', x: EXTRACTION.x, z: EXTRACTION.z, kind: 'extract', range: EXTRACTION.radius, label: mission.ready ? 'Extract · complete expedition' : 'Extraction locked · complete team objectives', available: mission.ready && mission.phase === 'active' });
  }
  return result;
}

export function nearestFieldTarget(position: Point, targets: readonly FieldTarget[]): FieldTarget | null {
  return targets.filter(t => t.available && Math.hypot(position.x - t.x, position.z - t.z) <= t.range)
    .sort((a, b) => Math.hypot(position.x - a.x, position.z - a.z) - Math.hypot(position.x - b.x, position.z - b.z) || a.id.localeCompare(b.id))[0] ?? null;
}

export function fieldIntent(target: FieldTarget): { type: string; body: Record<string, unknown> } | null {
  if (!target.available) return null;
  if (target.kind === 'bond') return target.species ? { type: 'bond', body: { species: target.species } } : null;
  if (target.kind === 'extract') return { type: 'extract', body: {} };
  return { type: target.kind, body: { id: target.id } };
}

export function nextOwnedSpecies(collection: CollectionState | null): SpeciesId | null {
  if (!collection) return null;
  const owned = SPECIES_IDS.filter(id => collection.creatures[id]?.owned);
  return owned.length > 1 ? owned[(owned.indexOf(collection.active) + 1) % owned.length] : null;
}

export function companionFollow(owner: Point, yaw: number,terrain=false): Point {
  return (terrain?terrainConstrain:constrainPosition)({ x: owner.x + Math.sin(yaw) * 1.6 + Math.cos(yaw) * 1.1, z: owner.z + Math.cos(yaw) * 1.6 - Math.sin(yaw) * 1.1 }, 0.3);
}
