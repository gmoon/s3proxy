import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/test/integration/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.d.ts'],
      thresholds: {
        branches: 85,
        functions: 95,
        lines: 90,
        statements: 90
      }
    },
    testTimeout: 30000,
    hookTimeout: 30000
  },
  esbuild: {
    target: 'node18'
  }
});
