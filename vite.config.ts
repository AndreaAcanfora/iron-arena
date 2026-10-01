import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base: works both on localhost and under a sub-path (GitHub Pages).
  base: './',
  server: { port: 5173 },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
