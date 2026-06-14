// src/pages/Bestuur.jsx
// Bestuurspagina — enkel toegankelijk voor admin/bestuurslid (zie de gate in
// App.jsx + de Firestore/Storage-rules). Drie onderdelen:
//   1. Vergaderingen: inplannen (datum, tijd, locatie, type, agenda), aanwezigheid,
//      besluiten, actiepunten en het verslag (docx/pdf) achteraf opladen.
//   2. Actiepunten: overzicht over alle vergaderingen heen, met verantwoordelijke,
//      deadline en status.
//   3. Documenten: vaste bestuursdocumenten (statuten, reglement, verzekering, ...).
// Herinneringen (push + e-mail) worden server-side verstuurd door de scheduled
// Cloud Function `bestuursVergaderingHerinnering`.
import React, { useState, useEffect, useMemo, useCallback } from 'react';
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

const LEGE_VERGADERING = { titel: '', type: 'bestuur', datum: '', tijdVan: '', tijdTot: '', locatie: '', herinneringDagen: 3, agendaTekst: '', besluitenTekst: '' };

const S = {
  page: {},
  title: { fontSize: 'var(--font-size-xl)', fontWeight: '700' },
  tabBar: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  tab: (a) => ({ background: a ? C.red : C.card, border: `1px solid ${a ? C.red : C.border}`, color: 'var(--text-primary)', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }),
  card: { background: C.card, borderRadius: '12px', border: `1px solid ${C.border}`, padding: '16px', marginBottom: '12px' },
  input: { width: '100%', background: 'var(--bg-primary)', border: `1px solid ${C.border}`, borderRadius: '8px', color: 'var(--text-primary)', padding: '10px', fontSize: '14px', boxSizing: 'border-box', marginBottom: '10px' },
  label: { color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px', display: 'block', fontWeight: '600' },
  btn: (v = 'primary') => ({ background: v === 'primary' ? C.red : v === 'ghost' ? 'transparent' : C.border, border: v === 'ghost' ? `1px solid ${C.border}` : 'none', color: 'var(--text-primary)', padding: '9px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }),
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' },
  modalCard: { background: C.card, borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '520px', maxHeight: '90vh', overflowY: 'auto' },
  badge: (kleur) => ({ display: 'inline-block', padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '700', background: `${kleur}22`, color: kleur, border: `1px solid ${kleur}55` }),
  iconBtn: { background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '15px', padding: '4px 6px' },
};

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

export default function Bestuur() {
  const { isBeheerder } = useAuth();
  const confirm = useConfirm();

  const [tab, setTab] = useState('vergaderingen');
  const [vergaderingen, setVergaderingen] = useState([]);
  const [actiepunten, setActiepunten] = useState([]);
  const [documenten, setDocumenten] = useState([]);
  const [bestuursleden, setBestuursleden] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isBeheerder) return;
    const u1 = subscribeBestuursVergaderingen(lijst => {
      lijst.sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
      setVergaderingen(lijst);
      setLoading(false);
    });
    const u2 = subscribeBestuursActiepunten(setActiepunten);
    const u3 = subscribeBestuursDocumenten(setDocumenten);
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
  const [modal, setModal] = useState(null); // null | 'nieuw' | vergadering-object (edit)
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
    const data = {
      titel: form.titel.trim(),
      type: form.type,
      datum: form.datum,
      tijdVan: form.tijdVan,
      tijdTot: form.tijdTot,
      locatie: form.locatie.trim(),
      herinneringDagen: Number(form.herinneringDagen) || 0,
      agenda: form.agendaTekst.split('\n').map(s => s.trim()).filter(Boolean),
      besluiten: form.besluitenTekst.split('\n').map(s => s.trim()).filter(Boolean),
    };
    if (modal === 'nieuw') {
      await addBestuursVergadering({ ...data, status: 'gepland', herinneringVerstuurd: false });
    } else {
      // Datum gewijzigd → herinnering opnieuw toelaten (verschoven vergadering).
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
  const komend = vergaderingen.filter(v => (v.datum || '') >= nu && v.status !== 'afgerond');
  const verleden = vergaderingen.filter(v => !((v.datum || '') >= nu && v.status !== 'afgerond'));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button style={S.btn('primary')} onClick={openNieuw}>+ Nieuwe vergadering</button>
      </div>

      {vergaderingen.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>Nog geen vergaderingen ingepland.</div>
      )}

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
        <div style={S.modal} onClick={() => setModal(null)}>
          <div style={S.modalCard} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{modal === 'nieuw' ? 'Nieuwe vergadering' : 'Vergadering bewerken'}</h3>
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

function SectieTitel({ children }) {
  return <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-secondary)', opacity: 0.7, margin: '18px 0 8px' }}>{children}</div>;
}

function VergaderingKaart({ v, open, onToggle, onEdit, onDelete, actiepunten, documenten, bestuursleden, confirm }) {
  const eigenActies = actiepunten.filter(a => a.vergaderingId === v.id);
  const openActies = eigenActies.filter(a => a.status !== 'afgerond').length;
  const gekoppeldeDocs = (documenten || []).filter(d => d.vergaderingId === v.id);
  const totaalVerslagen = (v.verslagen || []).length + gekoppeldeDocs.length;

  async function setStatus() {
    await updateBestuursVergadering(v.id, { status: v.status === 'afgerond' ? 'gepland' : 'afgerond' });
  }

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }} onClick={onToggle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: '700', fontSize: '15px' }}>{v.titel}</span>
            <span style={S.badge(v.status === 'afgerond' ? C.green : C.blue)}>{v.status === 'afgerond' ? 'Afgerond' : 'Gepland'}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{VERGADERING_TYPES[v.type] || v.type}</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            📅 {formatDatum(v.datum)}{v.tijdVan ? ` · ${v.tijdVan}${v.tijdTot ? '–' + v.tijdTot : ''}` : ''}{v.locatie ? ` · 📍 ${v.locatie}` : ''}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {(v.agenda || []).length > 0 && <span>📋 {v.agenda.length} agendapunt{v.agenda.length === 1 ? '' : 'en'}</span>}
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
            <button style={S.btn('ghost')} onClick={setStatus}>{v.status === 'afgerond' ? '↩️ Heropenen' : '✓ Afronden'}</button>
            <button style={{ ...S.btn('ghost'), color: C.red }} onClick={onDelete}>🗑 Verwijderen</button>
          </div>

          {(v.agenda || []).length > 0 && (
            <Blok titel="Agenda">
              <ol style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-primary)', fontSize: '14px' }}>
                {v.agenda.map((a, i) => <li key={i} style={{ marginBottom: '3px' }}>{a}</li>)}
              </ol>
            </Blok>
          )}

          <AanwezigheidBlok v={v} bestuursleden={bestuursleden} />

          {(v.besluiten || []).length > 0 && (
            <Blok titel="Besluiten">
              <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-primary)', fontSize: '14px' }}>
                {v.besluiten.map((b, i) => <li key={i} style={{ marginBottom: '3px' }}>{b}</li>)}
              </ul>
            </Blok>
          )}

          <ActiepuntenBlok v={v} eigenActies={eigenActies} confirm={confirm} />

          <VerslagenBlok v={v} gekoppeldeDocs={gekoppeldeDocs} confirm={confirm} />
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

