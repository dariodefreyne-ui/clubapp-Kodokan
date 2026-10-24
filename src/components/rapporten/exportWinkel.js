// src/components/rapporten/exportWinkel.js
// Exporteert het Winkel-rapport (productoverzicht) als .xlsx met dezelfde
// indeling als de tab. Niet seizoensgebonden.

import { maakWorkbook, voegSheetHeaderToe, styleTotaalRow, downloadWorkbook } from './exportHelpers';

export async function exportWinkel(data) {
  const wb = await maakWorkbook();

  const ws = wb.addWorksheet('Producten');
  voegSheetHeaderToe(
    ws,
    [{width:24},{width:16},{width:9},{width:10},{width:12},{width:12}],
    ['Product','Variant','Stock','Verkocht','Omzet','Marge'],
  );

  let totOmzet = 0, totMarge = 0, totStock = 0, totVerkocht = 0;
  data.products.forEach(p => {
    // Omzet/marge komen uit de verkopen (prijs op het moment van verkoop), zie winkelOmzet.js
    const omzet = p.omzet || 0;
    const marge = p.marge || 0;
    const verkocht = p.verkocht || 0;
    totOmzet += omzet; totMarge += marge; totStock += p.stock||0; totVerkocht += verkocht;
    ws.addRow([p.name, p.variant, p.stock||0, verkocht, Number(omzet.toFixed(2)), Number(marge.toFixed(2))]);
  });
  const totaalRow = ws.addRow(['Totaal', '', totStock, totVerkocht, Number(totOmzet.toFixed(2)), Number(totMarge.toFixed(2))]);
  styleTotaalRow(totaalRow);

  if (data.kostGeschatStuks > 0) {
    ws.addRow([]);
    const nota = ws.addRow([`Opmerking: voor ${data.kostGeschatStuks} verkochte stuks (oudere verkopen) is de aankoopprijs niet bewaard; daarvoor is de huidige aankoopprijs gebruikt.`]);
    nota.getCell(1).font = { italic: true, color: { argb: 'FF64748B' } };
  }

  await downloadWorkbook(wb, 'kodokan-winkel_export.xlsx');
}
