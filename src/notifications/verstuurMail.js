// src/notifications/verstuurMail.js
// Schrijft een mail-document naar Firestore.
// De Firebase 'Trigger Email from Firestore' extension pikt dit op en verstuurt de mail.

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

export { bouwMailHtml } from './mailTemplate';

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
