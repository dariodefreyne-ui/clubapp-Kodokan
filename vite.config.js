import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // autoUpdate: de nieuwe SW installeert zichzelf zodra hij klaar is.
      // useAppUpdate.js vangt 'controllerchange' op en toont dan de banner
      // zodat de gebruiker bewust herlaadt — geen stille reload midden in een actie.
      registerType: 'autoUpdate',

      // De Firebase messaging SW blijft apart — we injecteren die niet hier.
      injectRegister: 'auto',

      workbox: {
        // Cache de app-shell (JS, CSS, HTML, fonts, icons)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2}'],

        // Navigatiefallback zodat React Router werkt offline / bij refresh
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/firebase-messaging-sw\.js/],

        // Beperk cache-grootte om storage-problemen op mobiel te vermijden
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MB

        // Reageer op SKIP_WAITING zodat een manuele trigger ook nog werkt
        // (niet meer nodig met autoUpdate, maar kost niets en is defensief)
        skipWaiting: true,
        clientsClaim: true,
      },

      manifest: false,
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
    }),
  ],
  server: {
    port: 3000,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
