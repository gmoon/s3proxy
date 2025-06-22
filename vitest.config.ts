import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Exclude integration tests from unit test runs
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/test/integration/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json'],
      include: [
        'src/**/*.ts'
      ],
      exclude: [
        'dist/',
        'examples/',
        'test/',
        'coverage/',
        'shared-testing/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/*.js',
        'node_modules/',
        'src/index.cjs'
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    testTimeout: 30000,
    hookTimeout: 30000
  },
  esbuild: {
    target: 'node18'
  }
});
