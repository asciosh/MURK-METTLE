/** NEXTGEN presentation settings are device-local; they never modify cloud saves. */
export const QUALITY_STORAGE_KEY = 'mm-nextgen-quality-v1';
export type NextgenQuality = 'low' | 'balanced' | 'cinematic';
export const QUALITY_OPTIONS: readonly { id: NextgenQuality; label: string; description: string }[] = [
  { id: 'low', label: 'Performance', description: 'Lower foliage density and simpler lighting' },
  { id: 'balanced', label: 'Balanced', description: 'Recommended: shadows and good image quality' },
  { id: 'cinematic', label: 'Cinematic', description: 'Higher quality lighting and bloom' },
];
export function nextgenQuality(value: unknown): NextgenQuality {
  if (value === 'low' || value === 'balanced' || value === 'cinematic') return value;
  return 'balanced';
}
export function savedNextgenQuality(store: Pick<Storage, 'getItem'> | null): NextgenQuality {
  try { return nextgenQuality(store?.getItem(QUALITY_STORAGE_KEY)); }
  catch { return 'balanced'; }
}
export function saveNextgenQuality(store: Pick<Storage, 'setItem'> | null, value: unknown): NextgenQuality {
  const quality = nextgenQuality(value);
  try { store?.setItem(QUALITY_STORAGE_KEY, quality); } catch { /* Private mode/storage denial is not fatal. */ }
  return quality;
}
/** Only this list is rendered as the control legend; avoid describing unsupported co-op actions. */
export const NEXTGEN_CONTROLS = {
  shared: [
    ['W A S D', 'Move'], ['Shift', 'Sprint'], ['Mouse', 'Look / turn'],
    ['Right mouse', 'Aim'], ['Left mouse', 'Fire while aiming'],
    ['R', 'Reload'], ['F', 'Melee'], ['H', 'Bandage'],
    ['Q', 'Weapon resonance'], ['E', 'Interact'], ['I', 'Inventory'],
    ['Esc', 'Release mouse / game menu'],
  ],
  solo: [
    ['Ctrl', 'Dodge'], ['Space', 'Jump'], ['1 / 2', 'Pistol / owned primary'],
    ['C', 'Companion engage / recall'], ['X', 'Lumen Pulse'],
    ['G (inventory)', 'Drop selected equipment'],
  ],
  coop: [
    ['Ctrl', 'Server-validated dodge'], ['Space', 'Server-validated jump'],
    ['1 / 2 / 3', 'Pistol / Rifle / Shotgun'],
    ['C', 'Cycle bonded creatures'], ['G', 'Companion strike'],
    ['X', 'Creature Pulse'], ['V', 'Revive nearby teammate'],
    ['Enter', 'Respawn when down'],
  ],
} as const;
