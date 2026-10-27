// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Network ban (SPEC §8): Readback makes zero network requests. The allow-list is
 * empty, so any of these APIs anywhere in src/ fails lint.
 */
const networkGlobals = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].map((name) => ({
  name,
  message: 'Readback makes zero network requests (SPEC §8). The allow-list is empty.',
}));
const networkProperties = [
  ...['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'].flatMap((property) =>
    ['window', 'globalThis', 'self'].map((object) => ({
      object,
      property,
      message: 'Readback makes zero network requests (SPEC §8).',
    })),
  ),
  { object: 'navigator', property: 'sendBeacon', message: 'No telemetry (SPEC §8).' },
];

export default tseslint.config(
  {
    ignores: [
      '.output/**',
      '.wxt/**',
      'node_modules/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      // Generated fixture data and its generator script (see tests/fixtures/gmail/README.md).
      'tests/fixtures/gmail/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'error',
    },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-globals': ['error', ...networkGlobals],
      'no-restricted-properties': ['error', ...networkProperties],
    },
  },
  {
    // Dependency rule (ADR-0001): the engine depends only on chrono-node.
    files: ['src/engine/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.{1,2}/|chrono-node$)',
              message: 'src/engine is pure: only relative imports and chrono-node are allowed.',
            },
            {
              regex: '(^|/)(adapters|storage|state|messaging|entrypoints|styles|platform)(/|$)',
              message: 'src/engine must not import app code (reverse import).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['tests/**/*.ts', 'e2e/**/*.ts', '*.config.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // Tests drive deprecated-but-real browser APIs on purpose (document.write to load a
    // fixture, execCommand fakes), pass unbound mocks, and use terse void arrows. The
    // strict set stays on for everything under src/.
    files: ['tests/**/*.ts', 'e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-deprecated': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-meaningless-void-operator': 'off',
      '@typescript-eslint/no-unnecessary-type-parameters': 'off',
      '@typescript-eslint/no-unnecessary-type-conversion': 'off',
    },
  },
  prettier,
);
