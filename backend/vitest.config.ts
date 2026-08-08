import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Each suite boots its own in-memory PostgreSQL, so suites are isolated
    // but a single suite's cases run in order.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
    env: { NODE_ENV: 'test' },
  },
});
