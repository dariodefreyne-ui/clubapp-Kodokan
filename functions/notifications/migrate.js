// functions/notifications/migrate.js
// Eenmalige migratie van legacy notificatie-voorkeuren naar het nieuwe model.
//
// Triggert op aanmaak van een document in collection `migrationTriggers` met
// id `notificatieVoorkeuren` (bv. door admin in Firestore Console).
// Idempotent: bestaande `notificatieVoorkeuren` worden niet overschreven.

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
const { defaultVoorkeurenVoorRol, RUBRIEKEN } = require("./categories");

function legacyNaarVoorkeuren(userData) {
  const rol = userData.rol || "lid";
  const voorkeuren = defaultVoorkeurenVoorRol(rol);
  const legacy = userData.notificaties || {};

  if (typeof legacy.wedstrijdMeldingen === "boolean" && voorkeuren.wedstrijden) {
    voorkeuren.wedstrijden.actief = legacy.wedstrijdMeldingen;
  }
  if (Array.isArray(legacy.wedstrijdCategorieen) && voorkeuren.wedstrijden) {
    voorkeuren.wedstrijden.categorieen = legacy.wedstrijdCategorieen;
  }

  if (typeof legacy.trainerMeldingenActief === "boolean" && voorkeuren.trainerHerinnering) {
    voorkeuren.trainerHerinnering.actief = legacy.trainerMeldingenActief;
  }
  if (Array.isArray(legacy.trainerGroepen) && voorkeuren.trainerHerinnering) {
    voorkeuren.trainerHerinnering.groepen = legacy.trainerGroepen;
  }

  if (typeof legacy.stockMeldingenActief === "boolean" && voorkeuren.stock) {
    voorkeuren.stock.actief = legacy.stockMeldingenActief;
  } else if (legacy.stockAlerts === true && voorkeuren.stock) {
    voorkeuren.stock.actief = true;
  }

  return { voorkeuren, emailVoorkeur: legacy.emailVoorkeur || userData.email || null };
}

async function migrateUsers(db) {
  const snap = await db.collection("users").get();
  let geupdate = 0;
  let overgeslagen = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.notificatieVoorkeuren && Object.keys(data.notificatieVoorkeuren).length > 0) {
      overgeslagen++;
      continue;
    }

    const { voorkeuren, emailVoorkeur } = legacyNaarVoorkeuren(data);
    await docSnap.ref.set({
      notificatieVoorkeuren: voorkeuren,
      ...(emailVoorkeur ? { notificatieEmail: emailVoorkeur } : {}),
      voorkeurenGemigreerdOp: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    geupdate++;
  }

  return { geupdate, overgeslagen };
}

async function migrateTokens(db) {
  const snap = await db.collection("notificationTokens").get();
  let geupdate = 0;

  for (const docSnap of snap.docs) {
    const data = docSnap.data();
    if (data.alertsOverride && !data.alerts && !data.stockAlerts) continue;

    // alerts → alertsOverride alleen behouden waar device-specifiek is afgewezen.
    // Bij eerste migratie nemen we GEEN override over: device volgt voortaan het account.
    // Admins kunnen later per toestel afwijken via DeviceInstellingen.
    const update = {
      alertsOverride: data.alertsOverride || {},
      alerts: admin.firestore.FieldValue.delete(),
      stockAlerts: admin.firestore.FieldValue.delete(),
      tokenGemigreerdOp: admin.firestore.FieldValue.serverTimestamp(),
    };

    await docSnap.ref.set(update, { merge: true });
    geupdate++;
  }

  return { geupdate };
}

exports.migreerNotificatieVoorkeuren = onDocumentCreated({
  document: "migrationTriggers/{docId}",
  region: "europe-west1",
}, async (event) => {
  const docId = event.params.docId;
  if (docId !== "notificatieVoorkeuren") {
    console.log(`[migrate] Trigger ${docId} genegeerd (verwacht: notificatieVoorkeuren)`);
    return;
  }

  const db = admin.firestore();
  const start = Date.now();

  const userResultaat = await migrateUsers(db);
  const tokenResultaat = await migrateTokens(db);
  const duurMs = Date.now() - start;

  await event.data.ref.set({
    voltooidOp: admin.firestore.FieldValue.serverTimestamp(),
    duurMs,
    users: userResultaat,
    tokens: tokenResultaat,
    rubrieken: Object.keys(RUBRIEKEN),
  }, { merge: true });

  console.log(`[migrate] Klaar in ${duurMs}ms — users: ${userResultaat.geupdate}/${userResultaat.geupdate + userResultaat.overgeslagen}, tokens: ${tokenResultaat.geupdate}`);
});
