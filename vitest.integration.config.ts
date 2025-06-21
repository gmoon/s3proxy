import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Only include integration tests
    include: [
      'test/integration/**/*.{test,spec}.{js,ts}'
    ],
    testTimeout: 30000,
    hookTimeout: 30000
  },
  esbuild: {
    target: 'node18'
  }
});
