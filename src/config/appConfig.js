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
export const ALLE_PAGINAS = [
  { pad: '/trainingen', label: 'Trainingen', icon: '📅' },
  { pad: '/leden', label: 'Leden', icon: '👥' },
  { pad: '/wedstrijden', label: 'Wedstrijden', icon: '🏆' },
  { pad: '/examens', label: 'Examens', icon: '📘' },
  { pad: '/technieken', label: 'Technieken', icon: '🥋' },
  { pad: '/uitbetalingen', label: 'Uitbetalingen', icon: '💶' },
  { pad: '/winkel', label: 'Winkel', icon: '🛒' },
  { pad: '/rapporten', label: 'Rapporten', icon: '📊' },
  { pad: '/communicatie', label: 'Communicatie', icon: '📣' },
  { pad: '/documenten', label: 'Documenten', icon: '📁' },
  { pad: '/eetfestijn', label: 'Eetfestijn', icon: '🍝' },
  { pad: '/agenda', label: 'Agenda', icon: '📅' },
  { pad: '/evenementen', label: 'Evenementen', icon: '🎉' },
  { pad: '/beheer', label: 'Beheer', icon: '🔧' },
  { pad: '/profiel', label: 'Mijn profiel', icon: '👤' },
  { pad: '/instellingen', label: 'Instellingen', icon: '⚙️' },
];

export const ROL_STANDAARD_PAGINAS = {
  admin: ['/trainingen', '/leden', '/wedstrijden', '/examens', '/technieken', '/uitbetalingen', '/winkel', '/rapporten', '/communicatie', '/documenten', '/eetfestijn', '/agenda', '/evenementen', '/beheer', '/profiel', '/instellingen'],
  bestuurslid: ['/trainingen', '/leden', '/wedstrijden', '/examens', '/technieken', '/uitbetalingen', '/winkel', '/rapporten', '/communicatie', '/documenten', '/eetfestijn', '/agenda', '/evenementen', '/beheer', '/profiel', '/instellingen'],
  trainer: ['/trainingen', '/wedstrijden', '/examens', '/uitbetalingen', '/winkel', '/communicatie', '/agenda', '/profiel', '/instellingen'],
  lid: ['/wedstrijden', '/examens', '/communicatie', '/agenda', '/profiel', '/instellingen'],
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
