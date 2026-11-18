export const SURVIVOR_SKINS = ['ranger', 'medic', 'scavenger', 'sentinel'] as const;
export const INFECTED_SKINS = ['withered', 'ashen', 'ravager', 'feral'] as const;
export type SurvivorSkin = 'classic' | typeof SURVIVOR_SKINS[number];
export type InfectedSkin = 'classic' | typeof INFECTED_SKINS[number];
export type InfectedSelection = InfectedSkin | 'mixed';

export function selectSurvivorSkin(value: string | null): SurvivorSkin {
  return SURVIVOR_SKINS.find(name => name === value) ?? 'classic';
}
export function selectInfectedSkin(value: string | null): InfectedSelection {
  if (value === 'mixed') return value;
  return INFECTED_SKINS.find(name => name === value) ?? 'classic';
}
export function infectedSkinForSpawn(selection: InfectedSelection, wave: number, index: number): InfectedSkin {
  if (selection !== 'mixed') return selection;
  const offset = Math.max(0, Math.trunc(wave || 1) - 1) + Math.max(0, Math.trunc(index || 0));
  return INFECTED_SKINS[offset % INFECTED_SKINS.length] ?? 'withered';
}
export function characterSkinFile(kind: 'survivor' | 'infected', skin: SurvivorSkin | InfectedSkin): string {
  return skin === 'classic' ? kind + '.glb' : 'variants/' + kind + '-' + skin + '.glb';
}
