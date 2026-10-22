import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The app writes JSX in .js files; Vite 8 transforms with Oxc.
  oxc: {
    include: /\.(js|jsx)$/,
    exclude: /node_modules/,
    lang: 'jsx',
    jsx: { runtime: 'automatic' },
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    include: ['**/*.test.js'],
    exclude: ['node_modules/**', '.next/**', 'out/**', 'android/**'],
    setupFiles: ['./vitest.setup.js'],
  },
});
