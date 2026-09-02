import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const sodiumMessage =
  'libsodium may only be imported from services/crypto. See docs/implementation/01-repo-structure.md.';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'libsodium-wrappers-sumo',
              message: sodiumMessage,
            },
            {
              name: 'libsodium-wrappers',
              message: sodiumMessage,
            },
          ],
          patterns: [
            {
              group: ['@/services/*/src/*', '@/services/*/src'],
              message: 'Import through the service index or via contracts/.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['services/crypto/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/services/*/src/*', '@/services/*/src'],
              message: 'Import through the service index or via contracts/.',
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
    'docs/**',
  ]),
]);

export default eslintConfig;
