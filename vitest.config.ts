import { defineConfig } from 'vitest/config';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    root:        path.resolve(__dirname, '.'),
    include: [
      'tests/unit/**/*.test.ts',
      'tests/components/**/*.test.ts',
      'tests/contracts/**/*.test.ts',
      'tests/property/**/*.test.ts',
      'tests/property/**/*.property.ts',
    ],
    exclude: ['**/node_modules/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include:  ['core/**', 'backend/src/**'],
      exclude:  ['**/node_modules/**', '**/*.d.ts'],
    },
    timeout: 30_000,
  },
  resolve: {
    alias: {
      '@core':    path.resolve(__dirname, 'core'),
      '@backend': path.resolve(__dirname, 'backend/src'),
    },
  },
});
