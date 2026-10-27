import { defineConfig } from '@playwright/test';

/** e2e runs against the production build served by `vite preview` (`pnpm build` first). */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', channel: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm preview',
    url: 'http://localhost:4173/app/',
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
