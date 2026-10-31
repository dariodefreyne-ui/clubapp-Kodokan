// Gedeelde helpers en stijlen voor de Uitbetalingen-pagina en haar subcomponenten
// (UitbetalingsMatrix, WedstrijdKostenSectie, UitbetalingStatistieken).
import { C } from '../trainingen/tokens';
import { seizoenBereik } from '../../utils/seizoenUtils';

// ─── Formatters ────────────────────────────────────────────────────────────────
export function minutenNaarUren(min) { return Math.round((min / 60) * 100) / 100; }
export function formatUren(u) { return u ? `${Number(u).toFixed(2)}u` : '—'; }
export function formatBedrag(b) { return `€ ${Number(b).toFixed(2)}`; }
export function datumNaarISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function formatDatumLeesbaar(iso) {
  if (!iso) return '';
  return new Date(iso+'T00:00:00').toLocaleDateString('nl-BE',{weekday:'short',day:'numeric',month:'short'});
}
export function normNaam(s) { return String(s||'').trim().toLowerCase().replace(/\s+/g,' '); }
export function vindLesgever(key, lijst) {
  if (!key || !Array.isArray(lijst)) return null;
  // Lesgever-id is een lowercase slug van de naam op het moment van aanmaak (zie
  // LesgeversBeheer.jsx). Na een naamswijziging blijft die id ongewijzigd, terwijl
  // oudere trainingen/events de key nog met originele hoofdletters bewaren — vandaar
  // de hoofdletterongevoelige id-vergelijking naast de exacte match.
  return lijst.find(l=>l.id===key) || lijst.find(l=>normNaam(l.id)===normNaam(key))
    || lijst.find(l=>l.uid&&l.uid===key) || lijst.find(l=>normNaam(l.naam)===normNaam(key)) || null;
}

// ─── Stijl helpers ─────────────────────────────────────────────────────────────
export const INPUT = {
  background: 'transparent',
  border: `1px solid ${C.border}`,
  borderRadius: '6px',
  color: C.textPrimary,
  padding: '4px 8px',
  fontSize: '12px',
  fontFamily: 'inherit',
  textAlign: 'right',
  width: '72px',
};
export const SAVE_BTN = {
  padding: '4px 10px', background: C.green, border: 'none', borderRadius: '6px',
  color: 'white', cursor: 'pointer', fontSize: '11px', fontWeight: '700',
};
export const CANCEL_BTN = {
  padding: '4px 10px', background: 'transparent', border: `1px solid ${C.border}`,
  borderRadius: '6px', color: C.textMuted, cursor: 'pointer', fontSize: '11px',
};

// ─── Periode helpers ───────────────────────────────────────────────────────────
// Maandsleutels hebben het formaat 'YYYY-MM'. Een periode is { van, tot, naam } met
// ISO-datums (YYYY-MM-DD), identiek aan wat Firestore (uitbetalingsperiodes) bewaart.
export function maandNaam(maandNr) {
  return new Date(2000, maandNr - 1, 1).toLocaleDateString('nl-BE', { month: 'long' });
}
export function maandLabel(key) {
  const [j, m] = key.split('-').map(Number);
  return `${maandNaam(m)} ${j}`;
}
// offset in maanden t.o.v. vandaag (0 = deze maand, -1 = vorige maand, ...)
export function huidigeMaandKey(offset = 0) {
  const d = new Date();
  d.setDate(1); // eerst dag 1, anders springt 31 okt + 1 maand naar 1 dec
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
// Oplopende lijst maandsleutels, begin en einde inbegrepen.
export function maandSleutels(vanKey, totKey) {
  const lijst = [];
  let [j, m] = vanKey.split('-').map(Number);
  const [ej, em] = totKey.split('-').map(Number);
  while ((j < ej || (j === ej && m <= em)) && lijst.length < 120) {
    lijst.push(`${j}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; j++; }
  }
  return lijst;
}
// Periode van de 1e van de beginmaand t.e.m. de laatste dag van de eindmaand.
// Verkeerd om ingegeven (van > tot) wordt automatisch rechtgezet.
export function periodeVanMaanden(a, b) {
  const [vanKey, totKey] = a <= b ? [a, b] : [b, a];
  const [vj, vm] = vanKey.split('-').map(Number);
  const [tj, tm] = totKey.split('-').map(Number);
  const naam = vanKey === totKey ? maandLabel(vanKey)
    : vj === tj ? `${maandNaam(vm)} - ${maandLabel(totKey)}`
    : `${maandLabel(vanKey)} - ${maandLabel(totKey)}`;
  return { van: `${vanKey}-01`, tot: datumNaarISO(new Date(tj, tm, 0)), naam };
}
// true als de periode exact hele kalendermaanden omvat (dan kunnen de maandkiezers ze tonen)
export function isMaandBereik(p) {
  if (!p?.van || !p?.tot) return false;
  const [tj, tm] = p.tot.split('-').map(Number);
  return p.van.endsWith('-01') && p.tot === datumNaarISO(new Date(tj, tm, 0));
}
export function aantalMaanden(p) {
  const [vj, vm] = p.van.split('-').map(Number);
  const [tj, tm] = p.tot.split('-').map(Number);
  return (tj - vj) * 12 + (tm - vm) + 1;
}
export function periodeVanSnelknop(type) {
  if (type === 'deze-maand')   { const k = huidigeMaandKey(0);  return periodeVanMaanden(k, k); }
  if (type === 'vorige-maand') { const k = huidigeMaandKey(-1); return periodeVanMaanden(k, k); }
  if (type === 'dit-seizoen')  { const s = seizoenBereik(); return { van: s.start, tot: s.einde, naam: `Seizoen ${s.label}` }; }
  return null;
}

// ─── Weergave- en exporthelpers ────────────────────────────────────────────────
export function afrond2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
export function formatDagKort(iso)  { return new Date(iso + 'T00:00:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }); }
export function formatDagnaam(iso)  { return new Date(iso + 'T00:00:00').toLocaleDateString('nl-BE', { weekday: 'short' }); }
export function formatDagMetJaar(iso) { return new Date(iso + 'T00:00:00').toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' }); }
// "augustus - oktober 2026" → "Afrekening augustus - oktober 2026" (niet dubbel prefixen)
export function afrekeningNaam(naam) {
  const n = String(naam || '').trim();
  return /^afrekening\b/i.test(n) ? n : `Afrekening ${n}`;
}
export function bestandsDeel(naam) {
  return String(naam || 'periode').trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '_');
}

// Eén bron voor scherm én export: rijen per lesgever, alfabetisch.
// bedrag = null als er geen tarief is ingesteld voor het type (wordt dan expliciet gemeld).
export function bouwMatrixRijen({ data, lesgeversLijst, tarieven, tarieftypes }) {
  const rijen = Object.keys(data.lesgevers).map(id => {
    const info    = lesgeversLijst.find(l => l.id === id);
    const typeId  = info?.type || '';
    const tarief  = Number(tarieven[typeId]?.bedragPerUur) || 0;
    const cellen  = data.lesgevers[id];
    const uren    = afrond2(data.datums.reduce((s, d) => s + (cellen[d]?.uren || 0), 0));
    return {
      id, naam: info?.naam ?? id,
      typeLabel: tarieftypes.find(t => t.code === typeId)?.label || '',
      tarief, uren, bedrag: tarief > 0 ? afrond2(uren * tarief) : null, cellen,
    };
  });
  rijen.sort((a, b) => a.naam.localeCompare(b.naam));
  return rijen;
}
