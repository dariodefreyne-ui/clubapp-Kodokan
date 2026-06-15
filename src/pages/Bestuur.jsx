// src/pages/Bestuur.jsx
// Bestuurspagina — enkel toegankelijk voor admin/bestuurslid.
// Drie tabs: Vergaderingen (met live-vergadering-modus, agenda-notulen,
// actiepunten, verslagen), Actiepunten (cross-vergadering overzicht),
// Documenten (gegroepeerd per vergadering + overige).
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useConfirm } from '../contexts/ConfirmContext';
import {
  subscribeBestuursVergaderingen, addBestuursVergadering, updateBestuursVergadering, deleteBestuursVergadering,
  subscribeBestuursActiepunten, addBestuursActiepunt, updateBestuursActiepunt, deleteBestuursActiepunt,
  subscribeBestuursDocumenten, addBestuursDocument, deleteBestuursDocument,
  getBestuursleden,
} from '../services/firestoreService';
import { C } from '../styles/tokens';

const VERGADERING_TYPES = { bestuur: 'Bestuursvergadering', av: 'Algemene vergadering', bav: 'Buitengewone AV' };
const AANWEZIG_OPTIES = { aanwezig: 'Aanwezig', verontschuldigd: 'Verontschuldigd', afwezig: 'Afwezig' };
const ACTIE_STATUS = { open: 'Open', bezig: 'Bezig', afgerond: 'Afgerond' };
const ACTIE_STATUS_KLEUR = { open: C.orange, bezig: C.blue, afgerond: C.green };
const DOC_CATS = { vergadering: 'Vergaderingsverslag', statuten: 'Statuten', reglement: 'Huishoudelijk reglement', beleid: 'Beleid', verzekering: 'Verzekering', financieel: 'Financieel', overig: 'Overig' };
const VERG_STATUS_KLEUR = { gepland: C.blue, bezig: C.red, afgerond: C.green };
const VERG_STATUS_LABEL = { gepland: 'Gepland', bezig: 'Live', afgerond: 'Afgerond' };

const LEGE_VERGADERING = { titel: '', type: 'bestuur', datum: '', tijdVan: '', tijdTot: '', locatie: '', herinneringDagen: 3, agendaTekst: '', besluitenTekst: '' };

