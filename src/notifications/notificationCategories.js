// src/notifications/notificationCategories.js
// Client-zijde manifest van push-rubrieken.
// Bevat alleen UI-gerelateerde info: label, sublabel, zichtbaarheid per rol,
// defaults per rol, en sub-velden (categorieën / groepen).
//
// De server gebruikt een eigen, leidende kopie in functions/notifications/categories.js.
// Beide blijven manueel in sync — dit bestand is bewust geen build-output.

export const RUBRIEKEN = {
  trainingen: {
    label: 'Trainingen',
    sublabel: 'Annulaties en verplaatsingen van trainingen',
    rollen: ['admin', 'bestuurslid', 'trainer', 'lid'],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: true, lid: true },
    subInstellingen: [],
  },
  wedstrijden: {
    label: 'Wedstrijden',
    sublabel: 'Nieuwe tornooien, annulaties en wijzigingen',
    rollen: ['admin', 'bestuurslid', 'trainer', 'lid'],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: true, lid: true },
    subInstellingen: [
      {
        veld: 'categorieen',
        label: 'Leeftijdscategorieën',
        beschrijving: 'Krijg enkel een melding voor nieuwe tornooien in deze categorieën.',
        type: 'tagsLijst',
        opties: ['U7', 'U9', 'U11', 'U13', 'U14', 'U15', 'U16', 'U18', 'U21', 'Senior'],
      },
    ],
  },
  inschrijvingen: {
    label: 'Inschrijvingen',
    sublabel: 'Nieuwe en bevestigde inschrijvingen',
    rollen: ['admin', 'bestuurslid', 'trainer', 'lid'],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: true, lid: false },
    subInstellingen: [],
  },
  examens: {
    label: 'Examens',
    sublabel: 'Geplande examens en uitnodigingen',
    rollen: ['admin', 'bestuurslid', 'trainer', 'lid'],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: true, lid: false },
    subInstellingen: [],
  },
  graad: {
    label: 'Graad toegekend',
    sublabel: 'Wanneer een judoka een nieuwe gordel behaalt',
    rollen: ['admin', 'bestuurslid', 'trainer', 'lid'],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: true, lid: true },
    subInstellingen: [],
  },
  trainerHerinnering: {
    label: 'Trainer herinnering',
    sublabel: 'Trainingen zonder ingevulde lesgever',
    rollen: ['admin', 'bestuurslid', 'trainer'],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: true, lid: false },
    subInstellingen: [
      {
        veld: 'groepen',
        label: 'Welke groepen?',
        beschrijving: 'Krijg enkel meldingen voor trainingen van deze groepen. Leeg = alle groepen.',
        type: 'groepenLijst',
      },
    ],
  },
  stock: {
    label: 'Stockmeldingen',
    sublabel: 'Producten op 0 of lage voorraad',
    rollen: ['admin', 'bestuurslid'],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: false, lid: false },
    subInstellingen: [],
  },
  clubBerichten: {
    label: 'Clubberichten',
    sublabel: 'Algemene mededelingen van de club',
    rollen: ['admin', 'bestuurslid', 'trainer', 'lid'],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: true, lid: true },
    subInstellingen: [],
  },
  evenementen: {
    label: 'Evenementen',
    sublabel: 'Clubevenementen, opendeurdagen, BBQ, ...',
    rollen: ['admin', 'bestuurslid', 'trainer', 'lid'],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: true, lid: true },
    subInstellingen: [],
  },
  nieuweLeden: {
    label: 'Nieuwe leden',
    sublabel: 'Wanneer iemand zich registreert',
    rollen: ['admin', 'bestuurslid'],
    defaultPerRol: { admin: true, bestuurslid: true, trainer: false, lid: false },
    subInstellingen: [],
  },
};

/**
 * Lijst van rubriek-keys die zichtbaar zijn voor een gegeven rol.
 */
export function rubriekenVoorRol(rol) {
  return Object.entries(RUBRIEKEN)
    .filter(([, r]) => r.rollen.includes(rol))
    .map(([key]) => key);
}

/**
 * Bouwt een volledig voorkeurenobject met defaults voor de gegeven rol.
 * Wordt gebruikt om nieuwe gebruikers te initialiseren of als fallback bij
 * het laden.
 */
export function standaardVoorkeurenVoorRol(rol = 'lid') {
  const voorkeuren = {};
  for (const [key, rubriek] of Object.entries(RUBRIEKEN)) {
    if (!rubriek.rollen.includes(rol)) continue;
    voorkeuren[key] = { actief: rubriek.defaultPerRol[rol] === true };
    for (const sub of rubriek.subInstellingen) {
      voorkeuren[key][sub.veld] = [];
    }
  }
  return voorkeuren;
}
