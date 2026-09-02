import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'contracts/**/*.test.ts',
      'lib/**/*.test.ts',
      'services/**/test/**/*.test.ts',
      'scripts/**/*.test.ts',
      'evals/**/*.eval.ts',
    ],
    globals: false,
    coverage: {
      provider: 'v8',
      include: ['services/crypto/src/**/*.ts'],
      thresholds: {
        branches: 100,
        functions: 100,
        lines: 100,
        statements: 100,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
});
