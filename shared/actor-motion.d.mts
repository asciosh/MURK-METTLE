export function solveLeg(
  y: number,
  z: number,
  upper?: number,
  lower?: number,
): { hip: number; knee: number; foot: number };
export function footCycle(phase: number, sprint?: number): { z: number; lift: number; stance: boolean };
