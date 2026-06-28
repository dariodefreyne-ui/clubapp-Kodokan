// src/components/rapporten/exportExamens.js
// Exporteert het Examens-rapport als .xlsx met dezelfde indeling als de tab.

import { maakWorkbook, voegSheetHeaderToe, styleTotaalRow, bestandsnaam, downloadWorkbook } from './exportHelpers';

export async function exportExamens(examens, seizoenLabel = '') {
  const wb = await maakWorkbook();

  const ws = wb.addWorksheet('Examenresultaten');
  voegSheetHeaderToe(
    ws,
    [{width:22},{width:12},{width:12},{width:10},{width:14},{width:9},{width:10}],
    ['Examen','Datum','Kandidaten','Geslaagd','Niet geslaagd','Afwezig','Slaagpct.'],
  );

  const sorted = examens.slice().sort((a,b) => (a.date||'').localeCompare(b.date||''));
  sorted.forEach(e => {
    ws.addRow([e.name||e.naam, e.date, e.candidates, e.passed, e.failed, e.absent, `${e.passRate}%`]);
  });

  const totKandidaten = examens.reduce((s,e) => s + e.candidates, 0);
  const totGeslaagd   = examens.reduce((s,e) => s + e.passed, 0);
  const totFailed     = examens.reduce((s,e) => s + e.failed, 0);
  const totAfwezig    = examens.reduce((s,e) => s + e.absent, 0);
  const globaalPct    = totKandidaten > 0 ? Math.round(totGeslaagd/totKandidaten*100) : 0;
  const totaalRow = ws.addRow(['Totaal', '', totKandidaten, totGeslaagd, totFailed, totAfwezig, `${globaalPct}%`]);
  styleTotaalRow(totaalRow);

  await downloadWorkbook(wb, bestandsnaam('examens', seizoenLabel));
}
