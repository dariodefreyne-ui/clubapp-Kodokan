// src/components/rapporten/exportWedstrijdResultaten.js
// Exporteert de resultaten op de dag (winst/verlies/plaats per deelname) van
// elke judoka dit seizoen als .xlsx — voor seizoensanalyse buiten de app.
// Twee tabbladen: "Totalen" (1 rij per judoka) en "Details" (per judoka een
// vetgedrukte totaalrij, gevolgd door elke deelname apart).

const HEADER_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
const TOTAAL_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
const HEADER_FONT  = { bold: true, color: { argb: 'FFFFFFFF' } };

function plekTekst(eindplaats, systeem) {
  if (!eindplaats) return '';
  if (systeem === 'boom') {
    return { '1': '1e', '2': '2e', '3': '3e' }[eindplaats] || `${eindplaats}e`;
  }
  return eindplaats === 'gedeeld' ? 'gedeelde plaats (poule)' : `${eindplaats}e (poule)`;
}

function podiumTekst(d) {
  const delen = [];
  if (d.goud)   delen.push(`🥇${d.goud}`);
  if (d.zilver) delen.push(`🥈${d.zilver}`);
  if (d.brons)  delen.push(`🥉${d.brons}`);
  return delen.join(' ');
}

function styleHeaderRow(row) {
  row.eachCell(cell => {
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
  });
}

export async function exportWedstrijdResultaten(perDeelnemer, seizoenLabel = '') {
  const { Workbook } = await import('exceljs');
  const wb = new Workbook();

  const deelnemers = Object.values(perDeelnemer)
    .filter(d => (d.deelnames || []).length > 0)
    .sort((a, b) => (a.naam || '').localeCompare(b.naam || '', 'nl'));

  // ── Tabblad 1: Totalen — één rij per judoka ──
  const wsTotaal = wb.addWorksheet('Totalen');
  wsTotaal.columns = [
    {width:26},{width:11},{width:9},{width:10},{width:10},{width:14},
  ];
  const totaalHeader = wsTotaal.addRow(['Naam','Deelnames','Winst','Verlies','Winratio','Podium (🥇🥈🥉)']);
  styleHeaderRow(totaalHeader);
  wsTotaal.views = [{ state: 'frozen', ySplit: 1 }];

  deelnemers.forEach(d => {
    wsTotaal.addRow([
      d.naam,
      d.n,
      d.winst,
      d.verlies,
      d.winratio !== null ? `${d.winratio}%` : '—',
      podiumTekst(d) || '—',
    ]);
  });

  // ── Tabblad 2: Details — per judoka een vette totaalrij + deelnames ──
  const wsDetail = wb.addWorksheet('Details');
  wsDetail.columns = [
    {width:26},{width:12},{width:32},{width:12},{width:9},{width:10},{width:20},{width:10},
  ];
  const detailHeader = wsDetail.addRow(['Naam','Datum','Tornooi','Categorie','Winst','Verlies','Plaats','Afwezig']);
  styleHeaderRow(detailHeader);
  wsDetail.views = [{ state: 'frozen', ySplit: 1 }];

  deelnemers.forEach(d => {
    const totaalRow = wsDetail.addRow([
      d.naam, '', `TOTAAL (${d.n} deelname${d.n !== 1 ? 's' : ''})`, '',
      d.winst, d.verlies, podiumTekst(d) || '', '',
    ]);
    totaalRow.eachCell(cell => { cell.font = { bold: true }; cell.fill = TOTAAL_FILL; });

    d.deelnames.forEach(dl => {
      wsDetail.addRow([
        '',
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
