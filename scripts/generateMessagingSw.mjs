// Genereert public/firebase-messaging-sw.js uit het template door de __FB_*__
// placeholders te vervangen met de Firebase-webconfig uit de omgeving.
//
// Bronvolgorde voor de waarden:
//   1. process.env (bv. in CI of wanneer expliciet geëxporteerd)
//   2. .env.local  (lokaal en in CI — die file wordt daar uit secrets.ENV_LOCAL gemaakt)
//   3. .env
//
// Draait automatisch via "prebuild" en "predev" (zie package.json).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

// Minimale .env-parser (geen extra dependency). Negeert commentaar en lege regels,
// strips quotes rond waarden.
function parseEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  const tekst = readFileSync(path, 'utf8');
  for (const ruwe of tekst.split('\n')) {
    const regel = ruwe.trim();
    if (!regel || regel.startsWith('#')) continue;
    const eq = regel.indexOf('=');
    if (eq === -1) continue;
    const key = regel.slice(0, eq).trim();
    let val = regel.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const fromEnvLocal = parseEnvFile(join(root, '.env.local'));
const fromEnv = parseEnvFile(join(root, '.env'));
const lees = (key) => process.env[key] ?? fromEnvLocal[key] ?? fromEnv[key] ?? '';

const vervangingen = {
  __FB_API_KEY__: lees('VITE_FB_API_KEY'),
  __FB_AUTH_DOMAIN__: lees('VITE_FB_AUTH_DOMAIN'),
  __FB_PROJECT_ID__: lees('VITE_FB_PROJECT_ID'),
  __FB_STORAGE_BUCKET__: lees('VITE_FB_STORAGE_BUCKET'),
  __FB_MESSAGING_SENDER_ID__: lees('VITE_FB_MESSAGING_SENDER_ID'),
  __FB_APP_ID__: lees('VITE_FB_APP_ID'),
  __FB_MEASUREMENT_ID__: lees('VITE_FB_MEASUREMENT_ID'),
};

const templatePad = join(root, 'public', 'firebase-messaging-sw.template.js');
const doelPad = join(root, 'public', 'firebase-messaging-sw.js');

let inhoud = readFileSync(templatePad, 'utf8');
for (const [placeholder, waarde] of Object.entries(vervangingen)) {
  inhoud = inhoud.split(placeholder).join(waarde);
}

const ontbrekend = Object.entries(vervangingen)
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (ontbrekend.length) {
  console.warn(
    `[generateMessagingSw] Waarschuwing: geen waarde voor ${ontbrekend.join(', ')}. ` +
    'Achtergrondmeldingen werken pas met een ingevulde .env.local / ENV_LOCAL.'
  );
}

writeFileSync(doelPad, inhoud);
console.log('[generateMessagingSw] public/firebase-messaging-sw.js gegenereerd.');
