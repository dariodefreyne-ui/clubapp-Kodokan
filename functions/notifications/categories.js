// functions/notifications/categories.js
// Centraal manifest van alle push-rubrieken en bijbehorende types.
// Eén bron van waarheid voor: welke meldingscategorieen bestaan, welke types
// erbij horen, hoe ze gerouteerd worden naar gebruikers en hoe de titel/body
// opgebouwd wordt.
//
// SYNC-VEREIST met src/notifications/notificationCategories.js (client-UI kopie)
// Laatste sync: 2026-05-30
// Bij wijziging van rubrieken/types: pas BEIDE bestanden aan en update deze datum.

// ─── RUBRIEKEN ───────────────────────────────────────────────────────────────
// Per rubriek: zichtbaarheid in UI, defaults per rol, of e-mail ook gestuurd wordt.
const RUBRIEKEN = {
  trainingen: {
    label: "Trainingen",
    sublabel: "Annulaties en verplaatsingen van trainingen",
    rollen: ["admin", "bestuurslid", "trainer", "lid"],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: true, lid: true },
    ondersteundEmail: false,
  },
  wedstrijden: {
    label: "Wedstrijden",
    sublabel: "Nieuwe tornooien, annulaties en wijzigingen",
    rollen: ["admin", "bestuurslid", "trainer", "lid"],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: true, lid: true },
    ondersteundEmail: true,
  },
  inschrijvingen: {
    label: "Inschrijvingen",
    sublabel: "Nieuwe en bevestigde inschrijvingen",
    rollen: ["admin", "bestuurslid", "trainer", "lid"],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: true, lid: false },
    ondersteundEmail: false,
  },
  examens: {
    label: "Examens",
    sublabel: "Geplande examens en uitnodigingen",
    rollen: ["admin", "bestuurslid", "trainer", "lid"],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: true, lid: false },
    ondersteundEmail: false,
  },
  graad: {
    label: "Graad toegekend",
    sublabel: "Wanneer een judoka een nieuwe gordel behaalt",
    rollen: ["admin", "bestuurslid", "trainer", "lid"],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: true, lid: true },
    ondersteundEmail: false,
  },
  trainerHerinnering: {
    label: "Trainer herinnering",
    sublabel: "Trainingen zonder ingevulde lesgever",
    rollen: ["admin", "bestuurslid", "trainer"],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: true, lid: false },
    ondersteundEmail: true,
  },
  stock: {
    label: "Stockmeldingen",
    sublabel: "Producten op 0 of lage voorraad",
    rollen: ["admin", "bestuurslid"],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: false, lid: false },
    ondersteundEmail: true,
  },
  clubBerichten: {
    label: "Clubberichten",
    sublabel: "Algemene mededelingen van de club",
    rollen: ["admin", "bestuurslid", "trainer", "lid"],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: true, lid: true },
    ondersteundEmail: false,
  },
  evenementen: {
    label: "Evenementen",
    sublabel: "Clubevenementen, opendeurdagen, BBQ, ...",
    rollen: ["admin", "bestuurslid", "trainer", "lid"],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: true, lid: true },
    ondersteundEmail: false,
  },
  nieuweLeden: {
    label: "Nieuwe leden",
    sublabel: "Wanneer iemand zich registreert",
    rollen: ["admin", "bestuurslid"],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: false, lid: false },
    ondersteundEmail: true,
  },
  bestuur: {
    label: "Bestuur",
    sublabel: "Herinneringen voor bestuursvergaderingen",
    rollen: ["admin", "bestuurslid"],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: false, lid: false },
    ondersteundEmail: true,
  },
};

