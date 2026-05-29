const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

const { verzendNotificatie } = require("./notifications/dispatcher");
const { bouwMailHtml, getClubNaam } = require("./mailTemplate");
const { getMailTemplate } = require("./mailTemplates");

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
    const tmpl = await getMailTemplate(db, 'stock-alert', {
      product: productNaam,
      aantal: String(afterStock),
      drempel: String(drempelLaagStock ?? 0),
    });
    const clubnaam = await getClubNaam(db);
    await stuurMail(db, adressen, tmpl.onderwerp, bouwMailHtml(tmpl.titel, tmpl.inhoud, clubnaam));
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

  // Ondersteunende data eerst laden (nodig om assistent-types en assistentNodig te kennen).
  const lesgeversSnap = await db.collection("lesgevers").get();
  const lesgevers = lesgeversSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const assistentIds = new Set(lesgevers.filter(l => l.type === "assistent").map(l => l.id));

  const groepenSnap = await db.collection("groepen").get();
  const groepenById = {};
  groepenSnap.forEach(d => { groepenById[d.id] = { id: d.id, ...d.data() }; });
  const groepNaamVan = (groepId) => groepenById[groepId]?.naam || groepId;

  // Probleem 1: training zonder enige lesgever.
  // Probleem 2: training in een groep die een assistent nodig heeft, met wél een
  //             trainer maar zonder assistent.
  const probleemPerGroep = {};
  const assistentProbleemPerGroep = {};
  snap.forEach(docSnap => {
    const t = docSnap.data();
    const lesg = Array.isArray(t.lesgevers) ? t.lesgevers : [];
    const opmerking = (t.opmerking || "").toLowerCase();
    if (isGeenTrainingOpmerking(opmerking, geenTrainingMarkers)) return;
    const groepId = t.groepId || "_onbekend";

    if (lesg.length === 0) {
      if (!probleemPerGroep[groepId]) probleemPerGroep[groepId] = [];
      probleemPerGroep[groepId].push({ id: docSnap.id, datum: t.datum });
      return;
    }

    if (groepenById[groepId]?.assistentNodig) {
      const heeftAssistent = lesg.some(id => assistentIds.has(id));
      if (!heeftAssistent) {
        if (!assistentProbleemPerGroep[groepId]) assistentProbleemPerGroep[groepId] = [];
        assistentProbleemPerGroep[groepId].push({ id: docSnap.id, datum: t.datum });
      }
    }
  });

  if (Object.keys(probleemPerGroep).length === 0 &&
      Object.keys(assistentProbleemPerGroep).length === 0) return;

  const usersSnap = await db.collection("users").get();
  const usersByUid = {};
  usersSnap.forEach(d => { usersByUid[d.data().uid || d.id] = d.data(); });

  const logItems = [];

  // Reminders gaan enkel naar échte trainers, nooit naar assistenten.
  const echteTrainers = lesgevers.filter(l => l.actief !== false && l.type !== "assistent");
  const verantwoordelijkenVoor = (groepId) => {
    const inGroep = echteTrainers.filter(l => Array.isArray(l.groepen) && l.groepen.includes(groepId));
    return inGroep.length > 0 ? inGroep : echteTrainers;
  };

  const stuurReminder = async (doelwitten, { type, mailKey, statusLabel, groepId, trainingen }) => {
    const groepNaam = groepNaamVan(groepId);
    const datums = trainingen.map(t => t.datum).join(", ");
    const aantalTrainingen = trainingen.length;
    for (const lesgever of doelwitten) {
      const uid = lesgever.uid;
      if (!uid) continue;

      const pushResult = await verzendNotificatie(db, type, {
        uid, groepId, groepNaam, datum: trainingen[0].datum, datums, aantalTrainingen,
      });

      const userData = usersByUid[uid];
      const emailVoorkeur = userData?.notificatieEmail
        || userData?.notificaties?.emailVoorkeur
        || lesgever.email;
      let mailVerstuurd = false;
      if (emailVoorkeur) {
        const rijen = trainingen.map(t => `<tr><td>${t.datum}</td><td>${statusLabel}</td></tr>`).join("");
        const trainingenHtml = `<table><tr><th>Datum</th><th>Status</th></tr>${rijen}</table>`;
        const tmpl = await getMailTemplate(db, mailKey, {
          groep: groepNaam,
          aantalTrainingen: String(aantalTrainingen),
          trainingen: trainingenHtml,
        });
        const clubnaam = await getClubNaam(db);
        await stuurMail(db, [emailVoorkeur], tmpl.onderwerp, bouwMailHtml(tmpl.titel, tmpl.inhoud, clubnaam));
        mailVerstuurd = true;
      }

      logItems.push({
        lesgeverId: lesgever.id, uid, groepId, type, aantalTrainingen, datums,
        pushVerstuurd: pushResult.success > 0, mailVerstuurd,
      });
    }
  };

  for (const [groepId, trainingen] of Object.entries(probleemPerGroep)) {
    await stuurReminder(verantwoordelijkenVoor(groepId), {
      type: "trainer_reminder", mailKey: "trainer-ontbreekt", statusLabel: "Geen lesgever", groepId, trainingen,
    });
  }
  for (const [groepId, trainingen] of Object.entries(assistentProbleemPerGroep)) {
    await stuurReminder(verantwoordelijkenVoor(groepId), {
      type: "assistent_reminder", mailKey: "assistent-ontbreekt", statusLabel: "Geen assistent", groepId, trainingen,
    });
  }

  await db.collection("trainerReminders").add({
    uitgevoerdOp: admin.firestore.FieldValue.serverTimestamp(),
    bron: slaDagControleOver ? "manueel" : "scheduler",
    probleemPerGroep,
    assistentProbleemPerGroep,
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
  // Patch 1 is in dispatcher.js: admin/bestuurslid altijd meenemen.
  await verzendNotificatie(db, "nieuw_tornooi", {
    naam,
    datum,
    doelgroep,
    categorieen: categorieenEvent,
  });

  // MAIL: vaste adressen uit config (onafhankelijk van push-ontvangers).
  // Patch 2: mail valt niet langer stil als er geen push-ontvangers zijn.
  let vasteMails = [];
  let mailActief = true;
  try {
    const configSnap = await db.collection("instellingen").doc("meldingen").get();
    if (configSnap.exists) {
      const cfg = configSnap.data()?.wedstrijdMeldingen || {};
      if (Array.isArray(cfg.vasteMails)) vasteMails = cfg.vasteMails.filter(e => !!e);
      if (typeof cfg.mailActief === "boolean") mailActief = cfg.mailActief;
    }
  } catch (e) {
    console.warn("Kon wedstrijd-mailconfig niet laden:", e.message);
  }

  if (mailActief && vasteMails.length > 0) {
    const tmpl = await getMailTemplate(db, 'nieuw-tornooi', {
      naam,
      datum: datum || '-',
      locatie: doelgroep || '-',
      datumSuffix: datum ? ` op ${datum}` : '',
    });
    const clubnaam = await getClubNaam(db);
    await stuurMail(
      db,
      [...new Set(vasteMails)],
      tmpl.onderwerp,
      bouwMailHtml(tmpl.titel, tmpl.inhoud, clubnaam)
    );
  }
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
    // Log mislukking zodat bestuur ze kan raadplegen
    await db.collection("pushFailures").add({
      type,
      payload,
      error: e.message,
      aangemaakt: data.aangemaakt || admin.firestore.FieldValue.serverTimestamp(),
      misluktOp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await docRef.delete();
});

// ---------------------------------------------
// TRIGGER 5b: Cascade-delete subcollecties bij verwijderen event
// ---------------------------------------------
exports.verwijderEventSubcollecties = onDocumentDeleted({
  document: "events/{eventId}",
  region: "europe-west1",
}, async (event) => {
  const db = admin.firestore();
  const eventId = event.params.eventId;

  async function verwijderSubcollectie(naam) {
    const snap = await db.collection("events").doc(eventId).collection(naam).get();
    if (snap.empty) return;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }

  await Promise.all([
    verwijderSubcollectie("registrations"),
    verwijderSubcollectie("documents"),
  ]);
});

// ---------------------------------------------
// TRIGGER 5c: Cascade-delete inschrijvingen bij verwijderen wedstrijd/event
// ---------------------------------------------
exports.verwijderInschrijvingenBijEvent = onDocumentDeleted({
  document: "events/{eventId}",
  region: "europe-west1",
}, async (event) => {
  const db = admin.firestore();
  const eventId = event.params.eventId;
  const snap = await db.collection("inschrijvingen").where("wedstrijdId", "==", eventId).get();
  if (snap.empty) return;

  const BATCH_SIZE = 499;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    snap.docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
    await batch.commit();
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
    const tmpl = await getMailTemplate(db, 'nieuw-lid', {
      naam,
      email: data.email || '(niet opgegeven)',
    });
    const clubnaam = await getClubNaam(db);
    await stuurMail(db, vasteMails, tmpl.onderwerp, bouwMailHtml(tmpl.titel, tmpl.inhoud, clubnaam));
  }
});

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────
const { onDocumentWritten } = require("firebase-functions/v2/firestore");

const AUDIT_COLLECTIONS = ['members', 'users', 'trainingen', 'events'];

AUDIT_COLLECTIONS.forEach(col => {
  exports[`auditLog_${col}`] = onDocumentWritten({
    document: `${col}/{docId}`,
    region: "europe-west1",
  }, async (event) => {
    const db = admin.firestore();
    const docId = event.params.docId;
    const voor = event.data.before?.exists ? event.data.before.data() : null;
    const na = event.data.after?.exists ? event.data.after.data() : null;
    const type = !voor ? 'aanmaken' : !na ? 'verwijderen' : 'bijwerken';
    const door = na?.updatedBy || na?.aangemaaktDoor || voor?.updatedBy || null;

    try {
      await db.collection('auditLogs').add({
        collectie: col,
        docId,
        type,
        door: door || null,
        tijdstip: admin.firestore.FieldValue.serverTimestamp(),
        voor: voor ? JSON.parse(JSON.stringify(voor, (k, v) => v?.toDate ? v.toDate().toISOString() : v)) : null,
        na: na ? JSON.parse(JSON.stringify(na, (k, v) => v?.toDate ? v.toDate().toISOString() : v)) : null,
      });
    } catch (e) {
      console.error(`auditLog_${col} mislukt:`, e.message);
    }
  });
});

// ---------------------------------------------
// TRIGGER 6: Kalenderoverzicht wedstrijden
// Collection: kalenderTriggers/{docId}
// Aangemaakt door addKalenderTrigger() na Excel-import in ExcelImport.jsx.
// Stuurt push (broadcast, wedstrijden-voorkeur) + mail (vaste adressen uit config).
// Push en mail zijn volledig onafhankelijk van elkaar.
// ---------------------------------------------
exports.verwerkKalenderTrigger = onDocumentCreated({
  document: "kalenderTriggers/{docId}",
  region: "europe-west1",
}, async (event) => {
  const db = admin.firestore();
  const docRef = event.data.ref;
  const data = event.data.data();

  const seizoen = data.seizoen || "";
  const seizoenLabel = data.seizoenLabel || seizoen;
  const toegevoegd = Array.isArray(data.toegevoegd) ? data.toegevoegd : [];
  const bijgewerkt = Array.isArray(data.bijgewerkt) ? data.bijgewerkt : [];
  const verwijderd = Array.isArray(data.verwijderd) ? data.verwijderd : [];

  // ── PUSH ───────────────────────────────────────────────────────────────
  await verzendNotificatie(db, "kalender_overzicht", {
    seizoenLabel,
    aantalNieuw: String(toegevoegd.length),
    aantalVerwijderd: String(verwijderd.length),
  });

  // ── MAIL ───────────────────────────────────────────────────────────────
  let vasteMails = [];
  let mailActief = true;
  try {
    const configSnap = await db.collection("instellingen").doc("meldingen").get();
    if (configSnap.exists) {
      const cfg = configSnap.data()?.wedstrijdMeldingen || {};
      if (Array.isArray(cfg.vasteMails)) vasteMails = cfg.vasteMails.filter(e => !!e);
      if (typeof cfg.mailActief === "boolean") mailActief = cfg.mailActief;
    }
  } catch (e) {
    console.warn("Kon wedstrijd-mailconfig niet laden:", e.message);
  }

  if (mailActief && vasteMails.length > 0) {
    // Laad huidig seizoensoverzicht uit Firestore voor de mailinhoud.
    let alleEvents = [];
    try {
      const eventsSnap = await db.collection("events")
        .where("type", "==", "wedstrijd")
        .orderBy("datum", "asc")
        .get();
      alleEvents = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("Kon events niet laden voor kalendermail:", e.message);
    }

    // Filter op seizoen (formaat: "2025-2026" → bereik sept t/m juni).
    let seizoensEvents = alleEvents;
    if (seizoen && /^\d{4}-\d{4}$/.test(seizoen)) {
      const [startJ, eindeJ] = seizoen.split("-");
      const bereikStart = `${startJ}-09-01`;
      const bereikEinde = `${eindeJ}-06-30`;
      seizoensEvents = alleEvents.filter(e => e.datum >= bereikStart && e.datum <= bereikEinde);
    }

    const nieuwIds = new Set(toegevoegd.map(v => v.id).filter(Boolean));
    const verwijderdIds = new Set(verwijderd.map(v => v.id).filter(Boolean));

    // Bouw HTML-tabelrijen: actieve tornooien + verwijderde aan einde.
    const rijHtml = (e, isNieuw, isVerwijderd) => {
      const achtergrond = isVerwijderd ? "background:#fff0f0;" : isNieuw ? "background:#f0fff4;" : "";
      const prefix = isNieuw ? "\u2746 " : "";
      const naamTekst = `${prefix}${e.naam || ""}`;
      const naamHtml = isVerwijderd
        ? `<s style="color:#c00;">${naamTekst}</s>`
        : isNieuw ? `<strong>${naamTekst}</strong>` : naamTekst;
      return `<tr style="${achtergrond}">
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${e.datum || ""}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${naamHtml}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${e.doelgroep || ""}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;">${e.locatie || ""}</td>
      </tr>`;
    };

    const actieveRijen = seizoensEvents.map(e =>
      rijHtml(e, nieuwIds.has(e.id), verwijderdIds.has(e.id))
    ).join("\n");

    // Verwijderde tornooien die niet meer in Firestore staan (enkel in payload).
    const extraVerwijderd = verwijderd.filter(v => !seizoensEvents.find(e => e.id === v.id));
    const verwijderdRijen = extraVerwijderd.map(v =>
      rijHtml({ datum: v.datum || "", naam: v.naam || "", doelgroep: v.doelgroep || "", locatie: "" }, false, true)
    ).join("\n");

    const overzichtHtml = `
      <table style="border-collapse:collapse;width:100%;font-size:13px;">
        <thead>
          <tr style="background:#f5f5f5;">
            <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #ddd;">Datum</th>
            <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #ddd;">Tornooi</th>
            <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #ddd;">Doelgroep</th>
            <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #ddd;">Locatie</th>
          </tr>
        </thead>
        <tbody>${actieveRijen}${verwijderdRijen}</tbody>
      </table>`;

    const delenSamenvatting = [];
    if (toegevoegd.length > 0) delenSamenvatting.push(`<strong>${toegevoegd.length} nieuw</strong> tornooi${toegevoegd.length > 1 ? "\u00ebn" : ""} toegevoegd`);
    if (bijgewerkt.length > 0) delenSamenvatting.push(`<strong>${bijgewerkt.length}</strong> bijgewerkt`);
    if (verwijderd.length > 0) delenSamenvatting.push(`<strong>${verwijderd.length}</strong> verwijderd`);
    const samenvattingHtml = delenSamenvatting.length > 0
      ? `<p style="padding:10px 14px;background:#f8f8f8;border-left:3px solid #e63946;margin-bottom:16px;">Wijzigingen: ${delenSamenvatting.join(" \u00b7 ")}</p>`
      : "";

    const tmpl = await getMailTemplate(db, "kalender-overzicht", {
      seizoenLabel,
      samenvatting: samenvattingHtml,
      overzichtHtml,
    });
    const clubnaam = await getClubNaam(db);
    await stuurMail(
      db,
      [...new Set(vasteMails)],
      tmpl.onderwerp,
      bouwMailHtml(tmpl.titel, tmpl.inhoud, clubnaam)
    );
  }

  await docRef.delete();
});
