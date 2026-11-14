import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: { groups: [{ name: 'three-core', test: /node_modules\/three\/(?:build|src)\// }] },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    proxy: {
      '/room': { target: 'ws://127.0.0.1:8787', ws: true },
      '/api/account': { target: 'http://127.0.0.1:8787' },
    },
  },
});
