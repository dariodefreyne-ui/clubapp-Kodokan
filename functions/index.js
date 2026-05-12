const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

const DEFAULT_GEEN_TRAINING_MARKERS = [
  "geen training",
  "prov. training",
  "provinciale training",
  "judoweekend",
  "tornooi",
  "vakantie",
  "sporthal gesloten",
  "ceremonie",
];

function normaliseerGeenTrainingMarkers(markers) {
  const opgeschoond = Array.from(new Map(
    (Array.isArray(markers) ? markers : [])
      .map(x => String(x || "").trim())
      .filter(Boolean)
      .map(x => [x.toLowerCase(), x.toLowerCase()])
  ).values());
  return opgeschoond.length ? opgeschoond : DEFAULT_GEEN_TRAINING_MARKERS;
}

async function laadTrainingGeenTrainingMarkers(db, legacyUitsluitZin = "") {
  let clubSettings = {};
  try {
    const clubSnap = await db.collection("settings").doc("club").get();
    clubSettings = clubSnap.exists ? clubSnap.data() : {};
  } catch (e) {
    console.warn("Kon club-settings niet laden voor trainingGeenTrainingMarkers:", e.message);
  }
  const centraleMarkers = Array.isArray(clubSettings.trainingGeenTrainingMarkers)
    ? clubSettings.trainingGeenTrainingMarkers
    : [];
  const legacyMarkers = [clubSettings.geenTrainingMarker, clubSettings.geenTrainingTekst, legacyUitsluitZin].filter(Boolean);
  return normaliseerGeenTrainingMarkers([...centraleMarkers, ...legacyMarkers]);
}

function isGeenTrainingOpmerking(opmerking, markers) {
  const tekst = String(opmerking || "").toLowerCase();
  return normaliseerGeenTrainingMarkers(markers).some(marker => tekst.includes(marker));
}

