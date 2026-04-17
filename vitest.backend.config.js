import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['backend/tests/**/*.test.js'],
    setupFiles: ['./tests/backend-setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['backend/**/*.js'],
      exclude: [
        'backend/node_modules/',
        'backend/tests/',
        '**/*.config.js',
      ]
    },
    deps: {
      interopDefault: true,
      inline: ['mongoose']
    },
    server: {
      deps: {
        external: ['mongoose']
      }
    }
  },
  resolve: {
    alias: {
      'mongoose': './tests/mocks/mongoose.js'
    }
  }
});