// src/components/rapporten/exportWedstrijdResultaten.js
// Exporteert de resultaten op de dag (winst/verlies/plaats per deelname) van
// elke judoka dit seizoen als .xlsx — voor seizoensanalyse buiten de app.

function plekTekst(eindplaats, systeem) {
  if (!eindplaats) return '';
  if (systeem === 'boom') {
    return { '1': '1e', '2': '2e', '3': '3e' }[eindplaats] || `${eindplaats}e`;
  }
  return eindplaats === 'gedeeld' ? 'gedeelde plaats (poule)' : `${eindplaats}e (poule)`;
}

export async function exportWedstrijdResultaten(perDeelnemer, seizoenLabel = '') {
  const { Workbook } = await import('exceljs');
  const wb = new Workbook();
  const ws = wb.addWorksheet('Resultaten');
  ws.columns = [
    {width:24},{width:12},{width:32},{width:12},{width:10},{width:10},{width:20},{width:10},
  ];
  ws.addRow(['Naam','Datum','Tornooi','Categorie','Winst','Verlies','Plaats','Afwezig']);

  Object.values(perDeelnemer)
    .sort((a, b) => (a.naam || '').localeCompare(b.naam || '', 'nl'))
    .forEach(d => {
      (d.deelnames || []).forEach(dl => {
        ws.addRow([
          d.naam,
          dl.datum || '',
          dl.tornooiNaam,
          dl.categorieen || '',
          dl.afwezig ? '' : dl.winst,
          dl.afwezig ? '' : dl.verlies,
          dl.afwezig ? '' : plekTekst(dl.eindplaats, dl.systeem),
          dl.afwezig ? 'Ja' : 'Nee',
        ]);
      });
    });

  const bestandsnaam = seizoenLabel
    ? `wedstrijdresultaten_${seizoenLabel.replace('–', '-')}.xlsx`
    : 'wedstrijdresultaten_export.xlsx';
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = bestandsnaam;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
