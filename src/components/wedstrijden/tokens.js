// src/components/wedstrijden/tokens.js
// Geen duplicaat van de centrale tokens: C wordt geïmporteerd uit
// src/styles/tokens.js en hieronder enkel doorgegeven. CATEGORIE_COLORS is
// component-specifiek (leeftijdscategorie-kleuren voor wedstrijden) en bouwt
// bovenop de centrale kleuren — daarom bewust hier lokaal gehouden.
import { C } from '../../styles/tokens';
export { C };

const VET_C = { bg: 'rgba(20,184,166,0.15)', color: '#0d9488', border: 'rgba(20,184,166,0.35)' };

export const CATEGORIE_COLORS = {
  'U7':        { bg: 'rgba(251,191,36,0.15)',  color: '#d97706',  border: 'rgba(251,191,36,0.35)'  },
  'U9':        { bg: 'rgba(251,146,60,0.15)',  color: C.orange,   border: 'rgba(251,146,60,0.3)'   },
  'U11':       { bg: 'rgba(34,197,94,0.15)',   color: C.green,    border: 'rgba(34,197,94,0.3)'    },
  'U13':       { bg: 'rgba(56,189,248,0.15)',  color: C.blue,     border: 'rgba(56,189,248,0.3)'   },
  'U14':       { bg: 'rgba(167,139,250,0.15)', color: C.purple,   border: 'rgba(167,139,250,0.3)'  },
  'U15':       { bg: 'rgba(251,146,60,0.12)',  color: C.orange,   border: 'rgba(251,146,60,0.25)'  },
  'U16':       { bg: 'rgba(230,51,70,0.15)',   color: C.red,      border: 'rgba(230,51,70,0.3)'    },
  'U18':       { bg: 'rgba(56,189,248,0.12)',  color: C.blue,     border: 'rgba(56,189,248,0.25)'  },
  'U21':       { bg: 'rgba(167,139,250,0.12)', color: C.purple,   border: 'rgba(167,139,250,0.25)' },
  'U21+':      { bg: 'rgba(167,139,250,0.12)', color: C.purple,   border: 'rgba(167,139,250,0.25)' },
  'Veteranen': VET_C,
  'V1': VET_C, 'V2': VET_C, 'V3': VET_C, 'V4': VET_C, 'V5': VET_C,
  'V6': VET_C, 'V7': VET_C, 'V8': VET_C, 'V9': VET_C,
};

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * Geeft de kleurstijl voor een categoriecode.
 * Volgorde: kleur-veld uit Firestore → statische map → neutrale fallback.
 * @param {string} code
 * @param {Array=} categorieenArray  - optioneel: configCache.categorieen uit Firestore
 */
export function getCatColor(code, categorieenArray) {
  if (categorieenArray) {
    const cat = categorieenArray.find(c => c.code === code);
    if (cat?.kleur) {
      return {
        bg:     hexToRgba(cat.kleur, 0.15),
        color:  cat.kleur,
        border: hexToRgba(cat.kleur, 0.35),
      };
    }
  }
  if (CATEGORIE_COLORS[code]) return CATEGORIE_COLORS[code];
  return { bg: C.surface, color: C.textSec, border: C.border };
}

export const PROVINCES = ['ANT','LIM','OVL','WVL','VBR','JV','—'];
export const MONTHS_NL = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];
