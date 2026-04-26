import type { UserConfig } from 'vitest/config';

export const sharedTestConfig: UserConfig['test'] = {
  globals: true,
  environment: 'node',
  testTimeout: 30000,
  hookTimeout: 30000,
};

export const sharedEsbuildConfig: UserConfig['esbuild'] = {
  target: 'node18',
};
