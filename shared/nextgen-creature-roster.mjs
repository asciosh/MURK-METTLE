import { legacyEvolutionPreview, levelFromXP, EVOLUTION_DEMO_CATALOG } from './creature-evolution.mjs';

// Independent account key. Never replace the legacy one-per-species collection.
export const NEXTGEN_ROSTER_KEY = 'nextgen-creature-roster-v1';
const MAX_INSTANCES = 256;
const cleanXP = value => Number.isSafeInteger(value) && value >= 0 && value <= 250000;

/** Reconcile verified legacy ownership; never accept a browser-supplied collection. */
export function reconcileRoster(previous, legacyCollection, newId = () => crypto.randomUUID()) {
  if (previous !== undefined && (previous?.version !== 1 || !Array.isArray(previous.instances))) {
    // Fail closed on unknown versions instead of silently dropping a collection.
    throw Error('Unsupported NEXTGEN creature roster');
  }
  const instances = (previous?.instances ?? []).map(record => ({ ...record }));
  if (instances.length > MAX_INSTANCES) throw Error('Creature roster limit exceeded');
  const ids = new Set(), linked = new Map();
  for (const record of instances) {
    const family = EVOLUTION_DEMO_CATALOG.families[record.familyId];
    if (typeof record.id !== 'string' || !record.id || ids.has(record.id) || !family ||
      EVOLUTION_DEMO_CATALOG.forms[record.formId]?.familyId !== record.familyId || !cleanXP(record.xp) ||
      !['available', 'lost'].includes(record.status) || !['legacy', 'native'].includes(record.origin)) {
      throw Error('Invalid stored creature roster');
    }
    ids.add(record.id);
    if (record.origin === 'legacy') {
      if (!family.archive || linked.has(record.familyId)) throw Error('Invalid legacy roster link');
      linked.set(record.familyId, record);
    }
  }
  for (const entry of legacyEvolutionPreview(legacyCollection)) {
    if (!entry.owned) continue;
    const existing = linked.get(entry.species);
    if (existing) {
      // A future lost instance must NEVER be re-created by the legacy bridge.
      if (existing.status === 'lost') continue;
      if (entry.xp > existing.xp) {
        existing.xp = entry.xp;
        existing.formId = entry.formId;
      }
      continue;
    }
    if (instances.length === MAX_INSTANCES) throw Error('Creature roster limit exceeded');
    const id = newId();
    if (typeof id !== 'string' || !id || ids.has(id)) throw Error('Duplicate creature instance ID');
    const record = { id, familyId: entry.species, formId: entry.formId, xp: entry.xp,
      origin: 'legacy', status: 'available' };
    ids.add(id); instances.push(record); linked.set(entry.species, record);
  }
  const active = linked.get(legacyCollection?.active);
  return { version: 1, instances, activeId: active?.status === 'available' &&
    legacyCollection?.creatures?.[active.familyId]?.owned === true ? active.id : null };
}

/** Client view is derived from server-owned records, not writable client input. */
export function rosterView(roster) {
  return { version: roster.version, activeId: roster.activeId, instances: roster.instances.map(record => ({
    ...record, level: levelFromXP(record.xp),
    name: EVOLUTION_DEMO_CATALOG.forms[record.formId].name,
    familyName: EVOLUTION_DEMO_CATALOG.families[record.familyId].name,
    nextXP: record.origin === 'legacy' ? (record.xp < 120 ? 120 : record.xp < 400 ? 400 : null) : null,
  })) };
}
