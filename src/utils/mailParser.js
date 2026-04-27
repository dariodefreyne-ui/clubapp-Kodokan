import { seizoenBereik } from './seizoenUtils';

export const MAANDEN_NL = {
  januari:1,februari:2,maart:3,april:4,mei:5,juni:6,
  juli:7,augustus:8,september:9,oktober:10,november:11,december:12,
};
const MAAND_RE_STR = Object.keys(MAANDEN_NL).join('|');

/**
 * Bepaal het meest logische jaar voor een dag+maand combinatie.
 * Gebruikt het huidige seizoen (sept–juni) als anker:
 *  - sept–dec  → startjaar seizoen  (bv. 2025)
 *  - jan–juni  → eindjaar seizoen   (bv. 2026)
 * Zo wordt "22 maart" altijd correct als seizoensjaar geïnterpreteerd,
 * ook als je een oude mail opnieuw verwerkt.
 */
function jaarVoorMaand(maandNr) {
  const { start, einde } = seizoenBereik(0);
  const seizoenStartJaar = parseInt(start.slice(0, 4));
  const seizoenEindeJaar = parseInt(einde.slice(0, 4));
  return maandNr >= 9 ? seizoenStartJaar : seizoenEindeJaar;
}

export function parseerMailTekst(mailTekst) {
  if (!mailTekst) return { naamJudoka: '', inschrijvingen: [] };

  let naamJudoka = '';
  // Robuustere regex: pakt alles op tot newline/tab na het label,
  // ongeacht of het scheidingsteken spatie, tab of combinatie is.
  // Oude regex faalde bij tab-scheiding (typisch bij geplakte webmail).
  const naamMatch = mailTekst.match(
    /voornaam\s+en\s+naam\s+judoka[\s\t:]+([^\n\r\t]+)/i
  );
  if (naamMatch) naamJudoka = naamMatch[1].trim();

  const footerIdx = mailTekst.search(/gewicht\s*\(|uitschrijven\s+voor/i);
  const relevantTekst = footerIdx > -1 ? mailTekst.slice(0, footerIdx) : mailTekst;

  const grenzenRe = new RegExp(`-\\s*\\d{1,2}\\s+(?:${MAAND_RE_STR})(?:\\s+\\d{4})?(?:Ja)?`, 'gi');
  const grenzen = [];
  let gm;
  while ((gm = grenzenRe.exec(relevantTekst)) !== null)
    grenzen.push({ index: gm.index, match: gm[0] });

  const inschrijvingen = [];
  for (let i = 0; i < grenzen.length; i++) {
    const grens = grenzen[i];
    const vorigeEinde = i === 0 ? 0 : grenzen[i-1].index + grenzen[i-1].match.length;
    const tornooiNaamRaw = relevantTekst.slice(vorigeEinde, grens.index).trim();

    const datumRe = new RegExp(`-\\s*(\\d{1,2})\\s+(${MAAND_RE_STR})(?:\\s+(\\d{4}))?`, 'i');
    const datumMatch = grens.match.match(datumRe);
    if (!datumMatch) continue;

    const dag   = parseInt(datumMatch[1]);
    const maand = MAANDEN_NL[datumMatch[2].toLowerCase()];
    // Expliciet jaar in de mail heeft voorrang; anders afleiden van het seizoen
    const jaar  = datumMatch[3] ? parseInt(datumMatch[3]) : jaarVoorMaand(maand);
    if (!maand) continue;

    const heeftJa = /Ja$/i.test(grens.match.trim());
    if (!tornooiNaamRaw || tornooiNaamRaw.length < 3) continue;
    if (/^(e-?mailadres|voornaam|naam\s+judoka)/i.test(tornooiNaamRaw)) continue;
    if (tornooiNaamRaw.includes('@')) continue;

    const datum = new Date(jaar, maand - 1, dag).toISOString().slice(0, 10);
    const label = `${tornooiNaamRaw} - ${dag} ${datumMatch[2]}${datumMatch[3] ? ` ${jaar}` : ''}`;
    inschrijvingen.push({ label, tornooiNaam: tornooiNaamRaw, datum, ingeschreven: heeftJa });
  }

  return { naamJudoka, inschrijvingen };
}

export function fuzzyMatch(haystack, needle) {
  if (!haystack || !needle) return false;
  const h = haystack.toLowerCase();
  const stop = new Set(['cup','van','de','het','voor','over','en','op','in','bij']);
  const woorden = needle.toLowerCase().replace(/[()[\]/]/g,' ').split(/\s+/)
    .filter(w => w.length > 2 && !stop.has(w));
  if (woorden.length === 0) return false;
  return woorden.filter(w => h.includes(w)).length >= Math.min(2, woorden.length);
}
