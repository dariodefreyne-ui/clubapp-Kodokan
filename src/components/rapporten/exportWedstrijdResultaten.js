// src/components/rapporten/exportWedstrijdResultaten.js
// Exporteert de resultaten op de dag (winst/verlies/plaats per deelname) van
// elke judoka dit seizoen als .xlsx — voor seizoensanalyse buiten de app.
// Twee tabbladen: "Totalen" (1 rij per judoka) en "Details" (per judoka een
// vetgedrukte totaalrij, gevolgd door elke deelname apart).

import { maakWorkbook, voegSheetHeaderToe, styleTotaalRow, bestandsnaam, downloadWorkbook } from './exportHelpers';

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

export async function exportWedstrijdResultaten(perDeelnemer, seizoenLabel = '') {
  const wb = await maakWorkbook();

  const deelnemers = Object.values(perDeelnemer)
    .filter(d => (d.deelnames || []).length > 0)
    .sort((a, b) => (a.naam || '').localeCompare(b.naam || '', 'nl'));

  // ── Tabblad 1: Totalen — één rij per judoka ──
  const wsTotaal = wb.addWorksheet('Totalen');
  voegSheetHeaderToe(
    wsTotaal,
    [{width:26},{width:11},{width:9},{width:10},{width:10},{width:14}],
    ['Naam','Deelnames','Winst','Verlies','Winratio','Podium (🥇🥈🥉)'],
  );

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
  voegSheetHeaderToe(
    wsDetail,
    [{width:26},{width:12},{width:32},{width:12},{width:9},{width:10},{width:20},{width:10}],
    ['Naam','Datum','Tornooi','Categorie','Winst','Verlies','Plaats','Afwezig'],
  );

  deelnemers.forEach(d => {
    const totaalRow = wsDetail.addRow([
      d.naam, '', `TOTAAL (${d.n} deelname${d.n !== 1 ? 's' : ''})`, '',
      d.winst, d.verlies, podiumTekst(d) || '', '',
    ]);
    styleTotaalRow(totaalRow);

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

  await downloadWorkbook(wb, bestandsnaam('wedstrijden', seizoenLabel));
}
