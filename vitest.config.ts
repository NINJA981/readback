import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: ['tests/**/*.test.{ts,tsx}'],
    environment: 'node',
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: [
        'src/engine/**',
        'src/state/**',
        'src/storage/**',
        'src/adapters/**',
        'src/messaging/**',
        'src/overlay/**',
      ],
      thresholds: {
        'src/engine/**': { lines: 90 },
      },
    },
  },
});
