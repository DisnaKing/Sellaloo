import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'domain',
          environment: 'node',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        // Se ejecuta dentro de `firebase emulators:exec` (ver `npm run test:emulator` en la raíz).
        test: {
          name: 'emulator',
          environment: 'node',
          include: ['test/**/*.test.ts'],
          setupFiles: ['test/setup.ts'],
          fileParallelism: false,
          testTimeout: 20_000,
        },
      },
    ],
  },
});
