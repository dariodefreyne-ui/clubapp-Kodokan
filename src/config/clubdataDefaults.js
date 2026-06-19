// src/config/clubdataDefaults.js
// Default-waarden voor de Clubdata-collecties.
// Worden gebruikt om Firestore-collecties initieel te vullen (eenmalige seed)
// en als fallback wanneer een collectie nog leeg is.

export const DEFAULT_LEEFTIJDSCATEGORIEEN = [
  { code: 'U7',        label: 'U7',         vanLeeftijd: 0,  totLeeftijd: 6,  volgorde: 10,  kleur: '#d97706', gebruikInFiltering: true },
  { code: 'U9',        label: 'U9',         vanLeeftijd: 7,  totLeeftijd: 8,  volgorde: 20,  kleur: '#fb923c', gebruikInFiltering: true },
  { code: 'U11',       label: 'U11',        vanLeeftijd: 9,  totLeeftijd: 10, volgorde: 30,  kleur: '#22c55e', gebruikInFiltering: true },
  { code: 'U13',       label: 'U13',        vanLeeftijd: 11, totLeeftijd: 12, volgorde: 40,  kleur: '#38bdf8', gebruikInFiltering: true },
  { code: 'U14',       label: 'U14',        vanLeeftijd: 13, totLeeftijd: 13, volgorde: 50,  kleur: '#a78bfa', gebruikInFiltering: true },
  { code: 'U15',       label: 'U15',        vanLeeftijd: 14, totLeeftijd: 14, volgorde: 60,  kleur: '#fb923c', gebruikInFiltering: true },
  { code: 'U16',       label: 'U16',        vanLeeftijd: 15, totLeeftijd: 15, volgorde: 70,  kleur: '#e63346', gebruikInFiltering: true },
  { code: 'U18',       label: 'U18',        vanLeeftijd: 16, totLeeftijd: 17, volgorde: 80,  kleur: '#38bdf8', gebruikInFiltering: true },
  { code: 'U21',       label: 'U21',        vanLeeftijd: 18, totLeeftijd: 20, volgorde: 90,  kleur: '#a78bfa', gebruikInFiltering: true },
  { code: 'Veteranen', label: 'Veteranen',  vanLeeftijd: 30, totLeeftijd: 99, volgorde: 100, kleur: '#0d9488', gebruikInFiltering: true },
  { code: 'V1',        label: 'V1 (30–34)', vanLeeftijd: 30, totLeeftijd: 34, volgorde: 101, kleur: '#0d9488', gebruikInFiltering: true },
  { code: 'V2',        label: 'V2 (35–39)', vanLeeftijd: 35, totLeeftijd: 39, volgorde: 102, kleur: '#0d9488', gebruikInFiltering: true },
  { code: 'V3',        label: 'V3 (40–44)', vanLeeftijd: 40, totLeeftijd: 44, volgorde: 103, kleur: '#0d9488', gebruikInFiltering: true },
  { code: 'V4',        label: 'V4 (45–49)', vanLeeftijd: 45, totLeeftijd: 49, volgorde: 104, kleur: '#0d9488', gebruikInFiltering: true },
  { code: 'V5',        label: 'V5 (50–54)', vanLeeftijd: 50, totLeeftijd: 54, volgorde: 105, kleur: '#0d9488', gebruikInFiltering: true },
  { code: 'V6',        label: 'V6 (55–59)', vanLeeftijd: 55, totLeeftijd: 59, volgorde: 106, kleur: '#0d9488', gebruikInFiltering: true },
  { code: 'V7',        label: 'V7 (60–64)', vanLeeftijd: 60, totLeeftijd: 64, volgorde: 107, kleur: '#0d9488', gebruikInFiltering: true },
  { code: 'V8',        label: 'V8 (65–69)', vanLeeftijd: 65, totLeeftijd: 69, volgorde: 108, kleur: '#0d9488', gebruikInFiltering: true },
  { code: 'V9',        label: 'V9 (70+)',   vanLeeftijd: 70, totLeeftijd: 99, volgorde: 109, kleur: '#0d9488', gebruikInFiltering: true },
];

export const DEFAULT_LESGEVER_TYPES = [
  { code: 'aspirant',  label: 'Aspirant-trainer', volgorde: 10 },
  { code: 'initiator', label: 'Initiator',        volgorde: 20 },
  { code: 'trainer_b', label: 'Trainer B',        volgorde: 30 },
  { code: 'trainer_a', label: 'Trainer A',        volgorde: 40 },
  { code: 'assistent', label: 'Assistent',        volgorde: 50 },
];

