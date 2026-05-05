const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

admin.initializeApp();

// ─────────────────────────────────────────────
// HELPER: bouw HTML mail template
// ─────────────────────────────────────────────
function bouwMailHtml(titel, inhoud) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
      <div style="background: #c0392b; padding: 20px 24px;">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Kodokan Merchtem</h1>
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

// ─────────────────────────────────────────────
// HELPER: stuur mail via Trigger Email Extension
// ─────────────────────────────────────────────
async function stuurMail(db, aan, onderwerp, html) {
  if (!aan || aan.length === 0) return;
  await db.collection('mail').add({
    to: aan,
    message: { subject: onderwerp, html },
    aangemaakt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

// ─────────────────────────────────────────────
// TRIGGER 1: Stock op 0 → push + mail
// ─────────────────────────────────────────────
exports.notifyStockZero = onDocumentUpdated({
  document: 'products/{productId}',
  region: 'europe-west1',
}, async (event) => {
  const before = event.data.before.data() || {};
  const after  = event.data.after.data()  || {};

  if (after.active === false) return;

  const beforeStock = Number(before.stock ?? 0);
  const afterStock  = Number(after.stock  ?? 0);

  // Geen wijziging in stock? Stop.
  if (beforeStock === afterStock) return;

  const db = admin.firestore();

  // ── Lees configuratie ──
  let drempelLaagStock = 3;
  let vasteMails       = [];
  let stockNulActief   = true;
  let laagStockActief  = true;

  try {
    const configSnap = await db.collection('instellingen').doc('meldingen').get();
    if (configSnap.exists) {
      const cfg = configSnap.data()?.stockMeldingen || {};
      if (typeof cfg.drempelLaagStock === 'number') drempelLaagStock = cfg.drempelLaagStock;
      if (Array.isArray(cfg.vasteMails)) vasteMails = cfg.vasteMails.filter(e => !!e);
      if (typeof cfg.stockNulActief   === 'boolean') stockNulActief  = cfg.stockNulActief;
      if (typeof cfg.laagStockActief  === 'boolean') laagStockActief = cfg.laagStockActief;
    }
  } catch (e) {
    console.warn('Kon stock-config niet laden:', e.message);
  }

  const isStockNul   = beforeStock > 0 && afterStock === 0;
  const isLaagStock  = drempelLaagStock > 0 &&
                       beforeStock >= drempelLaagStock &&
                       afterStock > 0 &&
                       afterStock < drempelLaagStock;

  // Niets te melden?
  if (!isStockNul && !isLaagStock) return;
  if (isStockNul  && !stockNulActief)  return;
  if (isLaagStock && !laagStockActief) return;


  const productId  = event.params.productId;
  const naam       = after.name || after.naam || 'Product';
  const variant    = after.variant || '';
  const category   = after.category || '';
  const tweedehands = after.tweedehands === true;

  // ── Maak stockAlert document aan ──
  const alertRef = await db.collection('stockAlerts').add({
    productId, naam, variant, category, tweedehands,
    beforeStock, afterStock,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    sent: false,
  });

  // ── PUSH: haal tokens op ──
  const tokensSnap = await db.collection('notificationTokens')
    .where('active', '==', true)
    .where('stockAlerts', '==', true)
    .get();

  const tokens = [];
  tokensSnap.forEach(d => { const t = d.data().token; if (t) tokens.push(t); });

  let pushSuccess = 0;
  let pushFail    = 0;
  const invalidTokens = [];

  if (tokens.length > 0) {
    const pushPayload = {
      notification: { title: 'Stock op 0', body: `${naam} ${variant}`.trim() },
      data: {
        type: 'stock_zero', productId,
        naam: String(naam), variant: String(variant),
        category: String(category),
        tweedehands: tweedehands ? 'true' : 'false',
        url: '/winkel',
      },
      webpush: {
        fcmOptions: { link: '/winkel' },
        notification: { icon: '/pwa-192x192.png', badge: '/pwa-192x192.png' },
      },
    };

    for (let i = 0; i < tokens.length; i += 500) {
      const batch    = tokens.slice(i, i + 500);
      const response = await admin.messaging().sendEachForMulticast({ ...pushPayload, tokens: batch });
      pushSuccess   += response.successCount;
      pushFail      += response.failureCount;

      response.responses.forEach((result, idx) => {
        if (!result.success) {
          const code = result.error?.code || '';
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) invalidTokens.push(batch[idx]);
        }
      });
    }

    // Deactiveer ongeldige tokens
    await Promise.all(invalidTokens.map(token =>
      db.collection('notificationTokens').doc(token).set({
        active: false, stockAlerts: false,
        invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true })
    ));
  }

  // ── MAIL: haal adressen op van users met stockAlerts: true ──
    const usersSnap = await db.collection('users')
    .where('notificaties.stockAlerts', '==', true)
    .get();

  const adressenSet = new Set(vasteMails);
  usersSnap.forEach(d => {
    const email = d.data()?.notificaties?.emailVoorkeur;
    if (email) adressenSet.add(email);
  });
  const adressen = Array.from(adressenSet);

    let mailVerstuurd = false;
  if (adressen.length > 0) {
    const productNaam = `${naam} ${variant}`.trim();

    let mailTitel, mailOnderwerp, statusLabel, statusKleur;
    if (isStockNul) {
      mailTitel    = 'Stock op 0 — Winkel';
      mailOnderwerp = `Stock op 0: ${productNaam}`;
      statusLabel  = 'UITVERKOCHT';
      statusKleur  = '#c0392b';
    } else {
      mailTitel    = 'Lage stock — Winkel';
      mailOnderwerp = `Lage stock: ${productNaam} (nog ${afterStock})`;
      statusLabel  = `LAAG (${afterStock} resterend)`;
      statusKleur  = '#e67e22';
    }

    const inhoud = `
      <p>Het volgende product heeft een ${isStockNul ? '<strong>kritiek lage</strong>' : 'lage'} stock:</p>
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


  // ── Update stockAlert met resultaat ──
    await alertRef.update({
    sent: pushSuccess > 0 || mailVerstuurd,
    type: isStockNul ? 'stock_nul' : 'laag_stock',
    pushSuccess, pushFail,
    invalidTokens: invalidTokens.length,
    mailVerstuurd,
    mailAdressen: adressen,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
  });



// ─────────────────────────────────────────────
// TRIGGER 2: Trainer reminder — per groep, push + mail
// Draait woensdag + zaterdag om 9u
// ─────────────────────────────────────────────
exports.checkTrainingZonderLesgever = onSchedule({
  schedule: '0 9 * * *',
  region: 'europe-west1',
  timeZone: 'Europe/Brussels',
}, async () => {
  const db  = admin.firestore();

  // ── Lees configuratie uit Firestore ──
  let actiefOpDagen = [3, 6];
  let aantalDagen   = 5;
  let uitsluitZin   = 'sporthal gesloten';

  try {
    const configSnap = await db.collection('instellingen').doc('meldingen').get();
    if (configSnap.exists) {
      const cfg = configSnap.data()?.trainerReminder || {};
      if (Array.isArray(cfg.actiefOpDagen) && cfg.actiefOpDagen.length > 0) {
        actiefOpDagen = cfg.actiefOpDagen;
      }
      if (typeof cfg.aantalDagen === 'number' && cfg.aantalDagen >= 1) {
        aantalDagen = cfg.aantalDagen;
      }
      if (typeof cfg.uitsluitZin === 'string' && cfg.uitsluitZin.trim().length > 0) {
        uitsluitZin = cfg.uitsluitZin.trim().toLowerCase();
      }
    }
  } catch (e) {
    // Config niet beschikbaar, gebruik standaardwaarden
    console.warn('Kon meldingen-config niet laden, gebruik standaardwaarden:', e.message);
  }

  // ── Controleer of vandaag een actieve dag is ──
  const nu       = new Date();
  const dagNummer = nu.getDay(); // 0=zo, 1=ma, ..., 6=za
  if (!actiefOpDagen.includes(dagNummer)) return;

  const grensdatum = new Date(nu);
  grensatum.setDate(nu.getDate() + aantalDagen);

  const vandaag = nu.toISOString().slice(0, 10);
  const grens   = grensatum.toISOString().slice(0, 10);


  // ── Haal trainingen op zonder lesgever de komende 5 dagen ──
  const snap = await db.collection('trainingen')
    .where('datum', '>=', vandaag)
    .where('datum', '<=', grens)
    .get();

  if (snap.empty) return;

  // Groepeer probleemtrainingen per groepId
  const probleemPerGroep = {}; // { groepId: [{ id, datum }] }

  snap.forEach(docSnap => {
    const t = docSnap.data();
    const lesgevers = Array.isArray(t.lesgevers) ? t.lesgevers : [];
    const opmerking = (t.opmerking || '').toLowerCase();
       const isUitgesloten = uitsluitZin ? opmerking.includes(uitsluitZin) : false;

    if (lesgevers.length === 0 && !isUitgesloten) {

      const groepId = t.groepId || '_onbekend';
      if (!probleemPerGroep[groepId]) probleemPerGroep[groepId] = [];
      probleemPerGroep[groepId].push({ id: docSnap.id, datum: t.datum });
    }
  });

  if (Object.keys(probleemPerGroep).length === 0) return;

  // ── Haal alle lesgevers op (voor groepkoppeling + uid) ──
  const lesgeversSnap = await db.collection('lesgevers').get();
  const lesgevers = [];
  lesgeversSnap.forEach(d => lesgevers.push({ id: d.id, ...d.data() }));

  // ── Haal alle users op om emailVoorkeur te vinden via uid ──
  const usersSnap = await db.collection('users').get();
  const usersByUid = {};
  usersSnap.forEach(d => { usersByUid[d.data().uid || d.id] = d.data(); });

  // ── Verzamel alle tokens voor push (trainer + beheerder) ──
  const alleTokensSnap = await db.collection('notificationTokens')
    .where('active', '==', true)
    .where('rol', 'in', ['trainer', 'beheerder'])
    .get();
  const alleTrainerTokensMap = {}; // uid → [token]
  alleTokensSnap.forEach(d => {
    const data = d.data();
    if (!data.uid || !data.token) return;
    if (!alleTrainerTokensMap[data.uid]) alleTrainerTokensMap[data.uid] = [];
    alleTrainerTokensMap[data.uid].push(data.token);
  });

  // ── Verwerk per groep ──
  const logItems = [];
  const invalidTokens = [];

  for (const [groepId, trainingen] of Object.entries(probleemPerGroep)) {
    // Vind lesgevers die verantwoordelijk zijn voor deze groep
    const verantwoordelijken = lesgevers.filter(l =>
      Array.isArray(l.groepen) && l.groepen.includes(groepId) && l.actief !== false
    );

    // Als geen verantwoordelijke gevonden → stuur naar alle beheerders
    const doelwitten = verantwoordelijken.length > 0
      ? verantwoordelijken
      : lesgevers.filter(l => l.actief !== false);

    const datums = trainingen.map(t => t.datum).join(', ');
    const aantalTrainingen = trainingen.length;

    for (const lesgever of doelwitten) {
      const uid = lesgever.uid;
      if (!uid) continue;

      const userData = usersByUid[uid];
      const emailVoorkeur = userData?.notificaties?.emailVoorkeur || lesgever.email;
      const tokens = alleTrainerTokensMap[uid] || [];

      // ── PUSH per lesgever ──
      let pushSuccess = 0;
      if (tokens.length > 0) {
        const pushPayload = {
          notification: {
            title: 'Trainer ontbreekt',
            body: aantalTrainingen === 1
              ? `Training op ${trainingen[0].datum} (${groepId}) heeft nog geen lesgever.`
              : `${aantalTrainingen} trainingen voor ${groepId} zonder lesgever.`,
          },
          data: {
            type: 'trainer_reminder',
            groepId: String(groepId),
            aantalTrainingen: String(aantalTrainingen),
            datums,
            url: '/trainingen',
          },
          webpush: {
            fcmOptions: { link: '/trainingen' },
            notification: { icon: '/pwa-192x192.png', badge: '/pwa-192x192.png' },
          },
        };

        for (let i = 0; i < tokens.length; i += 500) {
          const batch    = tokens.slice(i, i + 500);
          const response = await admin.messaging().sendEachForMulticast({ ...pushPayload, tokens: batch });
          pushSuccess   += response.successCount;

          response.responses.forEach((result, idx) => {
            if (!result.success) {
              const code = result.error?.code || '';
              if (
                code === 'messaging/registration-token-not-registered' ||
                code === 'messaging/invalid-registration-token'
              ) invalidTokens.push(batch[idx]);
            }
          });
        }
      }

      // ── MAIL per lesgever ──
      let mailVerstuurd = false;
      if (emailVoorkeur) {
        const rijen = trainingen.map(t =>
          `<tr>
            <td style="padding:8px 12px; border-bottom:1px solid #eee;">${t.datum}</td>
            <td style="padding:8px 12px; border-bottom:1px solid #eee; color:#e67e22; font-weight:bold;">Geen lesgever</td>
          </tr>`
        ).join('');

        const inhoud = `
          <p>Voor de groep <strong>${groepId}</strong> zijn er de komende 5 dagen trainingen zonder ingevulde lesgever:</p>
          <table style="width:100%; border-collapse:collapse; margin-top:12px;">
            <tr style="background:#f5f5f5;">
              <th style="padding:8px 12px; text-align:left;">Datum</th>
              <th style="padding:8px 12px; text-align:left;">Status</th>
            </tr>
            ${rijen}
          </table>
          <p style="margin-top:16px;">
            Gelieve een lesgever in te vullen via de Kodokan Clubapp onder <strong>Trainingen</strong>.
          </p>
          <p style="color:#888; font-size:13px;">
            Indien de sporthal gesloten is, vermeld dit dan in de opmerking van de training — dan stopt deze melding automatisch.
          </p>
        `;

        const onderwerp = aantalTrainingen === 1
          ? `Trainer ontbreekt: ${trainingen[0].datum} — ${groepId}`
          : `${aantalTrainingen} trainingen zonder lesgever — ${groepId}`;

        await stuurMail(
          db,
          [emailVoorkeur],
          onderwerp,
          bouwMailHtml('Trainer ontbreekt', inhoud)
        );
        mailVerstuurd = true;
      }

      logItems.push({
        lesgeverId: lesgever.id, uid, groepId,
        aantalTrainingen, datums,
        pushVerstuurd: pushSuccess > 0,
        mailVerstuurd,
      });
    }
  }

  // Deactiveer ongeldige tokens
  await Promise.all(invalidTokens.map(token =>
    db.collection('notificationTokens').doc(token).set({
      active: false,
      invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  ));

  // Log de uitvoering
    await db.collection('trainerReminders').add({
    uitgevoerdOp: admin.firestore.FieldValue.serverTimestamp(),
    probleemPerGroep,
    logItems,
    invalidTokens: invalidTokens.length,
    gebruikteConfig: { actiefOpDagen, aantalDagen, uitsluitZin },
  });

});

// ─────────────────────────────────────────────
// TRIGGER 3: Nieuw wedstrijdevenement → push + mail
// Filtert op notificaties.wedstrijdCategorieen per trainer
// Collectie: 'events' (wedstrijden worden opgeslagen als type: 'wedstrijd')
// ─────────────────────────────────────────────
exports.notifyNieuweWedstrijd = onDocumentCreated({
  document: 'events/{eventId}',
  region: 'europe-west1',
}, async (event) => {
  const data = event.data.data();

  // Enkel reageren op wedstrijden
  if (data.type !== 'wedstrijd') return;

  const db       = admin.firestore();
  const naam     = data.naam || data.title || 'Nieuw tornooi';
  const datum    = data.datum || '';
  const doelgroep = data.doelgroep || '';

  // Splits doelgroep in individuele categorieen (bv. 'U11-U13' → ['U11','U13'])
  const categorieenEvent = doelgroep
    .split(/[-\/]/)
    .map(s => s.trim())
    .filter(Boolean);

  if (categorieenEvent.length === 0) return;

  // ── Haal alle users op met notificaties.wedstrijdCategorieen ──
  const usersSnap = await db.collection('users').get();
  const doelwitten = []; // { uid, email, naam }

  usersSnap.forEach(d => {
    const u = d.data();
    const voorkeur = u.notificaties?.wedstrijdCategorieen || [];
    if (!Array.isArray(voorkeur) || voorkeur.length === 0) return;

    // Controleer of minstens een categorie van het event overeenkomt
    const match = categorieenEvent.some(cat => voorkeur.includes(cat));
    if (!match) return;

    const emailVoorkeur = u.notificaties?.emailVoorkeur || u.email;
    if (emailVoorkeur) {
      doelwitten.push({ uid: d.id, email: emailVoorkeur, naam: u.naam || '' });
    }
  });

  if (doelwitten.length === 0) return;

  // ── Haal push tokens op ──
  const tokensSnap = await db.collection('notificationTokens')
    .where('active', '==', true)
    .where('rol', 'in', ['trainer', 'beheerder'])
    .get();

  const tokensByUid = {};
  tokensSnap.forEach(d => {
    const t = d.data();
    if (!t.uid || !t.token) return;
    if (!tokensByUid[t.uid]) tokensByUid[t.uid] = [];
    tokensByUid[t.uid].push(t.token);
  });

  const invalidTokens = [];

  for (const doelwit of doelwitten) {
    const tokens = tokensByUid[doelwit.uid] || [];

    // ── PUSH ──
    if (tokens.length > 0) {
      const pushPayload = {
        notification: {
          title: 'Nieuw tornooi',
          body: datum
            ? `${naam} op ${datum} (${doelgroep})`
            : `${naam} (${doelgroep})`,
        },
        data: {
          type: 'nieuw_wedstrijd',
          naam,
          datum,
          doelgroep,
          url: '/wedstrijden',
        },
        webpush: {
          fcmOptions: { link: '/wedstrijden' },
        },
      };

      const messaging = admin.messaging();
      for (const token of tokens) {
        try {
          await messaging.send({ ...pushPayload, token });
        } catch (err) {
          if (
            err.code === 'messaging/registration-token-not-registered' ||
            err.code === 'messaging/invalid-registration-token'
          ) {
            invalidTokens.push(token);
          }
        }
      }
    }

    // ── MAIL ──
    const inhoud = `
      <p>Er is een nieuw tornooi toegevoegd in de Kodokan Clubapp:</p>
      <table style="width:100%; border-collapse:collapse; margin-top:12px;">
        <tr style="background:#f5f5f5;">
          <th style="padding:8px 12px; text-align:left;">Tornooi</th>
          <th style="padding:8px 12px; text-align:left;">Datum</th>
          <th style="padding:8px 12px; text-align:left;">Doelgroep</th>
        </tr>
        <tr>
          <td style="padding:8px 12px; border-bottom:1px solid #eee;">${naam}</td>
          <td style="padding:8px 12px; border-bottom:1px solid #eee;">${datum || '—'}</td>
          <td style="padding:8px 12px; border-bottom:1px solid #eee;">${doelgroep || '—'}</td>
        </tr>
      </table>
      <p style="margin-top:16px;">
        Bekijk de details en schrijf judoka's in via de Kodokan Clubapp onder <strong>Wedstrijden</strong>.
      </p>
      <p style="color:#888; font-size:13px;">
        Wijzig je meldingsvoorkeuren via je profiel in de app.
      </p>
    `;

    await stuurMail(
      db,
      [doelwit.email],
      datum ? `Nieuw tornooi: ${naam} op ${datum}` : `Nieuw tornooi: ${naam}`,
      bouwMailHtml('Nieuw tornooi toegevoegd', inhoud)
    );
  }

  // Deactiveer ongeldige tokens
  await Promise.all(invalidTokens.map(token =>
    db.collection('notificationTokens').doc(token).set({
      active: false,
      invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  ));
});
