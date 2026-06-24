import { describe, it, expect, vi } from 'vitest';

// categorieLogica.js imports `db` from ../firebase at module scope, which would
// otherwise initialize a real Firebase app (and fail without env vars). Only
// the pure exports are under test here, so the hooks' Firestore calls are stubbed.
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({ docs: [] }),
  query: vi.fn(),
  orderBy: vi.fn(),
}));

import {
  catCodes,
  filterbareCategorieen,
  isVetCode,
  parseerDoelgroepArray,
  berekenLeeftijd,
  berekenCategorieen,
  berekenRuweCategorie,
  parseerToegelatenCategorieen,
  vetSubcatsVoorConfig,
  berekenVeteranenSubcat,
  berekenCategorie,
} from './categorieLogica';

// All tests below rely on DEFAULT_LEEFTIJDSCATEGORIEEN (src/config/clubdataDefaults.js),
// used automatically whenever no categorieenConfig is passed:
// U7 0-6, U9 7-8, U11 9-10, U13 11-12, U14 13, U15 14, U16 15, U18 16-17, U21 18-20,
// Veteranen 30-99, V1 30-34 ... V9 70-99.

describe('isVetCode', () => {
  it('matches the "Veteranen" code', () => {
    expect(isVetCode('Veteranen')).toBe(true);
  });

  it('matches V<n> codes', () => {
    expect(isVetCode('V1')).toBe(true);
    expect(isVetCode('V9')).toBe(true);
  });

  it('rejects regular age codes', () => {
    expect(isVetCode('U13')).toBe(false);
    expect(isVetCode('')).toBe(false);
    expect(isVetCode(undefined)).toBe(false);
  });
});

describe('catCodes / filterbareCategorieen', () => {
  it('returns codes sorted by volgorde', () => {
    const codes = catCodes();
    expect(codes[0]).toBe('U7');
    expect(codes).toContain('U21');
  });

  it('filters to categories flagged for filtering', () => {
    const filtered = filterbareCategorieen();
    expect(filtered.every(c => c.gebruikInFiltering === true)).toBe(true);
  });
});

describe('parseerDoelgroepArray', () => {
  it('passes arrays through unchanged', () => {
    expect(parseerDoelgroepArray(['U11', 'U13'])).toEqual(['U11', 'U13']);
  });

  it('parses legacy hyphen-string format', () => {
    expect(parseerDoelgroepArray('U11-U13')).toEqual(['U11', 'U13']);
  });

  it('parses legacy slash-string format', () => {
    expect(parseerDoelgroepArray('U11/U13')).toEqual(['U11', 'U13']);
  });

  it('returns an empty array for falsy input', () => {
    expect(parseerDoelgroepArray(null)).toEqual([]);
    expect(parseerDoelgroepArray('')).toEqual([]);
  });
});

describe('berekenLeeftijd', () => {
  it('computes age from birth year and a reference date', () => {
    expect(berekenLeeftijd(2017, '2024-01-01')).toBe(7);
  });

  it('accepts a reference year as a number', () => {
    expect(berekenLeeftijd(2017, 2024)).toBe(7);
  });

  it('defaults to the current year when no reference is given', () => {
    const expected = new Date().getFullYear() - 2000;
    expect(berekenLeeftijd(2000)).toBe(expected);
  });

  it('returns null when geboortejaar is falsy', () => {
    expect(berekenLeeftijd(null, '2024-01-01')).toBeNull();
  });
});

describe('berekenCategorieen', () => {
  it('returns all overlapping categories for veteran ages', () => {
    // born 1989 -> age 35 in 2024: matches "Veteranen" (30-99) and "V2" (35-39)
    const matches = berekenCategorieen(1989, '2024-01-01').map(c => c.code);
    expect(matches).toEqual(expect.arrayContaining(['Veteranen', 'V2']));
  });

  it('returns an empty array when geboortejaar is missing', () => {
    expect(berekenCategorieen(null, '2024-01-01')).toEqual([]);
  });
});