// Gordelsysteem (KYU) — kyu 6=wit ... kyu 1=bruin, kyu 0=zwart (overeenkomstig Technieken.jsx).
// Volgorde: lagere kyu = hogere graad, dus volgorde loopt op met dalende kyu.
export const DEFAULT_GORDELS = [
  { kyu: 6, code: 'wit',    label: 'Wit (6e kyu)',    kleur: '#ffffff', volgorde: 10 },
  { kyu: 5, code: 'geel',   label: 'Geel (5e kyu)',   kleur: '#f1c40f', volgorde: 20 },
  { kyu: 4, code: 'oranje', label: 'Oranje (4e kyu)', kleur: '#e67e22', volgorde: 30 },
  { kyu: 3, code: 'groen',  label: 'Groen (3e kyu)',  kleur: '#27ae60', volgorde: 40 },
  { kyu: 2, code: 'blauw',  label: 'Blauw (2e kyu)',  kleur: '#3498db', volgorde: 50 },
  { kyu: 1, code: 'bruin',  label: 'Bruin (1e kyu)',  kleur: '#8B4513', volgorde: 60 },
  { kyu: 0, code: 'zwart',  label: 'Zwart (1e dan+)', kleur: '#1a1a1a', volgorde: 70 },
];

export const DEFAULT_COMMUNICATIE_CATEGORIEEN = [
  { code: 'algemeen',    label: 'Algemeen',    kleur: '#3498db', volgorde: 10 },
  { code: 'training',    label: 'Training',    kleur: '#27ae60', volgorde: 20 },
  { code: 'wedstrijd',   label: 'Wedstrijd',   kleur: '#e67e22', volgorde: 30 },
  { code: 'examen',      label: 'Examen',      kleur: '#9b59b6', volgorde: 40 },
  { code: 'evenement',   label: 'Evenement',   kleur: '#1abc9c', volgorde: 50 },
  { code: 'belangrijk',  label: 'Belangrijk',  kleur: '#c0392b', volgorde: 60 },
];

// Tarieftypes voor uitbetalingen van lesgevers (uurloon per type).
// Komt overeen met FALLBACK_TARIEFTYPES uit Uitbetalingen.jsx
// (id-veld wordt afgeleid uit code).
export const DEFAULT_TARIEFTYPES = [
  { code: 'aspirant',  label: 'Aspirant-trainer', bedrag: 0, eenheid: 'uur', volgorde: 10 },
  { code: 'initiator', label: 'Initiator',        bedrag: 0, eenheid: 'uur', volgorde: 20 },
  { code: 'trainer_b', label: 'Trainer B',        bedrag: 0, eenheid: 'uur', volgorde: 30 },
  { code: 'trainer_a', label: 'Trainer A',        bedrag: 0, eenheid: 'uur', volgorde: 40 },
  { code: 'assistent', label: 'Assistent',        bedrag: 0, eenheid: 'uur', volgorde: 50 },
];

// Techniekcategorieën — types die in de Technieken-pagina filterbaar zijn.
// 'Alle' is implicit in de UI (geen aparte default nodig).
export const DEFAULT_TECHNIEK_CATEGORIEEN = [
  { code: 'val',          label: 'Val',          volgorde: 10 },
  { code: 'houdgreep',    label: 'Houdgreep',    volgorde: 20 },
  { code: 'verplaatsing', label: 'Verplaatsing', volgorde: 30 },
  { code: 'worpen',       label: 'Worpen',       volgorde: 40 },
  { code: 'transitie',    label: 'Transitie',    volgorde: 50 },
];

export const STANDAARD_PRODUCT_CATEGORIEEN = [
  { id: 'judogi',   label: 'Judogi',   volgorde: 1 },
  { id: 'gordel',   label: 'Gordel',   volgorde: 2 },
  { id: 'sportzak', label: 'Sportzak', volgorde: 3 },
  { id: 'hoodie',   label: 'Pull',     volgorde: 4 },
  { id: 'tshirt',   label: 'T-shirt',  volgorde: 5 },
];

// Mapping van collectienaam → default-data
export const CLUBDATA_DEFAULTS = {
  categorieen:             DEFAULT_LEEFTIJDSCATEGORIEEN,
  lesgeverTypes:           DEFAULT_LESGEVER_TYPES,
  gordels:                 DEFAULT_GORDELS,
  communicatieCategorieen: DEFAULT_COMMUNICATIE_CATEGORIEEN,
  tarieftypes:             DEFAULT_TARIEFTYPES,
  techniekCategorieen:     DEFAULT_TECHNIEK_CATEGORIEEN,
  productCategorieen:      STANDAARD_PRODUCT_CATEGORIEEN,
};
