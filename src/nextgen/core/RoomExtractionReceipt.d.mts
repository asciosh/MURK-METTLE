export type ExtractionReceipt = { expedition: number; status: 'pending'|'confirmed'|'failed'|'ineligible'; earnedXp: number|null; totalXp: number|null; totalExpeditions: number|null };
export function extractionStarted(expedition: number, eligible?: boolean): ExtractionReceipt|null;
export function extractionConfirmed(current: ExtractionReceipt|null, event: { xp: number; completed: number; totals: { xp: number } }): ExtractionReceipt|null;
export function extractionFailed(current: ExtractionReceipt|null): ExtractionReceipt|null;
export function extractionMessage(receipt: ExtractionReceipt|null): string;
