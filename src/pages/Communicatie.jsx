import React, { useState, useEffect, useRef } from 'react';
import {
  collection, onSnapshot, addDoc, deleteDoc, doc,
  query, orderBy, serverTimestamp, limit, getDocs, getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { C, buttonStyle, cardStyle, inputStyle } from '../styles/tokens';
import { stuurPushTrigger, PUSH_TYPES } from '../services/pushService';
import { getAllUsers, sendMail } from '../services/firestoreService';
import { CLUB_NAAM_KORT as CLUB_NAAM_KORT_FALLBACK, COLLECTIONS, ROL_LABELS } from '../config/appConfig';

const BATCH = 15;

const CATEGORIEËN = [
  { value: 'training',  label: 'Training',  icon: '📅', color: C.blue,    dim: C.blueDim },
  { value: 'wedstrijd', label: 'Wedstrijd', icon: '🏆', color: C.orange,  dim: C.orangeDim },
  { value: 'examen',    label: 'Examen',    icon: '📘', color: C.green,   dim: C.greenDim },
  { value: 'evenement', label: 'Evenement', icon: '🎉', color: C.purple,  dim: C.purpleDim },
  { value: 'overige',   label: 'Overige',   icon: '📣', color: C.textSec, dim: C.borderSoft },
];

const ROL_OPTIES = [
  { value: 'alle',        label: 'Iedereen' },
  { value: 'admin',       label: 'Admin' },
  { value: 'bestuurslid', label: 'Bestuursleden' },
  { value: 'trainer',     label: 'Trainers' },
  { value: 'lid',         label: 'Leden' },
];

function catVoor(cat) {
  return CATEGORIEËN.find(c => c.value === cat) || CATEGORIEËN[4]; // overige
}

function groepLabel(idOrNaam, alleGroepen) {
  const g = alleGroepen.find(x => x.id === idOrNaam);
  return g ? g.naam : idOrNaam;
}

function isRelevanteMessage(msg, userRol, userGroepIds, userUid) {
  if (msg.sendToAll) return true;
  if (msg.targetRoles?.length && msg.targetRoles.includes(userRol)) return true;
  if (msg.groups?.length && userGroepIds.some(id => msg.groups.includes(id))) return true;
  if (msg.targetUids?.length && msg.targetUids.includes(userUid)) return true;
  return false;
}

function buildEmailHtml(title, body, auteurNaam, clubNaamKort, appUrl = '') {
  const safe = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  const ctaHtml = appUrl
    ? `<div style="text-align:center;margin:30px 0;">
        <a href="${appUrl}" style="display:inline-block;background-color:#d99999;color:#2a2a2a;padding:16px 40px;text-decoration:none;border-radius:4px;font-weight:700;font-size:16px;">→ Open de app</a>
       </div>`
    : '';
  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#1e1e1e;font-family:Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#2a2a2a;">
    <div style="background:#2a2a2a;padding:30px 20px;border-bottom:4px solid #d99999;">
      <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;line-height:1.2;">${safe(title)}</h1>
    </div>
    <div style="background:#d99999;padding:20px;text-align:center;">
      <p style="margin:0;font-size:18px;font-weight:700;color:#2a2a2a;">${clubNaamKort}</p>
    </div>
    <div style="padding:30px 20px;background:#2a2a2a;">
      <div style="color:#e0e0e0;font-size:15px;line-height:1.6;">${safe(body)}</div>
      <p style="color:#888888;font-size:13px;margin-top:24px;">— ${safe(auteurNaam)}</p>
      ${ctaHtml}
    </div>
    <div style="background:#222222;padding:20px;border-top:1px solid #444444;">
      <p style="margin:0;color:#888888;font-size:12px;line-height:1.6;">Ontvangen via de ${clubNaamKort} Clubapp.</p>
    </div>
  </div>
</body>
</html>`;
}

const S = {
  page:     {},
  card:     { ...cardStyle(), marginBottom: '12px' },
  inp:      { ...inputStyle, marginBottom: '10px' },
  textarea: { ...inputStyle, marginBottom: '10px', minHeight: '100px', resize: 'vertical' },
  label:    { color: C.textSec, fontSize: '12px', marginBottom: '4px', display: 'block' },
  btn:      (v = 'primary') => buttonStyle(v),
  chip:     (sel, color, dim) => ({
    background: sel ? (dim || C.redDim) : 'transparent',
    border: `1px solid ${sel ? (color || C.red) : C.borderSoft}`,
    color: sel ? (color || C.red) : C.textSec,
    padding: '5px 12px', borderRadius: '14px', cursor: 'pointer', fontSize: '12px',
    fontWeight: sel ? '700' : '400',
  }),
  modeBtn:  (sel) => ({
    padding: '7px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: sel ? '700' : '400',
    border: `1px solid ${sel ? C.red : C.borderSoft}`,
    background: sel ? C.redDim : 'transparent', color: sel ? C.red : C.textSec,
  }),
  checkRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', cursor: 'pointer', fontSize: '14px' },
  badge:    (color) => ({ background: color ? color + '28' : C.redDim, color: color || C.red, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', marginRight: '4px', border: `1px solid ${color || C.red}40` }),
};

// ─── Leden modal component ────────────────────────────────────────────────────

function LedenModal({ selectedUids, onChange }) {
  const [open, setOpen]           = useState(false);
  const [alleUsers, setAlleUsers] = useState([]);
  const [laden, setLaden]         = useState(false);
  const [draft, setDraft]         = useState([]);   // tijdelijke selectie in modal
  const [zoek, setZoek]           = useState('');
  const zoekRef                   = useRef(null);

  function openModal() {
    if (alleUsers.length === 0 && !laden) {
      setLaden(true);
      getAllUsers().then(users => {
        setAlleUsers(users.sort((a, b) => (a.naam || '').localeCompare(b.naam || '')));
        setLaden(false);
      });
    }
    setDraft([...selectedUids]);
    setZoek('');
    setOpen(true);
    setTimeout(() => zoekRef.current?.focus(), 50);
  }

  function bevestig() {
    onChange(draft);
    setOpen(false);
  }

  function annuleer() {
    setOpen(false);
  }

  function toggleDraft(uid) {
    setDraft(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);
  }

  function removeSelected(uid) {
    onChange(selectedUids.filter(x => x !== uid));
  }

  // ESC sluit modal
  useEffect(() => {
    if (!open) return;
    const handler = e => { if (e.key === 'Escape') annuleer(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const gefilterd = zoek.trim()
    ? alleUsers.filter(u =>
        (u.naam || '').toLowerCase().includes(zoek.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(zoek.toLowerCase())
      )
    : alleUsers;

  const selectedUsers = alleUsers.filter(u => selectedUids.includes(u.uid));
  const MAX_CHIPS = 4;

  return (
    <>
      {/* Geselecteerde leden als chips */}
      {selectedUids.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          {selectedUsers.slice(0, MAX_CHIPS).map(u => (
            <span key={u.uid} style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: C.redDim, border: `1px solid ${C.red}40`,
              color: C.textPrimary, padding: '4px 10px', borderRadius: '20px', fontSize: '12px',
            }}>
              {u.naam || u.email}
              <button
                onClick={() => removeSelected(u.uid)}
                style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', padding: 0, fontSize: '14px', lineHeight: 1 }}
              >×</button>
            </span>
          ))}
          {selectedUids.length > MAX_CHIPS && (
            <span style={{
              background: C.surface, border: `1px solid ${C.borderSoft}`,
              color: C.textSec, padding: '4px 10px', borderRadius: '20px', fontSize: '12px',
            }}>
              +{selectedUids.length - MAX_CHIPS} meer
            </span>
          )}
        </div>
      )}

      {/* Knop om modal te openen */}
      <button
        type="button"
        onClick={openModal}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '9px 14px', borderRadius: '8px', cursor: 'pointer',
          border: `1px solid ${selectedUids.length ? C.red : C.borderSoft}`,
          background: selectedUids.length ? C.redDim : C.surface,
          color: selectedUids.length ? C.red : C.textSec,
          fontSize: '13px', fontWeight: '600', width: '100%', justifyContent: 'center',
        }}
      >
        👥 {selectedUids.length ? `${selectedUids.length} lid(en) geselecteerd — bewerken` : 'Selecteer leden...'}
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={e => { if (e.target === e.currentTarget) annuleer(); }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div style={{
            background: C.card, border: `1px solid ${C.borderSoft}`,
            borderRadius: '16px', width: '100%', maxWidth: '460px',
            maxHeight: '82vh', display: 'flex', flexDirection: 'column',
            boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
          }}>
            {/* Header */}
            <div style={{ padding: '16px 16px 12px', borderBottom: `1px solid ${C.borderSoft}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontWeight: '800', fontSize: '16px' }}>Leden selecteren</div>
              <button onClick={annuleer} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>

            {/* Zoekbalk */}
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.borderSoft}` }}>
              <input
                ref={zoekRef}
                style={{ ...inputStyle }}
                placeholder="Zoek op naam of e-mail..."
                value={zoek}
                onChange={e => setZoek(e.target.value)}
              />
              {draft.length > 0 && (
                <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: C.red, fontWeight: '700' }}>{draft.length} geselecteerd</span>
                  <button
                    onClick={() => setDraft([])}
                    style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '12px', padding: 0 }}
                  >
                    Alles deselecteren
                  </button>
                </div>
              )}
            </div>

            {/* Lijst */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {laden && <div style={{ padding: '24px', textAlign: 'center', color: C.textMuted, fontSize: '13px' }}>Laden...</div>}
              {!laden && gefilterd.length === 0 && (
                <div style={{ padding: '24px', textAlign: 'center', color: C.textMuted, fontSize: '13px' }}>Geen leden gevonden</div>
              )}
              {!laden && gefilterd.map(u => {
                const sel = draft.includes(u.uid);
                return (
                  <div
                    key={u.uid}
                    onClick={() => toggleDraft(u.uid)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 16px', cursor: 'pointer',
                      background: sel ? C.redDim : 'transparent',
                      borderBottom: `1px solid ${C.borderSoft}`,
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{
                      width: '20px', height: '20px', borderRadius: '6px', flexShrink: 0,
                      border: `2px solid ${sel ? C.red : C.borderSoft}`,
                      background: sel ? C.red : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '12px', color: '#fff',
                    }}>
                      {sel && '✓'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: sel ? '700' : '500', color: C.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {u.naam || '(Geen naam)'}
                      </div>
                      <div style={{ fontSize: '11px', color: C.textMuted }}>
                        {ROL_LABELS[u.rol] || u.rol}{u.email ? ` · ${u.email}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div style={{
              padding: '12px 16px', borderTop: `1px solid ${C.borderSoft}`,
              display: 'flex', gap: '10px', alignItems: 'center',
            }}>
              <button onClick={annuleer} style={{ ...buttonStyle(), flex: 1 }}>Annuleren</button>
              <button
                onClick={bevestig}
                disabled={draft.length === 0}
                style={{ ...buttonStyle('primary'), flex: 2, opacity: draft.length === 0 ? 0.5 : 1 }}
              >
                Bevestigen ({draft.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Hoofd component ───────────────────────────────────────────────────────────

export default function Communicatie() {
  const { role, profiel, lesgeverId, isBeheerder, isLid, configCache } = useAuth();
  const clubNaamKort = configCache?.clubSettings?.naamKort || configCache?.clubSettings?.naam || CLUB_NAAM_KORT_FALLBACK;
  const appUrl = configCache?.clubSettings?.appUrl || '';
  const confirm = useConfirm();

  const [messages, setMessages]             = useState([]);
  const [loading, setLoading]               = useState(true);
  const [loadedCount, setLoadedCount]       = useState(BATCH);
  const [hasMore, setHasMore]               = useState(false);
  const [alleGroepen, setAlleGroepen]       = useState([]);
  const [trainerGroepIds, setTrainerGroepIds] = useState([]);
  const [showCompose, setShowCompose]       = useState(false);
  const [filterCat, setFilterCat]           = useState(null); // null = alle categorieën
  const [sending, setSending]               = useState(false);
  const [emailStatus, setEmailStatus]       = useState(null);
  const totalRef = useRef(0);

  const [form, setForm] = useState({
    title:         '',
    body:          '',
    categorie:     'overige',
    doelgroepMode: 'rol',
    targetRoles:   ['alle'],
    groups:        [],
    targetUids:    [],
    stuurPush:     false,
    stuurEmail:    false,
  });

  useEffect(() => {
    getDocs(collection(db, COLLECTIONS.GROEPEN)).then(snap => {
      setAlleGroepen(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.naam.localeCompare(b.naam)));
    });
  }, []);

  useEffect(() => {
    if (!lesgeverId || isBeheerder) return;
    getDoc(doc(db, COLLECTIONS.LESGEVERS, lesgeverId)).then(snap => {
      if (snap.exists()) setTrainerGroepIds(snap.data().groepen || []);
    });
  }, [lesgeverId, isBeheerder]);

  useEffect(() => {
    const q = query(collection(db, 'communications'), orderBy('createdAt', 'desc'), limit(loadedCount + 1));
    return onSnapshot(q, snap => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setHasMore(docs.length > loadedCount);
      setMessages(docs.slice(0, loadedCount));
      totalRef.current = docs.length;
      setLoading(false);
    });
  }, [loadedCount]);

  const userGroepIds    = profiel?.groepen || [];
  const userUid         = profiel?.uid;

  const allVisible = isLid
    ? messages.filter(m => isRelevanteMessage(m, role, userGroepIds, userUid))
    : messages;

  const visibleMessages = filterCat
    ? allVisible.filter(m => (m.categorie || 'overige') === filterCat)
    : allVisible;

  const schrijverGroepen = isBeheerder
    ? alleGroepen
    : alleGroepen.filter(g => trainerGroepIds.includes(g.id));

  const canWrite = isBeheerder || (role === 'trainer' && schrijverGroepen.length > 0);

  function toggleRol(value) {
    setForm(f => {
      if (value === 'alle') return { ...f, targetRoles: ['alle'] };
      const zonder = f.targetRoles.filter(r => r !== 'alle' && r !== value);
      const nieuweSelectie = f.targetRoles.includes(value) ? zonder : [...zonder, value];
      return { ...f, targetRoles: nieuweSelectie.length === 0 ? ['alle'] : nieuweSelectie };
    });
  }

  function toggleGroep(id) {
    setForm(f => ({
      ...f,
      groups: f.groups.includes(id) ? f.groups.filter(x => x !== id) : [...f.groups, id],
    }));
  }

  async function handleSend() {
    if (!form.title.trim() || !form.body.trim()) return;
    if (!isBeheerder && form.groups.length === 0) return;
    if (isBeheerder && form.doelgroepMode === 'groep' && form.groups.length === 0) return;
    if (isBeheerder && form.doelgroepMode === 'leden' && form.targetUids.length === 0) return;

    setSending(true);
    setEmailStatus(null);

    const isSendToAll  = isBeheerder && form.doelgroepMode === 'rol' && form.targetRoles.includes('alle');
    const targetRoles  = isBeheerder && form.doelgroepMode === 'rol' && !isSendToAll
      ? form.targetRoles.filter(r => r !== 'alle') : [];
    const targetGroups = (form.doelgroepMode === 'groep' || !isBeheerder) ? form.groups : [];
    const targetUids   = isBeheerder && form.doelgroepMode === 'leden' ? form.targetUids : [];

    await addDoc(collection(db, 'communications'), {
      title:      form.title,
      body:       form.body,
      categorie:  form.categorie,
      sendToAll:  isSendToAll,
      targetRoles,
      groups:     targetGroups,
      targetUids,
      author:     role,
      authorUid:  profiel.uid,
      authorNaam: profiel.naam || role,
      createdAt:  serverTimestamp(),
    });

    // Push
    if (form.stuurPush) {
      if (targetGroups.length > 0) {
        // Groep-gerichte push (trainers en beheerders die "naar groep" sturen) —
        // gebruikt de groep-routing zodat enkel leden van de geselecteerde groep(en) een melding krijgen.
        for (const groepId of targetGroups) {
          stuurPushTrigger(PUSH_TYPES.GROEPSBERICHT, { titel: form.title, bericht: form.body, groepId });
        }
      } else if (isBeheerder && form.doelgroepMode === 'rol') {
        const rollen = isSendToAll ? ['alle'] : targetRoles;
        for (const rol of rollen) {
          stuurPushTrigger(PUSH_TYPES.CLUBBERICHT, { titel: form.title, bericht: form.body, doelRol: rol });
        }
      }
      // doelgroepMode 'leden': geen push-routing voor individuele uid-lijsten — bewust overgeslagen.
    }

    // E-mail
    if (form.stuurEmail && isBeheerder) {
      try {
        const alleUsers = await getAllUsers();
        let doelUsers;
        if (isSendToAll) {
          doelUsers = alleUsers;
        } else if (form.doelgroepMode === 'rol') {
          doelUsers = alleUsers.filter(u => targetRoles.includes(u.rol || 'lid'));
        } else if (form.doelgroepMode === 'groep') {
          doelUsers = alleUsers.filter(u => (u.groepen || []).some(gId => targetGroups.includes(gId)));
        } else {
          doelUsers = alleUsers.filter(u => targetUids.includes(u.uid));
        }
        const adressen = [...new Set(doelUsers.map(u => u.communicatieEmail || u.email).filter(Boolean))];
        if (adressen.length > 0) {
          await sendMail({
            to: adressen,
            message: { subject: form.title, html: buildEmailHtml(form.title, form.body, profiel.naam || role, clubNaamKort, appUrl) },
            type: 'communicatie',
          });
          setEmailStatus(`E-mail verstuurd naar ${adressen.length} adres(sen).`);
        } else {
          setEmailStatus('Geen e-mailadressen gevonden voor de doelgroep.');
        }
      } catch (e) {
        setEmailStatus('E-mail mislukt: ' + e.message);
      }
    }

    setForm({ title: '', body: '', categorie: 'overige', doelgroepMode: 'rol', targetRoles: ['alle'], groups: [], targetUids: [], stuurPush: false, stuurEmail: false });
    setShowCompose(false);
    setSending(false);
  }

  async function handleDelete(id) {
    const ok = await confirm({
      titel: 'Bericht verwijderen?', beschrijving: 'Dit bericht wordt definitief verwijderd.',
      bevestigLabel: 'Ja, verwijderen', variant: 'danger',
    });
    if (!ok) return;
    await deleteDoc(doc(db, 'communications', id));
  }

  function renderDoelgroepBadges(msg) {
    if (msg.sendToAll) return <span style={S.badge(null)}>Alle leden</span>;
    const rollen = (msg.targetRoles || []).map(r => ROL_OPTIES.find(o => o.value === r)?.label || r);
    const groepen = (msg.groups || []).map(g => groepLabel(g, alleGroepen));
    const leden = msg.targetUids?.length ? [`${msg.targetUids.length} lid(en)`] : [];
    return [...rollen, ...groepen, ...leden].map((label, i) => <span key={i} style={S.badge(null)}>{label}</span>);
  }

  const doelLabel = (() => {
    if (!isBeheerder) return form.groups.map(id => groepLabel(id, alleGroepen)).join(' + ') || '—';
    if (form.doelgroepMode === 'rol') return form.targetRoles.includes('alle') ? 'Iedereen' : form.targetRoles.map(r => ROL_OPTIES.find(o => o.value === r)?.label).filter(Boolean).join(' + ');
    if (form.doelgroepMode === 'groep') return form.groups.map(id => groepLabel(id, alleGroepen)).join(' + ') || '—';
    return form.targetUids.length ? `${form.targetUids.length} geselecteerde leden` : '—';
  })();

  const sendOk = form.title.trim() && form.body.trim() && (() => {
    if (!isBeheerder) return form.groups.length > 0;
    if (form.doelgroepMode === 'rol') return true;
    if (form.doelgroepMode === 'groep') return form.groups.length > 0;
    return form.targetUids.length > 0;
  })();

  const selectedCat = catVoor(form.categorie);

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '22px', fontWeight: '700' }}>📣 Communicatie</div>
        {canWrite && (
          <button style={S.btn('primary')} onClick={() => { setShowCompose(s => !s); setEmailStatus(null); }}>
            {showCompose ? '✕ Sluiten' : '✍️ Nieuw bericht'}
          </button>
        )}
      </div>

      {emailStatus && (
        <div style={{ background: 'rgba(39,174,96,0.12)', color: 'var(--success)', border: '1px solid rgba(39,174,96,0.3)', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '12px' }}>
          {emailStatus}
        </div>
      )}

      {/* Compose form */}
      {showCompose && (
        <div style={S.card}>
          <h3 style={{ marginTop: 0, color: C.red }}>Nieuw bericht</h3>

          {/* Categorie */}
          <label style={S.label}>Categorie</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
            {CATEGORIEËN.map(cat => (
              <button
                key={cat.value}
                style={S.chip(form.categorie === cat.value, cat.color, cat.dim)}
                onClick={() => setForm(f => ({ ...f, categorie: cat.value }))}
              >
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>

          {/* Doelgroep */}
          {isBeheerder && (
            <>
              <label style={S.label}>Doelgroep</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                {['rol', 'groep', 'leden'].map(mode => (
                  <button key={mode} style={S.modeBtn(form.doelgroepMode === mode)}
                    onClick={() => setForm(f => ({ ...f, doelgroepMode: mode, groups: [], targetUids: [], targetRoles: ['alle'] }))}>
                    {{ rol: 'Naar rol', groep: 'Naar groep', leden: 'Individuele leden' }[mode]}
                  </button>
                ))}
              </div>

              {form.doelgroepMode === 'rol' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {ROL_OPTIES.map(r => (
                    <button key={r.value} style={S.chip(form.targetRoles.includes(r.value))} onClick={() => toggleRol(r.value)}>
                      {form.targetRoles.includes(r.value) ? '✓ ' : ''}{r.label}
                    </button>
                  ))}
                </div>
              )}
              {form.doelgroepMode === 'groep' && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {alleGroepen.map(g => (
                    <button key={g.id} style={S.chip(form.groups.includes(g.id))} onClick={() => toggleGroep(g.id)}>
                      {form.groups.includes(g.id) ? '✓ ' : ''}{g.naam}
                    </button>
                  ))}
                </div>
              )}
              {form.doelgroepMode === 'leden' && (
                <div style={{ marginBottom: '12px' }}>
                  <LedenModal selectedUids={form.targetUids} onChange={uids => setForm(f => ({ ...f, targetUids: uids }))} />
                </div>
              )}
            </>
          )}

          {!isBeheerder && role === 'trainer' && (
            <>
              <label style={S.label}>Groep(en)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                {schrijverGroepen.map(g => (
                  <button key={g.id} style={S.chip(form.groups.includes(g.id))} onClick={() => toggleGroep(g.id)}>
                    {form.groups.includes(g.id) ? '✓ ' : ''}{g.naam}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Titel & body */}
          <label style={S.label}>Onderwerp</label>
          <input style={S.inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Onderwerp van het bericht" />
          <label style={S.label}>Bericht</label>
          <textarea style={S.textarea} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Typ hier uw bericht..." />

          {/* Push + E-mail */}
          {(isBeheerder || role === 'trainer') && (
            <div style={{ marginBottom: '12px' }}>
              <label style={S.checkRow}>
                <input type="checkbox" checked={form.stuurPush} onChange={e => setForm(f => ({ ...f, stuurPush: e.target.checked }))} />
                🔔 Stuur ook als push-notificatie
              </label>
              {isBeheerder && (
                <label style={S.checkRow}>
                  <input type="checkbox" checked={form.stuurEmail} onChange={e => setForm(f => ({ ...f, stuurEmail: e.target.checked }))} />
                  📧 Stuur ook als e-mail (naar communicatie-e-mailadres)
                </label>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button style={{ ...S.btn('primary'), flex: 1 }} onClick={handleSend} disabled={sending || !sendOk}>
              {sending ? 'Versturen...' : `${selectedCat.icon} Publiceren → ${doelLabel}`}
            </button>
            <button style={S.btn()} onClick={() => setShowCompose(false)}>Annuleren</button>
          </div>
        </div>
      )}

      {/* Categorie filter */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', marginBottom: '14px', WebkitOverflowScrolling: 'touch' }}>
        <button style={S.chip(!filterCat)} onClick={() => setFilterCat(null)}>Alle</button>
        {CATEGORIEËN.map(cat => (
          <button key={cat.value} style={S.chip(filterCat === cat.value, cat.color, cat.dim)} onClick={() => setFilterCat(filterCat === cat.value ? null : cat.value)}>
            {cat.icon} {cat.label}
          </button>
        ))}
      </div>

      {/* Berichten */}
      {loading ? (
        <div style={{ color: '#aaa', textAlign: 'center', padding: '40px' }}>Laden...</div>
      ) : visibleMessages.length === 0 ? (
        <div style={{ color: '#aaa', textAlign: 'center', padding: '40px' }}>
          {filterCat ? 'Geen berichten in deze categorie.' : isLid ? 'Geen berichten voor jou.' : 'Geen berichten.'}
        </div>
      ) : (
        <>
          {visibleMessages.map(m => {
            const cat = catVoor(m.categorie);
            const datum = m.createdAt?.toDate ? m.createdAt.toDate() : null;
            const nu = new Date();
            const diffMs = datum ? nu - datum : null;
            const diffDagen = diffMs !== null ? Math.floor(diffMs / 86400000) : null;
            const relatief = diffDagen === null ? null
              : diffDagen === 0 ? 'Vandaag'
              : diffDagen === 1 ? 'Gisteren'
              : diffDagen < 7 ? `${diffDagen} dagen geleden`
              : null;
            const datumLabel = datum
              ? (relatief
                  ? `${relatief} · ${datum.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}`
                  : datum.toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' }))
              : '—';
            return (
              <div key={m.id} style={{ ...cardStyle(), marginBottom: '10px', borderLeft: `3px solid ${cat.color}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '16px', lineHeight: 1.3 }}>{cat.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: '700', fontSize: '15px', color: C.textPrimary }}>{m.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: cat.color, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{cat.label}</span>
                      <span style={{ fontSize: '11px', color: C.textMuted }}>·</span>
                      <span style={{ fontSize: '11px', color: C.textSec, fontWeight: '500' }}>{datumLabel}</span>
                      <span style={{ fontSize: '11px', color: C.textMuted }}>·</span>
                      <span style={{ fontSize: '11px', color: C.textMuted, background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: '8px' }}>{m.authorNaam || m.author || 'admin'}</span>
                    </div>
                  </div>
                  {isBeheerder && (
                    <button style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '14px', padding: '2px 4px', flexShrink: 0 }} onClick={() => handleDelete(m.id)} aria-label="Bericht verwijderen">🗑</button>
                  )}
                </div>
                <div style={{ color: C.textSec, fontSize: '14px', lineHeight: '1.6', marginBottom: '8px', whiteSpace: 'pre-line' }}>{m.body}</div>
                {(m.doelgroep || m.groups?.length) ? (
                  <div style={{ marginTop: '4px' }}>{renderDoelgroepBadges(m)}</div>
                ) : null}
              </div>
            );
          })}

          {hasMore && (
            <button
              style={{ ...S.btn(), width: '100%', marginTop: '4px' }}
              onClick={() => setLoadedCount(c => c + BATCH)}
            >
              Meer laden...
            </button>
          )}

          <div style={{ textAlign: 'center', color: C.textMuted, fontSize: '12px', marginTop: '12px' }}>
            {visibleMessages.length} bericht{visibleMessages.length !== 1 ? 'en' : ''} getoond
          </div>
        </>
      )}

      {/* Zichtbaarheidsnota voor beheerders */}
      {isBeheerder && (
        <div style={{ marginTop: '20px', padding: '10px 14px', background: C.surface, borderRadius: '8px', fontSize: '12px', color: C.textMuted, lineHeight: '1.5' }}>
          ℹ️ Leden zien enkel berichten die voor hen bedoeld zijn (alle leden, hun rol of groep, of individueel). Filters gelden enkel voor de weergave hier.
        </div>
      )}
    </div>
  );
}
