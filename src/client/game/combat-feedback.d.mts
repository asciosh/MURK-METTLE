export function springStep(
  position: number,
  velocity: number,
  target: number,
  dt: number,
  frequency?: number,
): { position: number; velocity: number };
export function impactBudget(quality: string): number;
export const SOUND_CUES: Readonly<
  Record<
    'pistol' | 'rifle' | 'reload' | 'ready' | 'hit' | 'melee' | 'hurt' | 'heal',
    { frequency: number; end: number; duration: number; noise: number; gain: number }
  >
>;
