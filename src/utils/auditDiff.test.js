import { describe, it, expect } from 'vitest';
import { bepaalDiff, formatWaarde, lidWijzigingen } from './auditDiff';

describe('auditDiff', () => {
  it('bepaalDiff negeert updatedAt en vindt echte wijzigingen', () => {
    const d = bepaalDiff({ naam: 'A', gordel: 'wit', updatedAt: 1 }, { naam: 'A', gordel: 'geel', updatedAt: 2 });
    expect(d).toEqual([{ veld: 'gordel', oud: 'wit', nieuw: 'geel' }]);
  });
  it('lidWijzigingen filtert technische velden en voegt labels toe', () => {
    const log = {
      type: 'bijwerken',
      voor: { naam: 'Kintaert Oscar', naamLower: 'kintaert oscar', zoekPrefixes: ['k'], updatedBy: 'u1', gordel: 'wit' },
      na: { naam: 'Oscar Kintaert', naamLower: 'oscar kintaert', zoekPrefixes: ['o'], updatedBy: 'u2', gordel: 'wit' },
    };
    expect(lidWijzigingen(log)).toEqual([{ veld: 'naam', oud: 'Kintaert Oscar', nieuw: 'Oscar Kintaert', label: 'Naam' }]);
  });
  it('geeft geen veldlijst bij aanmaken/verwijderen of puur technische wijziging', () => {
    expect(lidWijzigingen({ type: 'aanmaken', voor: null, na: { naam: 'x' } })).toEqual([]);
    expect(lidWijzigingen({ type: 'bijwerken', voor: { updatedBy: 'a' }, na: { updatedBy: 'b' } })).toEqual([]);
  });
  it('formatWaarde is leesbaar', () => {
    expect(formatWaarde(null)).toBe('—');
    expect(formatWaarde(true)).toBe('ja');
    expect(formatWaarde(['U13', 'U15'])).toBe('U13, U15');
  });
});
