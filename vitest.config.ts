import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    include: ['tests/**/*.test.ts'],
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
      ],
      thresholds: {
        'src/engine/**': { lines: 90 },
      },
    },
  },
});
