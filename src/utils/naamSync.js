import { naamSleutel } from './ledenKoppeling';

// Pure planlogica voor de naam-synchronisatie (geen Firestore hier → testbaar).
// Regel: enkel herschrijven wanneer de opgeslagen naam EXACT dezelfde woorden
// bevat als "Voornaam Achternaam" van het gekoppelde lid (alleen de volgorde of
// hoofdletters verschillen). Afwijkende namen (bijnaam, andere spelling) worden
// nooit overschreven maar apart gerapporteerd.

export const TOEGELATEN_PADEN = /^(members|inschrijvingen|events\/[^/]+\/registrations|evenementen\/[^/]+\/registrations)\/[^/]+$/;
export const TOEGELATEN_VELDEN = ['naam', 'naamLower', 'judokaNaam', 'memberName'];

export const CATEGORIEEN = {
  lid: 'Leden (naam)',
  inschrijving: 'Wedstrijd-inschrijvingen',
  examen: 'Examenkandidaten',
  evenement: 'Evenement-registraties',
};

function weergaveVan(m) {
  const v = String(m?.voornaam || '').trim();
  const a = String(m?.achternaam || '').trim();
  return v && a ? `${v} ${a}` : null;
}

export function planNaamSync({ members, inschrijvingen, registrations }) {
  const perId = new Map();
  members.forEach(m => {
    const w = weergaveVan(m);
    if (w) perId.set(m.id, { weergave: w, sleutel: naamSleutel(w) });
  });

  const wijzigingen = [];
  const overgeslagen = [];

  const probeer = (categorie, path, veld, oud, memberId, extraVelden = {}) => {
    const lid = perId.get(memberId);
    if (!lid) return; // geen gesplitst lid → niets te doen
    const huidig = String(oud || '').trim();
    if (!huidig || huidig === lid.weergave) return;
    if (naamSleutel(huidig) !== lid.sleutel) {
      overgeslagen.push({ categorie, path, oud: huidig, lid: lid.weergave });
      return;
    }
    wijzigingen.push({
      categorie, path, oud: huidig, nieuw: lid.weergave,
      voor: { [veld]: oud ?? null, ...Object.fromEntries(Object.keys(extraVelden).map(k => [k, extraVelden[k].voor ?? null])) },
      patch: { [veld]: lid.weergave, ...Object.fromEntries(Object.entries(extraVelden).map(([k, v]) => [k, v.nieuw])) },
    });
  };

  members.forEach(m => {
    probeer('lid', `members/${m.id}`, 'naam', m.naam, m.id,
      { naamLower: { voor: m.naamLower, nieuw: (weergaveVan(m) || '').toLowerCase() } });
  });
  inschrijvingen.forEach(i => {
    if (i.memberId) probeer('inschrijving', i.path, 'judokaNaam', i.judokaNaam, i.memberId);
  });
  registrations.forEach(r => {
    if (r.path.startsWith('events/') && r.memberId && typeof r.memberName === 'string') {
      probeer('examen', r.path, 'memberName', r.memberName, r.memberId);
    } else if (r.path.startsWith('evenementen/')) {
      probeer('evenement', r.path, 'naam', r.naam, r.path.split('/').pop());
    }
  });

  const telling = {};
  Object.keys(CATEGORIEEN).forEach(k => { telling[k] = wijzigingen.filter(w => w.categorie === k).length; });
  return { wijzigingen, overgeslagen, telling };
}

// Valideert een (eventueel externe) back-up vóór terugzetten.
export function valideerPatches(items) {
  if (!Array.isArray(items) || items.length === 0) return 'Back-up is leeg of ongeldig.';
  for (const it of items) {
    if (!it || typeof it.path !== 'string' || !TOEGELATEN_PADEN.test(it.path)) return `Ongeldig pad: ${it?.path}`;
    if (!it.voor || typeof it.voor !== 'object') return `Ongeldige inhoud voor ${it.path}`;
    if (Object.keys(it.voor).some(k => !TOEGELATEN_VELDEN.includes(k))) return `Niet-toegelaten veld bij ${it.path}`;
  }
  return null;
}
