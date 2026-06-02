// Gedeelde constanten voor de examenpagina

export const GORDEL_KYU = {
  wit: '6', geel: '5', oranje: '4', groen: '3', blauw: '2', bruin: '1', zwart: '0',
};

export const BELTS = ['wit', 'geel', 'oranje', 'groen', 'blauw', 'bruin', 'zwart'];

export const BELT_NEXT = {
  wit: 'geel', geel: 'oranje', oranje: 'groen', groen: 'blauw',
  blauw: 'bruin', bruin: 'zwart', zwart: 'zwart',
};

export const BELT_COLORS = {
  wit:    { bg: '#fff', color: '#333', border: '1px solid #ccc' },
  geel:   { bg: '#f1c40f', color: '#333' },
  oranje: { bg: '#e67e22', color: '#fff' },
  groen:  { bg: '#27ae60', color: '#fff' },
  blauw:  { bg: '#3498db', color: '#fff' },
  bruin:  { bg: '#8B4513', color: '#fff' },
  zwart:  { bg: '#1a1a1a', color: '#fff', border: '1px solid #555' },
};

export const BELT_KYU_LABELS = {
  wit: 'Wit (6e kyu)', geel: 'Geel (5e kyu)', oranje: 'Oranje (4e kyu)',
  groen: 'Groen (3e kyu)', blauw: 'Blauw (2e kyu)', bruin: 'Bruin (1e kyu)',
  zwart: 'Zwart (1e dan+)',
};

export const TYPE_LABELS = {
  'Val': 'Vallen', 'houdgreep': 'Houdgrepen', 'Worpen': 'Worpen',
  'Verplaatsing': 'Verplaatsing', 'Transitie': 'Transitie',
  'klemmen': 'Klemmen', 'verwurgingen': 'Verwurgingen',
};

export const TYPE_VOLGORDE = [
  'Val', 'Worpen', 'houdgreep', 'Verplaatsing', 'Transitie', 'klemmen', 'verwurgingen',
];

export const DEFAULT_EXAM_CONFIG = {
  drempelGoed: 5,
  drempelUitstekend: 8,
  tekstOnvoldoende: 'Het examen werd niet behaald. Er zijn nog onvoldoende technieken die voldoende worden beheerst. We raden aan om verder te oefenen en op een later tijdstip opnieuw deel te nemen.',
  tekstGoed: 'Gefeliciteerd! Het examen werd succesvol afgelegd. De technieken worden goed beheerst en de graad kan worden toegekend.',
  tekstUitstekend: 'Uitstekend resultaat! De technieken worden op een hoog niveau beheerst. Proficiat met dit schitterend examenresultaat!',
};

export const RESULT_COLORS = {
  geslaagd: '#22C55E', niet_geslaagd: '#E63346', afwezig: '#64748B',
  pending: '#FB923C', geconfigureerd: '#38BDF8', scorend: '#38BDF8',
};

export const RESULT_LABELS = {
  geslaagd: 'Geslaagd', niet_geslaagd: 'Niet geslaagd', afwezig: 'Afwezig',
  pending: 'Wacht op examen', geconfigureerd: 'Klaar om te starten', scorend: 'Bezig',
};

export const CONCLUSIE_COLORS = {
  onvoldoende: '#E63346', goed: '#FB923C', uitstekend: '#22C55E',
};

export const CONCLUSIE_LABELS = {
  onvoldoende: 'Onvoldoende', goed: 'Goed', uitstekend: 'Uitstekend',
};
