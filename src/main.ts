import './styles.css';
import { Game } from './game/Game';
import { initAccount } from './game/Account';

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

// Compact menu keeps co-op and account controls out of the gameplay status strip.
const menuToggle = document.querySelector<HTMLButtonElement>('#field-menu-toggle');
const fieldMenu = document.querySelector<HTMLElement>('#field-menu');
menuToggle?.addEventListener('click', () => {
  if (!fieldMenu) return;
  fieldMenu.hidden = !fieldMenu.hidden;
  menuToggle.setAttribute('aria-expanded', String(!fieldMenu.hidden));
});

let game: Game | null = null;
void initAccount(() => {
  if (game) return;
  game = new Game(viewport);
  game.start();
});

const enterButton = document.querySelector<HTMLButtonElement>('#enter-field');
const titleScreen = document.querySelector<HTMLElement>('#title-screen');
enterButton?.addEventListener('click', () => {
  if (!game) return;
  game.enterField();
  titleScreen?.classList.add('is-hidden');
  titleScreen?.setAttribute('aria-hidden', 'true');
  // The lock request must happen synchronously from the user gesture.
  game.requestMouseCapture();
});

window.addEventListener('beforeunload', () => {
  game?.dispose();
});
