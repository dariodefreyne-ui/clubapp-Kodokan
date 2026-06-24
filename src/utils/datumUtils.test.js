import { describe, it, expect } from 'vitest';
import { formatDatum, formatDatumTijd, datumNaarIso, isoNaarDatum } from './datumUtils';

describe('formatDatum', () => {
  it('formats ISO string to dd/mm/yyyy', () => {
    expect(formatDatum('2024-09-01')).toBe('01/09/2024');
  });

  it('returns empty string for falsy input', () => {
    expect(formatDatum(null)).toBe('');
    expect(formatDatum('')).toBe('');
    expect(formatDatum(undefined)).toBe('');
  });

  it('formats a Date object', () => {
    expect(formatDatum(new Date(2024, 0, 15))).toBe('15/01/2024');
  });

  it('handles a Firestore Timestamp-like object', () => {
    const ts = { toDate: () => new Date(2024, 0, 15) };
    expect(formatDatum(ts)).toBe('15/01/2024');
  });

  it('falls back to the raw value for unparseable input', () => {
    expect(formatDatum('not-a-date')).toBe('not-a-date');
  });
});

describe('formatDatumTijd', () => {
  it('formats date and time as dd/mm/yyyy HH:mm', () => {
    const d = new Date(2024, 0, 15, 9, 5);
    expect(formatDatumTijd(d)).toBe('15/01/2024 09:05');
  });

  it('returns empty string for falsy input', () => {
    expect(formatDatumTijd(null)).toBe('');
  });
});

describe('datumNaarIso', () => {
  it('parses dd/mm/yyyy into yyyy-mm-dd', () => {
    expect(datumNaarIso('15/01/2024')).toBe('2024-01-15');
  });

  it('pads single-digit day/month', () => {
    expect(datumNaarIso('1/2/2024')).toBe('2024-02-01');
  });

  it('returns empty string for falsy input', () => {
    expect(datumNaarIso('')).toBe('');
    expect(datumNaarIso(null)).toBe('');
  });

  it('returns the original string when it does not match dd/mm/yyyy', () => {
    expect(datumNaarIso('2024-01-15')).toBe('2024-01-15');
  });
});

describe('isoNaarDatum', () => {
  it('formats yyyy-mm-dd into dd/mm/yyyy', () => {
    expect(isoNaarDatum('2024-01-15')).toBe('15/01/2024');
  });

  it('returns empty string for falsy input', () => {
    expect(isoNaarDatum('')).toBe('');
    expect(isoNaarDatum(null)).toBe('');
  });

  it('returns the original value when it does not match yyyy-mm-dd', () => {
    expect(isoNaarDatum('15/01/2024')).toBe('15/01/2024');
  });
});

describe('datumNaarIso / isoNaarDatum round-trip', () => {
  it('round-trips dd/mm/yyyy through ISO and back', () => {
    expect(isoNaarDatum(datumNaarIso('15/01/2024'))).toBe('15/01/2024');
  });
});
