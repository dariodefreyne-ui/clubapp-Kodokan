// src/notifications/verstuurMail.js
// Schrijft een mail-document naar Firestore.
// De Firebase 'Trigger Email from Firestore' extension pikt dit op en verstuurt de mail.

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CLUB_NAAM_KORT } from '../config/appConfig';

/**
 * Verstuur een mail via de Firebase Trigger Email extension.
 *
 * @param {string[]} aan       - Array van e-mailadressen, bv. ['jan@mail.com']
 * @param {string}   onderwerp - Onderwerp van de mail
 * @param {string}   html      - HTML-inhoud van de mail
 * @returns {Promise<void>}
 */
export async function verstuurMail(aan, onderwerp, html) {
  if (!aan || aan.length === 0) return;

  await addDoc(collection(db, 'mail'), {
    to: aan,
    message: {
      subject: onderwerp,
      html,
    },
    aangemaakt: serverTimestamp(),
  });
}

/**
 * Bouw een standaard HTML-mailtemplate op voor Kodokan.
 *
 * @param {string} titel    - Grote titel bovenaan de mail
 * @param {string} inhoud   - HTML-inhoud (mag paragrafen bevatten)
 * @returns {string}        - Volledige HTML-string
 */
export function bouwMailHtml(titel, inhoud) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: #c0392b; padding: 20px 24px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px;">${CLUB_NAAM_KORT}</h1>
      </div>
      <div style="padding: 24px;">
        <h2 style="color: #1a1a1a; margin-top: 0;">${titel}</h2>
        ${inhoud}
      </div>
      <div style="background: #f5f5f5; padding: 16px 24px; font-size: 12px; color: #888;">
        Dit is een automatische melding van de Kodokan Clubapp.
        Wijzig je meldingsvoorkeuren via de app.
      </div>
    </div>
  `;
}
