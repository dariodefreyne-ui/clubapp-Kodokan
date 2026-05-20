const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

const { verzendNotificatie } = require("./notifications/dispatcher");

// Re-export migratie-trigger
const { migreerNotificatieVoorkeuren } = require("./notifications/migrate");
exports.migreerNotificatieVoorkeuren = migreerNotificatieVoorkeuren;

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
  if (beforeStock === afterStock) return;

  const db = admin.firestore();
  const productId = event.params.productId;

  let drempelLaagStock = 3;
  let vasteMails = [];
  let stockNulActief = true;
  let laagStockActief = true;

  try {
    const configSnap = await db.collection("instellingen").doc("meldingen").get();
    if (configSnap.exists) {
      const cfg = configSnap.data()?.stockMeldingen || {};
      if (typeof cfg.drempelLaagStock === "number") drempelLaagStock = cfg.drempelLaagStock;
      if (Array.isArray(cfg.vasteMails)) vasteMails = cfg.vasteMails.filter(e => !!e);
      if (typeof cfg.stockNulActief === "boolean") stockNulActief = cfg.stockNulActief;
      if (typeof cfg.laagStockActief === "boolean") laagStockActief = cfg.laagStockActief;
    }
  } catch (e) {
    console.warn("Kon stock-config niet laden:", e.message);
  }

  const isStockNul = beforeStock > 0 && afterStock === 0;
  const isLaagStock = drempelLaagStock > 0 &&
    beforeStock >= drempelLaagStock &&
    afterStock > 0 &&
    afterStock < drempelLaagStock;

  if (!isStockNul && !isLaagStock) return;
  if (isStockNul && !stockNulActief) return;
  if (isLaagStock && !laagStockActief) return;

  const naam = after.name || after.naam || "Product";
  const variant = after.variant || "";
  const category = after.category || "";
  const tweedehands = after.tweedehands === true;
  const productNaam = `${naam} ${variant}`.trim();

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

  // PUSH via dispatcher
  const pushType = isStockNul ? "stock_nul" : "stock_laag";
  const pushResult = await verzendNotificatie(db, pushType, {
    productId,
    naam,
    variant,
    category,
    tweedehands,
    afterStock,
  });

  // MAIL: vaste mails uit config + per-user emailVoorkeur waar voorkeur.stock aanstaat
  const usersSnap = await db.collection("users").get();
  const adressenSet = new Set(vasteMails);
  usersSnap.forEach(d => {
    const u = d.data();
    const voorkeur = u.notificatieVoorkeuren?.stock?.actief
      ?? (u.notificaties?.stockMeldingenActief !== false && u.notificaties?.stockAlerts === true);
    if (!voorkeur) return;
    const email = u.notificatieEmail || u.notificaties?.emailVoorkeur;
    if (email) adressenSet.add(email);
  });
  const adressen = Array.from(adressenSet);

  let mailVerstuurd = false;
  if (adressen.length > 0) {
    const mailTitel = isStockNul ? "Stock op 0 - Winkel" : "Lage stock - Winkel";
    const mailOnderwerp = isStockNul
      ? `Stock op 0: ${productNaam}`
      : `Lage stock: ${productNaam} (nog ${afterStock})`;
    const statusLabel = isStockNul ? "UITVERKOCHT" : `LAAG (${afterStock} resterend)`;
    const statusKleur = isStockNul ? "#c0392b" : "#e67e22";

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

  await alertRef.update({
    sent: pushResult.success > 0 || mailVerstuurd,
    pushSuccess: pushResult.success,
    pushFail: pushResult.fail,
    mailVerstuurd,
    mailAdressen: adressen,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
  });
});

// ---------------------------------------------
// TRIGGER 2a: Manuele trainer-check via Firestore document
// ---------------------------------------------
exports.checkTrainingTrigger = onDocumentCreated({
  document: "trainerReminderTriggers/{docId}",
  region: "europe-west1",
}, async () => {
  await voerTrainerCheckUit({ slaDagControleOver: true });
});

// ---------------------------------------------
// TRIGGER 2b: Dagelijkse scheduler - trainer zonder lesgever
// ---------------------------------------------
exports.checkTrainingZonderLesgever = onSchedule({
  schedule: "0 9 * * *",
  region: "europe-west1",
  timeZone: "Europe/Brussels",
}, async () => {
  await voerTrainerCheckUit({ slaDagControleOver: false });
});

