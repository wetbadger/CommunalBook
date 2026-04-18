import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['frontend/tests/**/*.test.js', 'frontend/src/**/*.test.js'],
    setupFiles: ['./tests/frontend-setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['frontend/src/**/*.js', 'frontend/src/**/*.vue'],
      exclude: [
        'frontend/node_modules/',
        'frontend/tests/',
        '**/*.config.js',
      ]
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './frontend/src'),
    }
  }
});