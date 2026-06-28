// src/components/bestuur/shared.jsx
// Gedeelde constanten, stijlen en helpers voor de Bestuur-tabs.
import { C } from '../../styles/tokens';
import { updateBestuursActiepunt, deleteBestuursActiepunt } from '../../services/firestoreService';

export const VERGADERING_TYPES = { bestuur: 'Bestuursvergadering', av: 'Algemene vergadering', bav: 'Buitengewone AV' };
export const AANWEZIG_OPTIES = { aanwezig: 'Aanwezig', verontschuldigd: 'Verontschuldigd', afwezig: 'Afwezig' };
export const ACTIE_STATUS = { open: 'Open', bezig: 'Bezig', afgerond: 'Afgerond' };
export const ACTIE_STATUS_KLEUR = { open: C.orange, bezig: C.blue, afgerond: C.green };
export const DOC_CATS = { vergadering: 'Vergaderingsverslag', statuten: 'Statuten', reglement: 'Huishoudelijk reglement', beleid: 'Beleid', verzekering: 'Verzekering', financieel: 'Financieel', overig: 'Overig' };
export const VERG_STATUS_KLEUR = { gepland: C.blue, bezig: C.red, afgerond: C.green };
export const VERG_STATUS_LABEL = { gepland: 'Gepland', bezig: 'Live', afgerond: 'Afgerond' };

export const LEGE_VERGADERING = { titel: '', type: 'bestuur', datum: '', tijdVan: '', tijdTot: '', locatie: '', herinneringDagen: 3, agendaTekst: '', besluitenTekst: '' };

