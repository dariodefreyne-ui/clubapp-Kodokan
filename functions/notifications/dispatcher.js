// functions/notifications/dispatcher.js
// Centrale push-notificatie dispatcher.
//
// verzendNotificatie(type, payload) bouwt op basis van het categorie-manifest:
//   1. titel / body / url (via templates uit categories.js)
//   2. de doelgroep (volgens routing-strategie)
//   3. filter op gebruikersvoorkeur (notificatieVoorkeuren) + per-toestel override (alertsOverride)
//   4. FCM multicast + opruim ongeldige tokens
//
// Bestaande triggers worden hier dunne wrappers rond.

const admin = require("firebase-admin");
const { getType, getRubriek, defaultVoorkeurenVoorRol } = require("./categories");

// ─── HELPERS ─────────────────────────────────────────────────────────────────

// Stuur FCM-multicast in batches van 500.
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

async function deactiveerInvalideTokens(db, invalidTokens) {
  if (!invalidTokens || invalidTokens.length === 0) return;
  await Promise.all(invalidTokens.map(token =>
    db.collection("notificationTokens").doc(token).set({
      active: false,
      invalidatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true })
  ));
}

// Bepaal de effectieve voorkeur voor een rubriek uit een gebruikersdoc.
// Valt terug op legacy `notificaties.*` als nieuw model nog niet aanwezig is.
function effectieveVoorkeur(userData, rubriekKey, rol) {
  const nieuw = userData?.notificatieVoorkeuren?.[rubriekKey];
  if (nieuw && typeof nieuw.actief === "boolean") {
    return nieuw;
  }

  // Lazy fallback: lees uit legacy velden zodat het systeem direct werkt
  // ná deploy, vóór de bulk-migratie loopt.
  const legacy = userData?.notificaties || {};
  const legacyMap = {
    wedstrijden: { actief: legacy.wedstrijdMeldingen !== false, categorieen: legacy.wedstrijdCategorieen || [] },
    trainerHerinnering: { actief: legacy.trainerMeldingenActief !== false, groepen: legacy.trainerGroepen || [] },
    stock: { actief: legacy.stockMeldingenActief !== false || legacy.stockAlerts === true },
  };
  if (legacyMap[rubriekKey]) return legacyMap[rubriekKey];

  // Geen legacy mapping → gebruik default voor rol
  const defaults = defaultVoorkeurenVoorRol(rol || "lid");
  return defaults[rubriekKey] || { actief: false };
}

// Geeft true als token deze rubriek mag ontvangen (override telt zwaarder dan user-voorkeur).
function tokenWilRubriek(tokenData, userVoorkeurActief) {
  const override = tokenData?.alertsOverride;
  if (override && typeof override[tokenData._rubriekKey] === "boolean") {
    return override[tokenData._rubriekKey];
  }
  return userVoorkeurActief !== false;
}

// ─── HOOFDFUNCTIE ────────────────────────────────────────────────────────────

/**
 * Verstuur een push-notificatie van het opgegeven type.
 * Voert routing, voorkeur-check en FCM-verzending uit.
 *
 * @param {Firestore} db
 * @param {string} type     - Een key uit TYPES (zie categories.js)
 * @param {object} payload  - Context voor titel/body en routing
 * @returns {{ success: number, fail: number, ontvangerUids: string[] }}
 */
