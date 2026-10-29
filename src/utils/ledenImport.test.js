import { describe, it, expect } from 'vitest';
import { parseGordel, parseDatum, verwerkRij, bouwExportRijen, normaliseerHeader } from './ledenImport';
import { naamSleutel, splitsNaam, detecteerVolgorde, lidWeergaveNaam } from './ledenKoppeling';

const gordel = {
  opties: ['wit', 'geel', 'oranje', 'groen', 'blauw', 'bruin', 'zwart'],
  labels: { geel: 'Geel (5e kyu)', zwart: 'Zwart (1e dan+)' },
  kyuMap: { wit: '6', geel: '5', oranje: '4', groen: '3', blauw: '2', bruin: '1', zwart: '0' },
};

describe('parseGordel', () => {
  it.each([['geel', 'geel'], ['Geel', 'geel'], ['5', 'geel'], ['5e kyu', 'geel'], ['kyu 3', 'groen'],
    ['Geel (5e kyu)', 'geel'], ['1e dan', 'zwart'], ['', null], ['paars', undefined]])('%s → %s', (inp, uit) => {
    expect(parseGordel(inp, gordel)).toBe(uit);
  });
});

describe('parseDatum', () => {
  it('accepteert NL en ISO, weigert onmogelijke data', () => {
    expect(parseDatum('1/08/2018')).toBe('2018-08-01');
    expect(parseDatum('2018-08-01')).toBe('2018-08-01');
    expect(parseDatum('31/02/2018')).toBeUndefined();
    expect(parseDatum('')).toBeNull();
  });
});

describe('naam', () => {
  it('sleutel is volgorde- en accentonafhankelijk', () => {
    expect(naamSleutel('Kintaert Oscar')).toBe(naamSleutel('oscar  kintaert'));
    expect(naamSleutel('Ben Yassine Naïl')).toBe(naamSleutel('Nail Ben Yassine'));
  });
  it('splitst volgens volgorde', () => {
    expect(splitsNaam('Van Dorslaer Lenn', 'achternaam-eerst')).toEqual({ voornaam: 'Lenn', achternaam: 'Van Dorslaer' });
    expect(splitsNaam('Oscar Kintaert', 'voornaam-eerst')).toEqual({ voornaam: 'Oscar', achternaam: 'Kintaert' });
  });
  it('detecteert via herhaalde achternaam', () => {
    const eerste = new Map([['goessens', 3]]);
    expect(detecteerVolgorde('Goessens Léa', new Set(), eerste, new Map())).toBe('achternaam-eerst');
    expect(detecteerVolgorde('Jan Peeters', new Set(['jan']))).toBe('voornaam-eerst');
  });
  it('weergavenaam', () => {
    expect(lidWeergaveNaam({ voornaam: 'Oscar', achternaam: 'Kintaert', naam: 'x' })).toBe('Oscar Kintaert');
    expect(lidWeergaveNaam({ naam: 'Kintaert Oscar' })).toBe('Kintaert Oscar');
  });
});

describe('verwerkRij', () => {
  const ctx = { groepNamen: ['Groep 2', 'Groep 2&3'], gordel, huidigJaar: 2026 };
  it('lege cellen komen niet in parsed (geen wissen)', () => {
    const r = verwerkRij({ Naam: 'Beckwée Liv', Geboortedatum: '16/10/2013', Gordel: '3e kyu' }, ctx);
    expect(r.errors).toEqual([]);
    expect(r.parsed).toEqual({ naam: 'Beckwée Liv', geboortedatum: '2013-10-16', gordel: 'groen' });
    expect(r.waarschuwingen).toContain('Naam niet gesplitst');
  });
  it('voornaam+achternaam en header-aliassen (BOM, kyu)', () => {
    const r = verwerkRij({ '\uFEFFVoornaam': 'Liv', achternaam: 'Beckwée', Kyu: '5', Actief: 'nee' }, ctx);
    expect(r.parsed).toMatchObject({ naam: 'Liv Beckwée', voornaam: 'Liv', achternaam: 'Beckwée', gordel: 'geel', actief: false });
    expect(normaliseerHeader('\uFEFFLid ID')).toBe('LidID');
  });
  it('geeft fouten', () => {
    const r = verwerkRij({ Voornaam: 'Liv', Gordel: 'paars', Groepen: 'Onbekend' }, ctx);
    expect(r.errors.length).toBe(3);
    expect(r.parsed).toBeNull();
  });
});

describe('bouwExportRijen', () => {
  it('bevat LidID en NL-datum', () => {
    const [r] = bouwExportRijen([{ id: 'abc', naam: 'X Y', geboortedatum: '2018-08-01', gordel: 'geel', actief: true }], { kyuMap: gordel.kyuMap, categorieVan: () => 'U9' });
    expect(r).toMatchObject({ LidID: 'abc', Geboortedatum: '01/08/2018', Kyu: '5', Actief: 'ja', Categorie: 'U9' });
  });
});

import { lidMatchtZoekterm } from './ledenKoppeling';
describe('lidMatchtZoekterm', () => {
  it('matcht volgorde-onafhankelijk en zonder accenten', () => {
    const m = { naam: 'Kintaert Oscar' };
    expect(lidMatchtZoekterm(m, 'Oscar Kintaert')).toBe(true);
    expect(lidMatchtZoekterm(m, 'kint')).toBe(true);
    expect(lidMatchtZoekterm({ naam: 'Éloïse Peeters' }, 'eloise')).toBe(true);
    expect(lidMatchtZoekterm(m, 'Oscar Peeters')).toBe(false);
    expect(lidMatchtZoekterm(m, '')).toBe(true);
  });
});
