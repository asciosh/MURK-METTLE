import { spawn } from 'node:child_process';
const processes = [
  spawn(process.execPath, ['server/index.mjs'], { stdio: 'inherit' }),
  spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev:client'], { stdio: 'inherit' }),
];
const shutdown = () => { for (const child of processes) child.kill('SIGTERM'); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
for (const child of processes) child.on('exit', (code) => { if (code && code !== 0) { process.exitCode = code; shutdown(); } });
