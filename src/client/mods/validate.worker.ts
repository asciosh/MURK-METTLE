/// <reference lib="webworker" />
import { validatePackage } from './archive.mjs';
self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const mod = await validatePackage(event.data);
    self.postMessage({ ok: true, mod }, { transfer: [...mod.files.values()].map((bytes) => bytes.buffer) });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message.slice(0, 200) : 'Invalid cosmetic package',
    });
  }
};
