import { spawn } from 'node:child_process';

// The full client needs the authenticated Worker and the expansion room protocol.
// server/local/index.mjs remains a historical standalone WebSocket prototype.
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const bin = name => process.platform === 'win32' ? `${name}.cmd` : name;
const build = spawn(npm, ['run', 'build'], { stdio: 'inherit' });
const built = await new Promise(resolve => {
  build.on('error', error => { console.error(error.message); resolve(false); });
  build.on('exit', code => resolve(code === 0));
});
if (!built) process.exit(1);
const processes = [
  spawn(bin('vite'), ['build', '--watch'], { stdio: 'inherit' }),
  spawn(bin('wrangler'), ['dev', '--ip', '0.0.0.0', '--port', process.env.ROOM_PORT || '8787'], { stdio: 'inherit' }),
];
let stopping = false;
const shutdown = () => { if(stopping)return;stopping=true;for(const child of processes)child.kill('SIGTERM'); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
for (const child of processes) {
  child.on('error', error => { console.error(error.message); process.exitCode=1;shutdown(); });
  child.on('exit', code => { if(!stopping){process.exitCode=code || 0;shutdown();} });
}
