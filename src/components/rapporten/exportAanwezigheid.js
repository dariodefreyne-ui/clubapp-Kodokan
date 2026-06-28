// src/components/rapporten/exportAanwezigheid.js
// Exporteert het Aanwezigheid-rapport — maandoverzicht per groep, per lid en
// gordelverdeling — als .xlsx met dezelfde indeling als de tab.

import { maakWorkbook, voegSheetHeaderToe, bestandsnaam, downloadWorkbook, maandLabel } from './exportHelpers';

export async function exportAanwezigheid(perGroep, leden, gordelSorted, seizoenLabel = '') {
  const wb = await maakWorkbook();

  // ── Tabblad 1: Maandoverzicht per groep ──
  const wsMaand = wb.addWorksheet('Maandoverzicht');
  voegSheetHeaderToe(
    wsMaand,
    [{width:12},{width:22},{width:12},{width:9},{width:10},{width:8}],
    ['Maand','Groep','Trainingen','Leden','Aanwezig','%'],
  );
  perGroep.forEach(r => {
    wsMaand.addRow([maandLabel(r.maand), r.groep, r.trainingen, r.leden, r.totaalAtt, `${r.pct}%`]);
  });

  // ── Tabblad 2: Per lid ──
  const wsLid = wb.addWorksheet('Per lid');
  voegSheetHeaderToe(wsLid, [{width:26},{width:12},{width:14}], ['Naam','Gordel','Aanwezigheden']);
  leden.forEach(m => {
    wsLid.addRow([m.naam || m.name, m.gordel || m.belt || '—', m.aanwezigheid]);
  });

  // ── Tabblad 3: Gordelverdeling ──
  const wsGordel = wb.addWorksheet('Gordelverdeling');
  voegSheetHeaderToe(wsGordel, [{width:14},{width:10}], ['Gordel','Leden']);
  gordelSorted.forEach(([gordel, n]) => wsGordel.addRow([gordel, n]));

  await downloadWorkbook(wb, bestandsnaam('aanwezigheid', seizoenLabel));
}
