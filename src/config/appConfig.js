// src/config/appConfig.js
// Centrale plek voor alle clubconfiguratie, domein-constanten en Firestore collectienamen.

// ─── CLUB ─────────────────────────────────────────────────────────────────────
export const CLUB_NAAM = 'Judo Kodokan Merchtem';
export const CLUB_NAAM_KORT = 'Kodokan Merchtem';
export const CLUB_STORAGE_PREFIX = 'kodokan';

// ─── ROLLEN ───────────────────────────────────────────────────────────────────
export const ROLLEN = ['admin', 'bestuurslid', 'trainer', 'lid'];
export const ROL_LABELS = {
  admin: 'Admin',
  bestuurslid: 'Bestuurslid',
  trainer: 'Trainer',
  lid: 'Lid',
};

// ─── PAGINAS ──────────────────────────────────────────────────────────────────
// Enkelvoudige definitie van alle navigatie-items.
// `exact: true` = NavLink matcht alleen op exact pad (voor Dashboard '/').
// `groep`       = geeft aan in welke navigatiegroep het item valt (zie NAV_GROEPEN).
// App.jsx en Beheer gebruiken beiden deze lijst — geen duplicaat NAV_ITEMS meer.
export const ALLE_PAGINAS = [
  { pad: '/',             label: 'Dashboard',    icon: '🏠', exact: true, groep: 'club' },
  { pad: '/trainingen',   label: 'Trainingen',   icon: '🥋', groep: 'training' },
  { pad: '/leden',        label: 'Leden',        icon: '👥', groep: 'training' },
  { pad: '/technieken',   label: 'Technieken',   icon: '📖', groep: 'training' },
  { pad: '/events',       label: 'Evenementen',  icon: '📋', groep: 'evenementen' },
  { pad: '/wedstrijden',  label: 'Wedstrijden',  icon: '🏆', groep: 'evenementen' },
  { pad: '/examens',      label: 'Examens',      icon: '📘', groep: 'evenementen' },
  { pad: '/evenementen',  label: 'Evenementen',  icon: '🎉', groep: 'evenementen' },
  { pad: '/agenda',       label: 'Agenda',       icon: '📅', groep: 'evenementen' },
  { pad: '/winkel',       label: 'Winkel',       icon: '🛒', groep: 'financieel' },
  { pad: '/uitbetalingen',label: 'Uitbetalingen',icon: '💶', groep: 'financieel' },
  { pad: '/eetfestijn',   label: 'Eetfestijn',   icon: '🍝', groep: 'financieel' },
  { pad: '/communicatie', label: 'Communicatie', icon: '📣', groep: 'communicatie' },
  { pad: '/documenten',   label: 'Documenten',   icon: '📁', groep: 'communicatie' },
  { pad: '/rapporten',    label: 'Rapporten',    icon: '📊', groep: 'communicatie' },
  { pad: '/beheer',       label: 'Beheer',       icon: '🔧', groep: 'beheer' },
  { pad: '/profiel',      label: 'Mijn profiel', icon: '👤', groep: 'account' },
  { pad: '/instellingen', label: 'Instellingen', icon: '⚙️', groep: 'account' },
];

// Volgorde en labels van de navigatiegroepen
export const NAV_GROEPEN = [
  { id: 'club',         label: null },         // Dashboard: geen groep-label
  { id: 'training',     label: 'Leden & training' },
  { id: 'evenementen',  label: 'Evenementen' },
  { id: 'financieel',   label: 'Financieel' },
  { id: 'communicatie', label: 'Communicatie' },
  { id: 'beheer',       label: 'Beheer' },
  { id: 'account',      label: null },         // Account: geen label, visueel onderaan
];

export const ROL_STANDAARD_PAGINAS = {
  admin:       ['/', '/trainingen', '/leden', '/events', '/wedstrijden', '/examens', '/technieken', '/uitbetalingen', '/winkel', '/rapporten', '/communicatie', '/documenten', '/eetfestijn', '/agenda', '/evenementen', '/beheer', '/profiel', '/instellingen'],
  bestuurslid: ['/', '/trainingen', '/leden', '/events', '/wedstrijden', '/examens', '/technieken', '/uitbetalingen', '/winkel', '/rapporten', '/communicatie', '/documenten', '/eetfestijn', '/agenda', '/evenementen', '/beheer', '/profiel', '/instellingen'],
  trainer:     ['/', '/trainingen', '/events', '/wedstrijden', '/examens', '/uitbetalingen', '/winkel', '/communicatie', '/agenda', '/profiel', '/instellingen'],
  lid:         ['/', '/events', '/wedstrijden', '/examens', '/communicatie', '/agenda', '/profiel', '/instellingen'],
};

// ─── LEEFTIJDSCATEGORIEEN ─────────────────────────────────────────────────────
export const LEEFTIJDSCATEGORIEEN = [
  'U7', 'U9', 'U11', 'U13', 'U14', 'U15', 'U16', 'U18', 'U21', 'Senior',
];

// ─── LESGEVER TYPES ───────────────────────────────────────────────────────────
export const LESGEVER_TYPES = {
  aspirant: 'Aspirant-trainer',
  initiator: 'Initiator',
  trainer_b: 'Trainer B',
  trainer_a: 'Trainer A',
};

// ─── FIRESTORE COLLECTIES ─────────────────────────────────────────────────────
export const COLLECTIONS = {
  // Configureerbare lijsten (beheerbaar via Beheer > Instellingen)
  CATEGORIEEN: 'categorieen',
  LESGEVER_TYPES: 'lesgeverTypes',
  GORDELS: 'gordels',
  COMMUNICATIE_CATEGORIEEN: 'communicatieCategorieen',
  TECHNIEK_CATEGORIEEN: 'techniekCategorieen',
  USERS: 'users',
  LESGEVERS: 'lesgevers',
  GROEPEN: 'groepen',
  TRAININGEN: 'trainingen',
  TECHNIEKEN: 'technieken',
  INSTELLINGEN: 'instellingen',
  SETTINGS: 'settings',
  NOTIFICATION_TOKENS: 'notificationTokens',
  TRAINER_REMINDER_TRIGGERS: 'trainerReminderTriggers',
  PRODUCTS: 'products',
  MAIL: 'mail',
  EVENTS: 'events',
  MEMBERS: 'members',
  PUSH_TRIGGERS: 'pushTriggers',
  INSCHRIJVINGEN: 'inschrijvingen',
  // Nieuw toegevoegd:
  EXAMENS: 'examens',
  SALES: 'sales',
  TARIEVEN: 'tarieven',
  TARIEFTYPES: 'tarieftypes',
  UITBETALINGSPERIODES: 'uitbetalingsperiodes',
  STOCK_ALERTS: 'stockAlerts',
  EVENEMENTEN: 'evenementen',
  COMMUNICATIONS: 'communications',
  DOCUMENTS: 'documents',
  VERKOOPMOMENTEN: 'verkoopmomenten',
};
