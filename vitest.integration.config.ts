import { defineConfig } from 'vitest/config';
import { sharedTestConfig } from './vitest.shared.js';

export default defineConfig({
  test: {
    ...sharedTestConfig,
    include: ['test/integration/**/*.{test,spec}.{js,ts}'],
  },
});
