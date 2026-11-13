import './styles.css';
import { Game } from './game/Game';

const viewport = document.querySelector<HTMLElement>('#game-viewport');

if (!viewport) {
  throw new Error('Game viewport not found. Check index.html for #game-viewport.');
}

const game = new Game(viewport);
game.start();

window.addEventListener('beforeunload', () => {
  game.dispose();
});
