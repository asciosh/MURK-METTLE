import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    host: '0.0.0.0', port: 5173, strictPort: true,
    proxy: { '/room': { target: 'ws://127.0.0.1:8787', ws: true } },
  },
});
