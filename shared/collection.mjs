import { SPECIES_IDS, CREATURES, creaturePower, evolutionStage } from './expansion.mjs';
export const emptyCollection = () => ({
  active: 'lanternkin',
  creatures: Object.fromEntries(SPECIES_IDS.map((id) => [id, { owned: false, xp: 0 }])),
});
// Add missing species on read; never grant ownership or discard existing XP during an upgrade.
export function normalizeCollection(raw, legacy = {}) {
  const result = emptyCollection();
  result.creatures.lanternkin = { owned: legacy?.owned === true, xp: cleanXP(legacy?.xp) };
  for (const id of SPECIES_IDS) {
    const e = raw?.creatures?.[id];
    if (e) result.creatures[id] = { owned: e.owned === true, xp: cleanXP(e.xp) };
  }
  if (SPECIES_IDS.includes(raw?.active) && result.creatures[raw.active].owned) result.active = raw.active;
  return result;
}
const cleanXP = (value) => (Number.isFinite(value) ? Math.max(0, Math.min(250000, Math.floor(value))) : 0);
export function evolutionProgress(xp) {
  const stage = evolutionStage(xp),
    start = [0, 120, 400][stage],
    next = stage === 2 ? null : stage === 0 ? 120 : 400;
  return {
    stage,
    next,
    remaining: next === null ? 0 : Math.max(0, next - xp),
    fraction: next === null ? 1 : Math.max(0, Math.min(1, (xp - start) / (next - start))),
  };
}
export function journalEntry(id, xp) {
  const def = CREATURES[id],
    power = creaturePower(id, xp);
  return {
    ...evolutionProgress(xp),
    power,
    forms: def.forms.map((name, i) => ({ name, threshold: [0, 120, 400][i], unlocked: i <= power.stage })),
  };
}
