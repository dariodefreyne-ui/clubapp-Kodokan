// src/hooks/usePushSync.js
// Centrale hook die bij app-start het FCM-token verfrist en een foreground
// messaging listener actief houdt. Voorheen gebeurde dit indirect via de
// (nu verwijderde) StockAlertSettings-component; nu hebben we het nodig
// op één centrale plek omdat iOS PWA's de Firebase Messaging SDK anders
// niet betrouwbaar geactiveerd houden tussen sessies.

import { useEffect } from 'react';
import {
  browserOndersteuntPush,
  heeftActievePushToken,
  registreerPushToken,
  registreerVoorgrondMeldingen,
} from '../notifications/firebaseMessaging';

export function usePushSync(profiel) {
  useEffect(() => {
    if (!profiel?.uid) return;

    let unsubscribe = () => {};
    let gemonteerd = true;

    (async () => {
      const ondersteund = await browserOndersteuntPush();
      if (!ondersteund || !gemonteerd) return;

      // Permission al granted? Verfris het token zodat verlopen tokens
      // worden vervangen door een geldig nieuw token. Idempotent qua UX:
      // requestPermission() geeft direct "granted" terug zonder dialog
      // als al toegestaan, en setDoc({ merge: true }) is veilig.
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          const actief = await heeftActievePushToken(profiel.uid);
          if (actief && gemonteerd) {
            await registreerPushToken(profiel);
          }
        }
      } catch (e) {
        // Stille faal — push-vernieuwing mag de app niet breken
        console.warn('[usePushSync] Token verversen mislukt:', e?.message);
      }

      if (!gemonteerd) return;

      // Foreground listener — houdt de Firebase Messaging instance actief
      // en geeft ons later een hook om in-app meldingen te tonen indien gewenst.
      try {
        const unsub = await registreerVoorgrondMeldingen(() => {
          // Voor nu: niets doen. Browser/SW toont de melding zelf.
        });
        if (typeof unsub === 'function') unsubscribe = unsub;
      } catch (e) {
        console.warn('[usePushSync] Foreground listener faalde:', e?.message);
      }
    })();

    return () => {
      gemonteerd = false;
      try { unsubscribe(); } catch { /* noop */ }
    };
  }, [profiel?.uid]);
}
