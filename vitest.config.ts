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
          branches: 85,     // Increased from 75% to 85% (current: 86.88%)
          functions: 95,    // Increased from 80% to 95% (current: 95.83%)
          lines: 90,        // Increased from 80% to 90% (current: 93.12%)
          statements: 90    // Increased from 80% to 90% (current: 93.12%)
        }
      },
      // Ensure thresholds are enforced
      reportOnFailure: false
    },
    testTimeout: 30000,
    hookTimeout: 30000
  },
  esbuild: {
    target: 'node18'
  }
});
