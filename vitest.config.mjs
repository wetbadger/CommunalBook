// vitest.config.mjs
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    include: [
      'backend/tests/**/*.test.js',
      'frontend/tests/**/*.test.js',
      'frontend/src/**/*.test.js'
    ],
    // Map frontend tests to jsdom environment
    environmentMatchFiles: [
      ['frontend/tests/**/*.test.js', 'jsdom'],
      ['frontend/src/**/*.test.js', 'jsdom'],
      ['backend/tests/**/*.test.js', 'node']
    ],
    environmentOptions: {
      jsdom: {
        url: 'http://localhost:5173'
      }
    },
    // Use a single setup file (removed the duplicate)
    setupFiles: ['./tests/root-setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.js',
        '**/*.config.mjs'
      ]
    }
  }
});