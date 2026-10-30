import { describe, it, expect, vi } from 'vitest';

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  query: vi.fn(),
  orderBy: vi.fn(),
}));

import { berekenLidCategorieen } from './ledenCategorieen';

const jaar = new Date().getFullYear();
const cfg = [
  { code: 'U13', vanLeeftijd: 11, totLeeftijd: 12, volgorde: 10 },
  { code: 'U14', vanLeeftijd: 13, totLeeftijd: 13, volgorde: 20, extra: true },
  { code: 'U15', vanLeeftijd: 13, totLeeftijd: 14, volgorde: 30 },
  { code: 'U17', vanLeeftijd: 15, totLeeftijd: 16, volgorde: 40, extra: true },
  { code: 'U18', vanLeeftijd: 15, totLeeftijd: 17, volgorde: 50 },
  { code: 'V1', vanLeeftijd: 30, totLeeftijd: 34, volgorde: 101 },
];

describe('berekenLidCategorieen', () => {
  it('geeft hoofd + extra voor een lid in U14/U15', () => {
    expect(berekenLidCategorieen(jaar - 13, cfg)).toEqual({ hoofd: 'U15', extras: ['U14'], codes: ['U15', 'U14'] });
  });
  it('geeft hoofd + extra voor een lid in U17/U18', () => {
    expect(berekenLidCategorieen(jaar - 15, cfg).codes).toEqual(['U18', 'U17']);
  });
  it('geeft enkel hoofd als er geen extra past', () => {
    expect(berekenLidCategorieen(jaar - 11, cfg)).toEqual({ hoofd: 'U13', extras: [], codes: ['U13'] });
  });
  it('negeert veteranen-codes', () => {
    expect(berekenLidCategorieen(jaar - 32, cfg).codes).toEqual([]);
  });
  it('geeft lege indeling zonder geboortejaar', () => {
    expect(berekenLidCategorieen(null, cfg)).toEqual({ hoofd: null, extras: [], codes: [] });
  });
  it('zonder extra-vlag blijft de smalste categorie de hoofdcategorie (oud gedrag)', () => {
    const zonder = cfg.map(({ extra, ...rest }) => rest);
    expect(berekenLidCategorieen(jaar - 13, zonder).codes).toEqual(['U14']);
  });
});
