/**
 * seizoenUtils.js — seizoenslogica
 * Defaults: seizoen loopt van 1 september t.e.m. 30 juni.
 * Pas aan via Beheer > Clubdata > Seizoen (Firestore: settings/seizoen).
 *
 * v2: ondersteunt realtime Firestore-listener via initSeizoenListener().
 */

import { doc, onSnapshot } from 'firebase/firestore';
import { useState, useEffect } from 'react';

// Module-level cache voor seizoeninstellingen.
let SEIZOEN_SETTINGS = { startMaand: 9, startDag: 1, eindMaand: 6, eindDag: 30 };
// Subscribers voor React-hooks die de settings reactief nodig hebben
const _subscribers = new Set();

export function setSeizoenSettings(settings) {
  if (!settings) return;
  SEIZOEN_SETTINGS = {
    startMaand: Number(settings.startMaand) || 9,
    startDag:   Number(settings.startDag)   || 1,
    eindMaand:  Number(settings.eindMaand)  || 6,
    eindDag:    Number(settings.eindDag)    || 30,
  };
  _subscribers.forEach(fn => fn({ ...SEIZOEN_SETTINGS }));
}

export function getSeizoenSettings() {
  return { ...SEIZOEN_SETTINGS };
}

/**
 * Start een realtime Firestore-listener op settings/seizoen.
 * Roep aan vanuit AuthContext (na inloggen). Geeft unsubscribe terug.
 */
export function initSeizoenListener(db) {
  const ref = doc(db, 'settings', 'seizoen');
  return onSnapshot(ref, snap => {
    if (snap.exists()) setSeizoenSettings(snap.data());
  }, () => { /* ignore errors */ });
}

/**
 * React-hook: geeft altijd de actuele SEIZOEN_SETTINGS terug, ook na
 * een wijziging in Beheer zonder page-refresh.
 * Gebruik: const settings = useSeizoenSettings();
 */
export function useSeizoenSettings() {
  const [settings, setSettings] = useState(() => ({ ...SEIZOEN_SETTINGS }));
  useEffect(() => {
    // Sync bij mount (settings kunnen al bijgewerkt zijn door listener)
    setSettings({ ...SEIZOEN_SETTINGS });
    _subscribers.add(setSettings);
    return () => { _subscribers.delete(setSettings); };
  }, []);
  return settings;
}

// ─── Berekeningen (lezen altijd uit SEIZOEN_SETTINGS) ─────────────────────────

export function seizoenBereikVanJaar(startJaar) {
  const { startMaand, startDag, eindMaand, eindDag } = SEIZOEN_SETTINGS;
  const sm = String(startMaand).padStart(2, '0');
  const sd = String(startDag).padStart(2, '0');
  const em = String(eindMaand).padStart(2, '0');
  const ed = String(eindDag).padStart(2, '0');
  return {
    start: `${startJaar}-${sm}-${sd}`,
    einde: `${startJaar + 1}-${em}-${ed}`,
    label: `${startJaar}–${startJaar + 1}`,
    startJaar,
  };
}

export function huidigSeizoenStartJaar() {
  const now = new Date();
  const startMaandIdx = SEIZOEN_SETTINGS.startMaand - 1;
  return now.getMonth() >= startMaandIdx ? now.getFullYear() : now.getFullYear() - 1;
}

export function seizoenBereik(offsetJaar = 0) {
  return seizoenBereikVanJaar(huidigSeizoenStartJaar() + offsetJaar);
}

export function beschikbareSeizoenStartJaren() {
  const huidig = huidigSeizoenStartJaar();
  return [huidig + 1, huidig, huidig - 1, huidig - 2];
}

export function seizoenVanDatum(datum) {
  if (!datum) return '—';
  const d = new Date(datum);
  const startMaandIdx = SEIZOEN_SETTINGS.startMaand - 1;
  const startJaar = d.getMonth() >= startMaandIdx ? d.getFullYear() : d.getFullYear() - 1;
  return `${startJaar}–${startJaar + 1}`;
}

export function bepaalSeizoen(datumISO) {
  if (!datumISO) return null;
  const d = new Date(datumISO + 'T00:00:00');
  const maand = d.getMonth();
  const jaar  = d.getFullYear();
  const startMaandIdx = SEIZOEN_SETTINGS.startMaand - 1;
  return maand >= startMaandIdx ? `${jaar}-${jaar + 1}` : `${jaar - 1}-${jaar}`;
}

export function huidigSeizoen() {
  return bepaalSeizoen(new Date().toISOString().slice(0, 10));
}

export function vandaagISO() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDatum(isoString) {
  if (!isoString) return '';
  return new Date(isoString + 'T00:00:00').toLocaleDateString('nl-BE', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

export function trainingsId(groepId, datum) {
  return `${groepId}_${datum}`;
}

/**
 * Geeft de maanden terug voor een seizoen startend op startJaar,
 * rekening houdend met de actuele SEIZOEN_SETTINGS.
 * Bruikbaar voor dropdowns in Trainingen en Uitbetalingen.
 */
export function maandOptiesVoorSeizoen(startJaar) {
  const { startMaand, eindMaand } = SEIZOEN_SETTINGS;
  const opties = [];
  let jaar = startJaar;
  let maand = startMaand - 1; // 0-indexed
  // Loop maand per maand tot en met eindMaand van het volgende jaar
  // Max 18 maanden als veiligheid
  for (let i = 0; i < 18; i++) {
    const d = new Date(jaar, maand, 1);
    const van = `${jaar}-${String(maand + 1).padStart(2, '0')}-01`;
    const tot = new Date(jaar, maand + 1, 0);
    const totISO = `${tot.getFullYear()}-${String(tot.getMonth() + 1).padStart(2, '0')}-${String(tot.getDate()).padStart(2, '0')}`;
    opties.push({
      id: `maand-${van}`,
      van,
      tot: totISO,
      naam: d.toLocaleDateString('nl-BE', { month: 'long', year: 'numeric' }),
      value: `${van}|${totISO}`,
    });
    // Volgende maand
    maand++;
    if (maand > 11) { maand = 0; jaar++; }
    // Stop na eindMaand van het 2e jaar (startJaar+1)
    if (jaar === startJaar + 1 && maand > eindMaand - 1) break;
    if (jaar > startJaar + 1) break;
  }
  return opties;
}
