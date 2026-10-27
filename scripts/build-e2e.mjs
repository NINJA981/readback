// Builds the extension for Playwright: the overlay's shadow root is open (--mode e2e), but React
// and everything else stay on their production builds, so timing budgets measure the product.
import { spawnSync } from 'node:child_process';

const result = spawnSync('pnpm', ['exec', 'wxt', 'build', '--mode', 'e2e'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, NODE_ENV: 'production' },
});
process.exit(result.status ?? 1);
