import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // injectManifest: VitePWA bundelt src/sw.js via Vite en injecteert alleen
      // de precache-manifest (self.__WB_MANIFEST). Alle andere SW-logica
      // (runtime caching, FCM, navigatiefallback) staat in src/sw.js zelf.
      // useAppUpdate.js werkt ongewijzigd — het luistert naar 'controllerchange'
      // en is SW-agnostisch.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',

      // Geen automatische SW-registratie — main.jsx doet dit handmatig.
      injectRegister: null,

      workbox: {
        // Welke bestanden in de precache-manifest komen (hash-based).
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest,woff,woff2}'],
        // Beperk cache-grootte om storage-problemen op mobiel te vermijden.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // 4 MB
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
          exceljs: ['exceljs'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
          qrcode: ['html5-qrcode', 'qrcode'],
        },
      },
    },
  },
});
