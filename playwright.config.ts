import { defineConfig } from '@playwright/test';

/**
 * e2e runs the built extension (`pnpm build` first; `pnpm test:e2e` does it).
 * Chromium with an extension needs a persistent context, set up in
 * e2e/fixtures.ts, and runs headless through the `chromium` channel.
 * Gmail is never contacted: mail.google.com is fulfilled from
 * tests/fixtures/gmail by request interception.
 */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [['list']],
  use: { trace: 'retain-on-failure' },
});