function AanwezigheidBlok({ v, bestuursleden }) {
  const huidig = useMemo(() => {
    const map = {};
    (v.aanwezigheid || []).forEach(a => { if (a.uid) map[a.uid] = a.status; });
    return map;
  }, [v.aanwezigheid]);

  async function zet(lid, status) {
    const basis = (bestuursleden.length ? bestuursleden : (v.aanwezigheid || []).map(a => ({ uid: a.uid, naam: a.naam })));
    const nieuw = basis.map(b => ({
      uid: b.uid,
      naam: b.naam || b.email || b.uid,
      status: b.uid === lid.uid ? status : (huidig[b.uid] || 'aanwezig'),
    }));
    await updateBestuursVergadering(v.id, { aanwezigheid: nieuw });
  }

  if (bestuursleden.length === 0) return null;
  return (
    <Blok titel="Aanwezigheid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {bestuursleden.map(lid => {
          const status = huidig[lid.uid] || 'aanwezig';
          return (
            <div key={lid.uid} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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

function ActiepuntenBlok({ v, eigenActies, confirm }) {
  const [omschrijving, setOmschrijving] = useState('');
  const [verantwoordelijke, setVerantwoordelijke] = useState('');
  const [deadline, setDeadline] = useState('');

  async function voegToe() {
    if (!omschrijving.trim()) return;
    await addBestuursActiepunt({
      omschrijving: omschrijving.trim(),
      verantwoordelijke: verantwoordelijke.trim(),
      deadline: deadline || '',
      status: 'open',
      vergaderingId: v.id,
      vergaderingTitel: v.titel || '',
    });
    setOmschrijving(''); setVerantwoordelijke(''); setDeadline('');
  }

  return (
    <Blok titel="Actiepunten">
      {eigenActies.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>Nog geen actiepunten.</div>}
      {eigenActies.map(a => <ActiepuntRij key={a.id} a={a} confirm={confirm} compact />)}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', alignItems: 'flex-end' }}>
        <div style={{ flex: '2 1 160px' }}>
          <input style={{ ...S.input, marginBottom: 0 }} value={omschrijving} onChange={e => setOmschrijving(e.target.value)} placeholder="Nieuw actiepunt…" />
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

function VerslagenBlok({ v, gekoppeldeDocs = [], confirm }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

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
        const nieuw = [...(v.verslagen || []), entry];
        await updateBestuursVergadering(v.id, { verslagen: nieuw });
        setUploading(false); setProgress(0);
      }
    );
  }

  async function verwijder(entry) {
    const ok = await confirm({ titel: 'Verslag verwijderen?', beschrijving: entry.fileName, bevestigLabel: 'Verwijderen', variant: 'danger' });
    if (!ok) return;
    if (entry.pad) { try { await deleteObject(ref(storage, entry.pad)); } catch { /* bestand al weg */ } }
    const nieuw = (v.verslagen || []).filter(x => x !== entry && x.url !== entry.url);
    await updateBestuursVergadering(v.id, { verslagen: nieuw });
  }

  return (
    <Blok titel="Verslagen & bijlagen">
      {(v.verslagen || []).map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: '20px' }}>{/\.docx?$/i.test(d.fileName) ? '📝' : /\.pdf$/i.test(d.fileName) ? '📕' : '📄'}</span>
          <a href={d.url} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0, color: 'var(--text-primary)', textDecoration: 'none', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.titel || d.fileName}
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}> · {formatSize(d.fileSize)}</span>
          </a>
          <button style={{ ...S.iconBtn, color: C.red }} onClick={() => verwijder(d)}>🗑</button>
        </div>
      ))}
      {/* Documenten uit de Documenten-tab die aan deze vergadering gekoppeld zijn
          (read-only hier — beheren gebeurt in de Documenten-tab). */}
      {gekoppeldeDocs.map(d => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: '20px' }}>{/\.docx?$/i.test(d.fileName) ? '📝' : /\.pdf$/i.test(d.fileName) ? '📕' : '📄'}</span>
          <a href={d.url} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0, color: 'var(--text-primary)', textDecoration: 'none', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.titel || d.fileName}
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}> · {DOC_CATS[d.categorie] || d.categorie} · gekoppeld</span>
          </a>
        </div>
      ))}
      <label style={{ display: 'inline-block', marginTop: '10px', cursor: 'pointer', ...S.btn('ghost') }}>
        {uploading ? `Uploaden… ${progress}%` : '⬆️ Verslag opladen (Word/PDF/Excel)'}
        <input type="file" accept=".doc,.docx,.pdf,.odt,.xlsx,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={kies} disabled={uploading} />
      </label>
    </Blok>
  );
}

