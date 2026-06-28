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
    const omzet = (p.price||0) * (p.soldCount||0);
    const marge = ((p.price||0) - (p.costPrice||0)) * (p.soldCount||0);
    totOmzet += omzet; totMarge += marge; totStock += p.stock||0; totVerkocht += p.soldCount||0;
    ws.addRow([p.name, p.variant, p.stock||0, p.soldCount||0, Number(omzet.toFixed(2)), Number(marge.toFixed(2))]);
  });
  const totaalRow = ws.addRow(['Totaal', '', totStock, totVerkocht, Number(totOmzet.toFixed(2)), Number(totMarge.toFixed(2))]);
  styleTotaalRow(totaalRow);

  await downloadWorkbook(wb, 'kodokan-winkel_export.xlsx');
}
