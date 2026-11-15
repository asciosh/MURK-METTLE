import { spawn } from 'node:child_process';

// Tests use a local source/Worker/launcher server; none authenticate with production.
const suites = process.argv.slice(2);
for (const suite of suites) {
  if (!['interface', 'characters', 'combat', 'world', 'mods', 'performance-safety', 'loading', 'mods-production', 'desktop-launcher', 'worker'].includes(suite))
    throw new Error(`Unknown browser suite: ${suite}`);
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [`tests/browser/${suite}.cjs`], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', resolve);
  });
  if (code !== 0) process.exit(code || 1);
}
