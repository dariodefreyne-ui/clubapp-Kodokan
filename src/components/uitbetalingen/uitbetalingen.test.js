// Tests voor periode-helpers en Excel-exports van de Uitbetalingen-pagina.
import { describe, it, expect, vi, beforeEach } from 'vitest';

let vast;
vi.mock('../rapporten/exportHelpers', async (orig) => {
  const m = await orig();
  return { ...m, downloadWorkbook: async (wb, naam) => { vast = { wb, naam }; } };
});

import {
  periodeVanMaanden, isMaandBereik, maandSleutels, aantalMaanden, afrekeningNaam, bestandsDeel, bouwMatrixRijen,
} from './uitbetalingHelpers';
import { exporteerTrainingenXlsx, exporteerWedstrijdkostenXlsx } from './uitbetalingExport';

describe('periodeVanMaanden', () => {
  it('augustus t/m oktober 2026 → hele maanden, naam zoals de handmatige afrekening', () => {
    expect(periodeVanMaanden('2026-08', '2026-10')).toEqual({ van: '2026-08-01', tot: '2026-10-31', naam: 'augustus - oktober 2026' });
  });
  it('één maand en schrikkeljaar', () => {
    expect(periodeVanMaanden('2028-02', '2028-02')).toEqual({ van: '2028-02-01', tot: '2028-02-29', naam: 'februari 2028' });
  });
  it('over jaargrens heen toont beide jaren', () => {
    expect(periodeVanMaanden('2026-11', '2027-02').naam).toBe('november 2026 - februari 2027');
  });
  it('verkeerd om ingegeven wordt rechtgezet', () => {
    expect(periodeVanMaanden('2026-10', '2026-08')).toEqual(periodeVanMaanden('2026-08', '2026-10'));
  });
  it('isMaandBereik / aantalMaanden', () => {
    expect(isMaandBereik(periodeVanMaanden('2026-08', '2026-10'))).toBe(true);
    expect(isMaandBereik({ van: '2026-09-15', tot: '2026-11-15' })).toBe(false);
    expect(aantalMaanden(periodeVanMaanden('2026-08', '2026-10'))).toBe(3);
  });
  it('maandSleutels over jaargrens', () => {
    expect(maandSleutels('2026-11', '2027-01')).toEqual(['2026-11', '2026-12', '2027-01']);
  });
  it('afrekeningNaam en bestandsDeel', () => {
    expect(afrekeningNaam('augustus - oktober 2026')).toBe('Afrekening augustus - oktober 2026');
    expect(afrekeningNaam('Afrekening augustus - oktober 2026')).toBe('Afrekening augustus - oktober 2026');
    expect(bestandsDeel('Afrekening augustus - oktober 2026')).toBe('Afrekening_augustus_-_oktober_2026');
  });
});

const periode = periodeVanMaanden('2026-08', '2026-10');

