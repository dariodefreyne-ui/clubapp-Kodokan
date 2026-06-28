// Gedeelde constanten voor agenda-onderdelen (Agenda-pagina + dashboard widgets)

export const TYPE_KLEUREN = {
  training:       '#2980b9',
  wedstrijd:      '#e67e22',
  examen:         '#27ae60',
  evenement:      '#8e44ad',
  clubactiviteit: '#8e44ad',
  stage:          '#16a085',
  meeting:        '#7f8c8d',
  tornooi:        '#e67e22',
  overig:         '#555555',
};

export const TYPE_LABELS = {
  training:       'Training',
  wedstrijd:      'Wedstrijd',
  examen:         'Examen',
  clubactiviteit: 'Clubactiviteit',
  stage:          'Stage',
  meeting:        'Meeting',
  tornooi:        'Tornooi',
  overig:         'Overig',
};

export const TYPE_EMOJI = {
  training:       '🥋',
  wedstrijd:      '🏆',
  examen:         '📋',
  clubactiviteit: '📅',
  stage:          '📅',
  meeting:        '📅',
  tornooi:        '🏆',
  overig:         '📅',
};

export const DAGEN_KORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
export const MAANDEN_NL = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];

export const AGENDA_KLEUREN_DEFAULTS = TYPE_KLEUREN;

// Geeft de kleur voor een agenda-type, met voorrang voor een beheerder-
// geconfigureerde kleur (configCache.agendaCategorieen) boven de defaults.
export function getAgendaKleur(type, configCategorieen = []) {
  const cat = configCategorieen.find(c => c.id === type || c.code === type);
  return cat?.kleur || AGENDA_KLEUREN_DEFAULTS[type] || AGENDA_KLEUREN_DEFAULTS.overig;
}

export function typeKleur(type, configCategorieen) {
  if (configCategorieen) return getAgendaKleur(type, configCategorieen);
  return TYPE_KLEUREN[type] || TYPE_KLEUREN.overig;
}

export function typeLabel(type) {
  return TYPE_LABELS[type] || 'Overig';
}

export function typeEmoji(type) {
  return TYPE_EMOJI[type] || '📅';
}
