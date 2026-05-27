// src/hooks/useAppUpdate.js
// Detecteert wanneer een nieuwe versie van de app beschikbaar is via de service worker.
// Geeft `needsRefresh` terug (boolean) en een `updateApp` functie.
//
// Strategie: autoUpdate in vite.config.js zorgt dat de nieuwe SW zichzelf installeert.
// Deze hook luistert naar het 'controllerchange' event (= nieuwe SW is actief) en
// toont dan de banner zodat de gebruiker bewust kan herladen — in plaats van een
// onverwachte reload midden in een actie.
// Daarnaast roept hij reg.update() aan bij elke app-focus zodat de browser actief
// naar een nieuwe SW-versie checkt (cruciaal voor PWA's op het homescreen).

import { useEffect, useState } from 'react';

export function useAppUpdate() {
  const [needsRefresh, setNeedsRefresh] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Zodra de controller wisselt (nieuwe SW actief), toon de banner.
    // autoUpdate zorgt dat dit automatisch gebeurt na download + installatie.
    const handleControllerChange = () => {
      setNeedsRefresh(true);
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // Forceer een SW-update-check bij elke app-focus.
    // Zonder dit checkt de browser soms pas na 24u opnieuw op mobiel/homescreen.
    const handleFocus = () => {
      navigator.serviceWorker.getRegistration().then(reg => {
        reg?.update().catch(() => {});
      });
    };
    window.addEventListener('focus', handleFocus);

    // Check ook meteen bij mount (eerste open na lange tijd op homescreen)
    navigator.serviceWorker.getRegistration().then(reg => {
      reg?.update().catch(() => {});
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const updateApp = () => {
    window.location.reload();
  };

  return { needsRefresh, updateApp };
}
