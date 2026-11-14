import './styles.css';
import { initInterface } from './client/ui/Interface';
import { Game } from './client/game/Game';
import { initAccount } from './client/game/Account';
import { arrangeHud } from './client/ui/HudLayout';

const viewport = document.querySelector<HTMLElement>('#game-viewport');

if (!viewport) {
  throw new Error('Game viewport not found. Check index.html for #game-viewport.');
}

arrangeHud(viewport);
initInterface();

// Compact menu keeps co-op and account controls out of the gameplay status strip.
const menuToggle = document.querySelector<HTMLButtonElement>('#field-menu-toggle');
const fieldMenu = document.querySelector<HTMLElement>('#field-menu');
menuToggle?.addEventListener('click', () => {
  if (!fieldMenu) return;
  if (fieldMenu.hidden) {
    if (document.querySelector('#inventory-panel.visible')) document.querySelector<HTMLButtonElement>('#inventory-close')?.click();
    if (document.querySelector('#touch-journal-sheet:not([hidden])')) document.querySelector<HTMLButtonElement>('#touch-journal-close')?.click();
  }
  fieldMenu.hidden = !fieldMenu.hidden;
  menuToggle.setAttribute('aria-expanded', String(!fieldMenu.hidden));
});

// Escape closes the menu; clicks outside it do not leave an invisible overlay open.
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !fieldMenu || fieldMenu.hidden) return;
  fieldMenu.hidden = true;
  menuToggle?.setAttribute('aria-expanded', 'false');
  menuToggle?.focus();
});
document.addEventListener('pointerdown', event => {
  if (!fieldMenu || fieldMenu.hidden) return;
  if (event.target instanceof Node &&
    (fieldMenu.contains(event.target) || menuToggle?.contains(event.target))) return;
  fieldMenu.hidden = true;
  menuToggle?.setAttribute('aria-expanded', 'false');
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
