import { legacyEvolutionPreview, levelFromXP, EVOLUTION_DEMO_CATALOG, planEvolution } from './creature-evolution.mjs';

// Independent account key. Never replace the legacy one-per-species collection.
export const NEXTGEN_ROSTER_KEY = 'nextgen-creature-roster-v1';
const MAX_INSTANCES = 256;
const cleanXP = value => Number.isSafeInteger(value) && value >= 0 && value <= 250000;
export const NATIVE_CAPTURE = Object.freeze({ id: 'wild-lanternkin', x: 8, z: -8, range: 2.7, familyId: 'lanternkin' });

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
  const selected = instances.find(c => c.id === previous?.activeId && c.origin === 'native' && c.status === 'available');
  if (selected) return { version: 1, instances, activeId: selected.id };
  return { version: 1, instances, activeId: active?.status === 'available' &&
    legacyCollection?.creatures?.[active.familyId]?.owned === true ? active.id : null };
}

export function activeNative(roster) {
  if (roster?.version !== 1 || !Array.isArray(roster.instances)) return null;
  return roster.instances.find(c => c.id === roster.activeId && c.origin === 'native' && c.status === 'available' && c.familyId === NATIVE_CAPTURE.familyId && cleanXP(c.xp) && EVOLUTION_DEMO_CATALOG.forms[c.formId]?.familyId === c.familyId) ?? null;
}
export const nativeFormXP = record => record.formId === `${record.familyId}-3` ? 400 : record.formId === `${record.familyId}-2` ? 120 : 0;
export function captureNative(roster, id = crypto.randomUUID()) {
  // Reserve room for all five legacy imports even if the player hasn't bonded them yet.
  if (roster.instances.length >= MAX_INSTANCES - 5 || roster.instances.some(c => c.id === id)) throw Error('Creature collection is full or ID is invalid');
  const record = { id, familyId: NATIVE_CAPTURE.familyId, formId: NATIVE_CAPTURE.familyId, xp: 0, origin: 'native', status: 'available' };
  return { ...roster, instances: [...roster.instances, record], activeId: id };
}
export function creditNative(roster, id, xp) {
  const record = roster?.instances.find(c => c.id === id && c.origin === 'native' && c.status === 'available' && c.familyId === NATIVE_CAPTURE.familyId);
  if (!record || ![12,40].includes(xp)) throw Error('Invalid deployed creature');
  return { ...roster, instances: roster.instances.map(c => c.id === id ? { ...c, xp: Math.min(250000, c.xp + xp) } : c) };
}
export function selectNative(roster, id) {
  if (!roster.instances.some(c => c.id === id && c.origin === 'native' && c.status === 'available' && c.familyId === NATIVE_CAPTURE.familyId)) throw Error('Creature unavailable');
  return { ...roster, activeId: id };
}
export function evolveNative(roster, id, targetId) {
  const record = roster.instances.find(c => c.id === id && c.origin === 'native' && c.status === 'available' && c.familyId === NATIVE_CAPTURE.familyId);
  if (!record) throw Error('Creature unavailable');
  const decision = planEvolution(EVOLUTION_DEMO_CATALOG, record.familyId, record.formId, targetId, { xp: record.xp });
  if (!decision.ok || decision.consumes.length) throw Error('Evolution requirements not met');
  return { ...roster, instances: roster.instances.map(c => c.id === id ? { ...c, formId: decision.to } : c) };
}

/** Client view is derived from server-owned records, not writable client input. */
export function rosterView(roster) {
  return { version: roster.version, activeId: roster.activeId, instances: roster.instances.map(record => ({
    ...record, level: levelFromXP(record.xp),
    name: EVOLUTION_DEMO_CATALOG.forms[record.formId].name,
    familyName: EVOLUTION_DEMO_CATALOG.families[record.familyId].name,
    nextXP: record.origin === 'legacy' ? (record.xp < 120 ? 120 : record.xp < 400 ? 400 : null) : record.familyId === NATIVE_CAPTURE.familyId ? (nativeFormXP(record) === 0 ? 120 : nativeFormXP(record) === 120 ? 400 : null) : null,
    nextFormId: record.origin === 'native' && record.familyId === NATIVE_CAPTURE.familyId ? (nativeFormXP(record) === 0 ? `${record.familyId}-2` : nativeFormXP(record) === 120 ? `${record.familyId}-3` : null) : null,
  })) };
}
