// src/components/rapporten/exportLeden.js
// Exporteert het Leden-rapport — overzicht, aanwezigheid per groep, leden per
// seizoen en nieuwe leden — als .xlsx met dezelfde indeling als de tab.

import { maakWorkbook, voegSheetHeaderToe, bestandsnaam, downloadWorkbook } from './exportHelpers';
import { lidNaamDelen, vergelijkLeden } from '../../utils/ledenKoppeling';

export async function exportLeden(kpis, groepAttLijst, seizoenVolgorde, actievPerSeizoen, nieuw, seizoenLabel = '') {
  const wb = await maakWorkbook();

  // ── Tabblad 1: Overzicht ──
  const wsOverzicht = wb.addWorksheet('Overzicht');
  voegSheetHeaderToe(wsOverzicht, [{width:30},{width:14}], ['Kengetal','Waarde']);
  wsOverzicht.addRow(['Leden totaal', kpis.totaal]);
  wsOverzicht.addRow(['Actief dit seizoen', kpis.actief]);
  wsOverzicht.addRow(['Inactief dit seizoen', kpis.inactief]);
  wsOverzicht.addRow(['Nieuw dit seizoen', kpis.nieuwN]);
  wsOverzicht.addRow(['Gestopt dit seizoen', kpis.gestoptN]);
  wsOverzicht.addRow(['Niet teruggekeerd (actief vorig, niet dit seizoen)', kpis.verlaten]);

  // ── Tabblad 2: Aanwezigheid per groep ──
  const wsGroep = wb.addWorksheet('Per groep');
  voegSheetHeaderToe(
    wsGroep,
    [{width:22},{width:10},{width:12},{width:10},{width:10},{width:8}],
    ['Groep','Leden','Trainingen','Verwacht','Aanwezig','%'],
  );
  groepAttLijst.forEach(g => {
    wsGroep.addRow([g.naam, g.leden, g.trainingen, g.verwacht, g.totaalAtt, `${g.pct}%`]);
  });

  // ── Tabblad 3: Per seizoen ──
  const wsSeizoen = wb.addWorksheet('Per seizoen');
  voegSheetHeaderToe(wsSeizoen, [{width:14},{width:14}], ['Seizoen','Actieve leden']);
  seizoenVolgorde.forEach(sz => {
    wsSeizoen.addRow([sz.replace('-', '–'), actievPerSeizoen[sz]?.size || 0]);
  });

  // ── Tabblad 4: Nieuwe leden ──
  const wsNieuw = wb.addWorksheet('Nieuwe leden');
  voegSheetHeaderToe(wsNieuw, [{width:18},{width:22},{width:12}], ['Voornaam','Achternaam','Gordel']);
  [...nieuw].sort(vergelijkLeden).forEach(m => {
    const { voornaam, achternaam } = lidNaamDelen(m);
    wsNieuw.addRow([voornaam, achternaam, m.gordel || m.belt || '—']);
  });

  await downloadWorkbook(wb, bestandsnaam('leden', seizoenLabel));
}
