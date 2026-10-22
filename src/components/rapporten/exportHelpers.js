// src/components/rapporten/exportHelpers.js
// Gedeelde stijl- en downloadhelpers voor de .xlsx-exports per Rapporten-tab.
// Houdt elke export-module klein: enkel de kolommen/rijen zijn tab-specifiek.

export const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
export const HEADER_FONT = { bold: true, color: { argb: 'FFFFFFFF' } };
export const TOTAAL_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

export function styleHeaderRow(row) {
  row.eachCell(cell => { cell.font = HEADER_FONT; cell.fill = HEADER_FILL; });
}

export function styleTotaalRow(row) {
  row.eachCell(cell => { cell.font = { bold: true }; cell.fill = TOTAAL_FILL; });
}

export async function maakWorkbook() {
  const { Workbook } = await import('exceljs');
  return new Workbook();
}

// Zet kolombreedtes + vetgedrukte/gekleurde headerrij + bevroren eerste rij —
// het patroon dat elk werkblad in deze exports gebruikt.
export function voegSheetHeaderToe(ws, kolommen, titels) {
  ws.columns = kolommen;
  const headerRow = ws.addRow(titels);
  styleHeaderRow(headerRow);
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  return headerRow;
}

export function bestandsnaam(rubriek, seizoenLabel) {
  const suffix = seizoenLabel
    ? seizoenLabel.replace(/[–—]/g, '-').replace(/\s+/g, '')
    : 'export';
  return `kodokan-${rubriek}_${suffix}.xlsx`;
}

export async function downloadWorkbook(wb, naam) {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = naam;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Uitbreidingen voor het voorraadrapport ──────────────────────────────────
export const EURO_FMT = '"€" #,##0.00';
export const PCT_FMT = '0%';
export const DATUM_FMT = 'dd/mm/yyyy';

// A4 liggend, 1 pagina breed, kopregel herhalen op elke pagina.
export function zetPrintInstellingen(ws, { herhaalRij = 1 } = {}) {
  ws.pageSetup = {
    orientation: 'landscape',
    paperSize: 9,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
  };
  if (herhaalRij) ws.pageSetup.printTitlesRow = `${herhaalRij}:${herhaalRij}`;
}

const MAAND_NAMEN = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
export function maandLabel(maand) {
  const [jaar, m] = String(maand).split('-');
  return `${MAAND_NAMEN[Number(m) - 1] || m} ${jaar}`;
}