// ─── TYPES ───────────────────────────────────────────────────────────────────
// Elk push-type hoort bij precies één rubriek (voor opt-in/out) en heeft
// een routing-strategie (voor de doelgroep).
//
// routing:
//   'broadcast'    — alle gebruikers met deze rubriek aan
//   'rol'          — gebruikers met rol in routingDoelRollen
//   'persoonlijk'  — gebruiker waar uid == payload.uid
//   'groep'        — gebruikers waar payload.groepId in users.groepen
//   'categorie'    — gebruikers waar voorkeur.categorieen overlapt met payload.categorieen
//   'rolDoelgroep' — doelgroep via payload.doelRollen (array van rollen) of
//                    payload.doelRol (enkele rol); leeg/"alle" = iedereen
const TYPES = {
  // ── Trainingen ─────────────────────────────────────────────────────────
  training_geannuleerd: {
    rubriek: "trainingen",
    routing: "groep",
    url: "/trainingen",
    titel: () => "Training geannuleerd",
    body: (p) => p.groepNaam
      ? `${p.groepNaam} op ${p.datum || ""} gaat niet door.`
      : `Training op ${p.datum || ""} gaat niet door.`,
  },
  training_verplaatst: {
    rubriek: "trainingen",
    routing: "groep",
    url: "/trainingen",
    titel: () => "Training verplaatst",
    body: (p) => p.groepNaam
      ? `${p.groepNaam}: ${p.oudeDatum || ""} verplaatst naar ${p.nieuweDatum || ""}.`
      : `Training verplaatst naar ${p.nieuweDatum || ""}.`,
  },
  trainer_toegewezen: {
    rubriek: "trainingen",
    routing: "persoonlijk",
    url: "/trainingen",
    titel: () => "Trainer toegewezen",
    body: (p) => p.groepNaam && p.datum
      ? `Je bent ingevuld als trainer voor ${p.groepNaam} op ${p.datum}.`
      : "Je bent ingevuld als trainer voor een training.",
  },
  trainer_reminder: {
    rubriek: "trainerHerinnering",
    routing: "persoonlijk", // gebruikt payload.uid (per lesgever opgeroepen)
    url: "/trainingen",
    titel: () => "Trainer ontbreekt",
    body: (p) => p.aantalTrainingen && Number(p.aantalTrainingen) > 1
      ? `${p.aantalTrainingen} trainingen voor ${p.groepNaam || "een groep"} zonder lesgever.`
      : `Training op ${p.datum || p.datums || ""} (${p.groepNaam || "groep"}) heeft nog geen lesgever.`,
  },
  assistent_reminder: {
    rubriek: "trainerHerinnering", // valt onder dezelfde opt-in als trainer-herinneringen
    routing: "persoonlijk", // gebruikt payload.uid (per lesgever opgeroepen)
    url: "/trainingen",
    titel: () => "Assistent ontbreekt",
    body: (p) => p.aantalTrainingen && Number(p.aantalTrainingen) > 1
      ? `${p.aantalTrainingen} trainingen voor ${p.groepNaam || "een groep"} zonder assistent.`
      : `Training op ${p.datum || p.datums || ""} (${p.groepNaam || "groep"}) heeft nog geen assistent.`,
  },

  // ── Wedstrijden ────────────────────────────────────────────────────────
  nieuw_tornooi: {
    rubriek: "wedstrijden",
    routing: "categorie",
    routingPayloadVeld: "categorieen", // payload.categorieen wordt gematcht met voorkeur.categorieen
    voorkeurVeld: "categorieen",
    url: "/wedstrijden",
    titel: () => "Nieuw tornooi",
    body: (p) => p.datum
      ? `${p.naam || "Tornooi"} op ${p.datum}${p.doelgroep ? ` (${p.doelgroep})` : ""}`
      : `${p.naam || "Tornooi"}${p.doelgroep ? ` (${p.doelgroep})` : ""}`,
  },
  tornooi_geannuleerd: {
    rubriek: "wedstrijden",
    routing: "broadcast",
    url: "/wedstrijden",
    titel: () => "Tornooi geannuleerd",
    body: (p) => p.naam
      ? `${p.naam}${p.datum ? " op " + p.datum : ""} werd geannuleerd.`
      : "Een tornooi werd geannuleerd.",
  },
  tornooi_gewijzigd: {
    rubriek: "wedstrijden",
    routing: "broadcast",
    url: "/wedstrijden",
    titel: () => "Tornooi gewijzigd",
    body: (p) => p.naam
      ? `${p.naam}: datum of locatie werd aangepast.`
      : "Een tornooi werd gewijzigd.",
  },
  kalender_overzicht: {
    rubriek: "wedstrijden",
    routing: "broadcast", // alle users met wedstrijden-voorkeur aan
    url: "/wedstrijden",
    titel: (p) => p.seizoenLabel
      ? `Kalender ${p.seizoenLabel} bijgewerkt`
      : "Wedstrijdkalender bijgewerkt",
    body: (p) => {
      const delen = [];
      if (Number(p.aantalNieuw) > 0) delen.push(`${p.aantalNieuw} nieuw`);
      if (Number(p.aantalVerwijderd) > 0) delen.push(`${p.aantalVerwijderd} verwijderd`);
      return delen.length > 0
        ? `Wijziging kalender wedstrijden — ${delen.join(", ")}`
        : "Wijziging kalender wedstrijden";
    },
  },

  // ── Inschrijvingen ─────────────────────────────────────────────────────
  inschrijving_bevestigd: {
    rubriek: "inschrijvingen",
    routing: "persoonlijk",
    url: "/wedstrijden",
    titel: () => "Inschrijving bevestigd",
    body: (p) => p.judokaNaam && p.eventNaam
      ? `${p.judokaNaam} is ingeschreven voor ${p.eventNaam}.`
      : "Een inschrijving werd bevestigd.",
  },
  nieuwe_inschrijving: {
    rubriek: "inschrijvingen",
    routing: "rol",
    routingDoelRollen: ["admin", "bestuurslid", "trainer"],
    url: "/wedstrijden",
    titel: () => "Nieuwe inschrijving",
    body: (p) => p.judokaNaam && p.eventNaam
      ? `${p.judokaNaam} werd ingeschreven voor ${p.eventNaam}.`
      : "Er is een nieuwe inschrijving.",
  },

  // ── Examens ────────────────────────────────────────────────────────────
  examen_gepland: {
    rubriek: "examens",
    routing: "rol",
    routingDoelRollen: ["admin", "bestuurslid", "trainer"],
    url: "/examens",
    titel: () => "Examen gepland",
    body: (p) => p.naam && p.datum
      ? `${p.naam} op ${p.datum}${p.locatie ? " in " + p.locatie : ""}.`
      : "Er is een nieuw examen gepland.",
  },
  uitgenodigd_examen: {
    rubriek: "examens",
    routing: "persoonlijk",
    url: "/examens",
    titel: () => "Uitgenodigd voor examen",
    body: (p) => p.judokaNaam && p.examenNaam
      ? `${p.judokaNaam} is uitgenodigd voor ${p.examenNaam}.`
      : "Je bent uitgenodigd voor een examen.",
  },

  // ── Graad ──────────────────────────────────────────────────────────────
  graad_toegekend: {
    rubriek: "graad",
    routing: "persoonlijk",
    url: "/examens",
    titel: () => "Gordel behaald!",
    body: (p) => p.judokaNaam && p.gordel
      ? `${p.judokaNaam} heeft de ${p.gordel} gordel behaald.`
      : "Er werd een gordel toegekend.",
  },

  // ── Stock ──────────────────────────────────────────────────────────────
  stock_nul: {
    rubriek: "stock",
    routing: "rol",
    routingDoelRollen: ["admin", "bestuurslid"],
    url: "/winkel",
    titel: () => "Stock op 0",
    body: (p) => `${p.naam || "Product"}${p.variant ? " " + p.variant : ""}`,
  },
  stock_laag: {
    rubriek: "stock",
    routing: "rol",
    routingDoelRollen: ["admin", "bestuurslid"],
    url: "/winkel",
    titel: () => "Lage stock",
    body: (p) => `${p.naam || "Product"}${p.variant ? " " + p.variant : ""} — nog ${p.afterStock} resterend`,
  },

  // ── Club ───────────────────────────────────────────────────────────────
  clubbericht: {
    rubriek: "clubBerichten",
    routing: "rolDoelgroep", // payload.doelRol filtert verder
    url: "/",
    titel: (p) => p.titel || "Clubbericht",
    body: (p) => p.bericht || "",
  },

  // ── Evenementen ────────────────────────────────────────────────────────
  nieuw_evenement: {
    rubriek: "evenementen",
    // payload.doelRollen (array) beperkt de doelgroep volgens de zichtbaarheid
    // van het evenement: leeg = alle leden, ["trainer","assistent",...] voor
    // een trainersevenement, ["admin","bestuurslid"] voor een bestuursevenement.
    routing: "rolDoelgroep",
    url: "/agenda",
    titel: () => "Nieuw evenement",
    body: (p) => p.datum
      ? `${p.naam || "Evenement"} op ${p.datum}`
      : `${p.naam || "Nieuw evenement"}`,
  },
  evenement_gewijzigd: {
    rubriek: "evenementen",
    routing: "broadcast",
    url: "/agenda",
    titel: () => "Evenement gewijzigd",
    body: (p) => p.naam ? `${p.naam} werd aangepast.` : "Een evenement werd gewijzigd.",
  },
  evenement_geannuleerd: {
    rubriek: "evenementen",
    routing: "broadcast",
    url: "/agenda",
    titel: () => "Evenement geannuleerd",
    body: (p) => p.naam ? `${p.naam} werd geannuleerd.` : "Een evenement werd geannuleerd.",
  },

  // ── Bestuur ────────────────────────────────────────────────────────────
  bestuursvergadering_herinnering: {
    rubriek: "bestuur",
    routing: "rol",
    routingDoelRollen: ["admin", "bestuurslid"],
    url: "/bestuur",
    titel: () => "Bestuursvergadering",
    body: (p) => p.datum
      ? `${p.titel || "Vergadering"} op ${p.datum}${p.locatie ? " — " + p.locatie : ""}`
      : `${p.titel || "Bestuursvergadering"} binnenkort`,
  },

  // ── Nieuwe leden ───────────────────────────────────────────────────────
  nieuw_lid: {
    rubriek: "nieuweLeden",
    routing: "rol",
    routingDoelRollen: ["admin", "bestuurslid"],
    url: "/leden",
    titel: () => "Nieuw lid",
    body: (p) => p.naam
      ? `${p.naam} heeft een account aangemaakt.`
      : "Er heeft zich een nieuw lid geregistreerd.",
  },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function getRubriek(rubriekKey) {
  return RUBRIEKEN[rubriekKey] || null;
}

function getType(typeKey) {
  return TYPES[typeKey] || null;
}

function defaultVoorkeurenVoorRol(rol) {
  const voorkeuren = {};
  for (const [key, rubriek] of Object.entries(RUBRIEKEN)) {
    if (rubriek.rollen.includes(rol)) {
      voorkeuren[key] = { actief: rubriek.defaultPerRol[rol] === true };
    }
  }
  return voorkeuren;
}

module.exports = {
  RUBRIEKEN,
  TYPES,
  getRubriek,
  getType,
  defaultVoorkeurenVoorRol,
};
