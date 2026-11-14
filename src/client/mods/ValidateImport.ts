import { LIMITS, type ValidatedMod } from './format.mjs';
/** Untrusted ZIP/GLB/image validation runs in a disposable static worker with a wall-time limit. */
let validationQueue: Promise<unknown> = Promise.resolve();
export function validateImport(blob: Blob): Promise<ValidatedMod> {
  const result = validationQueue.then(() => validateBlob(blob));
  validationQueue = result.catch(() => {});
  return result;
}
async function validateBlob(blob: Blob): Promise<ValidatedMod> {
  if (blob.size > LIMITS.archive) throw Error('Package exceeds the 8 MiB import limit.');
  const bytes = await blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./validate.worker.ts', import.meta.url), { type: 'module' });
    const finish = () => {
      clearTimeout(timer);
      worker.terminate();
    };
    const timer = setTimeout(() => {
      finish();
      reject(Error('Package validation timed out. Reduce asset complexity.'));
    }, 15000);
    worker.onmessage = (event) => {
      finish();
      if (event.data.ok) resolve(event.data.mod as ValidatedMod);
      else reject(Error(event.data.error));
    };
    worker.onerror = () => {
      finish();
      reject(
        Error('Package validation failed. This browser must support Web Workers and DecompressionStream.'),
      );
    };
    worker.postMessage(bytes, [bytes]);
  });
}
