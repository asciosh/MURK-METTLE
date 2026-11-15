import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// Run JS entrypoints directly: Windows cannot spawn .cmd files without a shell.
// All local gameplay uses the same authenticated Worker and protocol as deployment.
const require = createRequire(import.meta.url);
function runTool(name, args) {
  const file = require.resolve(`${name}/package.json`);
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  const entry = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin[name === 'typescript' ? 'tsc' : name];
  return spawn(process.execPath, [resolve(dirname(file), entry), ...args], { stdio: 'inherit' });
}
const typecheck = runTool('typescript', ['--noEmit']);
const wait = child => new Promise(resolve => {
  child.on('error', error => { console.error(error.message); resolve(false); });
  child.on('exit', code => resolve(code === 0));
});
if (!await wait(typecheck) || !await wait(runTool('vite', ['build']))) process.exit(1);
const processes = [
  runTool('vite', ['build', '--watch']),
  runTool('wrangler', ['dev', '--local', '--ip', '0.0.0.0', '--port', process.env.ROOM_PORT || '8787']),
];
let stopping = false;
const shutdown = () => {
  if (stopping) return;
  stopping = true;
  for (const child of processes) child.kill('SIGTERM');
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
for (const child of processes) {
  child.on('error', error => { console.error(error.message); process.exitCode = 1; shutdown(); });
  child.on('exit', code => { if (!stopping) { process.exitCode = code || 0; shutdown(); } });
}
