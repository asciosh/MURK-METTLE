import type { ValidatedMod } from './format.mjs';
export function validatePackage(buffer: ArrayBuffer): Promise<ValidatedMod>;
export function readArchive(buffer: ArrayBuffer, limits?: Readonly<{ archive: number; extracted: number; files: number; model: number }>): Promise<Map<string, Uint8Array<ArrayBuffer>>>;
