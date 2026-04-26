import { defineConfig } from 'vitest/config';
import { sharedTestConfig } from './vitest.shared.js';

export default defineConfig({
  test: {
    ...sharedTestConfig,
    exclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/test/integration/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['**/*.d.ts'],
      thresholds: {
        branches: 85,
        functions: 95,
        lines: 90,
        statements: 90,
      },
    },
    pool: 'forks',
    forks: {
      execArgv: ['--expose-gc'],
    },
  },
});
