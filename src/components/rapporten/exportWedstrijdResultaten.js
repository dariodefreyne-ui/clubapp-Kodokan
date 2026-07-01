// src/components/rapporten/exportWedstrijdResultaten.js
// Exporteert de resultaten op de dag (winst/verlies/plaats per deelname) van
// elke judoka dit seizoen als .xlsx — voor seizoensanalyse buiten de app.
// Drie tabbladen: "Overzicht" (totale inschrijvingen per wedstrijd), "Totalen"
// (1 rij per judoka) en "Details" (per judoka een vetgedrukte totaalrij,
// gevolgd door elke deelname apart).

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

// Aggregeert per tornooi (gededupliceerd op naam+week, zelfde 'sleutel' als de
// rest van dit rapport — meerdaagse tornooien tellen dus niet dubbel).
function bouwOverzicht(events, toernooien, inschrijvingen, tornooiDeelnemers) {
  const eventById = Object.fromEntries((events || []).map(e => [e.id, e]));
  const perSleutel = {}; // sleutel → { totaal, afwezig }
  (inschrijvingen || []).forEach(i => {
    const ev = eventById[i.eventId];
    if (!ev) return;
    const sleutel = ev._sleutel;
    if (!perSleutel[sleutel]) perSleutel[sleutel] = { totaal: 0, afwezig: 0 };
    perSleutel[sleutel].totaal++;
    if (i.resultaat?.afwezig) perSleutel[sleutel].afwezig++;
  });

  return (toernooien || [])
    .map(t => ({
      datum: t.datum || '',
      naam: t.naam || '',
      doelgroep: (t.doelgroepCodes || []).join('-'),
      totaal: perSleutel[t.sleutel]?.totaal || 0,
      afwezig: perSleutel[t.sleutel]?.afwezig || 0,
      aantalJudokas: (tornooiDeelnemers?.[t.sleutel] || []).length,
    }))
    .sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));
}

export async function exportWedstrijdResultaten(data, seizoenLabel = '') {
  const { events, toernooien, inschrijvingen, perDeelnemer, tornooiDeelnemers } = data;
  const wb = await maakWorkbook();

  const deelnemers = Object.values(perDeelnemer)
    .filter(d => (d.deelnames || []).length > 0)
    .sort((a, b) => (a.naam || '').localeCompare(b.naam || '', 'nl'));

  // ── Tabblad 1: Overzicht — totale inschrijvingen per wedstrijd ──
  const wsOverzicht = wb.addWorksheet('Overzicht');
  voegSheetHeaderToe(
    wsOverzicht,
    [{width:12},{width:35},{width:14},{width:20},{width:12},{width:16}],
    ['Datum','Tornooi','Doelgroep','Totaal inschrijvingen','Waarvan afwezig','# Judoka\'s (aanwezig)'],
  );
  bouwOverzicht(events, toernooien, inschrijvingen, tornooiDeelnemers).forEach(t => {
    wsOverzicht.addRow([t.datum, t.naam, t.doelgroep, t.totaal, t.afwezig, t.aantalJudokas]);
  });

  // ── Tabblad 2: Totalen — één rij per judoka ──
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

  // ── Tabblad 3: Details — per judoka een vette totaalrij + deelnames ──
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
