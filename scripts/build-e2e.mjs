// Builds the extension for Playwright: the overlay's shadow root is open (--mode e2e), but React
// and everything else stay on their production builds, so timing budgets measure the product.
// Output goes to .output/chrome-mv3-e2e; `pnpm build` owns .output/chrome-mv3.
import { spawnSync } from 'node:child_process';

const result = spawnSync('pnpm', ['exec', 'wxt', 'build', '--mode', 'e2e'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NODE_ENV: 'production', RB_E2E: '1' },
});
process.exit(result.status ?? 1);
