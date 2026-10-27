// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Network ban (SPEC §8): Readback makes zero network requests. The allow-list is
 * empty, so any of these APIs anywhere in src/ or site/src/ fails lint. (The built site also
 * enforces it at runtime with `connect-src 'none'`; lint catches it before it is built.)
 */
const networkApis = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'WebTransport',
  'RTCPeerConnection',
  'importScripts',
  // Workers can fetch on their own, and a new one is a new place for a request to hide.
  'Worker',
  'SharedWorker',
];
const networkGlobals = networkApis.map((name) => ({
  name,
  message: 'Readback makes zero network requests (SPEC §8). The allow-list is empty.',
}));
// `new Image().src = url` is a request too.
const networkSyntax = [
  {
    selector: "NewExpression[callee.name='Image']",
    message: 'Readback makes zero network requests (SPEC §8): no new Image().',
  },
];
const networkProperties = [
  ...networkApis.flatMap((property) =>
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
      '.gallery/**',
      'site/dist/**',
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
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-restricted-globals': ['error', ...networkGlobals],
      'no-restricted-properties': ['error', ...networkProperties],
      'no-restricted-syntax': ['error', ...networkSyntax],
    },
  },
  {
    // The static site gets the same network ban (its service worker is generated text, not source).
    files: ['site/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': ['error', ...networkGlobals],
      'no-restricted-properties': ['error', ...networkProperties],
      'no-restricted-syntax': ['error', ...networkSyntax],
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
