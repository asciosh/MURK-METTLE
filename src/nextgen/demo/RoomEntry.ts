import { SimpleDemo } from './SimpleDemo';

export async function mountRoom(code: string) {
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
