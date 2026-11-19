export const NEXTGEN_ROSTER_KEY: 'nextgen-creature-roster-v1';
export const NATIVE_CAPTURE: Readonly<{ id: 'wild-lanternkin'; x: number; z: number; range: number; familyId: 'lanternkin'; duration:number; movementTolerance:number }>;
export interface CreatureInstance {
  id: string; familyId: string; formId: string; xp: number;
  origin: 'legacy' | 'native'; status: 'available' | 'lost';
}
export interface CreatureRoster { version: 1; instances: CreatureInstance[]; activeId: string | null; }
export interface NativeTrainingProgress {
  xp: number; level: number; levelStartXP: number; nextLevelXP: number | null; formId: string;
  nextXP: number | null; nextFormId: string | null; nextFormName: string | null; evolutionReady: boolean;
}
export function nativeTrainingProgress(record: CreatureInstance): NativeTrainingProgress;
export function nativeFormXP(record: CreatureInstance): number;
export interface CreatureRosterView { version: 1; activeId: string | null; instances: (CreatureInstance & {
  level: number; name: string; familyName: string; nextXP: number | null; nextFormId: string | null; training?: NativeTrainingProgress;
})[]; }
export function reconcileRoster(previous: CreatureRoster | undefined, legacyCollection: unknown,
  newId?: () => string): CreatureRoster;
export function rosterView(roster: CreatureRoster): CreatureRosterView;
