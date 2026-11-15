const { chromium } = require('playwright');
const { existsSync } = require('node:fs');

// Prefer an explicit local executable, otherwise Playwright's installed Chromium.
// Linux managed environments may already provide Chromium at this path.
exports.launchBrowser = () => chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
  headless: true,
  args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
