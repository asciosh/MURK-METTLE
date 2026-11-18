/** Display-only extraction receipt. Only authoritative room events can create/confirm it. */
export function extractionStarted(expedition, eligible = true) {
  if (!Number.isSafeInteger(expedition) || expedition < 1) return null;
  return { expedition, status: eligible ? 'pending' : 'ineligible', earnedXp: null, totalXp: null, totalExpeditions: null };
}

export function extractionConfirmed(current, event) {
  if (!current || !['pending','ineligible'].includes(current.status) || !Number.isSafeInteger(event?.xp) || event.xp < 0 ||
      !Number.isSafeInteger(event?.completed) || event.completed < 0 ||
      !Number.isSafeInteger(event?.totals?.xp) || event.totals.xp < 0) return current;
  return { ...current, status: 'confirmed', earnedXp: event.xp, totalXp: event.totals.xp, totalExpeditions: event.completed };
}

export function extractionFailed(current) {
  return current?.status === 'pending' ? { ...current, status: 'failed' } : current;
}

export function extractionMessage(receipt) {
  if (!receipt) return '';
  if (receipt.status === 'confirmed')
    return `ACCOUNT REWARD VERIFIED · +${receipt.earnedXp} XP · Total ${receipt.totalXp} XP · ${receipt.totalExpeditions} extractions`;
  if (receipt.status === 'failed') return 'REWARD NOT CONFIRMED · Do not retry extraction blindly. Check account stats and report the failed reward.';
  if (receipt.status === 'ineligible') return 'TEAM EXTRACTED · You were not among the living participants, so no personal reward was issued.';
  return 'MISSION CLEARED · Waiting for your account reward confirmation…';
}
