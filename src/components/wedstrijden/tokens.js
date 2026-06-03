// src/components/wedstrijden/tokens.js
// Geen duplicaat van de centrale tokens: C wordt geïmporteerd uit
// src/styles/tokens.js en hieronder enkel doorgegeven. CATEGORIE_COLORS is
// component-specifiek (leeftijdscategorie-kleuren voor wedstrijden) en bouwt
// bovenop de centrale kleuren — daarom bewust hier lokaal gehouden.
import { C } from '../../styles/tokens';
export { C };

export const CATEGORIE_COLORS = {
  'U7':     { bg: 'rgba(251,191,36,0.15)',  color: '#d97706',  border: 'rgba(251,191,36,0.35)'  },
  'U9':     { bg: 'rgba(251,146,60,0.15)',  color: C.orange,   border: 'rgba(251,146,60,0.3)'   },
  'U11':    { bg: 'rgba(34,197,94,0.15)',   color: C.green,    border: 'rgba(34,197,94,0.3)'    },
  'U13':    { bg: 'rgba(56,189,248,0.15)',  color: C.blue,     border: 'rgba(56,189,248,0.3)'   },
  'U14':    { bg: 'rgba(167,139,250,0.15)', color: C.purple,   border: 'rgba(167,139,250,0.3)'  },
  'U15':    { bg: 'rgba(251,146,60,0.12)',  color: C.orange,   border: 'rgba(251,146,60,0.25)'  },
  'U16':    { bg: 'rgba(230,51,70,0.15)',   color: C.red,      border: 'rgba(230,51,70,0.3)'    },
  'U18':    { bg: 'rgba(56,189,248,0.12)',  color: C.blue,     border: 'rgba(56,189,248,0.25)'  },
  'U21':    { bg: 'rgba(167,139,250,0.12)', color: C.purple,   border: 'rgba(167,139,250,0.25)' },
  'U21+':   { bg: 'rgba(167,139,250,0.12)', color: C.purple,   border: 'rgba(167,139,250,0.25)' },
  'Senior': { bg: 'rgba(230,51,70,0.12)',   color: C.red,      border: 'rgba(230,51,70,0.25)'   },
};

/** Geeft de kleurstijl voor een categoriegcode. Valt terug op neutrale stijl. */
export function getCatColor(code) {
  return CATEGORIE_COLORS[code] || { bg: C.surface, color: C.textSec, border: C.border };
}

export const PROVINCES = ['ANT','LIM','OVL','WVL','VBR','JV','—'];
export const MONTHS_NL = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
