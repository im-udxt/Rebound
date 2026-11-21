import { defineConfig } from 'vitest/config';

// GitHub Pages serves the site from /<repo-name>/. The deploy workflow sets
// BASE_PATH; locally and for itch.io we use a relative base so dist/ works anywhere.
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: { phaser: ['phaser'], tone: ['tone'] },
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
