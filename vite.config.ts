import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sellaloo',
        short_name: 'Sellaloo',
        lang: 'es',
        theme_color: '#0b6b5d',
        background_color: '#ffffff',
        display: 'standalone',
        // ponytail: solo SVG; iOS pide PNG para el icono de inicio, añadirlo al lanzar.
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
    }),
  ],
  resolve: {
    alias: { '@shared': fileURLToPath(new URL('./functions/src/shared', import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'] },
      },
      {
        // Se ejecuta dentro de `firebase emulators:exec` (ver `npm run test:rules`).
        extends: true,
        test: { name: 'rules', environment: 'node', include: ['tests/rules/**/*.test.ts'], fileParallelism: false },
      },
    ],
  },
});
