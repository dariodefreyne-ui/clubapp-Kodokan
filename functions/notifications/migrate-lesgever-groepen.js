// functions/notifications/migrate-lesgever-groepen.js
// Eenmalige migratie: kopieert het 'groepen'-veld op users/{uid} naar het
// nieuwe 'lesgeverGroepen'-veld, voor gebruikers met rol trainer/assistent.
//
// Achtergrond: 'groepen' op users/{uid} had twee betekenissen door elkaar —
// voor een lid de door koppelLidViaEmail gesynchroniseerde deelnemersgroepen,
// voor een trainer/assistent de zelf gekozen lesgeversgroepen. Deze migratie
// splitst dat: trainers/assistenten krijgen hun huidige waarde ook onder
// 'lesgeverGroepen'. Het oude 'groepen'-veld wordt hier NIET aangeraakt of
// gewist — dat blijft voor een lid de sync-bron, en wordt pas losgekoppeld
// zodra de nieuwe frontend-code (die 'lesgeverGroepen' leest/schrijft) is
// uitgerold en geverifieerd.
//
// Triggert op aanmaak van een document in collection `migrationTriggers` met
// id `lesgeverGroepen` (bv. door admin in Firestore Console).
// Idempotent: een document dat al 'lesgeverGroepen' heeft, wordt overgeslagen.

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

const LESGEVER_ROLLEN = ["trainer", "assistent"];

async function migreerLesgeverGroepen(db) {
  const snap = await db.collection("users")
    .where("rol", "in", LESGEVER_ROLLEN)
    .get();

  let geupdate = 0;
  let overgeslagen = 0;
  let leeg = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();

    if (Array.isArray(data.lesgeverGroepen)) {
      overgeslagen++;
      continue;
    }

    const huidigeGroepen = Array.isArray(data.groepen) ? data.groepen : [];
    if (huidigeGroepen.length === 0) {
      leeg++;
      continue;
    }

    await docSnap.ref.set({
      lesgeverGroepen: huidigeGroepen,
      lesgeverGroepenGemigreerdOp: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    geupdate++;
  }

  return { geupdate, overgeslagen, leeg, totaal: snap.size };
}

exports.migreerLesgeverGroepen = onDocumentCreated({
  document: "migrationTriggers/{docId}",
  region: "europe-west1",
}, async (event) => {
  const docId = event.params.docId;
  if (docId !== "lesgeverGroepen") {
    console.log(`[migrate-lesgeverGroepen] Trigger ${docId} genegeerd (verwacht: lesgeverGroepen)`);
    return;
  }

  const db = admin.firestore();
  const start = Date.now();

  const resultaat = await migreerLesgeverGroepen(db);
  const duurMs = Date.now() - start;

  await event.data.ref.set({
    voltooidOp: admin.firestore.FieldValue.serverTimestamp(),
    duurMs,
    resultaat,
  }, { merge: true });

  console.log(`[migrate-lesgeverGroepen] Klaar in ${duurMs}ms — ${resultaat.geupdate}/${resultaat.totaal} bijgewerkt, ${resultaat.overgeslagen} al gemigreerd, ${resultaat.leeg} zonder groepen.`);
});
