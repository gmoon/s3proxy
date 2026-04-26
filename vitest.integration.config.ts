import { defineConfig } from 'vitest/config';
import { sharedEsbuildConfig, sharedTestConfig } from './vitest.shared.js';

export default defineConfig({
  test: {
    ...sharedTestConfig,
    include: ['test/integration/**/*.{test,spec}.{js,ts}'],
  },
  esbuild: sharedEsbuildConfig,
});
