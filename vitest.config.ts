import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: true,
    environment: 'node',
    // Several suites spawn external processes (npx openspec, npm pack);
    // the 5s default flakes under parallel load and on slower CI runners.
    testTimeout: 30000,
  },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov'],
    exclude: ['tests/**', 'dist/**'],
    thresholds: {
      branches: 80,
      functions: 90,
      lines: 85,
      statements: 85,
    },
  },
});
