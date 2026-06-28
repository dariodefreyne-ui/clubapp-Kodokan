// src/components/rapporten/exportLesgevers.js
// Exporteert het Lesgevers-rapport — overzicht, per groep, per maand en
// vorige-seizoenen-vergelijking — als .xlsx met dezelfde indeling als de tab.

import { maakWorkbook, voegSheetHeaderToe, styleTotaalRow, bestandsnaam, downloadWorkbook, maandLabel } from './exportHelpers';

export async function exportLesgevers(lijst, perLesgeverSeizoen, totBedrag, totUren, seizoenLabel = '') {
  const wb = await maakWorkbook();

  // ── Tabblad 1: Overzicht ──
  const wsOverzicht = wb.addWorksheet('Overzicht');
  voegSheetHeaderToe(
    wsOverzicht,
    [{width:26},{width:14},{width:12},{width:10},{width:14}],
    ['Naam','Type','Trainingen','Uren','Vergoeding'],
  );
  lijst.forEach(l => {
    wsOverzicht.addRow([l.naam, l.type === 'assistent' ? 'Assistent' : 'Trainer', l.n, Number(l.uren.toFixed(1)), Number(l.bedrag.toFixed(2))]);
  });
  const totaalRow = wsOverzicht.addRow(['Totaal', '', lijst.reduce((s,l)=>s+l.n,0), Number(totUren.toFixed(1)), Number(totBedrag.toFixed(2))]);
  styleTotaalRow(totaalRow);

  // ── Tabblad 2: Per groep ──
  const wsGroep = wb.addWorksheet('Per groep');
  voegSheetHeaderToe(
    wsGroep,
    [{width:26},{width:22},{width:12},{width:10}],
    ['Lesgever','Groep','Trainingen','Uren'],
  );
  lijst.forEach(l => {
    Object.values(l.groepen)
      .sort((a,b) => b.n - a.n)
      .forEach(g => wsGroep.addRow([l.naam, g.naam, g.n, Number(g.uren.toFixed(1))]));
  });

  // ── Tabblad 3: Per maand ──
  const wsMaand = wb.addWorksheet('Per maand');
  voegSheetHeaderToe(
    wsMaand,
    [{width:26},{width:14},{width:12},{width:10},{width:14}],
    ['Lesgever','Maand','Trainingen','Uren','Vergoeding'],
  );
  lijst.forEach(l => {
    Object.values(l.maanden)
      .sort((a,b) => a.maand.localeCompare(b.maand))
      .forEach(m => wsMaand.addRow([l.naam, maandLabel(m.maand), m.n, Number(m.uren.toFixed(1)), Number(m.bedrag.toFixed(2))]));
  });

  // ── Tabblad 4: Vorige seizoenen ──
  const wsSeizoen = wb.addWorksheet('Vorige seizoenen');
  voegSheetHeaderToe(
    wsSeizoen,
    [{width:26},{width:12},{width:12},{width:10},{width:14},{width:10}],
    ['Lesgever','Seizoen','Trainingen','Uren','Vergoeding','% vs vorig'],
  );
  lijst.forEach(l => {
    const seizoenenLijst = Object.values(perLesgeverSeizoen[l.id]?.seizoenen || {}).sort((a,b) => b.seizoen.localeCompare(a.seizoen));
    seizoenenLijst.forEach((s, si) => {
      const vorig = seizoenenLijst[si+1];
      const pct = vorig && vorig.uren > 0 ? Math.round((s.uren - vorig.uren) / vorig.uren * 100) : null;
      wsSeizoen.addRow([l.naam, s.seizoen, s.n, Number(s.uren.toFixed(1)), Number(s.bedrag.toFixed(2)), pct == null ? '—' : `${pct>=0?'+':''}${pct}%`]);
    });
  });

  await downloadWorkbook(wb, bestandsnaam('lesgevers', seizoenLabel));
}
