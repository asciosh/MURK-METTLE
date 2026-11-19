/// <reference lib="webworker" />
import { validateSpritePack } from './sprite-pack.mjs';
self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try {
    const pack = await validateSpritePack(event.data);
    self.postMessage({ ok: true, pack }, { transfer: [...pack.files.values()].map(bytes => bytes.buffer) });
  } catch (error) {
    self.postMessage({ ok: false, error: error instanceof Error ? error.message.slice(0, 200) : 'Invalid sprite pack' });
  }
};
