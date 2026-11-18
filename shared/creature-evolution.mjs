/** M04-B: deterministic, portable evolution rules. No storage, network or UI authority. */
import { CREATURES, SPECIES_IDS, evolutionStage } from './expansion.mjs';

const ID = /^[a-z][a-z0-9_-]{1,39}$/;
const KINDS = new Set(['xp', 'level', 'friendship', 'item', 'trade', 'time']);
const upperBound = (value, maximum) => Number.isSafeInteger(value) && value >= 0 && value <= maximum;
const assert = (condition, message) => { if (!condition) throw Error(`Invalid creature catalog: ${message}`); };

export function levelFromXP(xp) {
  const clean = Number.isFinite(xp) ? Math.min(1_000_000_000, Math.max(0, Math.floor(xp))) : 0;
  return Math.min(100, 1 + Math.floor(Math.sqrt(clean / 60)));
}

/** Validate developer-authored catalogs before use. Never interpret executable pack content. */
export function createEvolutionCatalog(entries) {
  assert(Array.isArray(entries) && entries.length > 0 && entries.length <= 256, 'family count');
  const families = Object.create(null), forms = Object.create(null);
  let totalForms = 0, totalEdges = 0;
  for (const family of entries) {
    assert(family && typeof family === 'object' && !Array.isArray(family), 'family');
    assert(typeof family.id === 'string' && ID.test(family.id) && !families[family.id], 'family id');
    assert(typeof family.name === 'string' && family.name.length > 0 && family.name.length <= 60, 'family name');
    assert(Array.isArray(family.forms) && family.forms.length >= 1 && family.forms.length <= 12, 'forms count');
    assert(Array.isArray(family.evolutions) && family.evolutions.length <= 32, 'evolution count');
    const formIds = new Set();
    const cleanForms = family.forms.map(form => {
      assert(form && typeof form.id === 'string' && ID.test(form.id), 'form id');
      assert(typeof form.name === 'string' && form.name.length > 0 && form.name.length <= 60, 'form name');
      assert(!forms[form.id] && !formIds.has(form.id), 'duplicate form');
      formIds.add(form.id);
      const result = Object.freeze({ id: form.id, name: form.name, familyId: family.id });
      forms[form.id] = result;
      return result;
    });
    totalForms += cleanForms.length;
    assert(totalForms <= 1024, 'total forms');
    const edges = [], edgeKeys = new Set();
    for (const edge of family.evolutions) {
      assert(edge && typeof edge === 'object' && formIds.has(edge.from) && formIds.has(edge.to) && edge.from !== edge.to, 'edge endpoints');
      const key = `${edge.from}>${edge.to}`;
      assert(!edgeKeys.has(key), 'duplicate edge'); edgeKeys.add(key);
      assert(Array.isArray(edge.all) && edge.all.length > 0 && edge.all.length <= 6, 'requirements');
      const kinds = new Set();
      const all = edge.all.map(rule => {
        assert(rule && KINDS.has(rule.kind) && !kinds.has(rule.kind), 'requirement kind'); kinds.add(rule.kind);
        if (rule.kind === 'time') assert(['day', 'night'].includes(rule.value), 'time');
        else if (rule.kind === 'item') assert(typeof rule.value === 'string' && ID.test(rule.value), 'item id');
        else if (rule.kind === 'trade') assert(rule.value === true, 'trade');
        else if (rule.kind === 'level') assert(upperBound(rule.value, 100) && rule.value >= 1, 'level');
        else if (rule.kind === 'friendship') assert(upperBound(rule.value, 100), 'friendship');
        else assert(upperBound(rule.value, 1_000_000_000), 'xp');
        return Object.freeze({ kind: rule.kind, value: rule.value });
      });
      edges.push(Object.freeze({ from: edge.from, to: edge.to, all: Object.freeze(all) }));
    }
    totalEdges += edges.length;
    assert(totalEdges <= 2048, 'total edges');
    // Reject any evolution graph with cycles, including branches that later reconnect.
    const adjacency = new Map(cleanForms.map(f => [f.id, []]));
    for (const edge of edges) adjacency.get(edge.from).push(edge.to);
    const visiting = new Set(), visited = new Set();
    function visit(node) {
      assert(!visiting.has(node), 'cycle');
      if (visited.has(node)) return;
      visiting.add(node);
      for (const next of adjacency.get(node)) visit(next);
      visiting.delete(node); visited.add(node);
    }
    for (const form of cleanForms) visit(form.id);
    families[family.id] = Object.freeze({ id: family.id, name: family.name,
      forms: Object.freeze(cleanForms), evolutions: Object.freeze(edges),
      archive: family.archive === true });
  }
  return Object.freeze({ families: Object.freeze(families), forms: Object.freeze(forms), familyIds: Object.freeze(Object.keys(families)) });
}

