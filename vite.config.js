import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import sharp from 'sharp';

// Build-stempel in Belgische tijd (niet UTC) zodat het uur klopt in de app.
const BUILD_STAMP = new Intl.DateTimeFormat('nl-BE', {
  timeZone: 'Europe/Brussels', day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date());

export default defineConfig({
  // Build-stempel zodat we in-app kunnen zien welke versie effectief draait.
  define: {
    __BUILD_TIME__: JSON.stringify(BUILD_STAMP),
  },
  plugins: [
    {
      name: 'generate-manifest',
      configResolved(config) {
        // Blokkeer productie-build als AppCheck key ontbreekt.
        // configResolved loopt nádat Vite .env.local heeft ingeladen — hier zijn
        // VITE_* vars beschikbaar via config.env in plaats van process.env.
        if (config.mode === 'production' && !config.env.VITE_APPCHECK_KEY) {
          throw new Error(
            'VITE_APPCHECK_KEY is verplicht voor productie-builds. ' +
            'Voeg de key toe aan je .env.local of GitHub secret ENV_LOCAL.'
          );
        }
      },
      async buildStart() {
        const clubNaam = process.env.VITE_CLUB_NAAM || 'Clubapp Kodokan Merchtem';
        const clubNaamKort = process.env.VITE_CLUB_NAAM_KORT || 'Kodokan Merchtem';
        const themeColor = process.env.VITE_THEME_COLOR || '#E63346';

        // Haal het logo-URL op via Firestore REST (settings/club is publiek
        // leesbaar) zodat we altijd het correcte logo hebben, ongeacht het
        // Storage-pad. VITE_LOGO_URL dient als optionele override.
        const PROJECT_ID = process.env.VITE_FB_PROJECT_ID || 'club-app-kodokan-merchtem';
        let logoUrl = process.env.VITE_LOGO_URL || null;

        if (!logoUrl) {
          try {
            const fsRes = await fetch(
              `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/settings/club`
            );
            if (fsRes.ok) {
              const fsData = await fsRes.json();
              logoUrl = fsData?.fields?.logoUrl?.stringValue || null;
              if (logoUrl) console.log('[PWA] logoUrl gelezen uit Firestore settings/club');
            }
          } catch { /* stil falen — logoUrl blijft null */ }
        }

        if (logoUrl) {
          try {
            const imgRes = await fetch(logoUrl);
            if (imgRes.ok) {
              const buf = Buffer.from(await imgRes.arrayBuffer());
              const transparant = { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } };
              await Promise.all([
                sharp(buf).resize(192, 192, transparant).png().toFile('public/pwa-192x192.png'),
                sharp(buf).resize(512, 512, transparant).png().toFile('public/pwa-512x512.png'),
                sharp(buf).resize(180, 180, transparant).png().toFile('public/apple-touch-icon.png'),
              ]);
              console.log('[PWA] ✅ Logo geschaald en opgeslagen als PWA-icoon');
            } else {
              console.warn(`[PWA] ⚠️ Logo download mislukt (HTTP ${imgRes.status})`);
            }
          } catch (e) {
            console.warn('[PWA] ⚠️ Logo download fout:', e.message);
          }
        } else {
          console.warn('[PWA] ⚠️ Geen logoUrl gevonden — PWA gebruikt bestaande iconen');
        }

        const manifest = {
          name: clubNaam,
          short_name: clubNaamKort,
          description: `Club management app voor ${clubNaam}`,
          theme_color: themeColor,
          background_color: '#0D1B2A',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        };
        const manifestPath = 'public/manifest.webmanifest';
        const content = JSON.stringify(manifest, null, 2);
        const existing = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf-8') : null;
        if (existing !== content) fs.writeFileSync(manifestPath, content);
      },
    },
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
