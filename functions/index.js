const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();

const { verzendNotificatie } = require("./notifications/dispatcher");
const { bouwMailHtml, getClubNaam } = require("./mailHtmlBuilder");
const { getMailTemplate } = require("./mailTemplateStore");

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

// `markers` wordt al genormaliseerd aangeleverd via laadTrainingGeenTrainingMarkers().
function isGeenTrainingOpmerking(opmerking, markers) {
  const tekst = String(opmerking || "").toLowerCase();
  return markers.some(marker => tekst.includes(marker));
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

// Escape user-input vóór interpolatie in mail-HTML (verslagtitels, agenda, ...).
function escapeHtml(tekst) {
  return String(tekst == null ? "" : tekst)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

  // MAIL: vaste mails + opt-in adressen uit notificatieIndex (1 doc read ipv 500)
  const adressenSet = new Set(vasteMails);
  try {
    const indexSnap = await db.collection('instellingen').doc('notificatieIndex').get();
    if (indexSnap.exists) {
      const stockAdressen = indexSnap.data()?.stock || [];
      stockAdressen.forEach((e) => adressenSet.add(e));
    } else {
      // Fallback: full read als index nog niet bestaat (eerste keer na deploy)
      const usersSnap = await db.collection('users').get();
      usersSnap.forEach((d) => {
        const u = d.data();
        const voorkeur =
          u.notificatieVoorkeuren?.stock?.actief ??
          (u.notificaties?.stockMeldingenActief !== false &&
            u.notificaties?.stockAlerts === true);
        if (!voorkeur) return;
        const email = u.notificatieEmail || u.notificaties?.emailVoorkeur;
        if (email) adressenSet.add(email);
      });
    }
  } catch (e) {
    console.warn('Kon notificatieIndex niet lezen, fallback naar users.get():', e.message);
  }
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
  // Probleem 2: training in een groep die een assistent nodig heeft, met wel een
  //             trainer maar zonder assistent.
  const probleemPerGroep = {};
  const assistentProbleemPerGroep = {};
  snap.forEach(docSnap => {
    const t = docSnap.data();
    const lesg = Array.isArray(t.lesgevers) ? t.lesgevers : [];
    const opmerking = (t.opmerking || "").toLowerCase();
    if (isGeenTrainingOpmerking(opmerking, geenTrainingMarkers)) return;
    const groepId = t.groepId || "_onbekend";

    // Samengevoegde of inactieve groepen: trainerReminderActief === false → overslaan.
    if (groepenById[groepId]?.trainerReminderActief === false) return;

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

  // Training-reminders vereisen uid→email lookup per trainer, dus users.get() blijft
  // nodig. Zodra de notificatieIndex een uid-gebaseerde map bevat, kan dit vervangen
  // worden door een gerichte doc read per trainer-uid.
  const usersByUid = {};
  try {
    const usersSnap = await db.collection("users").get();
    usersSnap.forEach(d => { usersByUid[d.data().uid || d.id] = d.data(); });
  } catch (e) {
    console.warn('usersByUid laden mislukt:', e.message);
  }

  const logItems = [];

  // Reminders gaan enkel naar echte trainers, nooit naar assistenten.
  const echteTrainers = lesgevers.filter(l => l.actief !== false && l.type !== "assistent");
  const verantwoordelijkenVoor = (groepId) => {
    const inGroep = echteTrainers.filter(l => Array.isArray(l.groepen) && l.groepen.includes(groepId));
    return inGroep.length > 0 ? inGroep : echteTrainers;
  };

  const stuurReminder = async (doelwitten, { type, mailKey, statusLabel, groepId, trainingen }) => {
    const groepNaam = groepNaamVan(groepId);
    const datums = trainingen.map(t => t.datum).join(", ");
    const aantalTrainingen = trainingen.length;

    // Mailtemplate, clubnaam en de tabel-HTML zijn identiek voor elke lesgever in
    // deze groep — één keer opbouwen vóór de loop i.p.v. per lesgever (N+1).
    const rijen = trainingen.map(t => `<tr><td>${t.datum}</td><td>${statusLabel}</td></tr>`).join("");
    const trainingenHtml = `<table><tr><th>Datum</th><th>Status</th></tr>${rijen}</table>`;
    const tmpl = await getMailTemplate(db, mailKey, {
      groep: groepNaam,
      aantalTrainingen: String(aantalTrainingen),
      trainingen: trainingenHtml,
    });
    const clubnaam = await getClubNaam(db);
    const mailHtml = bouwMailHtml(tmpl.titel, tmpl.inhoud, clubnaam);

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
        await stuurMail(db, [emailVoorkeur], tmpl.onderwerp, mailHtml);
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
// TRIGGER 2c: Dagelijkse scheduler - herinnering bestuursvergadering
// Stuurt `herinneringDagen` dagen voor een geplande vergadering één keer een
// push (via de dispatcher, rubriek 'bestuur') én een e-mail naar admins en
// bestuursleden. `herinneringVerstuurd` voorkomt dubbele meldingen.
// ---------------------------------------------
exports.bestuursVergaderingHerinnering = onSchedule({
  schedule: "0 8 * * *",
  region: "europe-west1",
  timeZone: "Europe/Brussels",
}, async () => {
  const db = admin.firestore();
  const vandaag = new Date().toISOString().slice(0, 10);

  // Komende vergaderingen (datum is een 'YYYY-MM-DD' string → lexicografische
  // vergelijking volstaat, geen composite index nodig).
  const snap = await db.collection("bestuursVergaderingen")
    .where("datum", ">=", vandaag)
    .get();
  if (snap.empty) return;

  // E-mailadressen van admins + bestuursleden (één keer ophalen).
  const usersSnap = await db.collection("users").where("rol", "in", ["admin", "bestuurslid"]).get();
  const adressen = [];
  usersSnap.forEach(d => {
    const u = d.data();
    const email = u.notificatieEmail || u.notificaties?.emailVoorkeur || u.email;
    if (email) adressen.push(email);
  });
  const uniekeAdressen = [...new Set(adressen)];
  const clubnaam = await getClubNaam(db);

  const vandaagMs = new Date(vandaag + "T00:00:00").getTime();

  for (const docSnap of snap.docs) {
    const v = docSnap.data();
    if (v.herinneringVerstuurd === true) continue;
    if (v.status && v.status !== "gepland") continue;

    const dagen = Number(v.herinneringDagen);
    const drempel = Number.isFinite(dagen) && dagen >= 0 ? dagen : 3;

    const verschilDagen = Math.round(
      (new Date(v.datum + "T00:00:00").getTime() - vandaagMs) / 86400000
    );
    // Alleen versturen wanneer de vergadering binnen het herinneringsvenster valt.
    if (verschilDagen < 0 || verschilDagen > drempel) continue;

    const payload = {
      titel: v.titel || "Bestuursvergadering",
      datum: v.datum,
      locatie: v.locatie || "",
    };

    let pushVerstuurd = false;
    try {
      const res = await verzendNotificatie(db, "bestuursvergadering_herinnering", payload);
      pushVerstuurd = res.success > 0;
    } catch (e) {
      console.warn("Push bestuursvergadering faalde:", e.message);
    }

    let mailVerstuurd = false;
    if (uniekeAdressen.length > 0) {
      const tijd = v.tijdVan ? ` om ${v.tijdVan}${v.tijdTot ? "–" + v.tijdTot : ""}` : "";
      const agenda = Array.isArray(v.agenda) ? v.agenda.filter(Boolean) : [];
      const agendaHtml = agenda.length > 0
        ? `<p><strong>Agenda:</strong></p><ul>${agenda.map(a => `<li>${escapeHtml(a)}</li>`).join("")}</ul>`
        : "";
      const inhoud = `
        <p>Er staat een bestuursvergadering gepland:</p>
        <p><strong>${escapeHtml(payload.titel)}</strong><br/>
        📅 ${escapeHtml(v.datum)}${escapeHtml(tijd)}<br/>
        ${v.locatie ? "📍 " + escapeHtml(v.locatie) : ""}</p>
        ${agendaHtml}
      `;
      const html = bouwMailHtml("Herinnering bestuursvergadering", inhoud, clubnaam);
      try {
        await stuurMail(db, uniekeAdressen, `Herinnering: ${payload.titel} op ${v.datum}`, html);
        mailVerstuurd = true;
      } catch (e) {
        console.warn("Mail bestuursvergadering faalde:", e.message);
      }
    }

    await docSnap.ref.set({
      herinneringVerstuurd: true,
      herinneringVerstuurdOp: admin.firestore.FieldValue.serverTimestamp(),
      herinneringPush: pushVerstuurd,
      herinneringMail: mailVerstuurd,
    }, { merge: true });
  }
});

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

  await verzendNotificatie(db, "nieuw_tornooi", {
    naam,
    datum,
    doelgroep,
    categorieen: categorieenEvent,
  });

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
// Ondersteunt optioneel een mail-blok voor types die ook mail vereisen
// (bv. kalender_overzicht). Push en mail zijn onafhankelijk van elkaar.
// ---------------------------------------------

// Helper: bouw de HTML voor de kalenderoverzicht-mail.
// Opgehaald door verwerkPushTrigger wanneer type === 'kalender_overzicht'.
async function bouwKalenderMailVars(db, { seizoen, seizoenLabel, toegevoegd = [], bijgewerkt = [], verwijderd = [] }) {
  let alleEvents = [];
  try {
    // Geen orderBy -> vermijdt de noodzaak van een samengestelde index
    // (type + datum). We sorteren verderop in het geheugen. Zonder deze
    // index gooide de orderBy-query een fout, waardoor de lijst leeg bleef.
    const eventsSnap = await db.collection("events")
      .where("type", "==", "wedstrijd")
      .get();
    alleEvents = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.warn("Kon wedstrijd-events niet gefilterd laden, val terug op alle events:", e.message);
    try {
      const alleSnap = await db.collection("events").get();
      alleEvents = alleSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(ev => ev.type === "wedstrijd");
    } catch (e2) {
      console.warn("Kon events niet laden voor kalendermail:", e2.message);
    }
  }

  // Sorteer in geheugen op datum (ISO-datums sorteren lexicografisch correct).
  alleEvents.sort((a, b) => String(a.datum || "").localeCompare(String(b.datum || "")));

  // Gebruik Belgische datum om timezone-verschil (UTC vs Europe/Brussels) te vermijden.
  const nu = new Date();
  const vandaagStr = nu.toLocaleDateString("sv-SE", { timeZone: "Europe/Brussels" });

  // Toon alleen toekomstige wedstrijden (verwijderde altijd tonen via extraVerwijderd).
  const seizoensEvents = alleEvents.filter(e => e.datum >= vandaagStr);

  const nieuwIds = new Set(toegevoegd.map(v => v.id).filter(Boolean));
  const verwijderdIds = new Set(verwijderd.map(v => v.id).filter(Boolean));

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
          <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #ddd;">Categorie</th>
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

  return { seizoenLabel, samenvatting: samenvattingHtml, overzichtHtml };
}

exports.verwerkPushTrigger = onDocumentCreated({
  document: "pushTriggers/{docId}",
  region: "europe-west1",
}, async (event) => {
  const db = admin.firestore();
  const docRef = event.data.ref;
  const data = event.data.data();

  const type = data.type || "";
  const payload = data.payload || {};
  const mailConfig = data.mail || null;

  if (!type) {
    await docRef.delete();
    return;
  }

  // Rate-limiting: als hetzelfde type binnen 60 seconden al een keer in de
  // queue zit, is dit waarschijnlijk een dubbele write. We laten dan de eerste
  // verwerken en gooien de huidige weg.
  const nu = admin.firestore.Timestamp.now();
  const grens = admin.firestore.Timestamp.fromMillis(nu.toMillis() - 60 * 1000);
  try {
    const recente = await db.collection('pushTriggers')
      .where('type', '==', type)
      .where('aangemaakt', '>=', grens)
      .limit(2)
      .get();
    if (recente.size >= 2) {
      console.warn(`[verwerkPushTrigger] Duplicate trigger voor type '${type}' gevonden — overgeslagen.`);
      await docRef.delete();
      return;
    }
  } catch (e) {
    console.warn('[verwerkPushTrigger] Duplicate-check mislukt, verwerking gaat door:', e.message);
  }

  try {
    await verzendNotificatie(db, type, payload);

    if (mailConfig) {
      const { templateKey, configPad } = mailConfig;

      let vasteMails = [];
      let mailActief = true;
      if (configPad) {
        try {
          const snap = await db.collection("instellingen").doc("meldingen").get();
          const cfg = snap.exists ? (snap.data()?.[configPad] || {}) : {};
          vasteMails = Array.isArray(cfg.vasteMails) ? cfg.vasteMails.filter(Boolean) : [];
          mailActief = cfg.mailActief ?? true;
        } catch (e) {
          console.warn(`[verwerkPushTrigger] Kon config ${configPad} niet laden:`, e.message);
        }
      }

      if (mailActief && vasteMails.length > 0) {
        let vars = mailConfig.vars || {};
        if (type === "kalender_overzicht") {
          // De wedstrijd-data (seizoen, seizoenLabel, toegevoegd, bijgewerkt,
          // verwijderd) staat rechtstreeks op het mail-blok (zie addKalenderTrigger).
          vars = await bouwKalenderMailVars(db, mailConfig);
        }

        const tmpl = await getMailTemplate(db, templateKey, vars);
        const clubnaam = await getClubNaam(db);
        await stuurMail(db, [...new Set(vasteMails)], tmpl.onderwerp, bouwMailHtml(tmpl.titel, tmpl.inhoud, clubnaam));
      }
    }
  } catch (e) {
    console.error(`[verwerkPushTrigger] ${type} faalde:`, e);
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
// TRIGGER 5: Cascade-delete bij verwijderen event
// Eén trigger op events/{eventId}: ruimt zowel de subcollecties
// (registrations, documents) als de losse inschrijvingen op. Voorheen
// waren dit twee aparte functies op hetzelfde pad — samengevoegd om
// dubbele cold-starts en billing per delete-event te vermijden.
// ---------------------------------------------
exports.verwijderEventData = onDocumentDeleted({
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

  async function verwijderInschrijvingen() {
    const snap = await db.collection("inschrijvingen").where("wedstrijdId", "==", eventId).get();
    if (snap.empty) return;
    const BATCH_SIZE = 499;
    for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      snap.docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }

  await Promise.all([
    verwijderSubcollectie("registrations"),
    verwijderSubcollectie("documents"),
    verwijderInschrijvingen(),
  ]);
});

// ---------------------------------------------
// TRIGGER 6: Nieuw lid geregistreerd
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

// ─── CONFIG-CASCADE ───────────────────────────────────────────────────────────
// Houdt verwijzingen consistent wanneer een configuratie-item in Beheer hernoemd
// (code gewijzigd) of verwijderd wordt. Records die naar de oude code/id verwezen
// worden bijgewerkt (rename) of opgeschoond (delete). Zonder deze triggers blijven
// groepen, notificatievoorkeuren, lesgevers enz. naar een niet-bestaande waarde
// wijzen — bv. een categorie hernoemen van "U16" naar "U17" liet overal "U16" staan.

const CASCADE_OPTS = { region: "europe-west1" };

// Vervang (rename) of verwijder (nieuw == null) een waarde in een ARRAY-veld van
// alle docs die de oude waarde bevatten.
async function cascadeArrayVeld(db, collectie, veld, oud, nieuw) {
  const snap = await db.collection(collectie).where(veld, "array-contains", oud).get();
  if (snap.empty) return 0;
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = db.batch();
    snap.docs.slice(i, i + 450).forEach(d => {
      const huidig = Array.isArray(d.data()[veld]) ? d.data()[veld] : [];
      const bijgewerkt = nieuw == null
        ? huidig.filter(x => x !== oud)
        : huidig.map(x => (x === oud ? nieuw : x));
      batch.update(d.ref, { [veld]: Array.from(new Set(bijgewerkt)) });
    });
    await batch.commit();
  }
  return snap.size;
}

// Vervang of leeg ("" bij delete) een SCALAR-veld van alle docs met de oude waarde.
async function cascadeScalarVeld(db, collectie, veld, oud, nieuw) {
  const snap = await db.collection(collectie).where(veld, "==", oud).get();
  if (snap.empty) return 0;
  for (let i = 0; i < snap.docs.length; i += 450) {
    const batch = db.batch();
    snap.docs.slice(i, i + 450).forEach(d => {
      batch.update(d.ref, { [veld]: nieuw == null ? "" : nieuw });
    });
    await batch.commit();
  }
  return snap.size;
}

// Vervang/verwijder een waarde in een genest array-veld onder
// notificatieVoorkeuren.<rubriek>.<subveld> over alle users (nested array →
// geen Firestore-query mogelijk, dus volledige scan; admin-actie is zeldzaam).
async function cascadeVoorkeurArray(db, rubriek, subveld, oud, nieuw) {
  const pad = `notificatieVoorkeuren.${rubriek}.${subveld}`;
  const snap = await db.collection("users").get();
  const treffers = snap.docs.filter(d => {
    const arr = d.data()?.notificatieVoorkeuren?.[rubriek]?.[subveld];
    return Array.isArray(arr) && arr.includes(oud);
  });
  for (let i = 0; i < treffers.length; i += 450) {
    const batch = db.batch();
    treffers.slice(i, i + 450).forEach(d => {
      const arr = d.data().notificatieVoorkeuren[rubriek][subveld];
      const bijgewerkt = nieuw == null
        ? arr.filter(x => x !== oud)
        : arr.map(x => (x === oud ? nieuw : x));
      batch.update(d.ref, { [pad]: Array.from(new Set(bijgewerkt)) });
    });
    await batch.commit();
  }
  return treffers.length;
}

// Leidt de oude/nieuwe `code` af uit een onDocumentWritten-event op een
// config-collectie. Retourneert null als er niets te cascaderen valt
// (aanmaken, of een wijziging die de code niet raakt).
function codeWijziging(event) {
  const voor = event.data.before?.exists ? event.data.before.data() : null;
  const na = event.data.after?.exists ? event.data.after.data() : null;
  const oud = voor?.code ?? null;
  const nieuw = na?.code ?? null;   // null ⇒ document verwijderd
  if (!oud) return null;            // aanmaken: geen bestaande verwijzingen
  if (oud === nieuw) return null;   // enkel een ander veld gewijzigd
  return { oud, nieuw };
}

// categorieen.code → groepen.categorieen[] + users voorkeuren wedstrijden.categorieen[]
exports.cascadeCategorie = onDocumentWritten({ ...CASCADE_OPTS, document: "categorieen/{id}" }, async (event) => {
  const w = codeWijziging(event);
  if (!w) return;
  const db = admin.firestore();
  try {
    await cascadeArrayVeld(db, "groepen", "categorieen", w.oud, w.nieuw);
    await cascadeVoorkeurArray(db, "wedstrijden", "categorieen", w.oud, w.nieuw);
  } catch (e) { console.error("cascadeCategorie mislukt:", e.message); }
});

// lesgeverTypes.code → lesgevers.type
exports.cascadeLesgeverType = onDocumentWritten({ ...CASCADE_OPTS, document: "lesgeverTypes/{id}" }, async (event) => {
  const w = codeWijziging(event);
  if (!w) return;
  const db = admin.firestore();
  try { await cascadeScalarVeld(db, "lesgevers", "type", w.oud, w.nieuw); }
  catch (e) { console.error("cascadeLesgeverType mislukt:", e.message); }
});

// communicatieCategorieen.code → communications.categorie
exports.cascadeCommunicatieCategorie = onDocumentWritten({ ...CASCADE_OPTS, document: "communicatieCategorieen/{id}" }, async (event) => {
  const w = codeWijziging(event);
  if (!w) return;
  const db = admin.firestore();
  try { await cascadeScalarVeld(db, "communications", "categorie", w.oud, w.nieuw); }
  catch (e) { console.error("cascadeCommunicatieCategorie mislukt:", e.message); }
});

// techniekCategorieen.code → technieken.type
exports.cascadeTechniekCategorie = onDocumentWritten({ ...CASCADE_OPTS, document: "techniekCategorieen/{id}" }, async (event) => {
  const w = codeWijziging(event);
  if (!w) return;
  const db = admin.firestore();
  try { await cascadeScalarVeld(db, "technieken", "type", w.oud, w.nieuw); }
  catch (e) { console.error("cascadeTechniekCategorie mislukt:", e.message); }
});

// gordels.code → members.gordel. Enkel bij hernoemen: bij verwijderen behouden
// we de opgeslagen gordel op het lid i.p.v. ledendata te wissen.
exports.cascadeGordel = onDocumentWritten({ ...CASCADE_OPTS, document: "gordels/{id}" }, async (event) => {
  const w = codeWijziging(event);
  if (!w || w.nieuw == null) return;
  const db = admin.firestore();
  try { await cascadeScalarVeld(db, "members", "gordel", w.oud, w.nieuw); }
  catch (e) { console.error("cascadeGordel mislukt:", e.message); }
});

// Groepen worden via doc-ID gerefereerd, niet via een code → hernoemen werkt
// vanzelf (namen worden live opgezocht op id). Enkel verwijderen vereist het
// opschonen van wees-ID's uit users/members en notificatievoorkeuren.
exports.cascadeGroepVerwijderd = onDocumentDeleted({ ...CASCADE_OPTS, document: "groepen/{groepId}" }, async (event) => {
  const db = admin.firestore();
  const groepId = event.params.groepId;
  try {
    await cascadeArrayVeld(db, "users", "groepen", groepId, null);
    await cascadeArrayVeld(db, "members", "groepen", groepId, null);
    await cascadeVoorkeurArray(db, "trainerHerinnering", "groepen", groepId, null);
  } catch (e) { console.error("cascadeGroepVerwijderd mislukt:", e.message); }
});

// ─── CUSTOM CLAIMS ────────────────────────────────────────────────────────────
// Synchroniseert de rol uit het user-document naar een Firebase Auth custom claim
// (request.auth.token.rol). Hierdoor kunnen Firestore- én Storage-rules de rol
// lezen zonder extra get()-reads per request (zie rol() in firestore.rules).
// De claim wordt actief in een verse ID-token (na opnieuw inloggen of de
// automatische token-refresh, ~1u); tot dan vallen de rules terug op get().
exports.syncRolClaim = onDocumentWritten({
  document: "users/{uid}",
  region: "europe-west1",
}, async (event) => {
  const uid = event.params.uid;
  const na = event.data.after?.exists ? event.data.after.data() : null;
  const voor = event.data.before?.exists ? event.data.before.data() : null;

  // Document verwijderd → rol-claim opruimen.
  if (!na) {
    try { await admin.auth().setCustomUserClaims(uid, null); }
    catch (e) { console.warn(`syncRolClaim: claim wissen mislukt voor ${uid}:`, e.message); }
    return;
  }

  const nieuweRol = na.rol || "lid";
  if (voor && (voor.rol || "lid") === nieuweRol) return; // rol ongewijzigd → niets doen

  try {
    const user = await admin.auth().getUser(uid);
    const huidigeClaims = user.customClaims || {};
    if (huidigeClaims.rol === nieuweRol) return;
    // Enkel 'rol' beheren — nooit andere claims overnemen of doorgeven.
    await admin.auth().setCustomUserClaims(uid, { rol: nieuweRol });
  } catch (e) {
    // Een users/{uid}-doc hoeft niet altijd te matchen met een Auth-account
    // (bv. een record vóór de eerste login) → log enkel, geen harde fout.
    console.warn(`syncRolClaim: claim zetten mislukt voor ${uid}:`, e.message);
  }
});

// ─── LID-KOPPELING ───────────────────────────────────────────────────────────
// Koppelt een user-account server-side aan een lid op basis van e-mailadres.
// Triggert bij elke write op users/{uid}; doet niets als linkedMemberId al
// aanwezig is in het bijgewerkte document. onDocumentWritten dekt zowel
// nieuwe accounts (create) als bestaande accounts zonder koppeling (elke update
// triggert opnieuw totdat de koppeling gezet is).
// Beide schrijfacties (user-doc + member reverse-link) lopen via de admin SDK
// en vereisen geen Firestore-rules aanpassing.
exports.koppelLidViaEmail = onDocumentWritten({
  document: "users/{uid}",
  region: "europe-west1",
}, async (event) => {
  const uid = event.params.uid;
  const na = event.data.after?.exists ? event.data.after.data() : null;

  // Document verwijderd of linkedMemberId al aanwezig: niets doen.
  if (!na || na.linkedMemberId) return;

  const db = admin.firestore();

  // ── Stap 1: koppelen op e-mailadres ────────────────────────────────────────
  const email = na.email;
  if (email) {
    let snap;
    try {
      snap = await db.collection("members").where("email", "==", email).get();
    } catch (e) {
      console.warn(`koppelLidViaEmail: members-query mislukt voor ${uid}:`, e.message);
    }

    if (snap) {
      const actief = snap.docs.filter(d => {
        const m = d.data();
        return m.actief !== false && m.active !== false;
      });

      if (actief.length === 1) {
        await koppelLidAanUser(db, uid, actief[0]);
        return;
      }
      if (actief.length > 1) {
        console.log(`koppelLidViaEmail: ambigue e-mailmatch voor ${uid} — ${actief.length} leden gevonden`);
        return;
      }
      console.log(`koppelLidViaEmail: geen e-mailmatch voor ${uid} (${email}), val terug op naam+geboortedatum`);
    }
  }

  // ── Stap 2: koppelen op volledige naam + geboortedatum (fallback bij launch) ──
  // Triggert opnieuw na onboarding omdat de geboortedatum dan pas beschikbaar is.
  const userNaam = normaliseerNaam(na.naam);
  const userGeboortedatum = na.geboortedatum || null; // 'YYYY-MM-DD'
  if (!userNaam || !userGeboortedatum) {
    console.log(`koppelLidViaEmail: naam of geboortedatum ontbreekt voor ${uid}, overgeslagen`);
    return;
  }

  let alleSnap;
  try {
    alleSnap = await db.collection("members").get();
  } catch (e) {
    console.warn(`koppelLidViaEmail: leden-scan mislukt voor ${uid}:`, e.message);
    return;
  }

  const matches = alleSnap.docs.filter(d => {
    const m = d.data();
    if (m.actief === false || m.active === false) return false;
    if (m.linkedUserId) return false; // al gekoppeld aan een ander account
    if (m.geboortedatum !== userGeboortedatum) return false;
    return normaliseerNaam(m.naam) === userNaam;
  });

  if (matches.length !== 1) {
    console.log(`koppelLidViaEmail: naam+geboortedatum fallback voor ${uid} — ${matches.length} matches gevonden`);
    return;
  }

  console.log(`koppelLidViaEmail: naam+geboortedatum match gevonden voor ${uid}`);
  await koppelLidAanUser(db, uid, matches[0]);
});

function normaliseerNaam(naam) {
  return (naam || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

async function koppelLidAanUser(db, uid, lidDoc) {
  try {
    await db.collection("users").doc(uid).update({
      linkedMemberId: lidDoc.id,
      bijgewerkt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`koppelLidViaEmail: gebruiker ${uid} gekoppeld aan lid ${lidDoc.id}`);
  } catch (e) {
    console.error(`koppelLidViaEmail: schrijven linkedMemberId mislukt voor ${uid}:`, e.message);
    return;
  }
  try {
    await db.collection("members").doc(lidDoc.id).update({ linkedUserId: uid });
  } catch (e) {
    console.warn(`koppelLidViaEmail: reverse-link op member ${lidDoc.id} mislukt (niet kritiek):`, e.message);
  }

  // Controleer of dit lid al ouder(s)/beheerder(s) heeft via eerder goedgekeurde gezinslinks.
  // Als een ouder eerder de link aanvroeg, werd memberId al gezet. Nu het kind een account
  // heeft, kennen we ook het kindUid — update de link en stuur de ouder een pushmelding.
  const memberData = lidDoc.data ? lidDoc.data() : {};
  const beheerderUids = Array.isArray(memberData.beheerderUids) ? memberData.beheerderUids : [];
  if (beheerderUids.length === 0) return;

  const lidNaam = memberData.naam || "";
  for (const ouderUid of beheerderUids) {
    try {
      const linksSnap = await db.collection("gezinslinks")
        .where("ouderUid", "==", ouderUid)
        .where("memberId", "==", lidDoc.id)
        .where("status", "==", "goedgekeurd")
        .get();
      for (const linkDoc of linksSnap.docs) {
        await linkDoc.ref.update({
          kindUid: uid,
          kindGekoppeldOp: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
      await verzendNotificatie(db, "kind_heeft_account", { uid: ouderUid, lidNaam });
    } catch (e) {
      console.warn(`koppelLidAanUser: ouder ${ouderUid} notificatie/link-update mislukt:`, e.message);
    }
  }
}

// ─── GEZINSLINKS ─────────────────────────────────────────────────────────────
// Wanneer een ouder een kind toevoegt, wordt een gezinslink aangemaakt met
// status 'lookup'. Deze trigger zoekt het lid op naam+geboortedatum, zet
// memberId op de link en stuurt een melding naar admins voor goedkeuring.
exports.verwerkGezinslink = onDocumentCreated({
  document: "gezinslinks/{linkId}",
  region: "europe-west1",
}, async (event) => {
  const linkId = event.params.linkId;
  const data = event.data?.data();
  if (!data || data.status !== "lookup") return;

  const db = admin.firestore();
  const lidNaam = (data.lidNaam || "").trim();
  const lidGeboortedatum = data.lidGeboortedatum || null;

  if (!lidNaam || !lidGeboortedatum) {
    await db.collection("gezinslinks").doc(linkId).update({
      status: "niet_gevonden",
      verwerktOp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  let memberId = null;
  let lidNaamGevonden = null;

  try {
    const alleSnap = await db.collection("members").get();
    const matches = alleSnap.docs.filter(d => {
      const m = d.data();
      if (m.actief === false || m.active === false) return false;
      if (m.geboortedatum !== lidGeboortedatum) return false;
      return normaliseerNaam(m.naam) === normaliseerNaam(lidNaam);
    });
    if (matches.length === 1) {
      memberId = matches[0].id;
      lidNaamGevonden = matches[0].data().naam;
    } else {
      console.log(`verwerkGezinslink: ${matches.length} matches voor "${lidNaam}" / ${lidGeboortedatum}`);
    }
  } catch (e) {
    console.warn("verwerkGezinslink: leden-scan mislukt:", e.message);
  }

  if (!memberId) {
    await db.collection("gezinslinks").doc(linkId).update({
      status: "niet_gevonden",
      verwerktOp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return;
  }

  await db.collection("gezinslinks").doc(linkId).update({
    memberId,
    lidNaam: lidNaamGevonden || lidNaam,
    status: "pending",
    verwerktOp: admin.firestore.FieldValue.serverTimestamp(),
  });

  try {
    await verzendNotificatie(db, "gezinslink_aanvraag", {
      ouderNaam: data.ouderNaam || "",
      lidNaam: lidNaamGevonden || lidNaam,
    });
  } catch (e) {
    console.warn("verwerkGezinslink: notificatie mislukt:", e.message);
  }
});

const EXTRA_NOTIFICATIE_TYPES = ['examen', 'wedstrijd', 'evenement'];

// ─────────────────────────────────────────────────────────────────────────────
// syncNotificatieIndex — houdt instellingen/notificatieIndex up-to-date.
// Triggered bij elke write op users/{uid}.
// Schrijft de opt-in adressen per notificatietype naar een index-document,
// zodat stock/training triggers 1 document lezen ipv 500.
// ─────────────────────────────────────────────────────────────────────────────
exports.syncNotificatieIndex = onDocumentWritten(
  { document: 'users/{uid}', region: 'europe-west1' },
  async () => {
    const db = admin.firestore();
    try {
      const usersSnap = await db.collection('users').get();
      const indexData = {
        stock: [],
        training: [],
        examen: [],
        wedstrijd: [],
        evenement: [],
        bijgewerkt: admin.firestore.FieldValue.serverTimestamp(),
      };

      usersSnap.forEach((d) => {
        const u = d.data();
        const email = u.notificatieEmail || u.notificaties?.emailVoorkeur;
        if (!email) return;
        const voorkeuren = u.notificatieVoorkeuren || {};

        const stockActief =
          voorkeuren?.stock?.actief ??
          (u.notificaties?.stockMeldingenActief !== false &&
            u.notificaties?.stockAlerts === true);
        if (stockActief) indexData.stock.push(email);

        const trainingActief = voorkeuren?.training?.actief ?? true;
        if (trainingActief && (u.rol === 'trainer' || u.rol === 'bestuurslid' || u.rol === 'admin')) {
          indexData.training.push(email);
        }

        EXTRA_NOTIFICATIE_TYPES.forEach((type) => {
          if (voorkeuren?.[type]?.actief ?? true) {
            indexData[type].push(email);
          }
        });
      });

      ['stock', 'training', 'examen', 'wedstrijd', 'evenement'].forEach((k) => {
        indexData[k] = [...new Set(indexData[k])];
      });

      await db
        .collection('instellingen')
        .doc('notificatieIndex')
        .set(indexData, { merge: false });
    } catch (e) {
      console.error('syncNotificatieIndex mislukt:', e.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// updateLedenCount — houdt settings/club.ledenCount gesynchroniseerd.
// Triggered bij elke write op members/{id}.
// Gebruikt Firestore count() aggregatie — geen full-collection read.
// ─────────────────────────────────────────────────────────────────────────────
exports.updateLedenCount = onDocumentWritten(
  { document: 'members/{id}', region: 'europe-west1' },
  async () => {
    const db = admin.firestore();
    try {
      const snap = await db
        .collection('members')
        .where('actief', '!=', false)
        .count()
        .get();
      await db.collection('settings').doc('club').set(
        {
          ledenCount: snap.data().count,
          ledenCountBijgewerkt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (e) {
      console.error('updateLedenCount mislukt:', e.message);
    }
  }
);

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────
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
