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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
});