const S = {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────
function vandaagISO() { return new Date().toISOString().slice(0, 10); }
function formatDatum(iso) {
  if (!iso) return '';
  try { return new Date(iso + 'T00:00:00').toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}
function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
function fileEmoji(fileName) {
  if (!fileName) return '📄';
  if (/\.docx?$/i.test(fileName)) return '📝';
  if (/\.pdf$/i.test(fileName)) return '📕';
  if (/\.xlsx?$/i.test(fileName)) return '📊';
  if (/\.(png|jpg|jpeg|gif|webp)$/i.test(fileName)) return '🖼️';
  return '📄';
}

function getAgendaPunten(v) {
  if (v.agendaPunten?.length > 0) return v.agendaPunten;
  if (v.agenda?.length > 0) return v.agenda.map(tekst => ({ tekst, notities: '', behandeld: false, discussiepunten: [] }));
  return [];
}

function genereerVerslagTekst(v, eigenActies = []) {
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

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function Bestuur() {
  const { isBeheerder } = useAuth();
  const confirm = useConfirm();

  const [tab, setTab] = useState('vergaderingen');
  const [vergaderingen, setVergaderingen] = useState([]);
  const [actiepunten, setActiepunten] = useState([]);
  const [documenten, setDocumenten] = useState([]);
  const [bestuursleden, setBestuursleden] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fout, setFout] = useState(null);

  useEffect(() => {
    if (!isBeheerder) return;
    setFout(null);
    const onFout = (err) => {
      setLoading(false);
      setFout(`${err.code ?? 'fout'}: ${err.message}`);
    };
    const u1 = subscribeBestuursVergaderingen(lijst => {
      lijst.sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
      setVergaderingen(lijst);
      setLoading(false);
    }, onFout);
    const u2 = subscribeBestuursActiepunten(setActiepunten, onFout);
    const u3 = subscribeBestuursDocumenten(setDocumenten, onFout);
    getBestuursleden().then(setBestuursleden).catch(() => {});
    return () => { u1(); u2(); u3(); };
  }, [isBeheerder]);

  if (!isBeheerder) {
    return (
      <div style={{ ...S.page, textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>🔒</div>
        <div style={{ fontSize: '18px', fontWeight: '700' }}>Geen toegang</div>
        <div style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          Deze pagina is enkel voor bestuursleden en admins.
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={S.title}>🏛️ Bestuur</div>
      </div>

      {fout && (
        <div style={{ background: `${C.red}18`, border: `1px solid ${C.red}`, borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: C.red }}>
          <strong>Firestore-fout</strong> — controleer de browser-console voor details.<br />
          <span style={{ fontFamily: 'monospace', fontSize: '12px', opacity: 0.85 }}>{fout}</span>
        </div>
      )}

      <div style={S.tabBar}>
        <button style={S.tab(tab === 'vergaderingen')} onClick={() => setTab('vergaderingen')}>📅 Vergaderingen</button>
        <button style={S.tab(tab === 'actiepunten')} onClick={() => setTab('actiepunten')}>
          ✅ Actiepunten{actiepunten.filter(a => a.status !== 'afgerond').length > 0 ? ` (${actiepunten.filter(a => a.status !== 'afgerond').length})` : ''}
        </button>
        <button style={S.tab(tab === 'documenten')} onClick={() => setTab('documenten')}>📁 Documenten</button>
      </div>

      {tab === 'vergaderingen' && (
        <VergaderingenTab
          vergaderingen={vergaderingen} loading={loading} actiepunten={actiepunten}
          documenten={documenten} bestuursleden={bestuursleden} confirm={confirm}
        />
      )}
      {tab === 'actiepunten' && (
        <ActiepuntenTab actiepunten={actiepunten} vergaderingen={vergaderingen} confirm={confirm} />
      )}
      {tab === 'documenten' && (
        <DocumentenTab documenten={documenten} vergaderingen={vergaderingen} confirm={confirm} />
      )}
    </div>
  );
}

// ─── VERGADERINGEN ─────────────────────────────────────────────────────────────
function VergaderingenTab({ vergaderingen, loading, actiepunten, documenten, bestuursleden, confirm }) {
  const [openId, setOpenId] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(LEGE_VERGADERING);

  function openNieuw() {
    setForm({ ...LEGE_VERGADERING, datum: vandaagISO() });
    setModal('nieuw');
  }
  function openEdit(v) {
    setForm({
      titel: v.titel || '', type: v.type || 'bestuur', datum: v.datum || '',
      tijdVan: v.tijdVan || '', tijdTot: v.tijdTot || '', locatie: v.locatie || '',
      herinneringDagen: v.herinneringDagen ?? 3,
      agendaTekst: (v.agenda || []).join('\n'),
      besluitenTekst: (v.besluiten || []).join('\n'),
    });
    setModal(v);
  }

  async function bewaar() {
    if (!form.titel.trim() || !form.datum) return;
    const agendaLijst = form.agendaTekst.split('\n').map(s => s.trim()).filter(Boolean);
    const bestaandeAP = modal === 'nieuw' ? [] : (modal.agendaPunten || []);
    const agendaPunten = agendaLijst.map(tekst => {
      const gevonden = bestaandeAP.find(p => p.tekst === tekst);
      return gevonden || { tekst, notities: '', behandeld: false, discussiepunten: [] };
    });
    const data = {
      titel: form.titel.trim(), type: form.type, datum: form.datum,
      tijdVan: form.tijdVan, tijdTot: form.tijdTot, locatie: form.locatie.trim(),
      herinneringDagen: Number(form.herinneringDagen) || 0,
      agenda: agendaLijst, agendaPunten,
      besluiten: form.besluitenTekst.split('\n').map(s => s.trim()).filter(Boolean),
    };
    if (modal === 'nieuw') {
      await addBestuursVergadering({ ...data, status: 'gepland', herinneringVerstuurd: false });
    } else {
      if (modal.datum !== data.datum) data.herinneringVerstuurd = false;
      await updateBestuursVergadering(modal.id, data);
    }
    setModal(null);
  }

  async function verwijder(v) {
    const ok = await confirm({ titel: 'Vergadering verwijderen?', beschrijving: `"${v.titel}" en bijhorende gegevens worden verwijderd.`, bevestigLabel: 'Verwijderen', variant: 'danger' });
    if (!ok) return;
    await deleteBestuursVergadering(v.id);
  }

  if (loading) return <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>Laden…</div>;

  const nu = vandaagISO();
  const live    = vergaderingen.filter(v => v.status === 'bezig');
  // Wees inclusief: vergaderingen met een onbekende/ontbrekende status vallen
  // in 'komend' of 'verleden' op basis van de datum, niet verloren.
  const komend  = vergaderingen.filter(v => v.status !== 'bezig' && v.status !== 'afgerond' && (v.datum || '') >= nu);
  const verleden = vergaderingen.filter(v => v.status !== 'bezig' && (v.status === 'afgerond' || (v.datum || '') < nu));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button style={S.btn('primary')} onClick={openNieuw}>+ Nieuwe vergadering</button>
      </div>

      {vergaderingen.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>Nog geen vergaderingen ingepland.</div>
      )}

      {live.length > 0 && <SectieTitel accent>🔴 Live vergadering</SectieTitel>}
      {live.map(v => (
        <VergaderingKaart key={v.id} v={v} open={openId === v.id} onToggle={() => setOpenId(openId === v.id ? null : v.id)}
          onEdit={() => openEdit(v)} onDelete={() => verwijder(v)} actiepunten={actiepunten} documenten={documenten} bestuursleden={bestuursleden} confirm={confirm} />
      ))}

      {komend.length > 0 && <SectieTitel>Komende vergaderingen</SectieTitel>}
      {komend.map(v => (
        <VergaderingKaart key={v.id} v={v} open={openId === v.id} onToggle={() => setOpenId(openId === v.id ? null : v.id)}
          onEdit={() => openEdit(v)} onDelete={() => verwijder(v)} actiepunten={actiepunten} documenten={documenten} bestuursleden={bestuursleden} confirm={confirm} />
      ))}

      {verleden.length > 0 && <SectieTitel>Afgelopen vergaderingen</SectieTitel>}
      {verleden.map(v => (
        <VergaderingKaart key={v.id} v={v} open={openId === v.id} onToggle={() => setOpenId(openId === v.id ? null : v.id)}
          onEdit={() => openEdit(v)} onDelete={() => verwijder(v)} actiepunten={actiepunten} documenten={documenten} bestuursleden={bestuursleden} confirm={confirm} />
      ))}

      {modal && (
        <div style={S.modal} onClick={() => setModal(null)} onKeyDown={e => e.key === 'Escape' && setModal(null)}>
          <div style={S.modalCard} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="vergadering-modal-titel">
            <h3 style={{ marginTop: 0 }} id="vergadering-modal-titel">{modal === 'nieuw' ? 'Nieuwe vergadering' : 'Vergadering bewerken'}</h3>
            <label style={S.label}>Titel *</label>
            <input style={S.input} value={form.titel} onChange={e => setForm(f => ({ ...f, titel: e.target.value }))} placeholder="Bv. Bestuursvergadering juni" />
            <label style={S.label}>Type</label>
            <select style={S.input} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {Object.entries(VERGADERING_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={S.label}>Datum *</label>
                <input type="date" style={S.input} value={form.datum} onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} />
              </div>
              <div style={{ width: '110px' }}>
                <label style={S.label}>Van</label>
                <input type="time" style={S.input} value={form.tijdVan} onChange={e => setForm(f => ({ ...f, tijdVan: e.target.value }))} />
              </div>
              <div style={{ width: '110px' }}>
                <label style={S.label}>Tot</label>
                <input type="time" style={S.input} value={form.tijdTot} onChange={e => setForm(f => ({ ...f, tijdTot: e.target.value }))} />
              </div>
            </div>
            <label style={S.label}>Locatie</label>
            <input style={S.input} value={form.locatie} onChange={e => setForm(f => ({ ...f, locatie: e.target.value }))} placeholder="Bv. Clubhuis / online" />
            <label style={S.label}>Herinnering (dagen vooraf — push + e-mail naar bestuur)</label>
            <input type="number" min="0" max="30" style={S.input} value={form.herinneringDagen} onChange={e => setForm(f => ({ ...f, herinneringDagen: e.target.value }))} />
            <label style={S.label}>Agenda (één punt per lijn)</label>
            <textarea style={{ ...S.input, minHeight: '90px', resize: 'vertical' }} value={form.agendaTekst} onChange={e => setForm(f => ({ ...f, agendaTekst: e.target.value }))} placeholder={'Goedkeuring vorig verslag\nFinancieel overzicht\nVaria'} />
            <label style={S.label}>Besluiten (één per lijn — kan ook achteraf)</label>
            <textarea style={{ ...S.input, minHeight: '70px', resize: 'vertical' }} value={form.besluitenTekst} onChange={e => setForm(f => ({ ...f, besluitenTekst: e.target.value }))} placeholder="Genomen beslissingen…" />
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button style={{ ...S.btn('primary'), flex: 1 }} onClick={bewaar} disabled={!form.titel.trim() || !form.datum}>Bewaren</button>
              <button style={S.btn('ghost')} onClick={() => setModal(null)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SectieTitel({ children, accent }) {
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

// ─── VERGADERING KAART ─────────────────────────────────────────────────────────
function VergaderingKaart({ v, open, onToggle, onEdit, onDelete, actiepunten, documenten, bestuursleden, confirm }) {
  const eigenActies = actiepunten.filter(a => a.vergaderingId === v.id);
  const openActies = eigenActies.filter(a => a.status !== 'afgerond').length;
  const gekoppeldeDocs = (documenten || []).filter(d => d.vergaderingId === v.id);
  const totaalVerslagen = (v.verslagen || []).length + gekoppeldeDocs.length;
  const isLive = v.status === 'bezig';
  const statusKleur = VERG_STATUS_KLEUR[v.status] || C.blue;
  const statusLabel = VERG_STATUS_LABEL[v.status] || v.status;
  const agendaAantal = (v.agendaPunten || v.agenda || []).length;

  async function startVergadering() {
    await updateBestuursVergadering(v.id, { status: 'bezig', startTijdstip: new Date().toISOString() });
  }
  async function beeindigVergadering() {
    await updateBestuursVergadering(v.id, { status: 'afgerond', eindTijdstip: new Date().toISOString() });
  }
  async function heropenen() {
    await updateBestuursVergadering(v.id, { status: 'gepland' });
  }

  return (
    <div style={{ ...S.card, border: isLive ? `2px solid ${C.red}` : `1px solid ${C.border}` }}>
      {isLive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', padding: '7px 12px', background: `${C.red}15`, borderRadius: '8px' }}>
          <span style={{ color: C.red, fontWeight: '800', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔴 Live vergadering</span>
          {v.startTijdstip && <LiveTimer startTijdstip={v.startTijdstip} />}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }} onClick={onToggle} role="button" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: '700', fontSize: '15px' }}>{v.titel}</span>
            <span style={S.badge(statusKleur)}>{statusLabel}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{VERGADERING_TYPES[v.type] || v.type}</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            📅 {formatDatum(v.datum)}{v.tijdVan ? ` · ${v.tijdVan}${v.tijdTot ? '–' + v.tijdTot : ''}` : ''}{v.locatie ? ` · 📍 ${v.locatie}` : ''}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {agendaAantal > 0 && <span>📋 {agendaAantal} agendapunt{agendaAantal === 1 ? '' : 'en'}</span>}
            {totaalVerslagen > 0 && <span>📄 {totaalVerslagen} verslag{totaalVerslagen === 1 ? '' : 'en'}</span>}
            {openActies > 0 && <span style={{ color: C.orange }}>✅ {openActies} open actiepunt{openActies === 1 ? '' : 'en'}</span>}
          </div>
        </div>
        <span style={{ color: 'var(--text-secondary)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ marginTop: '14px', borderTop: `1px solid ${C.border}`, paddingTop: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <button style={S.btn('ghost')} onClick={onEdit}>✏️ Bewerken</button>
            {v.status === 'gepland' && (
              <button style={{ ...S.btn('ghost'), color: C.red, border: `1px solid ${C.red}` }} onClick={startVergadering}>
                ▶️ Start vergadering
              </button>
            )}
            {v.status === 'bezig' && (
              <button style={{ ...S.btn('ghost'), color: C.green, border: `1px solid ${C.green}` }} onClick={beeindigVergadering}>
                ⏹ Beëindig vergadering
              </button>
            )}
            {v.status === 'afgerond' && (
              <button style={S.btn('ghost')} onClick={heropenen}>↩️ Heropenen</button>
            )}
            <button style={{ ...S.btn('ghost'), color: C.red }} onClick={onDelete}>🗑 Verwijderen</button>
          </div>

          <AgendaPuntenBlok v={v} />
          <AanwezigheidBlok v={v} bestuursleden={bestuursleden} />
          <NotulenBlok v={v} />

          {(v.besluiten || []).length > 0 && (
            <Blok titel="Besluiten">
              <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-primary)', fontSize: '14px' }}>
                {v.besluiten.map((b, i) => <li key={i} style={{ marginBottom: '3px' }}>{b}</li>)}
              </ul>
            </Blok>
          )}

          <ActiepuntenBlok v={v} eigenActies={eigenActies} confirm={confirm} />
          <VerslagenBlok v={v} gekoppeldeDocs={gekoppeldeDocs} eigenActies={eigenActies} confirm={confirm} />
        </div>
      )}
    </div>
  );
}

function Blok({ titel, children }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px' }}>{titel}</div>
      {children}
    </div>
  );
}

// ─── LIVE TIMER ────────────────────────────────────────────────────────────────
function LiveTimer({ startTijdstip }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startTijdstip).getTime();
    setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    const iv = setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000))), 1000);
    return () => clearInterval(iv);
  }, [startTijdstip]);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return (
    <span style={{ fontFamily: 'monospace', fontSize: '13px', color: C.red, marginLeft: 'auto', fontWeight: '700' }}>
      {h > 0 ? `${h}:` : ''}{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

// ─── AGENDA PUNTEN BLOK ───────────────────────────────────────────────────────
function AgendaPuntenBlok({ v }) {
  const [localPunten, setLocalPunten] = useState(() => getAgendaPunten(v));
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [nieuwPunt, setNieuwPunt] = useState({});
  const saveTimerRef = useRef(null);

  // Sync when vergadering or agenda changes (agenda text modified from modal)
  useEffect(() => {
    const nieuw = getAgendaPunten(v);
    const huidig = localPunten;
    const teksGewijzigd = nieuw.length !== huidig.length || nieuw.some((p, i) => p.tekst !== huidig[i]?.tekst);
    if (teksGewijzigd) setLocalPunten(nieuw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.agenda, v.agendaPunten]);

  function slaOp(punten) {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      updateBestuursVergadering(v.id, { agendaPunten: punten }).catch(() => {});
    }, 600);
  }

  function zetBehandeld(i, val) {
    const nieuw = localPunten.map((p, j) => j === i ? { ...p, behandeld: val } : p);
    setLocalPunten(nieuw);
    updateBestuursVergadering(v.id, { agendaPunten: nieuw }).catch(() => {});
  }

  function zetNotities(i, tekst) {
    const nieuw = localPunten.map((p, j) => j === i ? { ...p, notities: tekst } : p);
    setLocalPunten(nieuw);
    slaOp(nieuw);
  }

  function voegDiscussieToe(i) {
    const tekst = (nieuwPunt[i] || '').trim();
    if (!tekst) return;
    const dp = [...(localPunten[i].discussiepunten || []), { tekst, opgelost: false }];
    const nieuw = localPunten.map((p, j) => j === i ? { ...p, discussiepunten: dp } : p);
    setLocalPunten(nieuw);
    updateBestuursVergadering(v.id, { agendaPunten: nieuw }).catch(() => {});
    setNieuwPunt(np => ({ ...np, [i]: '' }));
  }

  function zetDiscussieOpgelost(i, di, opgelost) {
    const dp = localPunten[i].discussiepunten.map((d, j) => j === di ? { ...d, opgelost } : d);
    const nieuw = localPunten.map((p, j) => j === i ? { ...p, discussiepunten: dp } : p);
    setLocalPunten(nieuw);
    updateBestuursVergadering(v.id, { agendaPunten: nieuw }).catch(() => {});
  }

  function verwijderDiscussie(i, di) {
    const dp = localPunten[i].discussiepunten.filter((_, j) => j !== di);
    const nieuw = localPunten.map((p, j) => j === i ? { ...p, discussiepunten: dp } : p);
    setLocalPunten(nieuw);
    updateBestuursVergadering(v.id, { agendaPunten: nieuw }).catch(() => {});
  }

  if (!localPunten.length) return null;

  return (
    <Blok titel="Agenda & discussiepunten">
      {localPunten.map((p, i) => {
        const expanded = expandedIdx === i;
        const heeftInhoud = p.notities || (p.discussiepunten || []).length > 0;
        return (
          <div key={i} style={{ marginBottom: '6px', border: `1px solid ${p.behandeld ? `${C.green}44` : C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', cursor: 'pointer', background: p.behandeld ? `${C.green}0d` : 'transparent', transition: 'background 0.15s' }}
              onClick={() => setExpandedIdx(expanded ? null : i)}
            >
              <input
                type="checkbox"
                checked={p.behandeld || false}
                onChange={e => { e.stopPropagation(); zetBehandeld(i, e.target.checked); }}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: C.green, flexShrink: 0 }}
              />
              <span style={{ flex: 1, fontSize: '14px', fontWeight: '600', textDecoration: p.behandeld ? 'line-through' : 'none', opacity: p.behandeld ? 0.65 : 1 }}>
                {i + 1}. {p.tekst}
              </span>
              {heeftInhoud && (
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '4px' }}>
                  {p.notities && <span>📝</span>}
                  {(p.discussiepunten || []).length > 0 && <span>💬{p.discussiepunten.length}</span>}
                </span>
              )}
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{expanded ? '▲' : '▼'}</span>
            </div>

            {expanded && (
              <div style={{ padding: '12px', borderTop: `1px solid ${C.border}`, background: 'var(--bg-primary)' }}>
                <label style={S.label}>Notities</label>
                <textarea
                  style={{ ...S.input, minHeight: '70px', resize: 'vertical', marginBottom: '14px' }}
                  value={p.notities || ''}
                  onChange={e => zetNotities(i, e.target.value)}
                  placeholder="Bespreking, opmerkingen…"
                />

                {(p.discussiepunten || []).length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Discussiepunten</div>
                    {p.discussiepunten.map((d, di) => (
                      <div key={di} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
                        <input type="checkbox" checked={d.opgelost || false} onChange={e => zetDiscussieOpgelost(i, di, e.target.checked)} style={{ accentColor: C.green, flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', flex: 1, textDecoration: d.opgelost ? 'line-through' : 'none', opacity: d.opgelost ? 0.55 : 1, color: d.opgelost ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                          {d.tekst}
                        </span>
                        <button style={{ ...S.iconBtn, fontSize: '13px' }} onClick={() => verwijderDiscussie(i, di)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    style={{ ...S.input, marginBottom: 0, flex: 1, fontSize: '13px' }}
                    value={nieuwPunt[i] || ''}
                    onChange={e => setNieuwPunt(np => ({ ...np, [i]: e.target.value }))}
                    placeholder="Nieuw discussiepunt…"
                    onKeyDown={e => e.key === 'Enter' && voegDiscussieToe(i)}
                  />
                  <button style={{ ...S.btn('ghost'), padding: '9px 12px' }} onClick={() => voegDiscussieToe(i)}>+</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </Blok>
  );
}

// ─── NOTULEN BLOK ─────────────────────────────────────────────────────────────
function NotulenBlok({ v }) {
  const [tekst, setTekst] = useState(v.notulen || '');
  const [status, setStatus] = useState(null); // null | 'saving' | 'saved'
  const timerRef = useRef(null);

  useEffect(() => {
    setTekst(v.notulen || '');
  }, [v.id]); // reset only when switching to a different vergadering

  function wijzig(val) {
    setTekst(val);
    setStatus('saving');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updateBestuursVergadering(v.id, { notulen: val })
        .then(() => { setStatus('saved'); setTimeout(() => setStatus(null), 2000); })
        .catch(() => setStatus(null));
    }, 1200);
  }

  const label = status === 'saved' ? 'Notulen · ✓ opgeslagen' : status === 'saving' ? 'Notulen · opslaan…' : 'Notulen';

  return (
    <Blok titel={label}>
      <textarea
        style={{ ...S.input, minHeight: '100px', resize: 'vertical', marginBottom: 0 }}
        value={tekst}
        onChange={e => wijzig(e.target.value)}
        placeholder="Vrije notulen — automatisch opgeslagen na stoppen met typen…"
      />
    </Blok>
  );
}

// ─── AANWEZIGHEID ──────────────────────────────────────────────────────────────
function AanwezigheidBlok({ v, bestuursleden }) {
  const huidig = useMemo(() => {
    const map = {};
    (v.aanwezigheid || []).forEach(a => { if (a.uid) map[a.uid] = a.status; });
    return map;
  }, [v.aanwezigheid]);

  async function zet(lid, status) {
    const basis = bestuursleden.length ? bestuursleden : (v.aanwezigheid || []).map(a => ({ uid: a.uid, naam: a.naam }));
    const nieuw = basis.map(b => ({
      uid: b.uid, naam: b.naam || b.email || b.uid,
      status: b.uid === lid.uid ? status : (huidig[b.uid] || 'aanwezig'),
    }));
    await updateBestuursVergadering(v.id, { aanwezigheid: nieuw });
  }

  if (!bestuursleden.length) return null;
  return (
    <Blok titel="Aanwezigheid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {bestuursleden.map(lid => {
          const status = huidig[lid.uid] || 'aanwezig';
          const kleur = status === 'aanwezig' ? C.green : status === 'verontschuldigd' ? C.orange : C.red;
          return (
            <div key={lid.uid} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: kleur, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: '120px', fontSize: '14px' }}>{lid.naam || lid.email || lid.uid}</span>
              <select style={{ ...S.input, marginBottom: 0, width: 'auto', padding: '6px 8px', fontSize: '13px' }} value={status} onChange={e => zet(lid, e.target.value)}>
                {Object.entries(AANWEZIG_OPTIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          );
        })}
      </div>
    </Blok>
  );
}

// ─── ACTIEPUNTEN BLOK (binnen vergadering) ─────────────────────────────────────
function ActiepuntenBlok({ v, eigenActies, confirm }) {
  const [omschrijving, setOmschrijving] = useState('');
  const [verantwoordelijke, setVerantwoordelijke] = useState('');
  const [deadline, setDeadline] = useState('');

  async function voegToe() {
    if (!omschrijving.trim()) return;
    await addBestuursActiepunt({
      omschrijving: omschrijving.trim(), verantwoordelijke: verantwoordelijke.trim(),
      deadline: deadline || '', status: 'open',
      vergaderingId: v.id, vergaderingTitel: v.titel || '',
    });
    setOmschrijving(''); setVerantwoordelijke(''); setDeadline('');
  }

  return (
    <Blok titel="Actiepunten">
      {eigenActies.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>Nog geen actiepunten.</div>}
      {eigenActies.map(a => <ActiepuntRij key={a.id} a={a} confirm={confirm} compact />)}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', alignItems: 'flex-end' }}>
        <div style={{ flex: '2 1 160px' }}>
          <input style={{ ...S.input, marginBottom: 0 }} value={omschrijving} onChange={e => setOmschrijving(e.target.value)} placeholder="Nieuw actiepunt…" onKeyDown={e => e.key === 'Enter' && voegToe()} />
        </div>
        <div style={{ flex: '1 1 110px' }}>
          <input style={{ ...S.input, marginBottom: 0 }} value={verantwoordelijke} onChange={e => setVerantwoordelijke(e.target.value)} placeholder="Wie?" />
        </div>
        <input type="date" style={{ ...S.input, marginBottom: 0, width: 'auto' }} value={deadline} onChange={e => setDeadline(e.target.value)} />
        <button style={S.btn('primary')} onClick={voegToe} disabled={!omschrijving.trim()}>+ Toevoegen</button>
      </div>
    </Blok>
  );
}

// ─── VERSLAGEN BLOK ───────────────────────────────────────────────────────────
function VerslagenBlok({ v, gekoppeldeDocs = [], eigenActies = [], confirm }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [verslagModal, setVerslagModal] = useState(false);

  function kies(e) {
    const file = e.target.files[0];
    if (file) upload(file);
    e.target.value = '';
  }

  function upload(file) {
    setUploading(true); setProgress(0);
    const pad = `bestuur/${v.id}/${Date.now()}_${file.name}`;
    const task = uploadBytesResumable(ref(storage, pad), file);
    task.on('state_changed',
      snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      err => { console.error(err); setUploading(false); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        const entry = { titel: file.name.replace(/\.[^.]+$/, ''), url, pad, fileName: file.name, fileSize: file.size, uploadedAt: Date.now() };
        await updateBestuursVergadering(v.id, { verslagen: [...(v.verslagen || []), entry] });
        setUploading(false); setProgress(0);
      }
    );
  }

  async function verwijder(entry) {
    const ok = await confirm({ titel: 'Verslag verwijderen?', beschrijving: entry.fileName, bevestigLabel: 'Verwijderen', variant: 'danger' });
    if (!ok) return;
    if (entry.pad) { try { await deleteObject(ref(storage, entry.pad)); } catch { /* al weg */ } }
    await updateBestuursVergadering(v.id, { verslagen: (v.verslagen || []).filter(x => x.url !== entry.url) });
  }

  return (
    <Blok titel="Verslagen & bijlagen">
      {(v.verslagen || []).map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: '20px' }}>{fileEmoji(d.fileName)}</span>
          <a href={d.url} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0, color: 'var(--text-primary)', textDecoration: 'none', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.titel || d.fileName}
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}> · {formatSize(d.fileSize)}</span>
          </a>
          <button style={{ ...S.iconBtn, color: C.red }} onClick={() => verwijder(d)}>🗑</button>
        </div>
      ))}
      {gekoppeldeDocs.map(d => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: '20px' }}>{fileEmoji(d.fileName)}</span>
          <a href={d.url} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0, color: 'var(--text-primary)', textDecoration: 'none', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.titel || d.fileName}
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}> · {DOC_CATS[d.categorie] || d.categorie} · gekoppeld</span>
          </a>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
        <label style={{ display: 'inline-block', cursor: 'pointer', ...S.btn('ghost') }}>
          {uploading ? `Uploaden… ${progress}%` : '⬆️ Verslag opladen'}
          <input type="file" accept=".doc,.docx,.pdf,.odt,.xlsx,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={kies} disabled={uploading} />
        </label>
        <button style={S.btn('ghost')} onClick={() => setVerslagModal(true)}>📋 Genereer verslag</button>
      </div>
      {uploading && (
        <div style={{ marginTop: '8px', height: '4px', background: 'var(--bg-primary)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: C.red, width: `${progress}%`, transition: 'width 0.3s' }} />
        </div>
      )}
      {verslagModal && <VerslagModal v={v} eigenActies={eigenActies} onSluit={() => setVerslagModal(false)} />}
    </Blok>
  );
}

// ─── VERSLAG GENERATIE MODAL ──────────────────────────────────────────────────
function VerslagModal({ v, eigenActies, onSluit }) {
  const tekst = genereerVerslagTekst(v, eigenActies);
  const [gekopieerd, setGekopieerd] = useState(false);

  function kopieer() {
    navigator.clipboard?.writeText(tekst).then(() => {
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2500);
    });
  }

  function download() {
    const blob = new Blob([tekst], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verslag-${v.datum || 'onbekend'}-${(v.titel || 'vergadering').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={S.modal} onClick={onSluit} onKeyDown={e => e.key === 'Escape' && onSluit()}>
      <div style={{ ...S.modalCard, maxWidth: '620px' }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="verslag-modal-titel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }} id="verslag-modal-titel">📋 Gegenereerd verslag</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={S.btn('ghost')} onClick={kopieer}>{gekopieerd ? '✓ Gekopieerd!' : '📋 Kopiëren'}</button>
            <button style={S.btn('ghost')} onClick={download}>⬇️ .txt</button>
          </div>
        </div>
        <pre style={{ background: 'var(--bg-primary)', borderRadius: '8px', padding: '14px', overflow: 'auto', fontSize: '12px', lineHeight: '1.65', color: 'var(--text-primary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '55vh', border: `1px solid ${C.border}` }}>
          {tekst}
        </pre>
        <div style={{ marginTop: '12px' }}>
          <button style={{ ...S.btn('ghost'), width: '100%' }} onClick={onSluit}>Sluiten</button>
        </div>
      </div>
    </div>
  );
}

// ─── ACTIEPUNTEN TAB ──────────────────────────────────────────────────────────
function ActiepuntenTab({ actiepunten, vergaderingen, confirm }) {
  const [filter, setFilter] = useState('open');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ omschrijving: '', verantwoordelijke: '', deadline: '', vergaderingId: '' });

  const gesorteerd = useMemo(() => {
    const lijst = [...actiepunten].sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
    if (filter === 'open') return lijst.filter(a => a.status !== 'afgerond');
    if (filter === 'afgerond') return lijst.filter(a => a.status === 'afgerond');
    return lijst;
  }, [actiepunten, filter]);

  async function bewaar() {
    if (!form.omschrijving.trim()) return;
    const verg = vergaderingen.find(x => x.id === form.vergaderingId);
    await addBestuursActiepunt({
      omschrijving: form.omschrijving.trim(), verantwoordelijke: form.verantwoordelijke.trim(),
      deadline: form.deadline || '', status: 'open',
      vergaderingId: form.vergaderingId || null, vergaderingTitel: verg?.titel || '',
    });
    setForm({ omschrijving: '', verantwoordelijke: '', deadline: '', vergaderingId: '' });
    setModal(false);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[['open', 'Open'], ['alle', 'Alle'], ['afgerond', 'Afgerond']].map(([k, l]) =>
            <button key={k} style={S.tab(filter === k)} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
        <button style={S.btn('primary')} onClick={() => setModal(true)}>+ Nieuw actiepunt</button>
      </div>

      {gesorteerd.length === 0 && <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>Geen actiepunten.</div>}
      {gesorteerd.map(a => (
        <div key={a.id} style={S.card}>
          <ActiepuntRij a={a} confirm={confirm} />
          {a.vergaderingTitel && <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '6px' }}>↳ uit: {a.vergaderingTitel}</div>}
        </div>
      ))}

      {modal && (
        <div style={S.modal} onClick={() => setModal(false)} onKeyDown={e => e.key === 'Escape' && setModal(false)}>
          <div style={S.modalCard} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="actiepunt-modal-titel">
            <h3 style={{ marginTop: 0 }} id="actiepunt-modal-titel">Nieuw actiepunt</h3>
            <label style={S.label}>Omschrijving *</label>
            <input style={S.input} value={form.omschrijving} onChange={e => setForm(f => ({ ...f, omschrijving: e.target.value }))} />
            <label style={S.label}>Verantwoordelijke</label>
            <input style={S.input} value={form.verantwoordelijke} onChange={e => setForm(f => ({ ...f, verantwoordelijke: e.target.value }))} />
            <label style={S.label}>Deadline</label>
            <input type="date" style={S.input} value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            <label style={S.label}>Koppelen aan vergadering (optioneel)</label>
            <select style={S.input} value={form.vergaderingId} onChange={e => setForm(f => ({ ...f, vergaderingId: e.target.value }))}>
              <option value="">— Geen —</option>
              {vergaderingen.map(v => <option key={v.id} value={v.id}>{v.titel} ({v.datum})</option>)}
            </select>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button style={{ ...S.btn('primary'), flex: 1 }} onClick={bewaar} disabled={!form.omschrijving.trim()}>Bewaren</button>
              <button style={S.btn('ghost')} onClick={() => setModal(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActiepuntRij({ a, confirm, compact }) {
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

// ─── DOCUMENTEN TAB ───────────────────────────────────────────────────────────
function DocRij({ d, kanVerwijderen, onVerwijder }) {
  return (
    <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '26px' }}>{fileEmoji(d.fileName)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <a href={d.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: '600', fontSize: '14px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.titel || d.fileName}
        </a>
        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
          {d._bron === 'verslag' ? 'Verslag' : (DOC_CATS[d.categorie] || d.categorie)} · {formatSize(d.fileSize)}
        </div>
      </div>
      {kanVerwijderen && onVerwijder && (
        <button style={{ ...S.iconBtn, color: C.red }} onClick={() => onVerwijder(d)}>🗑</button>
      )}
    </div>
  );
}

function DocumentenTab({ documenten, vergaderingen, confirm }) {
  const [modal, setModal] = useState(false);
  const [file, setFile] = useState(null);
  const [titel, setTitel] = useState('');
  const [cat, setCat] = useState('vergadering');
  const [vergaderingId, setVergaderingId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Combine linked docs + embedded verslagen per vergadering
  const perVergadering = useMemo(() => {
    const map = {};
    // Linked docs from bestuursDocumenten
    documenten.forEach(d => {
      if (d.vergaderingId) {
        if (!map[d.vergaderingId]) map[d.vergaderingId] = [];
        map[d.vergaderingId].push({ ...d, _bron: 'doc' });
      }
    });
    // Embedded verslagen uploaded directly to a vergadering
    vergaderingen.forEach(v => {
      (v.verslagen || []).forEach(vsl => {
        const alsBestuursDoc = (documenten || []).some(d => d.vergaderingId === v.id && d.url === vsl.url);
        if (!alsBestuursDoc) {
          if (!map[v.id]) map[v.id] = [];
          map[v.id].push({ ...vsl, _bron: 'verslag', vergaderingId: v.id, _vergId: v.id });
        }
      });
    });
    return map;
  }, [documenten, vergaderingen]);

  const zonderVergadering = useMemo(() =>
    [...documenten].filter(d => !d.vergaderingId).sort((a, b) => (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0)),
    [documenten]
  );

  const vergaderingenMetBestanden = useMemo(() =>
    [...vergaderingen].filter(v => perVergadering[v.id]?.length > 0),
    [vergaderingen, perVergadering]
  );

  const totaalBestanden = documenten.length + vergaderingen.reduce((s, v) => s + (v.verslagen?.length || 0), 0);

  function kies(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    if (!titel) setTitel(f.name.replace(/\.[^.]+$/, ''));
  }

  function upload() {
    if (!file || !titel.trim()) return;
    setUploading(true); setProgress(0);
    const pad = `bestuur/documenten/${Date.now()}_${file.name}`;
    const task = uploadBytesResumable(ref(storage, pad), file);
    task.on('state_changed',
      snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      err => { console.error(err); setUploading(false); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        const gekoppeld = vergaderingen.find(x => x.id === vergaderingId);
        await addBestuursDocument({
          titel: titel.trim(), categorie: cat, url, pad, fileName: file.name, fileSize: file.size,
          vergaderingId: vergaderingId || null, vergaderingTitel: gekoppeld?.titel || '',
        });
        setModal(false); setFile(null); setTitel(''); setCat('vergadering'); setVergaderingId(''); setUploading(false); setProgress(0);
      }
    );
  }

  async function verwijderDoc(d) {
    const ok = await confirm({ titel: 'Document verwijderen?', beschrijving: d.titel, bevestigLabel: 'Verwijderen', variant: 'danger' });
    if (!ok) return;
    if (d.pad) { try { await deleteObject(ref(storage, d.pad)); } catch { /* al weg */ } }
    await deleteBestuursDocument(d.id);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button style={S.btn('primary')} onClick={() => setModal(true)}>+ Document uploaden</button>
      </div>

      {totaalBestanden === 0 && (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>Nog geen bestuursdocumenten.</div>
      )}

      {/* Gegroepeerd per vergadering */}
      {vergaderingenMetBestanden.map(v => (
        <div key={v.id} style={{ marginBottom: '20px' }}>
          <SectieTitel>📅 {v.titel} · {formatDatum(v.datum)}</SectieTitel>
          {perVergadering[v.id].map((d, i) => (
            <DocRij key={d.id || i} d={d} kanVerwijderen={d._bron === 'doc'} onVerwijder={verwijderDoc} />
          ))}
        </div>
      ))}

      {/* Overige documenten */}
      {zonderVergadering.length > 0 && (
        <div>
          {vergaderingenMetBestanden.length > 0 && <SectieTitel>Overige documenten</SectieTitel>}
          {zonderVergadering.map(d => <DocRij key={d.id} d={d} kanVerwijderen onVerwijder={verwijderDoc} />)}
        </div>
      )}

      {modal && (
        <div style={S.modal} onClick={() => !uploading && setModal(false)} onKeyDown={e => { if (e.key === 'Escape' && !uploading) setModal(false); }}>
          <div style={S.modalCard} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="document-modal-titel">
            <h3 style={{ marginTop: 0 }} id="document-modal-titel">Bestuursdocument uploaden</h3>
            <label style={{ display: 'block', background: 'var(--bg-primary)', border: `2px dashed ${C.border}`, borderRadius: '10px', padding: '24px', textAlign: 'center', cursor: 'pointer', marginBottom: '12px', color: 'var(--text-secondary)' }}>
              {file ? <span style={{ color: 'var(--text-primary)' }}>📄 {file.name}</span> : '📁 Klik om bestand te kiezen'}
              <input type="file" accept=".doc,.docx,.pdf,.odt,.xlsx,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={kies} />
            </label>
            <label style={S.label}>Titel</label>
            <input style={S.input} value={titel} onChange={e => setTitel(e.target.value)} placeholder="Naam van het document" />
            <label style={S.label}>Categorie</label>
            <select style={S.input} value={cat} onChange={e => setCat(e.target.value)}>
              {Object.entries(DOC_CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <label style={S.label}>Koppelen aan vergadering — verschijnt dan ook bij die vergadering</label>
            <select style={S.input} value={vergaderingId} onChange={e => setVergaderingId(e.target.value)}>
              <option value="">— Geen —</option>
              {vergaderingen.map(v => <option key={v.id} value={v.id}>{v.titel} ({v.datum})</option>)}
            </select>
            {uploading && (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>{progress}% geüpload…</div>
                <div style={{ height: '6px', background: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: C.red, width: `${progress}%`, transition: 'width 0.3s' }} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button style={{ ...S.btn('primary'), flex: 1 }} onClick={upload} disabled={uploading || !file || !titel.trim()}>{uploading ? 'Uploaden…' : '⬆️ Uploaden'}</button>
              <button style={S.btn('ghost')} onClick={() => setModal(false)} disabled={uploading}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
