import { defineConfig } from '@playwright/test';

/**
 * e2e runs against the production build served by `vite preview` (`pnpm build` first).
 *
 * Two projects: `desktop` (1440 x 900) and `phone` (375 x 812, touch, mobile emulation).
 * The web-app flows, the PWA checks and the accessibility checks run on both. The older
 * specs (`app.spec.ts`, `landing.spec.ts`) open their own viewports, so they run once.
 */
const shared = {
  baseURL: 'http://localhost:4173',
  channel: 'chromium',
  trace: 'retain-on-failure',
} as const;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [['list']],
  use: shared,
  projects: [
    {
      name: 'desktop',
      use: { ...shared, viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'phone',
      testMatch: /(flows|pwa|a11y)\.spec\.ts/,
      use: {
        ...shared,
        viewport: { width: 375, height: 812 },
        hasTouch: true,
        isMobile: true,
        deviceScaleFactor: 3,
      },
    },
  ],
  webServer: {
    command: 'pnpm preview',
    url: 'http://localhost:4173/app/',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