async function voerTrainerCheckUit({ slaDagControleOver }) {
  const db = admin.firestore();

  let actiefOpDagen = [3, 6];
  let aantalDagen = 5;
  let legacyUitsluitZin = "";

  try {
    const configSnap = await db.collection("instellingen").doc("meldingen").get();
    if (configSnap.exists) {
      const cfg = configSnap.data()?.trainerReminder || {};
      if (Array.isArray(cfg.actiefOpDagen) && cfg.actiefOpDagen.length > 0) actiefOpDagen = cfg.actiefOpDagen;
      if (typeof cfg.aantalDagen === "number" && cfg.aantalDagen >= 1) aantalDagen = cfg.aantalDagen;
      if (typeof cfg.uitsluitZin === "string" && cfg.uitsluitZin.trim().length > 0) legacyUitsluitZin = cfg.uitsluitZin.trim().toLowerCase();
    }
  } catch (e) {
    console.warn("Config niet geladen:", e.message);
  }
  const geenTrainingMarkers = await laadTrainingGeenTrainingMarkers(db, legacyUitsluitZin);

  const nu = new Date();
  if (!slaDagControleOver && !actiefOpDagen.includes(nu.getDay())) return;

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
    if (lesgevers.length === 0 && !isGeenTrainingOpmerking(opmerking, geenTrainingMarkers)) {
      const groepId = t.groepId || "_onbekend";
      if (!probleemPerGroep[groepId]) probleemPerGroep[groepId] = [];
      probleemPerGroep[groepId].push({ id: docSnap.id, datum: t.datum });
    }
  });

  if (Object.keys(probleemPerGroep).length === 0) return;

  const lesgeversSnap = await db.collection("lesgevers").get();
  const lesgevers = lesgeversSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const groepenSnap = await db.collection("groepen").get();
  const groepenMap = {};
  groepenSnap.forEach(d => { groepenMap[d.id] = d.data().naam || d.id; });

  const usersSnap = await db.collection("users").get();
  const usersByUid = {};
  usersSnap.forEach(d => { usersByUid[d.data().uid || d.id] = d.data(); });

  const logItems = [];

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

      // PUSH via dispatcher (filtering op rubriek + groep gebeurt daar)
      const pushResult = await verzendNotificatie(db, "trainer_reminder", {
        uid,
        groepId,
        groepNaam,
        datum: trainingen[0].datum,
        datums,
        aantalTrainingen,
      });

      // MAIL
      const userData = usersByUid[uid];
      const emailVoorkeur = userData?.notificatieEmail
        || userData?.notificaties?.emailVoorkeur
        || lesgever.email;
      let mailVerstuurd = false;
      if (emailVoorkeur) {
        const rijen = trainingen.map(t => `<tr><td>${t.datum}</td><td>Geen lesgever</td></tr>`).join("");
        const inhoud = `
Voor de groep ${groepNaam} zijn er de komende ${aantalDagen} dagen trainingen zonder ingevulde lesgever:

<table>
<tr><th>Datum</th><th>Status</th></tr>
${rijen}
</table>

Gelieve een lesgever in te vullen via de Kodokan Clubapp onder Trainingen.
`;
        const onderwerp = aantalTrainingen === 1
          ? `Trainer ontbreekt: ${trainingen[0].datum} - ${groepNaam}`
          : `${aantalTrainingen} trainingen zonder lesgever - ${groepNaam}`;
        await stuurMail(db, [emailVoorkeur], onderwerp, bouwMailHtml("Trainer ontbreekt", inhoud));
        mailVerstuurd = true;
      }

      logItems.push({
        lesgeverId: lesgever.id,
        uid,
        groepId,
        aantalTrainingen,
        datums,
        pushVerstuurd: pushResult.success > 0,
        mailVerstuurd,
      });
    }
  }

  await db.collection("trainerReminders").add({
    uitgevoerdOp: admin.firestore.FieldValue.serverTimestamp(),
    bron: slaDagControleOver ? "manueel" : "scheduler",
    probleemPerGroep,
    logItems,
    gebruikteConfig: { actiefOpDagen, aantalDagen, trainingGeenTrainingMarkers: geenTrainingMarkers },
  });
}

