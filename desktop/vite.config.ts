import { defineConfig } from 'vite';
export default defineConfig({
  root: 'ui',
  clearScreen: false,
  build: { outDir: '../dist', emptyOutDir: true },
});