describe('berekenRuweCategorie', () => {
  it('classifies age 7 as U9', () => {
    expect(berekenRuweCategorie(2017, '2024-01-01')).toBe('U9');
  });

  it('classifies age 0 as U7', () => {
    expect(berekenRuweCategorie(2024, '2024-01-01')).toBe('U7');
  });

  it('returns null when only veteran codes match (excluded from "ruwe" category)', () => {
    // born 1989 -> age 35 in 2024: only Veteranen/V2 match, both vet codes
    expect(berekenRuweCategorie(1989, '2024-01-01')).toBeNull();
  });

  it('picks the narrowest range when categories overlap', () => {
    // age 18 in 2024 (born 2006) matches only U21 (18-20) among non-vet codes
    expect(berekenRuweCategorie(2006, '2024-01-01')).toBe('U21');
  });
});

describe('parseerToegelatenCategorieen', () => {
  it('returns all codes when doelgroep is whitespace-only (empty after stripping)', () => {
    const allCodes = catCodes();
    expect(parseerToegelatenCategorieen(' ', null)).toEqual(allCodes);
  });

  it('returns all codes when doelgroep contains "ALLE"', () => {
    const allCodes = catCodes();
    expect(parseerToegelatenCategorieen('ALLE', null)).toEqual(allCodes);
  });

  it('returns the array as-is for non-empty array doelgroep', () => {
    expect(parseerToegelatenCategorieen(['U11', 'U13'], null)).toEqual(['U11', 'U13']);
  });

  it('returns null when doelgroep is falsy', () => {
    expect(parseerToegelatenCategorieen(null, null)).toBeNull();
  });

  it('expands "U18+" to U18 and every later category', () => {
    const result = parseerToegelatenCategorieen('U18+', null);
    expect(result).toContain('U18');
    expect(result).toContain('U21');
    expect(result).not.toContain('U16');
  });
});

describe('vetSubcatsVoorConfig', () => {
  it('returns only V<n> codes, excluding the bare "Veteranen" code', () => {
    const subs = vetSubcatsVoorConfig().map(c => c.code);
    expect(subs).toContain('V1');
    expect(subs).not.toContain('Veteranen');
  });
});

describe('berekenVeteranenSubcat', () => {
  it('returns the narrowest matching V-subcategory', () => {
    // born 1989 -> age 35 in 2024 -> V2 (35-39)
    expect(berekenVeteranenSubcat(1989, '2024-01-01')?.code).toBe('V2');
  });

  it('returns null when geboortejaar is missing', () => {
    expect(berekenVeteranenSubcat(null, '2024-01-01')).toBeNull();
  });
});

describe('berekenCategorie', () => {
  it('returns the raw category with buiten:false when doelgroep is null', () => {
    // age 7 in 2024 -> U9
    expect(berekenCategorie(2017, '2024-01-01', null)).toEqual({ cat: 'U9', buiten: false });
  });

  it('promotes a younger player up into the doelgroep without flagging buiten', () => {
    // age 7 (U9) with doelgroep ['U11','U13'] -> promoted to U11, not penalized
    expect(berekenCategorie(2017, '2024-01-01', ['U11', 'U13'])).toEqual({ cat: 'U11', buiten: false });
  });

  it('demotes an older player down into the doelgroep and flags buiten:true', () => {
    // age 13 (U14) with doelgroep ['U11','U13'] -> demoted to U13, flagged as buiten
    expect(berekenCategorie(2011, '2024-01-01', ['U11', 'U13'])).toEqual({ cat: 'U13', buiten: true });
  });

  it('resolves veteranen tournaments to the matching V-subcategory', () => {
    // born 1989 -> age 35 in 2024 -> V2
    expect(berekenCategorie(1989, '2024-01-01', ['Veteranen'])).toEqual({ cat: 'V2', buiten: false });
  });

  it('flags buiten:true when too young for a veteranen tournament', () => {
    // age 7 -> too young for any V-subcategory
    expect(berekenCategorie(2017, '2024-01-01', ['Veteranen'])).toEqual({ cat: 'U9', buiten: true });
  });

  it('returns a placeholder when no category matches at all', () => {
    expect(berekenCategorie(null, '2024-01-01', null)).toEqual({ cat: '—', buiten: false });
  });
});
