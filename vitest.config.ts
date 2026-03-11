import { defineConfig } from 'vitest/config';
import path from 'node:path';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
      '@server': path.resolve(__dirname, 'server/src'),
      '@client': path.resolve(__dirname, 'client/src'),
    },
  },
  test: {
    globals: false,
    projects: [
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/src/**/*.test.ts', 'shared/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['client/src/**/*.test.tsx', 'client/src/**/*.test.ts'],
          setupFiles: ['client/src/test-setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['server/src/**/*.ts', 'shared/**/*.ts', 'client/src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/__tests__/**',
        '**/index.ts',
        '**/*.d.ts',
        'shared/types/**',
        'server/src/typings/**',
        'client/src/lib/api.ts',
        'client/src/hooks/use-sse.ts',
        'client/src/App.tsx',
      ],
      thresholds: { lines: 80, functions: 80, branches: 65, statements: 80 },
    },
  },
});
