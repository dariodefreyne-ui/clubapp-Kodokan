// src/hooks/useAppUpdate.js
// Detecteert wanneer een nieuwe versie van de app beschikbaar is via de service worker.
// Geeft `needsRefresh` terug (boolean) en een `updateApp` functie.
//
// Strategie: de SW roept skipWaiting() NIET automatisch aan. In plaats daarvan
// wacht de nieuwe SW in de "installed"-toestand tot de app het SKIP_WAITING-bericht
// stuurt. Hierdoor kan de SW nooit activeren terwijl Firebase aan het opstarten is
// (wat op iOS PWA from homescreen de laadtijd ernstig kon vertragen).
//
// Detectie: updatefound + statechange op de registratie (niet controllerchange),
// zodat we de wachtende SW-referentie hebben voor het SKIP_WAITING-bericht.

import { useEffect, useRef, useState } from 'react';

export function useAppUpdate() {
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const waitingWorkerRef = useRef(null);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    function bewakRegistratie(reg) {
      if (!reg) return;

      // Al een wachtende SW (bv. app geopend terwijl update klaarstond)?
      if (reg.waiting && navigator.serviceWorker.controller) {
        waitingWorkerRef.current = reg.waiting;
        setNeedsRefresh(true);
      }

      // Luister naar nieuwe SW-versies die beschikbaar komen.
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          // 'installed' + bestaande controller = update wacht op activatie.
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            waitingWorkerRef.current = newWorker;
            setNeedsRefresh(true);
          }
        });
      });
    }

    // Huidige registratie ophalen, bewaken en meteen checken op updates.
    navigator.serviceWorker.getRegistration().then(reg => {
      bewakRegistratie(reg);
      // Vertraag de update-check met 3s zodat de app eerst zichtbaar is
      // voordat de SW een mogelijke update begint te downloaden.
      setTimeout(() => reg?.update().catch(() => {}), 3000);
    });

    // Update-check bij elke app-focus (cruciaal voor PWA op het homescreen).
    const handleFocus = () => {
      navigator.serviceWorker.getRegistration().then(reg => {
        reg?.update().catch(() => {});
      });
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const updateApp = () => {
    const worker = waitingWorkerRef.current;
    if (worker) {
      // Reload pas nadat de controller gewisseld is (anders kan de oude SW
      // de eerste request van het reload nog afhandelen).
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      }, { once: true });
      worker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  };

  return { needsRefresh, updateApp };
}
