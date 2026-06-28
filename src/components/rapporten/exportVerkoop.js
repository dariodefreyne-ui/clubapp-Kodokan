// src/components/rapporten/exportVerkoop.js
// Exporteert het Verkoop-rapport — trend per seizoen, per dag en alle
// transacties — als .xlsx met dezelfde indeling als de tab.

import { maakWorkbook, voegSheetHeaderToe, bestandsnaam, downloadWorkbook } from './exportHelpers';

export async function exportVerkoop(data, seizoenLabel = '') {
  const wb = await maakWorkbook();

  if (data.trend.length > 1) {
    const wsTrend = wb.addWorksheet('Trend per seizoen');
    voegSheetHeaderToe(wsTrend, [{width:14},{width:14},{width:14}], ['Seizoen','Transacties','Omzet']);
    data.trend.forEach(row => wsTrend.addRow([row.seizoen.replace('-','–'), row.count, Number(row.totaal.toFixed(2))]));
  }

  const wsDag = wb.addWorksheet('Per dag');
  voegSheetHeaderToe(wsDag, [{width:14},{width:14}], ['Datum','Omzet']);
  Object.entries(data.byDate).forEach(([date, tot]) => wsDag.addRow([date, Number(tot.toFixed(2))]));

  const wsTrans = wb.addWorksheet('Transacties');
  voegSheetHeaderToe(
    wsTrans,
    [{width:20},{width:40},{width:22},{width:12}],
    ['Datum/tijd','Items','Verkoper','Totaal'],
  );
  data.sales.forEach(s => {
    wsTrans.addRow([
      s._ts?.toDate ? s._ts.toDate().toLocaleString('nl-BE') : '—',
      (s.items||[]).map(i => `${i.name} ${i.variant||''} ×${i.qty}`).join(' · '),
      data.verkoperMap[s.verkoperUid] || s.koperNaam || '—',
      Number((s._totaal||0).toFixed(2)),
    ]);
  });

  await downloadWorkbook(wb, bestandsnaam('verkoop', seizoenLabel));
}
