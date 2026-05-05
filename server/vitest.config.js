import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    // Tests hit a shared remote DB; run them in-band so they don't race each other.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
