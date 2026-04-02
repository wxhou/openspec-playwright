import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
    environment: 'node',
  },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov'],
    exclude: ['tests/**', 'dist/**'],
  },
});