// ─── ACTIEPUNTEN-TAB ─────────────────────────────────────────────────────────
function ActiepuntenTab({ actiepunten, vergaderingen, confirm }) {
  const [filter, setFilter] = useState('open'); // open | alle | afgerond
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ omschrijving: '', verantwoordelijke: '', deadline: '', vergaderingId: '' });

  const gesorteerd = useMemo(() => {
    const lijst = [...actiepunten];
    lijst.sort((a, b) => {
      const da = a.deadline || '9999';
      const dbb = b.deadline || '9999';
      return da.localeCompare(dbb);
    });
    if (filter === 'open') return lijst.filter(a => a.status !== 'afgerond');
    if (filter === 'afgerond') return lijst.filter(a => a.status === 'afgerond');
    return lijst;
  }, [actiepunten, filter]);

  async function bewaar() {
    if (!form.omschrijving.trim()) return;
    const v = vergaderingen.find(x => x.id === form.vergaderingId);
    await addBestuursActiepunt({
      omschrijving: form.omschrijving.trim(),
      verantwoordelijke: form.verantwoordelijke.trim(),
      deadline: form.deadline || '',
      status: 'open',
      vergaderingId: form.vergaderingId || null,
      vergaderingTitel: v?.titel || '',
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
        <div style={S.modal} onClick={() => setModal(false)}>
          <div style={S.modalCard} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Nieuw actiepunt</h3>
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

// ─── DOCUMENTEN-TAB ─────────────────────────────────────────────────────────
function DocumentenTab({ documenten, vergaderingen, confirm }) {
  const [modal, setModal] = useState(false);
  const [file, setFile] = useState(null);
  const [titel, setTitel] = useState('');
  const [cat, setCat] = useState('vergadering');
  const [vergaderingId, setVergaderingId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const gesorteerd = useMemo(() => {
    const l = [...documenten];
    l.sort((a, b) => (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0));
    return l;
  }, [documenten]);

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
          vergaderingId: vergaderingId || null,
          vergaderingTitel: gekoppeld?.titel || '',
        });
        setModal(false); setFile(null); setTitel(''); setCat('vergadering'); setVergaderingId(''); setUploading(false); setProgress(0);
      }
    );
  }

  async function verwijder(d) {
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

      {gesorteerd.length === 0 && <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>Nog geen bestuursdocumenten.</div>}
      {gesorteerd.map(d => (
        <div key={d.id} style={{ ...S.card, display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '26px' }}>{/\.docx?$/i.test(d.fileName) ? '📝' : /\.pdf$/i.test(d.fileName) ? '📕' : '📄'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <a href={d.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: '600', fontSize: '14px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.titel}</a>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>{DOC_CATS[d.categorie] || d.categorie} · {formatSize(d.fileSize)}{d.vergaderingTitel ? ` · ↳ ${d.vergaderingTitel}` : ''}</div>
          </div>
          <button style={{ ...S.iconBtn, color: C.red }} onClick={() => verwijder(d)}>🗑</button>
        </div>
      ))}

      {modal && (
        <div style={S.modal} onClick={() => !uploading && setModal(false)}>
          <div style={S.modalCard} onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Bestuursdocument uploaden</h3>
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
            <label style={S.label}>Koppelen aan vergadering (optioneel — verschijnt dan ook bij die vergadering)</label>
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