describe('exporteerWedstrijdkostenXlsx (voorbeeld uit de handmatige Excel)', () => {
  const rijen = [
    { eventId: 'e1', eventNaam: 'Brabant Open (U15/U21+)', datum: '2026-09-19', naam: 'Sofie Michiels', groepKey: 's', km: 0, inkom: 5 },
    { eventId: 'e5', eventNaam: 'Jeugdtrofee Thibaut Van Roeyen', datum: '2026-10-18', naam: 'Dario De Freyne', groepKey: 'd', km: 66, inkom: 7 },
    { eventId: 'e7', eventNaam: 'Open van Zaventem', datum: '2026-10-24', naam: 'Dario De Freyne', groepKey: 'd', km: 70, inkom: 17 },
    { eventId: 'e7', eventNaam: 'Open van Zaventem', datum: '2026-10-24', naam: 'Stef Dewandeler', groepKey: 'st', km: 0, inkom: 5 },
  ];
  const lijst = [
    { naam: 'Dario De Freyne', km: 136, kmBedrag: 54.4, inkom: 24 },
    { naam: 'Sofie Michiels', km: 0, kmBedrag: 0, inkom: 5 },
    { naam: 'Stef Dewandeler', km: 0, kmBedrag: 0, inkom: 5 },
  ];
  beforeEach(() => { vast = null; });

  it('meldt een wedstrijd met meerdere coaches maar één keer (samengevoegd) en geeft dezelfde totalen', async () => {
    await exporteerWedstrijdkostenXlsx({ rijen, lijst, kmTarief: 0.4, periode });
    expect(vast.naam).toBe('wedstrijdkosten_Afrekening_augustus_-_oktober_2026.xlsx');
    const ws = vast.wb.getWorksheet('Wedstrijdkosten');
    expect(ws.getCell('A1').value).toBe('Onkosten wedstrijden Afrekening augustus - oktober 2026');
    expect(Object.keys(ws._merges).sort()).toEqual(['A1', 'A5', 'B5']); // titel + Zaventem (A5:A6, B5:B6)
    expect(ws.getCell('A5').value).toBe('Open van Zaventem');
    expect(ws.getCell('A6').isMerged).toBe(true);                   // tweede coach: geen herhaling, wel samengevoegd
    expect(ws.getCell('A6').master.address).toBe('A5');
    const totaal = (naam) => { let r; ws.eachRow((row, nr) => { if (row.getCell(1).value === 'Totaal:' && row.getCell(3).value === naam) r = row; }); return r; };
    expect(totaal('Dario De Freyne').getCell(7).value.result).toBeCloseTo(78.4, 2);
    expect(totaal('Algemeen').getCell(7).value.result).toBeCloseTo(88.4, 2);
    expect(totaal('Algemeen').getCell(5).value.result).toBe(136);
    expect(ws.getCell('F4').value).toBeCloseTo(26.4, 2);
    expect(ws.getCell('F5').value).toBeCloseTo(28, 2);
  });
});

describe('exporteerTrainingenXlsx', () => {
  beforeEach(() => { vast = null; });
  it('zet totalen (uren, €/u, totaal) vóór de datums en meldt ontbrekend tarief niet als 0', async () => {
    const data = {
      datums: ['2026-08-19', '2026-09-05'],
      lesgevers: {
        luc: { '2026-08-19': { uren: 1.5, groepen: ['Groep 4'] }, '2026-09-05': { uren: 1.5, groepen: ['Groep 4'] } },
        anke: { '2026-09-05': { uren: 1.5, groepen: ['Groep 2&3'] } },
      },
    };
    const lesgeversLijst = [{ id: 'luc', naam: 'Luc Raeymaekers', type: 'trainerB' }, { id: 'anke', naam: 'Anke Rutten', type: 'onbekend' }];
    const rijen = bouwMatrixRijen({ data, lesgeversLijst, tarieven: { trainerB: { bedragPerUur: 14 } }, tarieftypes: [{ code: 'trainerB', label: 'Trainer B' }] });
    await exporteerTrainingenXlsx({ rijen, datums: data.datums, periode });
    expect(vast.naam).toBe('uitbetaling_Afrekening_augustus_-_oktober_2026.xlsx');
    const ws = vast.wb.getWorksheet('Uitbetaling');
    expect(ws.getRow(1).values.slice(1, 8)).toEqual(['Lesgever', 'Type', 'Uren', '€/u', 'Totaal €', '19 aug', '5 sep']);
    expect(ws.getCell('A2').value).toBe('Anke Rutten');            // alfabetisch
    expect(ws.getCell('E2').value).toBe('');                       // geen tarief → leeg, geen € 0
    expect(ws.getCell('A3').value).toBe('Luc Raeymaekers');
    expect(ws.getCell('E3').value).toEqual({ formula: 'C3*D3', result: 42 });
    expect(ws.getCell('F3').value).toBe('Groep 4 (1.5u)');
    expect(ws.getCell('C4').value.result).toBe(4.5);               // totaalrij
    expect(ws.views[0]).toMatchObject({ state: 'frozen', xSplit: 1, ySplit: 1 });
  });
});