export const S = {
  page: {},
  title: { fontSize: 'var(--font-size-xl)', fontWeight: '700' },
  tabBar: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  tab: (a) => ({ background: a ? C.red : C.card, border: `1px solid ${a ? C.red : C.border}`, color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }),
  card: { background: C.card, borderRadius: '12px', border: `1px solid ${C.border}`, padding: '16px', marginBottom: '12px' },
  input: { width: '100%', background: 'var(--bg-primary)', border: `1px solid ${C.border}`, borderRadius: '8px', color: 'var(--text-primary)', padding: '10px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '10px', fontFamily: 'inherit' },
  label: { color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px', display: 'block', fontWeight: '600' },
  btn: (v = 'primary') => ({ background: v === 'primary' ? C.red : v === 'ghost' ? 'transparent' : C.border, border: v === 'ghost' ? `1px solid ${C.border}` : 'none', color: 'var(--text-primary)', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' }),
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' },
  modalCard: { background: C.card, borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' },
  badge: (kleur) => ({ display: 'inline-block', padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', background: `${kleur}22`, color: kleur, border: `1px solid ${kleur}55` }),
  iconBtn: { background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '15px', padding: '4px 6px', fontFamily: 'inherit' },
};

export function vandaagISO() { return new Date().toISOString().slice(0, 10); }
export function formatDatum(iso) {
  if (!iso) return '';
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}
export function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
export function fileEmoji(fileName) {
  if (!fileName) return '📄';
  if (/\.docx?$/i.test(fileName)) return '📝';
  if (/\.pdf$/i.test(fileName)) return '📕';
  if (/\.xlsx?$/i.test(fileName)) return '📊';
  if (/\.(png|jpg|jpeg|gif|webp)$/i.test(fileName)) return '🖼️';
  return '📄';
}

export function getAgendaPunten(v) {
  if (v.agendaPunten?.length > 0) return v.agendaPunten;
  if (v.agenda?.length > 0) return v.agenda.map(tekst => ({ tekst, notities: '', behandeld: false, discussiepunten: [] }));
  return [];
}

export function genereerVerslagTekst(v, eigenActies = []) {
  const lines = [];
  const titel = v.titel || 'Vergadering';
  lines.push(`VERSLAG — ${titel}`);
  lines.push('='.repeat(Math.max(20, titel.length + 12)));
  lines.push('');
  lines.push(`Datum:     ${formatDatum(v.datum)}`);
  if (v.tijdVan) lines.push(`Tijdstip:  ${v.tijdVan}${v.tijdTot ? ' – ' + v.tijdTot : ''}`);
  if (v.locatie) lines.push(`Locatie:   ${v.locatie}`);
  lines.push(`Type:      ${VERGADERING_TYPES[v.type] || v.type}`);

  const aanwezig = (v.aanwezigheid || []).filter(a => a.status === 'aanwezig').map(a => a.naam);
  const veront = (v.aanwezigheid || []).filter(a => a.status === 'verontschuldigd').map(a => a.naam);
  const afwz = (v.aanwezigheid || []).filter(a => a.status === 'afwezig').map(a => a.naam);
  if (aanwezig.length + veront.length + afwz.length > 0) {
    lines.push(''); lines.push('AANWEZIGHEID'); lines.push('-'.repeat(24));
    if (aanwezig.length) lines.push(`Aanwezig:          ${aanwezig.join(', ')}`);
    if (veront.length)   lines.push(`Verontschuldigd:   ${veront.join(', ')}`);
    if (afwz.length)     lines.push(`Afwezig:           ${afwz.join(', ')}`);
  }

  const punten = getAgendaPunten(v);
  if (punten.length > 0) {
    lines.push(''); lines.push('AGENDA & NOTULEN'); lines.push('-'.repeat(24));
    punten.forEach((p, i) => {
      lines.push('');
      lines.push(`${i + 1}. ${p.tekst}${p.behandeld ? '  ✓' : ''}`);
      if (p.notities) p.notities.split('\n').forEach(l => l && lines.push(`   ${l}`));
      (p.discussiepunten || []).forEach(d => lines.push(`   • ${d.tekst}${d.opgelost ? ' [opgelost]' : ''}`));
    });
  }

  if (v.notulen?.trim()) {
    lines.push(''); lines.push('VRIJE NOTULEN'); lines.push('-'.repeat(24));
    v.notulen.split('\n').forEach(l => lines.push(l));
  }

  if ((v.besluiten || []).length > 0) {
    lines.push(''); lines.push('BESLUITEN'); lines.push('-'.repeat(24));
    v.besluiten.forEach(b => lines.push(`• ${b}`));
  }

  const openActies = eigenActies.filter(a => a.status !== 'afgerond');
  if (openActies.length > 0) {
    lines.push(''); lines.push('ACTIEPUNTEN'); lines.push('-'.repeat(24));
    openActies.forEach(a => {
      let r = `• ${a.omschrijving}`;
      if (a.verantwoordelijke) r += ` — ${a.verantwoordelijke}`;
      if (a.deadline) r += ` (deadline: ${formatDatum(a.deadline)})`;
      lines.push(r);
    });
  }

  lines.push('');
  lines.push(`Gegenereerd op ${new Date().toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })}`);
  return lines.join('\n');
}

export function SectieTitel({ children, accent }) {
  return (
    <div style={{
      fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px',
      color: accent ? C.red : 'var(--text-secondary)', opacity: accent ? 1 : 0.7,
      margin: '18px 0 8px',
    }}>
      {children}
    </div>
  );
}

export function Blok({ titel, children }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>{titel}</div>
      {children}
    </div>
  );
}

export function ActiepuntRij({ a, confirm, compact }) {
  const verlopen = a.deadline && a.status !== 'afgerond' && a.deadline < vandaagISO();
  async function zetStatus(status) { await updateBestuursActiepunt(a.id, { status }); }
  async function verwijder() {
    const ok = await confirm({ titel: 'Actiepunt verwijderen?', beschrijving: a.omschrijving, bevestigLabel: 'Verwijderen', variant: 'danger' });
    if (ok) await deleteBestuursActiepunt(a.id);
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: compact ? '6px 0' : 0, borderBottom: compact ? `1px solid ${C.border}` : 'none' }}>
      <div style={{ flex: 1, minWidth: '140px' }}>
        <div style={{ fontSize: '14px', textDecoration: a.status === 'afgerond' ? 'line-through' : 'none', opacity: a.status === 'afgerond' ? 0.6 : 1 }}>{a.omschrijving}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
          {a.verantwoordelijke ? `👤 ${a.verantwoordelijke}` : ''}{a.verantwoordelijke && a.deadline ? ' · ' : ''}
          {a.deadline ? <span style={{ color: verlopen ? C.red : 'var(--text-secondary)' }}>📅 {formatDatum(a.deadline)}{verlopen ? ' (verlopen)' : ''}</span> : ''}
        </div>
      </div>
      <select style={{ ...S.input, marginBottom: 0, width: 'auto', padding: '6px 8px', fontSize: '13px', borderColor: ACTIE_STATUS_KLEUR[a.status] }} value={a.status} onChange={e => zetStatus(e.target.value)}>
        {Object.entries(ACTIE_STATUS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      <button style={{ ...S.iconBtn, color: C.red }} onClick={verwijder}>🗑</button>
    </div>
  );
}