// ---------------------------------------------
// HELPER: bouw HTML mail template
// ---------------------------------------------
function bouwMailHtml(titel, inhoud) {
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;">
    <div style="background:#c0392b;padding:20px 24px;">
      <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:bold;">Kodokan Merchtem</h1>
    </div>
    <div style="padding:24px;">
      <h2 style="margin:0 0 16px 0;color:#1a1a1a;font-size:18px;">${titel}</h2>
      <div style="color:#333333;font-size:14px;line-height:1.6;">${inhoud}</div>
    </div>
    <div style="background:#f5f5f5;padding:16px 24px;border-top:1px solid #e0e0e0;">
      <p style="margin:0;color:#888888;font-size:12px;">Dit is een automatische melding van de Kodokan Clubapp.<br>Wijzig je meldingsvoorkeuren via de app.</p>
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------
// HELPER: stuur mail via Trigger Email Extension
// ---------------------------------------------
async function stuurMail(db, aan, onderwerp, html) {
  if (!aan || aan.length === 0) return;

  await db.collection("mail").add({
    to: aan,
    message: {
      subject: onderwerp,
      html,
    },
    aangemaakt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ---------------------------------------------
// HELPER: stuur FCM multicast naar lijst tokens
// Geeft { success, fail, invalidTokens } terug
// ---------------------------------------------
async function stuurMulticast(tokens, pushPayload) {
  const uniekeTokens = [...new Set(tokens.filter(Boolean))];
  if (uniekeTokens.length === 0) return { success: 0, fail: 0, invalidTokens: [] };

  let success = 0;
  let fail = 0;
  const invalidTokens = [];

  for (let i = 0; i < uniekeTokens.length; i += 500) {
    const batch = uniekeTokens.slice(i, i + 500);
    const response = await admin.messaging().sendEachForMulticast({
      ...pushPayload,
      tokens: batch,
    });

    success += response.successCount;
    fail += response.failureCount;

    response.responses.forEach((result, idx) => {
      if (!result.success) {
        const code = result.error?.code || "";
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token"
        ) {
          invalidTokens.push(batch[idx]);
        }
      }
    });
  }

  return { success, fail, invalidTokens };
}

// ---------------------------------------------
// HELPER: deactiveer lijst van ongeldige tokens
// ---------------------------------------------
async function deactiveerInvalideTokens(db, invalidTokens) {
  if (!invalidTokens || invalidTokens.length === 0) return;
  await Promise.all(invalidTokens.map(token =>
    db.collection("notificationTokens").doc(token).set({
      active: false,
      stockAlerts: false,
      invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  ));
}

// ---------------------------------------------
// TRIGGER 1: Stock op 0 / lage stock - push + mail
// ---------------------------------------------
exports.notifyStockZero = onDocumentUpdated({
  document: "products/{productId}",
  region: "europe-west1",
}, async (event) => {
  const before = event.data.before.data() || {};
  const after = event.data.after.data() || {};

  if (after.active === false) return;

  const beforeStock = Number(before.stock ?? 0);
  const afterStock = Number(after.stock ?? 0);

  // Geen wijziging in stock? Stop.
  if (beforeStock === afterStock) return;

  const db = admin.firestore();
  const productId = event.params.productId;

  // Lees configuratie
  let drempelLaagStock = 3;
  let vasteMails = [];
  let stockNulActief = true;
  let laagStockActief = true;

  try {
    const configSnap = await db.collection("instellingen").doc("meldingen").get();

    if (configSnap.exists) {
      const cfg = configSnap.data()?.stockMeldingen || {};

      if (typeof cfg.drempelLaagStock === "number") {
        drempelLaagStock = cfg.drempelLaagStock;
      }

      if (Array.isArray(cfg.vasteMails)) {
        vasteMails = cfg.vasteMails.filter(e => !!e);
      }

      if (typeof cfg.stockNulActief === "boolean") {
        stockNulActief = cfg.stockNulActief;
      }

      if (typeof cfg.laagStockActief === "boolean") {
        laagStockActief = cfg.laagStockActief;
      }
    }
  } catch (e) {
    console.warn("Kon stock-config niet laden:", e.message);
  }

  const isStockNul = beforeStock > 0 && afterStock === 0;
  const isLaagStock = drempelLaagStock > 0 &&
    beforeStock >= drempelLaagStock &&
    afterStock > 0 &&
    afterStock < drempelLaagStock;

  // Niets te melden?
  if (!isStockNul && !isLaagStock) return;
  if (isStockNul && !stockNulActief) return;
  if (isLaagStock && !laagStockActief) return;

  const naam = after.name || after.naam || "Product";
  const variant = after.variant || "";
  const category = after.category || "";
  const tweedehands = after.tweedehands === true;
  const productNaam = `${naam} ${variant}`.trim();

  // Maak stockAlert document aan
  const alertRef = await db.collection("stockAlerts").add({
    productId,
    naam,
    variant,
    category,
    tweedehands,
    beforeStock,
    afterStock,
    type: isStockNul ? "stock_nul" : "laag_stock",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    sent: false,
  });

  // PUSH: haal tokens op
  const tokensSnap = await db.collection("notificationTokens")
    .where("active", "==", true)
    .where("stockAlerts", "==", true)
    .get();

  const tokens = [];
  tokensSnap.forEach(d => {
    const t = d.data().token;
    if (t) tokens.push(t);
  });
  const uniekeTokens = [...new Set(tokens)];

  let pushSuccess = 0;
  let pushFail = 0;
  const invalidTokens = [];

  if (uniekeTokens.length > 0) {
    const pushPayload = {
      notification: {
        title: isStockNul ? "Stock op 0" : "Lage stock",
        body: isStockNul
          ? productNaam
          : `${productNaam} - nog ${afterStock} resterend`,
      },
      data: {
        type: isStockNul ? "stock_zero" : "low_stock",
        productId,
        naam: String(naam),
        variant: String(variant),
        category: String(category),
        tweedehands: tweedehands ? "true" : "false",
        url: "/winkel",
      },
      webpush: {
        fcmOptions: {
          link: "/winkel",
        },
        notification: {
          icon: "/pwa-192x192.png",
          badge: "/pwa-192x192.png",
        },
      },
    };

    for (let i = 0; i < uniekeTokens.length; i += 500) {
      const batch = uniekeTokens.slice(i, i + 500);
      const response = await admin.messaging().sendEachForMulticast({
        ...pushPayload,
        tokens: batch,
      });

      pushSuccess += response.successCount;
      pushFail += response.failureCount;

      response.responses.forEach((result, idx) => {
        if (!result.success) {
          const code = result.error?.code || "";
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            invalidTokens.push(batch[idx]);
          }
        }
      });
    }

    // Deactiveer ongeldige tokens
    await Promise.all(invalidTokens.map(token =>
      db.collection("notificationTokens").doc(token).set({
        active: false,
        stockAlerts: false,
        invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
    ));
  }

  // MAIL: haal adressen op van users met stockAlerts: true en voeg vaste mails toe
  const usersSnap = await db.collection("users")
    .where("notificaties.stockAlerts", "==", true)
    .get();

  const adressenSet = new Set(vasteMails);

  usersSnap.forEach(d => {
    const email = d.data()?.notificaties?.emailVoorkeur;
    if (email) adressenSet.add(email);
  });

  const adressen = Array.from(adressenSet);

  let mailVerstuurd = false;

  if (adressen.length > 0) {
    let mailTitel;
    let mailOnderwerp;
    let statusLabel;
    let statusKleur;

    if (isStockNul) {
      mailTitel = "Stock op 0 - Winkel";
      mailOnderwerp = `Stock op 0: ${productNaam}`;
      statusLabel = "UITVERKOCHT";
      statusKleur = "#c0392b";
    } else {
      mailTitel = "Lage stock - Winkel";
      mailOnderwerp = `Lage stock: ${productNaam} (nog ${afterStock})`;
      statusLabel = `LAAG (${afterStock} resterend)`;
      statusKleur = "#e67e22";
    }

    const inhoud = `
Het volgende product heeft een ${isStockNul ? "<strong>kritiek lage</strong>" : "lage"} stock:

<table style="width:100%; border-collapse:collapse; margin-top:12px;">
<tr>
<td style="padding:8px 12px; border-bottom:1px solid #eee;">${productNaam}</td>
<td style="padding:8px 12px; border-bottom:1px solid #eee; font-weight:bold; color:${statusKleur};">${statusLabel}</td>
</tr>
</table>

<p style="margin-top:16px; color:#888; font-size:13px;">
Controleer de voorraad in de Kodokan Clubapp onder Winkel.
</p>
`;

    await stuurMail(db, adressen, mailOnderwerp, bouwMailHtml(mailTitel, inhoud));
    mailVerstuurd = true;
  }

  // Update stockAlert met resultaat
  await alertRef.update({
    sent: pushSuccess > 0 || mailVerstuurd,
    type: isStockNul ? "stock_nul" : "laag_stock",
    pushSuccess,
    pushFail,
    invalidTokens: invalidTokens.length,
    mailVerstuurd,
    mailAdressen: adressen,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});

// ---------------------------------------------
// TRIGGER 2: Trainer reminder - per groep, push + mail
// ---------------------------------------------
// ---------------------------------------------
// TRIGGER 2b: Manuele trainer-check via Firestore document
// Admin klikt op knop in Beheer -> document in trainerReminderTriggers -> deze function
// Voert dezelfde logica uit als de scheduler maar slaat de dagcontrole over
// ---------------------------------------------
exports.checkTrainingTrigger = onDocumentCreated({
  document: "trainerReminderTriggers/{docId}",
  region: "europe-west1",
}, async () => {
  const db = admin.firestore();

  // Lees configuratie
  let aantalDagen = 5;
  let legacyUitsluitZin = "";

  try {
    const configSnap = await db.collection("instellingen").doc("meldingen").get();

    if (configSnap.exists) {
      const cfg = configSnap.data()?.trainerReminder || {};
      if (typeof cfg.aantalDagen === "number" && cfg.aantalDagen >= 1) aantalDagen = cfg.aantalDagen;
      if (typeof cfg.uitsluitZin === "string" && cfg.uitsluitZin.trim().length > 0) legacyUitsluitZin = cfg.uitsluitZin.trim().toLowerCase();
    }
  } catch (e) {
    console.warn("Config niet geladen:", e.message);
  }
  const geenTrainingMarkers = await laadTrainingGeenTrainingMarkers(db, legacyUitsluitZin);

  const nu = new Date();
  const vandaag = nu.toISOString().slice(0, 10);
  const grensdatum = new Date(nu);
  grensdatum.setDate(nu.getDate() + aantalDagen);
  const grens = grensdatum.toISOString().slice(0, 10);

  const snap = await db.collection("trainingen")
    .where("datum", ">=", vandaag)
    .where("datum", "<=", grens)
    .get();

  if (snap.empty) return;

  const probleemPerGroep = {};

  snap.forEach(docSnap => {
    const t = docSnap.data();
    const lesgevers = Array.isArray(t.lesgevers) ? t.lesgevers : [];
    const opmerking = (t.opmerking || "").toLowerCase();
    const isUitgesloten = isGeenTrainingOpmerking(opmerking, geenTrainingMarkers);

    if (lesgevers.length === 0 && !isUitgesloten) {
      const groepId = t.groepId || "_onbekend";
      if (!probleemPerGroep[groepId]) probleemPerGroep[groepId] = [];
      probleemPerGroep[groepId].push({ id: docSnap.id, datum: t.datum });
    }
  });

  if (Object.keys(probleemPerGroep).length === 0) return;

  const lesgeversSnap = await db.collection("lesgevers").get();
  const lesgevers = [];
  lesgeversSnap.forEach(d => lesgevers.push({ id: d.id, ...d.data() }));

  const groepenSnap = await db.collection("groepen").get();
  const groepenMap = {};
  groepenSnap.forEach(d => { groepenMap[d.id] = d.data().naam || d.id; });

  const usersSnap = await db.collection("users").get();
  const usersByUid = {};
  usersSnap.forEach(d => { usersByUid[d.data().uid || d.id] = d.data(); });

  const alleTokensSnap = await db.collection("notificationTokens")
    .where("active", "==", true)
    .where("rol", "in", ["trainer", "admin", "bestuurslid"])
    .get();

  const alleTrainerTokensMap = {};
  alleTokensSnap.forEach(d => {
    const data = d.data();
    if (!data.uid || !data.token) return;
    if (!alleTrainerTokensMap[data.uid]) alleTrainerTokensMap[data.uid] = [];
    alleTrainerTokensMap[data.uid].push(data.token);
  });

  const invalidTokens = [];

  for (const [groepId, trainingen] of Object.entries(probleemPerGroep)) {
    const groepNaam = groepenMap[groepId] || groepId;
    const verantwoordelijken = lesgevers.filter(l =>
      Array.isArray(l.groepen) && l.groepen.includes(groepId) && l.actief !== false
    );

    const doelwitten = verantwoordelijken.length > 0
      ? verantwoordelijken
      : lesgevers.filter(l => l.actief !== false);

    const datums = trainingen.map(t => t.datum).join(", ");
    const aantalTrainingen = trainingen.length;

    for (const lesgever of doelwitten) {
      const uid = lesgever.uid;
      if (!uid) continue;

      const userData = usersByUid[uid];
      if (userData?.notificaties?.trainerMeldingenActief === false) continue;
      // trainerGroepen filter: als de trainer voorkeuren heeft ingesteld,
      // stuur enkel als groepId in zijn trainerGroepen lijst staat
      const trainerGroepen = userData?.notificaties?.trainerGroepen;
      if (Array.isArray(trainerGroepen) && trainerGroepen.length > 0) {
        if (!trainerGroepen.includes(groepId)) continue;
      }

      const tokens = alleTrainerTokensMap[uid] || [];
      if (tokens.length === 0) continue;

      const pushPayload = {
        notification: {
          title: "Trainer ontbreekt",
          body: aantalTrainingen === 1
            ? `Training op ${trainingen[0].datum} (${groepNaam}) heeft nog geen lesgever.`
            : `${aantalTrainingen} trainingen voor ${groepNaam} zonder lesgever.`,
        },
        data: {
          type: "trainer_reminder",
          groepId: String(groepId),
          aantalTrainingen: String(aantalTrainingen),
          datums,
          url: "/trainingen",
        },
        webpush: {
          fcmOptions: { link: "/trainingen" },
          notification: { icon: "/pwa-192x192.png", badge: "/pwa-192x192.png" },
        },
      };

      for (let i = 0; i < tokens.length; i += 500) {
        const batch = tokens.slice(i, i + 500);
        const response = await admin.messaging().sendEachForMulticast({ ...pushPayload, tokens: batch });

        response.responses.forEach((result, idx) => {
          if (!result.success) {
            const code = result.error?.code || "";
            if (code === "messaging/registration-token-not-registered" ||
                code === "messaging/invalid-registration-token") {
              invalidTokens.push(batch[idx]);
            }
          }
        });
      }
    }
  }

  await Promise.all(invalidTokens.map(token =>
    db.collection("notificationTokens").doc(token).set({
      active: false,
      invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  ));

  await db.collection("trainerReminders").add({
    uitgevoerdOp: admin.firestore.FieldValue.serverTimestamp(),
    bron: "manueel",
    probleemPerGroep,
    invalidTokens: invalidTokens.length,
  });
});

// ---------------------------------------------
// TRIGGER 2: Dagelijkse scheduler - trainer zonder lesgever
// ---------------------------------------------
exports.checkTrainingZonderLesgever = onSchedule({
  schedule: "0 9 * * *",
  region: "europe-west1",
  timeZone: "Europe/Brussels",
}, async () => {
  const db = admin.firestore();

  // Lees configuratie uit Firestore
  let actiefOpDagen = [3, 6];
  let aantalDagen = 5;
  let legacyUitsluitZin = "";

  try {
    const configSnap = await db.collection("instellingen").doc("meldingen").get();

    if (configSnap.exists) {
      const cfg = configSnap.data()?.trainerReminder || {};

      if (Array.isArray(cfg.actiefOpDagen) && cfg.actiefOpDagen.length > 0) {
        actiefOpDagen = cfg.actiefOpDagen;
      }

      if (typeof cfg.aantalDagen === "number" && cfg.aantalDagen >= 1) {
        aantalDagen = cfg.aantalDagen;
      }

      if (typeof cfg.uitsluitZin === "string" && cfg.uitsluitZin.trim().length > 0) {
        legacyUitsluitZin = cfg.uitsluitZin.trim().toLowerCase();
      }
    }
  } catch (e) {
    console.warn("Kon meldingen-config niet laden, gebruik standaardwaarden:", e.message);
  }
  const geenTrainingMarkers = await laadTrainingGeenTrainingMarkers(db, legacyUitsluitZin);

  // Controleer of vandaag een actieve dag is
  const nu = new Date();
  const dagNummer = nu.getDay();

  if (!actiefOpDagen.includes(dagNummer)) return;

  const grensdatum = new Date(nu);
  grensdatum.setDate(nu.getDate() + aantalDagen);

  const vandaag = nu.toISOString().slice(0, 10);
  const grens = grensdatum.toISOString().slice(0, 10);

  // Haal trainingen op zonder lesgever voor de ingestelde periode
  const snap = await db.collection("trainingen")
    .where("datum", ">=", vandaag)
    .where("datum", "<=", grens)
    .get();

  if (snap.empty) return;

  // Groepeer probleemtrainingen per groepId
  const probleemPerGroep = {};

  snap.forEach(docSnap => {
    const t = docSnap.data();
    const lesgevers = Array.isArray(t.lesgevers) ? t.lesgevers : [];
    const opmerking = (t.opmerking || "").toLowerCase();
    const isUitgesloten = isGeenTrainingOpmerking(opmerking, geenTrainingMarkers);

    if (lesgevers.length === 0 && !isUitgesloten) {
      const groepId = t.groepId || "_onbekend";

      if (!probleemPerGroep[groepId]) {
        probleemPerGroep[groepId] = [];
      }

      probleemPerGroep[groepId].push({
        id: docSnap.id,
        datum: t.datum,
      });
    }
  });

  if (Object.keys(probleemPerGroep).length === 0) return;

  // Haal alle lesgevers op voor groepkoppeling en uid
  const lesgeversSnap = await db.collection("lesgevers").get();
  const lesgevers = [];

  lesgeversSnap.forEach(d => {
    lesgevers.push({
      id: d.id,
      ...d.data(),
    });
  });

  const groepenSnap = await db.collection("groepen").get();
  const groepenMap = {};
  groepenSnap.forEach(d => { groepenMap[d.id] = d.data().naam || d.id; });

  // Haal alle users op om emailVoorkeur te vinden via uid
  const usersSnap = await db.collection("users").get();
  const usersByUid = {};

  usersSnap.forEach(d => {
    usersByUid[d.data().uid || d.id] = d.data();
  });

  // Verzamel alle tokens voor push naar trainer, admin en bestuurslid
  const alleTokensSnap = await db.collection("notificationTokens")
    .where("active", "==", true)
    .where("rol", "in", ["trainer", "admin", "bestuurslid"])
    .get();

  const alleTrainerTokensMap = {};

  alleTokensSnap.forEach(d => {
    const data = d.data();

    if (!data.uid || !data.token) return;

    if (!alleTrainerTokensMap[data.uid]) {
      alleTrainerTokensMap[data.uid] = [];
    }

    alleTrainerTokensMap[data.uid].push(data.token);
  });

  const logItems = [];
  const invalidTokens = [];

  for (const [groepId, trainingen] of Object.entries(probleemPerGroep)) {
    const groepNaam = groepenMap[groepId] || groepId;
    // Vind lesgevers die verantwoordelijk zijn voor deze groep
    const verantwoordelijken = lesgevers.filter(l =>
      Array.isArray(l.groepen) &&
      l.groepen.includes(groepId) &&
      l.actief !== false
    );

    // Als geen verantwoordelijke gevonden, stuur naar alle actieve lesgevers
    const doelwitten = verantwoordelijken.length > 0
      ? verantwoordelijken
      : lesgevers.filter(l => l.actief !== false);

    const datums = trainingen.map(t => t.datum).join(", ");
    const aantalTrainingen = trainingen.length;

    for (const lesgever of doelwitten) {
      const uid = lesgever.uid;
      if (!uid) continue;

      const userData = usersByUid[uid];
      if (userData?.notificaties?.trainerMeldingenActief === false) continue;
      // trainerGroepen filter: als de trainer voorkeuren heeft ingesteld,
      // stuur enkel als groepId in zijn trainerGroepen lijst staat.
      // Beheerders zonder trainerGroepen krijgen altijd alle meldingen.
      const trainerGroepen = userData?.notificaties?.trainerGroepen;
      if (Array.isArray(trainerGroepen) && trainerGroepen.length > 0) {
        if (!trainerGroepen.includes(groepId)) continue;
      }
      const emailVoorkeur = userData?.notificaties?.emailVoorkeur || lesgever.email;
      const tokens = alleTrainerTokensMap[uid] || [];

      // PUSH per lesgever
      let pushSuccess = 0;

      if (tokens.length > 0) {
        const pushPayload = {
          notification: {
            title: "Trainer ontbreekt",
            body: aantalTrainingen === 1
              ? `Training op ${trainingen[0].datum} (${groepNaam}) heeft nog geen lesgever.`
              : `${aantalTrainingen} trainingen voor ${groepNaam} zonder lesgever.`,
          },
          data: {
            type: "trainer_reminder",
            groepId: String(groepId),
            aantalTrainingen: String(aantalTrainingen),
            datums,
            url: "/trainingen",
          },
          webpush: {
            fcmOptions: {
              link: "/trainingen",
            },
            notification: {
              icon: "/pwa-192x192.png",
              badge: "/pwa-192x192.png",
            },
          },
        };

        for (let i = 0; i < tokens.length; i += 500) {
          const batch = tokens.slice(i, i + 500);
          const response = await admin.messaging().sendEachForMulticast({
            ...pushPayload,
            tokens: batch,
          });

          pushSuccess += response.successCount;

          response.responses.forEach((result, idx) => {
            if (!result.success) {
              const code = result.error?.code || "";
              if (
                code === "messaging/registration-token-not-registered" ||
                code === "messaging/invalid-registration-token"
              ) {
                invalidTokens.push(batch[idx]);
              }
            }
          });
        }
      }

      // MAIL per lesgever
      let mailVerstuurd = false;

      if (emailVoorkeur) {
        const rijen = trainingen.map(t => `
<tr>
<td>${t.datum}</td>
<td>Geen lesgever</td>
</tr>
`).join("");

        const inhoud = `
Voor de groep ${groepNaam} zijn er de komende ${aantalDagen} dagen trainingen zonder ingevulde lesgever:

<table>
<tr>
<th>Datum</th>
<th>Status</th>
</tr>
${rijen}
</table>

Gelieve een lesgever in te vullen via de Kodokan Clubapp onder Trainingen.

Indien de opmerking matcht met de centrale Training detectie-lijst, stopt deze melding automatisch.
`;

        const onderwerp = aantalTrainingen === 1
          ? `Trainer ontbreekt: ${trainingen[0].datum} - ${groepNaam}`
          : `${aantalTrainingen} trainingen zonder lesgever - ${groepNaam}`;

        await stuurMail(
          db,
          [emailVoorkeur],
          onderwerp,
          bouwMailHtml("Trainer ontbreekt", inhoud)
        );

        mailVerstuurd = true;
      }

      logItems.push({
        lesgeverId: lesgever.id,
        uid,
        groepId,
        aantalTrainingen,
        datums,
        pushVerstuurd: pushSuccess > 0,
        mailVerstuurd,
      });
    }
  }

  // Deactiveer ongeldige tokens
  await Promise.all(invalidTokens.map(token =>
    db.collection("notificationTokens").doc(token).set({
      active: false,
      invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  ));

  // Log de uitvoering
  await db.collection("trainerReminders").add({
    uitgevoerdOp: admin.firestore.FieldValue.serverTimestamp(),
    probleemPerGroep,
    logItems,
    invalidTokens: invalidTokens.length,
    gebruikteConfig: {
      actiefOpDagen,
      aantalDagen,
      trainingGeenTrainingMarkers: geenTrainingMarkers,
      legacyUitsluitZin,
    },
  });
});

// ---------------------------------------------
// TRIGGER 3: Nieuw wedstrijdevenement - push + mail
// Filtert op notificaties.wedstrijdCategorieen per trainer
// Collectie: "events" met type: "wedstrijd"
// ---------------------------------------------
exports.notifyNieuweWedstrijd = onDocumentCreated({
  document: "events/{eventId}",
  region: "europe-west1",
}, async (event) => {
  const data = event.data.data();

  // Enkel reageren op wedstrijden
  if (data.type !== "wedstrijd") return;

  const db = admin.firestore();

  const naam = data.naam || data.title || "Nieuw tornooi";
  const datum = data.datum || "";
  const doelgroep = data.doelgroep || "";

  // Splits doelgroep in individuele categorieen, bv. "U11-U13" naar ["U11", "U13"]
  const categorieenEvent = doelgroep
    .split(/[-/]/)
    .map(s => s.trim())
    .filter(Boolean);

  if (categorieenEvent.length === 0) return;

  // Haal alle users op met notificaties.wedstrijdCategorieen
  const usersSnap = await db.collection("users").get();
  const doelwitten = [];

  usersSnap.forEach(d => {
    const u = d.data();
    if (u.notificaties?.wedstrijdMeldingen === false) return;
    const voorkeur = u.notificaties?.wedstrijdCategorieen || [];

    if (!Array.isArray(voorkeur) || voorkeur.length === 0) return;

    // Controleer of minstens een categorie van het event overeenkomt
    const match = categorieenEvent.some(cat => voorkeur.includes(cat));
    if (!match) return;

    const emailVoorkeur = u.notificaties?.emailVoorkeur || u.email;

    if (emailVoorkeur) {
      doelwitten.push({
        uid: d.id,
        email: emailVoorkeur,
        naam: u.naam || "",
      });
    }
  });

  if (doelwitten.length === 0) return;

  // Haal push tokens op
  const tokensSnap = await db.collection("notificationTokens")
    .where("active", "==", true)
    .where("rol", "in", ["lid", "trainer", "admin", "bestuurslid"])
    .get();

  const tokensByUid = {};

  tokensSnap.forEach(d => {
    const t = d.data();

    if (!t.uid || !t.token) return;

    if (!tokensByUid[t.uid]) {
      tokensByUid[t.uid] = [];
    }

    tokensByUid[t.uid].push(t.token);
  });

  const invalidTokens = [];

  for (const doelwit of doelwitten) {
    const tokens = tokensByUid[doelwit.uid] || [];

    // PUSH
    if (tokens.length > 0) {
      const pushPayload = {
        notification: {
          title: "Nieuw tornooi",
          body: datum ? `${naam} op ${datum} (${doelgroep})` : `${naam} (${doelgroep})`,
        },
        data: {
          type: "nieuw_wedstrijd",
          naam,
          datum,
          doelgroep,
          url: "/wedstrijden",
        },
        webpush: {
          fcmOptions: {
            link: "/wedstrijden",
          },
        },
      };

      const messaging = admin.messaging();

      for (const token of tokens) {
        try {
          await messaging.send({
            ...pushPayload,
            token,
          });
        } catch (err) {
          if (
            err.code === "messaging/registration-token-not-registered" ||
            err.code === "messaging/invalid-registration-token"
          ) {
            invalidTokens.push(token);
          }
        }
      }
    }

    // MAIL
    const inhoud = `
Er is een nieuw tornooi toegevoegd in de Kodokan Clubapp:

<table>
<tr>
<th>Tornooi</th>
<th>Datum</th>
<th>Doelgroep</th>
</tr>
<tr>
<td>${naam}</td>
<td>${datum || "-"}</td>
<td>${doelgroep || "-"}</td>
</tr>
</table>

Bekijk de details en schrijf judoka's in via de Kodokan Clubapp onder Wedstrijden.

Wijzig je meldingsvoorkeuren via je profiel in de app.
`;

    await stuurMail(
      db,
      [doelwit.email],
      datum ? `Nieuw tornooi: ${naam} op ${datum}` : `Nieuw tornooi: ${naam}`,
      bouwMailHtml("Nieuw tornooi toegevoegd", inhoud)
    );
  }

  // Deactiveer ongeldige tokens
  await Promise.all(invalidTokens.map(token =>
    db.collection("notificationTokens").doc(token).set({
      active: false,
      invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  ));
});

// ---------------------------------------------
// TRIGGER 4: Verwerk push-triggers van paginas
// Collectie: pushTriggers/{docId}
// Aangemaakt door stuurPushTrigger() in pushService.js
// ---------------------------------------------
exports.verwerkPushTrigger = onDocumentCreated({
  document: "pushTriggers/{docId}",
  region: "europe-west1",
}, async (event) => {
  const db = admin.firestore();
  const docRef = event.data.ref;
  const data = event.data.data();

  const type = data.type || "";
  const payload = data.payload || {};

  if (!type) {
    await docRef.delete();
    return;
  }

  // Mapping: type -> alerts-sleutel die tokens moeten hebben
  const ALERTS_SLEUTEL = {
    training_geannuleerd:   "trainingen",
    training_verplaatst:    "trainingen",
    trainer_toegewezen:     "trainingen",
    tornooi_geannuleerd:    "wedstrijden",
    tornooi_gewijzigd:      "wedstrijden",
    inschrijving_bevestigd: "inschrijvingen",
    nieuwe_inschrijving:    "inschrijvingen",
    examen_gepland:         "examens",
    graad_toegekend:        "graad",
    uitgenodigd_examen:     "examens",
    clubbericht:            "clubBerichten",
  };

  const alertsSleutel = ALERTS_SLEUTEL[type];

  // ── Haal tokens op ──────────────────────────────────────────────────────
  // nieuw_lid: altijd naar admin en bestuurslid, geen alerts-check
  // overige: filter op alerts.{sleutel} == true

  let tokenDocs = [];

  if (type === "nieuw_lid") {
    const snap = await db.collection("notificationTokens")
      .where("active", "==", true)
      .where("rol", "in", ["admin", "bestuurslid"])
      .get();
    snap.forEach(d => tokenDocs.push(d.data()));

  } else if (alertsSleutel) {
    const snap = await db.collection("notificationTokens")
      .where("active", "==", true)
      .get();

    snap.forEach(d => {
      const td = d.data();
      // Controleer alerts object
      if (td.alerts && td.alerts[alertsSleutel] === true) {
        tokenDocs.push(td);
      }
    });
  }

  // ── Filter op uid als melding persoonsgericht is ─────────────────────────
  // Voor: inschrijving_bevestigd, graad_toegekend, uitgenodigd_examen, trainer_toegewezen
  const doelUid = payload.uid || null;

  if (doelUid && [
    "inschrijving_bevestigd",
    "graad_toegekend",
    "uitgenodigd_examen",
    "trainer_toegewezen",
  ].includes(type)) {
    tokenDocs = tokenDocs.filter(td => td.uid === doelUid);
  }

  // ── Filter op rol voor bepaalde types ───────────────────────────────────
  if (["nieuwe_inschrijving", "examen_gepland"].includes(type)) {
    tokenDocs = tokenDocs.filter(td =>
      td.rol === "trainer" || td.rol === "admin" || td.rol === "bestuurslid"
    );
  }

  // ── Clubbericht: filter op doelRol als opgegeven ─────────────────────────
  if (type === "clubbericht" && payload.doelRol && payload.doelRol !== "alle") {
    tokenDocs = tokenDocs.filter(td => td.rol === payload.doelRol);
  }

  // ── Bouw FCM payload per type ────────────────────────────────────────────
  let title = "";
  let body = "";
  let url = "/";

  if (type === "training_geannuleerd") {
    title = "Training geannuleerd";
    body = payload.groepNaam
      ? `${payload.groepNaam} op ${payload.datum || ""} gaat niet door.`
      : `Training op ${payload.datum || ""} gaat niet door.`;
    url = "/trainingen";

  } else if (type === "training_verplaatst") {
    title = "Training verplaatst";
    body = payload.groepNaam
      ? `${payload.groepNaam}: ${payload.oudeDatum || ""} verplaatst naar ${payload.nieuweDatum || ""}.`
      : `Training verplaatst naar ${payload.nieuweDatum || ""}.`;
    url = "/trainingen";

  } else if (type === "trainer_toegewezen") {
    title = "Trainer toegewezen";
    body = payload.groepNaam && payload.datum
      ? `Je bent ingevuld als trainer voor ${payload.groepNaam} op ${payload.datum}.`
      : "Je bent ingevuld als trainer voor een training.";
    url = "/trainingen";

  } else if (type === "tornooi_geannuleerd") {
    title = "Tornooi geannuleerd";
    body = payload.naam
      ? `${payload.naam}${payload.datum ? " op " + payload.datum : ""} werd geannuleerd.`
      : "Een tornooi werd geannuleerd.";
    url = "/wedstrijden";

  } else if (type === "tornooi_gewijzigd") {
    title = "Tornooi gewijzigd";
    body = payload.naam
      ? `${payload.naam}: datum of locatie werd aangepast.`
      : "Een tornooi werd gewijzigd.";
    url = "/wedstrijden";

  } else if (type === "inschrijving_bevestigd") {
    title = "Inschrijving bevestigd";
    body = payload.judokaNaam && payload.eventNaam
      ? `${payload.judokaNaam} is ingeschreven voor ${payload.eventNaam}.`
      : "Een inschrijving werd bevestigd.";
    url = "/wedstrijden";

  } else if (type === "nieuwe_inschrijving") {
    title = "Nieuwe inschrijving";
    body = payload.judokaNaam && payload.eventNaam
      ? `${payload.judokaNaam} werd ingeschreven voor ${payload.eventNaam}.`
      : "Er is een nieuwe inschrijving.";
    url = "/wedstrijden";

  } else if (type === "examen_gepland") {
    title = "Examen gepland";
    body = payload.naam && payload.datum
      ? `${payload.naam} op ${payload.datum}${payload.locatie ? " in " + payload.locatie : ""}.`
      : "Er is een nieuw examen gepland.";
    url = "/examens";

  } else if (type === "graad_toegekend") {
    title = "Gordel behaald!";
    body = payload.judokaNaam && payload.gordel
      ? `${payload.judokaNaam} heeft de ${payload.gordel} gordel behaald.`
      : "Er werd een gordel toegekend.";
    url = "/examens";

  } else if (type === "uitgenodigd_examen") {
    title = "Uitgenodigd voor examen";
    body = payload.judokaNaam && payload.examenNaam
      ? `${payload.judokaNaam} is uitgenodigd voor ${payload.examenNaam}.`
      : "Je bent uitgenodigd voor een examen.";
    url = "/examens";

  } else if (type === "nieuw_lid") {
    title = "Nieuw lid";
    body = payload.naam
      ? `${payload.naam} heeft een account aangemaakt.`
      : "Er heeft zich een nieuw lid geregistreerd.";
    url = "/leden";

  } else if (type === "clubbericht") {
    title = payload.titel || "Clubbericht";
    body = payload.bericht || "";
    url = "/";
  }

  if (!title || !body) {
    await docRef.delete();
    return;
  }

  // ── Verzend FCM ──────────────────────────────────────────────────────────
  const tokens = tokenDocs.map(td => td.token).filter(Boolean);

  const pushPayload = {
    notification: { title, body },
    data: {
      type,
      url,
      ...Object.fromEntries(
        Object.entries(payload).map(([k, v]) => [k, String(v)])
      ),
    },
    webpush: {
      fcmOptions: { link: url },
      notification: {
        icon: "/pwa-192x192.png",
        badge: "/pwa-192x192.png",
      },
    },
  };

  const { invalidTokens } = await stuurMulticast(tokens, pushPayload);
  await deactiveerInvalideTokens(db, invalidTokens);

  // ── Ruim trigger document op ─────────────────────────────────────────────
  await docRef.delete();
});

// ---------------------------------------------
// TRIGGER 5: Nieuw lid geregistreerd (C2)
// Luistert op aanmaak van users/{uid}
// Stuurt push naar alle admins en bestuursleden
// ---------------------------------------------
exports.notifyNieuwLid = onDocumentCreated({
  document: "users/{uid}",
  region: "europe-west1",
}, async (event) => {
  const db = admin.firestore();
  const data = event.data.data();

  // Sla anonieme of lege documenten over
  const naam = data.naam || data.displayName || data.email || null;
  if (!naam) return;

  // Haal instellingen op
  const instellingenSnap = await db
    .collection("instellingen")
    .doc("meldingen")
    .get();
  const instellingen = instellingenSnap.exists ? instellingenSnap.data() : {};
  const nieuwLidCfg = instellingen.nieuwLidMeldingen || {};
  const pushActief = nieuwLidCfg.pushActief !== false;
  const vasteMails = Array.isArray(nieuwLidCfg.vasteMails) ? nieuwLidCfg.vasteMails : [];

  // PUSH
  if (pushActief) {
    const tokensSnap = await db.collection("notificationTokens")
      .where("active", "==", true)
      .where("rol", "in", ["admin", "bestuurslid"])
      .get();

    const tokens = [];
    tokensSnap.forEach(d => {
      const t = d.data().token;
      if (t) tokens.push(t);
    });

    if (tokens.length > 0) {
      const pushPayload = {
        notification: {
          title: "Nieuw lid",
          body: `${naam} heeft een account aangemaakt.`,
        },
        data: {
          type: "nieuw_lid",
          naam: String(naam),
          url: "/leden",
        },
        webpush: {
          fcmOptions: { link: "/leden" },
          notification: {
            icon: "/pwa-192x192.png",
            badge: "/pwa-192x192.png",
          },
        },
      };

      const { invalidTokens } = await stuurMulticast(tokens, pushPayload);
      await deactiveerInvalideTokens(db, invalidTokens);
    }
  }

  // MAIL
  if (vasteMails.length > 0) {
    const inhoud = `
      <p>Er heeft zich een nieuw lid geregistreerd in de Kodokan app.</p>
      <table style="border-collapse:collapse;width:100%;margin-top:12px;">
        <tr>
          <td style="padding:8px 12px;background:#f5f5f5;font-weight:600;width:120px;">Naam</td>
          <td style="padding:8px 12px;">${naam}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f5f5f5;font-weight:600;">E-mail</td>
          <td style="padding:8px 12px;">${data.email || '(niet opgegeven)'}</td>
        </tr>
      </table>
      <p style="margin-top:16px;">
        <a href="https://app.kodokan.be/leden" style="background:#c0392b;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:600;">
          Bekijk in ledenlijst
        </a>
      </p>
    `;

    await stuurMail(
      db,
      vasteMails,
      `Nieuw lid: ${naam}`,
      bouwMailHtml("Nieuw lid geregistreerd", inhoud)
    );
  }
});
