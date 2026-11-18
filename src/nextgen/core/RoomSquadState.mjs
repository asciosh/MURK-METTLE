/** Pure squad-facing presentation. Display aliases are session labels, not account names. */
export function squadRoster(self, peers) {
  if (!self) return [];
  return [self, ...peers].map((player, index) => {
    const hp = Math.max(0, Math.min(100, Number.isFinite(player.hp) ? player.hp : 0));
    const downedMs = hp <= 0 ? Math.max(0, Number(player.nextgen?.downedMs) || 0) : 0;
    const downed = hp <= 0 && downedMs > 0;
    return {
      id: player.id,
      label: index === 0 ? 'YOU' : `ALLY ${index}`,
      hp,
      x: player.x,
      z: player.z,
      downed,
      downedSeconds: Math.ceil(downedMs / 1000),
      eliminated: hp <= 0 && !downed,
      reviving: !!player.nextgen?.revivingTarget,
      receivingRevive: !!player.nextgen?.reviveBy,
      reviveProgress: Math.max(0, Math.min(1, Number(player.nextgen?.reviveProgress) || 0))
    };
  });
}

/** Objective counters are display-only; room mission packets remain authoritative. */
export function objectiveDisplay(mission, killGoal, sampleGoal) {
  const kills = Math.max(0, Math.min(killGoal, Number(mission?.kills) || 0));
  const samples = Math.max(0, Math.min(sampleGoal, Number(mission?.salvage) || 0));
  const ready = !!(mission?.ready && mission?.phase === 'active');
  return { kills, samples, ready,
    label: !mission ? 'SYNCING MISSION' : mission.phase !== 'active' ? 'EXTRACTION IN PROGRESS' : ready ? 'EXTRACTION READY · FIND THE GREEN ZONE' :
      `SECURE THE ZONE · ${kills}/${killGoal} KILLS · ${samples}/${sampleGoal} SAMPLES`
  };
}
