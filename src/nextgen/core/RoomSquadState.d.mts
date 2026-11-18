export type SquadActor = { id: string; hp: number; x: number; z: number; nextgen?: { downedMs?: number; revivingTarget?: string | null; reviveBy?: string | null; reviveProgress?: number } };
export type SquadView = { id: string; label: string; hp: number; x: number; z: number; downed: boolean; downedSeconds: number; eliminated: boolean; reviving: boolean; receivingRevive: boolean; reviveProgress: number };
export function squadRoster(self: SquadActor | null, peers: readonly SquadActor[]): SquadView[];
export function objectiveDisplay(mission: { kills: number; salvage: number; ready: boolean; phase: string } | null, killGoal: number, sampleGoal: number): { kills: number; samples: number; ready: boolean; label: string };
