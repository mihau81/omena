import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    projects: [
      {
        resolve: {
          alias: {
            '@': path.resolve(__dirname, '.'),
          },
        },
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['tests/unit/**/*.{test,spec}.{ts,tsx}'],
          setupFiles: ['tests/setup.ts'],
          globals: true,
        },
      },
      {
        resolve: {
          alias: {
            '@': path.resolve(__dirname, '.'),
          },
        },
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.{test,spec}.{ts,tsx}'],
          setupFiles: ['tests/setup.integration.ts', 'tests/setup.ts'],
          globals: true,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/**',
        'tests/**',
        '.next/**',
        '*.config.*',
        'next-env.d.ts',
      ],
    },
  },
});
