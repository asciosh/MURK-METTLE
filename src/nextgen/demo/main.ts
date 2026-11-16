import { SimpleDemo } from './SimpleDemo';

const demo = new SimpleDemo();
void demo.mount().then(() => {
  Object.assign(window, {
    __m01Demo: demo,
    __m01DemoLoaded: true,
  });
}).catch((err) => {
  console.error('nextgen demo failed to mount', err);
  const status = document.createElement('div');
  status.style.cssText =
    'position:fixed;top:10px;left:10px;color:#a33;background:#ffeef0;padding:10px;font-family:sans-serif;border:1px solid #a33;z-index:1000;';
  status.textContent = 'Nextgen demo failed to mount. See console for details.';
  document.body.appendChild(status);
});
