import { invoke } from '@tauri-apps/api/core';
import deployment from '../deployment.json';
import './style.css';
const button = document.querySelector<HTMLButtonElement>('#launch')!;
const status = document.querySelector<HTMLElement>('#status')!;
const details = document.querySelector<HTMLDetailsElement>('#launch-error')!;
const errorText = document.querySelector<HTMLElement>('#launch-error-text')!;
document.querySelector('#deployment')!.textContent = new URL(deployment.origin).origin;
button.addEventListener('click', async () => {
  button.disabled = true;
  details.hidden = true;
  status.textContent =
    'Opening the game window… If it cannot connect, use Game → Reload field after restoring your connection.';
  try {
    await invoke('start_game');
    status.textContent =
      'Game window opened. Use Game → Connection & help to return here. If it is blank, check your connection and reload the field.';
  } catch (error) {
    errorText.textContent = String(error);
    details.hidden = false;
    details.open = true;
    status.textContent =
      'The game window could not open. Check that Microsoft Edge WebView2 is installed, then try again.';
  } finally {
    button.disabled = false;
  }
});

// Static HTML stays disabled until the module and click handler are ready.
button.disabled = false;
