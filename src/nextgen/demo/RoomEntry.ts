import { SimpleDemo } from './SimpleDemo';
import { mountLobby } from './NextgenEntry';

export async function mountRoom(code: string) {
  const response = await fetch('/api/account/me', {credentials:'same-origin',cache:'no-store'});
  if (!response.ok || !(await response.json()).username) { mountLobby(code); return; }
  const demo = new SimpleDemo(false, code);
  try {
    await demo.mount();
    Object.assign(window, { __nextgenRoom: demo });
    window.addEventListener('beforeunload', () => demo.dispose(), { once: true });
  } catch (error) {
    demo.dispose();
    throw error;
  }
}