async function verzendNotificatie(db, type, payload = {}) {
  const typeCfg = getType(type);
  if (!typeCfg) {
    console.warn(`[dispatcher] Onbekend push-type: ${type}`);
    return { success: 0, fail: 0, ontvangerUids: [] };
  }

  const rubriek = getRubriek(typeCfg.rubriek);
  if (!rubriek) {
    console.warn(`[dispatcher] Type ${type} verwijst naar onbekende rubriek ${typeCfg.rubriek}`);
    return { success: 0, fail: 0, ontvangerUids: [] };
  }

  // ── 1. Bouw titel/body/url uit templates ────────────────────────────────
  const title = typeCfg.titel(payload);
  const body = typeCfg.body(payload);
  const url = typeCfg.url || "/";

  if (!title || !body) {
    console.warn(`[dispatcher] ${type}: titel of body leeg, push overgeslagen`);
    return { success: 0, fail: 0, ontvangerUids: [] };
  }

  // ── 2. Bepaal kandidaat-users volgens routing ───────────────────────────
  const kandidaten = await haalKandidaten(db, typeCfg, payload);
  if (kandidaten.length === 0) {
    return { success: 0, fail: 0, ontvangerUids: [] };
  }

  // ── 3. Filter op rubriek-voorkeur per user ──────────────────────────────
  const ontvangers = kandidaten.filter(u => {
    const v = effectieveVoorkeur(u, typeCfg.rubriek, u.rol);
    if (v.actief === false) return false;

    // Categorie-routing: extra filter op categorie-overlap
    if (typeCfg.routing === "categorie") {
      const userCats = v[typeCfg.voorkeurVeld || "categorieen"] || [];
      const payloadCats = payload[typeCfg.routingPayloadVeld || "categorieen"] || [];
      if (!Array.isArray(payloadCats) || payloadCats.length === 0) return false;
      if (!Array.isArray(userCats) || userCats.length === 0) return false;
      return payloadCats.some(c => userCats.includes(c));
    }

    // Groep-routing: extra filter op groep-overlap
    if (typeCfg.routing === "groep" && payload.groepId) {
      const userGroepen = u.groepen || [];
      // Voor trainerHerinnering: gebruik voorkeur.groepen als ingesteld
      const voorkeurGroepen = v.groepen;
      if (Array.isArray(voorkeurGroepen) && voorkeurGroepen.length > 0) {
        return voorkeurGroepen.includes(payload.groepId);
      }
      return Array.isArray(userGroepen) && userGroepen.includes(payload.groepId);
    }

    return true;
  });

  if (ontvangers.length === 0) {
    return { success: 0, fail: 0, ontvangerUids: [] };
  }

  // ── 4. Haal actieve tokens op voor deze uids ────────────────────────────
  const ontvangerUids = ontvangers.map(u => u.uid).filter(Boolean);
  const tokenDocs = await haalActieveTokensVoorUids(db, ontvangerUids);

  // Markeer tokens met hun rubriek voor de override-check
  const userVoorkeurActiefMap = {};
  ontvangers.forEach(u => {
    const v = effectieveVoorkeur(u, typeCfg.rubriek, u.rol);
    userVoorkeurActiefMap[u.uid] = v.actief !== false;
  });

  const tokens = tokenDocs
    .filter(t => {
      t._rubriekKey = typeCfg.rubriek;
      const userActief = userVoorkeurActiefMap[t.uid] !== false;
      return tokenWilRubriek(t, userActief);
    })
    .map(t => t.token)
    .filter(Boolean);

  if (tokens.length === 0) {
    return { success: 0, fail: 0, ontvangerUids };
  }

  // ── 5. Verzend FCM-multicast ────────────────────────────────────────────
  const pushPayload = {
    notification: { title, body },
    data: {
      type,
      url,
      rubriek: typeCfg.rubriek,
      ...Object.fromEntries(
        Object.entries(payload).map(([k, v]) => [k, String(v == null ? "" : v)])
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

  const { success, fail, invalidTokens } = await stuurMulticast(tokens, pushPayload);
  await deactiveerInvalideTokens(db, invalidTokens);

  return { success, fail, ontvangerUids };
}

// ─── ROUTING ─────────────────────────────────────────────────────────────────

async function haalKandidaten(db, typeCfg, payload) {
  switch (typeCfg.routing) {
    case "broadcast":
    case "categorie":
    case "groep": {
      const snap = await db.collection("users").get();
      return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    }

    case "rol": {
      const rollen = typeCfg.routingDoelRollen || [];
      if (rollen.length === 0) return [];
      const snap = await db.collection("users").where("rol", "in", rollen).get();
      return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    }

    case "rolDoelgroep": {
      // payload.doelRol filtert de doelgroep verder. "alle" of leeg = iedereen.
      const doel = payload.doelRol;
      if (doel && doel !== "alle") {
        const snap = await db.collection("users").where("rol", "==", doel).get();
        return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      }
      const snap = await db.collection("users").get();
      return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    }

    case "persoonlijk": {
      const uid = payload.uid;
      if (!uid) return [];
      const doc = await db.collection("users").doc(uid).get();
      if (!doc.exists) return [];
      return [{ uid: doc.id, ...doc.data() }];
    }

    default:
      console.warn(`[dispatcher] Onbekende routing: ${typeCfg.routing}`);
      return [];
  }
}

async function haalActieveTokensVoorUids(db, uids) {
  if (uids.length === 0) return [];

  // Firestore 'in' query max 30 — chunk indien nodig
  const tokens = [];
  for (let i = 0; i < uids.length; i += 30) {
    const chunk = uids.slice(i, i + 30);
    const snap = await db.collection("notificationTokens")
      .where("active", "==", true)
      .where("uid", "in", chunk)
      .get();
    snap.forEach(d => tokens.push(d.data()));
  }
  return tokens;
}

module.exports = {
  verzendNotificatie,
  stuurMulticast,
  deactiveerInvalideTokens,
  effectieveVoorkeur,
};