/** Context must be supplied by the trusted game authority in production (including time/trade/items). */
export function availableEvolutions(catalog, familyId, formId, context = {}) {
  const family = catalog?.families?.[familyId];
  if (!family || catalog.forms?.[formId]?.familyId !== familyId) return [];
  const xp = Number.isFinite(context.xp) ? Math.max(0, Math.floor(context.xp)) : 0;
  const level = levelFromXP(xp);
  const friendship = Number.isFinite(context.friendship) ? Math.max(0, Math.min(100, Math.floor(context.friendship))) : 0;
  const items = context.items && typeof context.items === 'object' ? context.items : {};
  return family.evolutions.filter(e => e.from === formId).map(edge => {
    const missing = [];
    const consumes = [];
    for (const rule of edge.all) {
      if (rule.kind === 'xp' && xp < rule.value) missing.push(`Need ${rule.value} XP`);
      if (rule.kind === 'level' && level < rule.value) missing.push(`Need level ${rule.value}`);
      if (rule.kind === 'friendship' && friendship < rule.value) missing.push(`Need friendship ${rule.value}`);
      if (rule.kind === 'item') {
        const count = Object.hasOwn(items, rule.value) && upperBound(items[rule.value], 100_000) ? items[rule.value] : 0;
        if (count < 1) missing.push(`Need ${rule.value}`);
        else consumes.push(Object.freeze({ itemId: rule.value, count: 1 }));
      }
      if (rule.kind === 'trade' && context.trustedTrade !== true) missing.push('Requires trusted trade');
      if (rule.kind === 'time' && context.timeOfDay !== rule.value) missing.push(`Requires ${rule.value}`);
    }
    return Object.freeze({ from: formId, to: edge.to, targetName: catalog.forms[edge.to].name,
      ready: missing.length === 0, missing: Object.freeze(missing), consumes: Object.freeze(consumes) });
  });
}

/** Pure transaction plan. NEVER persist directly from the client; co-op must revalidate on server. */
export function planEvolution(catalog, familyId, formId, targetId, context) {
  const candidate = availableEvolutions(catalog, familyId, formId, context).find(c => c.to === targetId);
  if (!candidate) return Object.freeze({ ok: false, reason: 'Unknown evolution' });
  if (!candidate.ready) return Object.freeze({ ok: false, reason: candidate.missing.join('; ') });
  return Object.freeze({ ok: true, familyId, from: formId, to: targetId, consumes: candidate.consumes });
}

/** Read-only translation of existing five-species saves; no schema change, no ownership grant. */
export function legacyEvolutionPreview(rawCollection) {
  return SPECIES_IDS.map(species => {
    const entry = rawCollection?.creatures?.[species];
    const xp = Number.isFinite(entry?.xp) ? Math.max(0, Math.min(250_000, Math.floor(entry.xp))) : 0;
    const stage = evolutionStage(xp);
    return Object.freeze({ species, owned: entry?.owned === true, xp,
      formId: stage === 0 ? species : `${species}-${stage + 1}` });
  });
}

const legacy = SPECIES_IDS.map(id => ({
  id, name: CREATURES[id].name, archive: true,
  forms: CREATURES[id].forms.map((name, i) => ({ id: i === 0 ? id : `${id}-${i + 1}`, name })),
  evolutions: [
    { from: id, to: `${id}-2`, all: [{ kind: 'xp', value: 120 }] },
    { from: `${id}-2`, to: `${id}-3`, all: [{ kind: 'xp', value: 400 }] },
  ],
}));

/** New ORIGINAL example only; demonstrates branches, friendship, time, items and trade. No asset or combat registration. */
export const EVOLUTION_DEMO_CATALOG = createEvolutionCatalog([...legacy, {
  id: 'glimmerpaw', name: 'Glimmerpaw (example)',
  forms: [
    { id: 'glimmerpaw', name: 'Glimmerpaw' }, { id: 'sunmane', name: 'Sunmane' },
    { id: 'moonpelt', name: 'Moonpelt' }, { id: 'starcrest', name: 'Starcrest' },
  ],
  evolutions: [
    { from: 'glimmerpaw', to: 'sunmane', all: [{ kind: 'level', value: 5 }, { kind: 'time', value: 'day' }] },
    { from: 'glimmerpaw', to: 'moonpelt', all: [{ kind: 'level', value: 5 }, { kind: 'item', value: 'moon_shard' }] },
    { from: 'sunmane', to: 'starcrest', all: [{ kind: 'friendship', value: 80 }, { kind: 'trade', value: true }] },
  ],
}]);
