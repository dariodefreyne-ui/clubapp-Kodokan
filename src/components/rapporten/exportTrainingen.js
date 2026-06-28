// src/components/rapporten/exportTrainingen.js
// Exporteert het Trainingen-rapport (per groep) en, indien geladen, de
// technieken-statistiek — als .xlsx met dezelfde indeling als de Rapporten-tab.

import { maakWorkbook, voegSheetHeaderToe, styleTotaalRow, bestandsnaam, downloadWorkbook } from './exportHelpers';

export async function exportTrainingen(groepenLijst, totalen, techData, seizoenLabel = '') {
  const wb = await maakWorkbook();

  const wsGroep = wb.addWorksheet('Per groep');
  voegSheetHeaderToe(
    wsGroep,
    [{width:22},{width:10},{width:10},{width:10},{width:10},{width:8},{width:8},{width:12},{width:9}],
    ['Groep','Gepland','Gegeven','Geann.','Samenv.','Geen','Prov.','2 lesgevers','Uren'],
  );
  groepenLijst.forEach(g => {
    wsGroep.addRow([
      g.displayNaam, g.totaal, g.normaal||0, g.geannuleerd||0, g.samengevoegd||0,
      g.geen||0, g.provTrn||0, g.metTwee, Number(g.uren.toFixed(1)),
    ]);
  });
  const totaalRow = wsGroep.addRow([
    'Totaal', totalen.totaal, totalen.normaal, totalen.geannuleerd, totalen.samengevoegd,
    totalen.geen, totalen.provTraining, totalen.metTwee, Number(totalen.totalUren.toFixed(1)),
  ]);
  styleTotaalRow(totaalRow);

  if (techData && techData.length > 0) {
    const wsTech = wb.addWorksheet('Technieken');
    voegSheetHeaderToe(
      wsTech,
      [{width:30},{width:10},{width:10},{width:12}],
      ['Techniek','Totaal','Basis','Verdieping'],
    );
    techData.forEach(t => {
      wsTech.addRow([t.naam, t.totaal, t.basis||0, t.verdieping||0]);
    });
  }

  await downloadWorkbook(wb, bestandsnaam('trainingen', seizoenLabel));
}
