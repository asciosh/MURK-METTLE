import './styles.css';
import { Game } from './game/Game';

const viewport = document.querySelector<HTMLElement>('#game-viewport');

if (!viewport) {
  throw new Error('Game viewport not found. Check index.html for #game-viewport.');
}

// Build stable HUD columns without changing the existing component IDs or handlers.
// Keeping the panels inside the viewport also avoids fighting the WebGL canvas layout.
function arrangeHud(root: HTMLElement): void {
  const left = document.createElement('aside');
  left.className = 'hud-stack hud-stack-left';
  left.setAttribute('aria-label', 'Survivor and companion information');
  const right = document.createElement('aside');
  right.className = 'hud-stack hud-stack-right';
  right.setAttribute('aria-label', 'Expedition and enemy information');
  for (const selector of ['.player-status', '.progress-panel', '.creature-panel']) {
    const panel = root.querySelector(selector);
    if (panel) left.appendChild(panel);
  }
  for (const selector of ['.mission-panel', '.enemy-panel']) {
    const panel = root.querySelector(selector);
    if (panel) right.appendChild(panel);
  }
  root.append(left, right);
}
arrangeHud(viewport);

const game = new Game(viewport);
game.start();

window.addEventListener('beforeunload', () => {
  game.dispose();
});
