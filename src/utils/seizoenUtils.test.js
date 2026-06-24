import { describe, it, expect, beforeEach } from 'vitest';
import {
  setSeizoenSettings,
  getSeizoenSettings,
  seizoenBereikVanJaar,
  huidigSeizoenStartJaar,
  seizoenBereik,
  beschikbareSeizoenStartJaren,
  seizoenVanDatum,
  bepaalSeizoen,
  huidigSeizoen,
  vandaagISO,
  formatDatum,
  trainingsId,
  maandOptiesVoorSeizoen,
} from './seizoenUtils';

// SEIZOEN_SETTINGS is module-level mutable state, default: 1 sept t.e.m. 30 juni.
// Reset before each test so tests don't leak settings into each other.
beforeEach(() => {
  setSeizoenSettings({ startMaand: 9, startDag: 1, eindMaand: 6, eindDag: 30 });
});

describe('setSeizoenSettings / getSeizoenSettings', () => {
  it('returns the default settings', () => {
    expect(getSeizoenSettings()).toEqual({ startMaand: 9, startDag: 1, eindMaand: 6, eindDag: 30 });
  });

  it('updates settings and falls back to defaults for invalid fields', () => {
    setSeizoenSettings({ startMaand: 8, startDag: 15, eindMaand: 0, eindDag: null });
    expect(getSeizoenSettings()).toEqual({ startMaand: 8, startDag: 15, eindMaand: 6, eindDag: 30 });
  });

  it('does nothing when called with a falsy value', () => {
    setSeizoenSettings(null);
    expect(getSeizoenSettings()).toEqual({ startMaand: 9, startDag: 1, eindMaand: 6, eindDag: 30 });
  });
});

describe('seizoenBereikVanJaar', () => {
  it('builds start/einde/label for a given start year using default settings', () => {
    expect(seizoenBereikVanJaar(2024)).toEqual({
      start: '2024-09-01',
      einde: '2025-06-30',
      label: '2024–2025',
      startJaar: 2024,
    });
  });

  it('respects custom seizoen settings', () => {
    setSeizoenSettings({ startMaand: 1, startDag: 1, eindMaand: 12, eindDag: 31 });
    expect(seizoenBereikVanJaar(2024)).toEqual({
      start: '2024-01-01',
      einde: '2025-12-31',
      label: '2024–2025',
      startJaar: 2024,
    });
  });
});

describe('huidigSeizoenStartJaar / seizoenBereik / beschikbareSeizoenStartJaren', () => {
  it('huidigSeizoenStartJaar returns a number', () => {
    expect(typeof huidigSeizoenStartJaar()).toBe('number');
  });

  it('seizoenBereik(0) matches seizoenBereikVanJaar(huidigSeizoenStartJaar())', () => {
    expect(seizoenBereik(0)).toEqual(seizoenBereikVanJaar(huidigSeizoenStartJaar()));
  });

  it('seizoenBereik(offsetJaar) shifts the start year by the offset', () => {
    const huidig = huidigSeizoenStartJaar();
    expect(seizoenBereik(1).startJaar).toBe(huidig + 1);
    expect(seizoenBereik(-1).startJaar).toBe(huidig - 1);
  });

  it('beschikbareSeizoenStartJaren returns four consecutive years descending from huidig+1', () => {
    const huidig = huidigSeizoenStartJaar();
    expect(beschikbareSeizoenStartJaren()).toEqual([huidig + 1, huidig, huidig - 1, huidig - 2]);
  });
});

describe('seizoenVanDatum', () => {
  it('returns "—" for a falsy date', () => {
    expect(seizoenVanDatum(null)).toBe('—');
    expect(seizoenVanDatum('')).toBe('—');
  });

  it('classifies a date in the September..December range to the season starting that year', () => {
    expect(seizoenVanDatum('2024-09-15')).toBe('2024–2025');
  });

  it('classifies a date before the start month to the season starting the previous year', () => {
    expect(seizoenVanDatum('2024-03-15')).toBe('2023–2024');
  });
});

describe('bepaalSeizoen', () => {
  it('returns null for a falsy datumISO', () => {
    expect(bepaalSeizoen(null)).toBeNull();
    expect(bepaalSeizoen('')).toBeNull();
  });

  it('classifies a date on/after startMaand to "jaar-jaar+1"', () => {
    expect(bepaalSeizoen('2024-09-15')).toBe('2024-2025');
  });

  it('classifies a date before startMaand to "jaar-1-jaar"', () => {
    expect(bepaalSeizoen('2024-03-15')).toBe('2023-2024');
  });
});

describe('huidigSeizoen / vandaagISO', () => {
  it('huidigSeizoen returns a "jaar-jaar+1" string consistent with bepaalSeizoen(vandaagISO())', () => {
    expect(huidigSeizoen()).toBe(bepaalSeizoen(vandaagISO()));
  });

  it('vandaagISO returns a yyyy-mm-dd string', () => {
    expect(vandaagISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('formatDatum (seizoenUtils)', () => {
  it('formats an ISO date as a long-form Dutch date', () => {
    expect(formatDatum('2024-01-15')).toBe('maandag 15 januari 2024');
  });

  it('returns empty string for falsy input', () => {
    expect(formatDatum(null)).toBe('');
    expect(formatDatum('')).toBe('');
  });
});

describe('trainingsId', () => {
  it('joins groepId and datum with an underscore', () => {
    expect(trainingsId('groep1', '2024-01-15')).toBe('groep1_2024-01-15');
  });
});

describe('maandOptiesVoorSeizoen', () => {
  it('returns one option per month from startMaand of startJaar through eindMaand of the next year', () => {
    const opties = maandOptiesVoorSeizoen(2024);
    expect(opties).toHaveLength(10); // sep..dec (2024) + jan..jun (2025)
    expect(opties[0]).toMatchObject({ van: '2024-09-01', tot: '2024-09-30' });
    expect(opties[opties.length - 1]).toMatchObject({ van: '2025-06-01', tot: '2025-06-30' });
  });

  it('respects custom seizoen settings for the month range', () => {
    // startMaand/eindMaand always span two calendar years (startJaar..startJaar+1),
    // so startMaand=1/eindMaand=3 covers jan 2024 through mar 2025 (15 months).
    setSeizoenSettings({ startMaand: 1, startDag: 1, eindMaand: 3, eindDag: 31 });
    const opties = maandOptiesVoorSeizoen(2024);
    expect(opties).toHaveLength(15);
    expect(opties[0].van).toBe('2024-01-01');
    expect(opties[opties.length - 1].van).toBe('2025-03-01');
  });
});
