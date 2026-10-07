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
        theme_color: '#1d3bb3',
        background_color: '#f3f4f7',
        display: 'standalone',
        // Los PNG salen de icon.svg, a sangre completa: el sistema recorta la forma.
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  build: {
    // Firebase va en su propio chunk: cambia menos que la app y la caché del navegador lo aprovecha.
    // Por sí solo pasa de 500 kB (Auth y Firestore se usan en todas las pantallas).
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: 'firebase', test: /node_modules[\\/]@?firebase/ }] } },
    },
  },
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
