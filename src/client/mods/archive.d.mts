import type { ValidatedMod } from './format.mjs';
export function validatePackage(buffer: ArrayBuffer): Promise<ValidatedMod>;
export function readArchive(buffer: ArrayBuffer): Promise<Map<string, Uint8Array<ArrayBuffer>>>;