// ---------------------------------------------
// TRIGGER 3: Nieuw wedstrijdevenement - push + mail
// ---------------------------------------------
exports.notifyNieuweWedstrijd = onDocumentCreated({
  document: "events/{eventId}",
  region: "europe-west1",
}, async (event) => {
  const data = event.data.data();
  if (data.type !== "wedstrijd") return;

  const db = admin.firestore();
  const naam = data.naam || data.title || "Nieuw tornooi";
  const datum = data.datum || "";
  const doelgroep = data.doelgroep || "";

  const categorieenEvent = doelgroep
    .split(/[-/]/)
    .map(s => s.trim())
    .filter(Boolean);

  // PUSH via dispatcher (categorie-routing + voorkeur-check daar)
  const pushResult = await verzendNotificatie(db, "nieuw_tornooi", {
    naam,
    datum,
    doelgroep,
    categorieen: categorieenEvent,
  });

  // MAIL aan dezelfde ontvangers (uids van push)
  if (pushResult.ontvangerUids.length === 0) return;

  const adressen = [];
  for (let i = 0; i < pushResult.ontvangerUids.length; i += 30) {
    const chunk = pushResult.ontvangerUids.slice(i, i + 30);
    const snap = await db.collection("users").where("uid", "in", chunk).get();
    snap.forEach(d => {
      const u = d.data();
      const email = u.notificatieEmail || u.notificaties?.emailVoorkeur || u.email;
      if (email) adressen.push(email);
    });
    // Fallback: gebruik docId als uid-veld leeg is
    if (snap.empty) {
      for (const uid of chunk) {
        const doc = await db.collection("users").doc(uid).get();
        if (doc.exists) {
          const u = doc.data();
          const email = u.notificatieEmail || u.notificaties?.emailVoorkeur || u.email;
          if (email) adressen.push(email);
        }
      }
    }
  }

  if (adressen.length === 0) return;

  const inhoud = `
Er is een nieuw tornooi toegevoegd in de Kodokan Clubapp:

<table>
<tr><th>Tornooi</th><th>Datum</th><th>Doelgroep</th></tr>
<tr><td>${naam}</td><td>${datum || "-"}</td><td>${doelgroep || "-"}</td></tr>
</table>

Bekijk de details en schrijf judoka's in via de Kodokan Clubapp onder Wedstrijden.

Wijzig je meldingsvoorkeuren via je profiel in de app.
`;

  await stuurMail(
    db,
    [...new Set(adressen)],
    datum ? `Nieuw tornooi: ${naam} op ${datum}` : `Nieuw tornooi: ${naam}`,
    bouwMailHtml("Nieuw tornooi toegevoegd", inhoud)
  );
});

// ---------------------------------------------
// TRIGGER 4: Verwerk push-triggers van paginas
// Collection: pushTriggers/{docId}
// Aangemaakt door stuurPushTrigger() in src/services/pushService.js
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

  try {
    await verzendNotificatie(db, type, payload);
  } catch (e) {
    console.error(`[verwerkPushTrigger] ${type} faalde:`, e);
  } finally {
    await docRef.delete();
  }
});

// ---------------------------------------------
// TRIGGER 5: Nieuw lid geregistreerd
// ---------------------------------------------
exports.notifyNieuwLid = onDocumentCreated({
  document: "users/{uid}",
  region: "europe-west1",
}, async (event) => {
  const db = admin.firestore();
  const data = event.data.data();

  const naam = data.naam || data.displayName || data.email || null;
  if (!naam) return;

  const instellingenSnap = await db.collection("instellingen").doc("meldingen").get();
  const instellingen = instellingenSnap.exists ? instellingenSnap.data() : {};
  const nieuwLidCfg = instellingen.nieuwLidMeldingen || {};
  const pushActief = nieuwLidCfg.pushActief !== false;
  const vasteMails = Array.isArray(nieuwLidCfg.vasteMails) ? nieuwLidCfg.vasteMails : [];

  if (pushActief) {
    await verzendNotificatie(db, "nieuw_lid", { naam, email: data.email || "" });
  }

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
    await stuurMail(db, vasteMails, `Nieuw lid: ${naam}`, bouwMailHtml("Nieuw lid geregistreerd", inhoud));
  }
});
