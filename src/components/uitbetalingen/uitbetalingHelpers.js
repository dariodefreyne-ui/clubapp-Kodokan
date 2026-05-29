// Gedeelde helpers en stijlen voor de Uitbetalingen-pagina en haar subcomponenten
// (UitbetalingsMatrix, WedstrijdKostenSectie, UitbetalingStatistieken).
import { C } from '../trainingen/tokens';

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
  return lijst.find(l=>l.id===key) || lijst.find(l=>l.uid&&l.uid===key) || lijst.find(l=>normNaam(l.naam)===normNaam(key)) || null;
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
export function periodeVanSnelknop(type) {
  const nu=new Date(), jaar=nu.getFullYear(), maand=nu.getMonth();
  if (type==='deze-maand') {
    return { van:datumNaarISO(new Date(jaar,maand,1)), tot:datumNaarISO(new Date(jaar,maand+1,0)), naam:nu.toLocaleDateString('nl-BE',{month:'long',year:'numeric'}) };
  }
  if (type==='vorige-maand') {
    const d=new Date(jaar,maand-1,1);
    return { van:datumNaarISO(d), tot:datumNaarISO(new Date(jaar,maand,0)), naam:d.toLocaleDateString('nl-BE',{month:'long',year:'numeric'}) };
  }
  if (type==='dit-seizoen') {
    const s=maand>=8?jaar:jaar-1;
    return { van:`${s}-09-01`, tot:`${s+1}-06-30`, naam:`Seizoen ${s}-${s+1}` };
  }
  return null;
}
