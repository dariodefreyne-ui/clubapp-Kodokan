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
        navigateFallbackDenylist: [
          /^\/api/,
          /^\/firebase-messaging-sw\.js/,
          /^\/__\//,           // Firebase Auth helper URLs
          /^\/favicon\.ico$/,
        ],

        // Beperk cache-grootte om storage-problemen op mobiel te vermijden
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MB

        // Nieuwe SW neemt meteen de controle — essentieel voor iOS homescreen
        skipWaiting: true,
        clientsClaim: true,

        // Runtime caching: bronnen die niet in de app-shell zitten
        runtimeCaching: [
          {
            // Google Fonts CSS (verandert zelden, lang cachen)
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            // Google Fonts bestanden (immutable, CacheFirst)
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Firebase Storage (logo, uploads) — kort cachen, revalidate op achtergrond
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'firebase-storage',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 dagen
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Firestore en Firebase Auth API calls nooit cachen
            urlPattern: /^https:\/\/firestore\.googleapis\.com\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Overige externe requests: network-first, fallback naar cache
            urlPattern: /^https:\/\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'external-resources',
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
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
    rollupOptions: {
      output: {
        // Splits zware libs in eigen chunks zodat ze apart (en langdurig) gecached
        // worden en niet bij elke app-wijziging opnieuw gedownload moeten worden.
        manualChunks: {
          firebase: ['firebase/app', 'firebase/firestore', 'firebase/auth', 'firebase/storage', 'firebase/messaging'],
          xlsx: ['xlsx'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
