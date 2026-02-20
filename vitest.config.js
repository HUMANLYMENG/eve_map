import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: ['tests/**', '**/*.config.js']
    },
    setupFiles: ['./tests/setup.js']
  }
});
