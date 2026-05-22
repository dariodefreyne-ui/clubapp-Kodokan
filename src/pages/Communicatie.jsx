import React, { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, deleteDoc, doc,
  query, orderBy, serverTimestamp, getDocs, getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';
import { C, buttonStyle, cardStyle, inputStyle } from '../styles/tokens';
import { stuurPushTrigger, PUSH_TYPES } from '../services/pushService';
import { getAllUsers, sendMail } from '../services/firestoreService';
import { CLUB_NAAM_KORT, COLLECTIONS } from '../config/appConfig';

const ROL_OPTIES = [
  { value: 'alle',        label: 'Iedereen' },
  { value: 'bestuurslid', label: 'Bestuursleden' },
  { value: 'trainer',     label: 'Trainers' },
  { value: 'lid',         label: 'Leden' },
];

function groepLabel(idOrNaam, alleGroepen) {
  const g = alleGroepen.find(x => x.id === idOrNaam);
  return g ? g.naam : idOrNaam;
}

function isRelevanteMessage(msg, userRol, userGroepIds) {
  if (msg.sendToAll) return true;
  if (msg.targetRoles?.length && msg.targetRoles.includes(userRol)) return true;
  if (msg.groups?.length && userGroepIds.some(id => msg.groups.includes(id))) return true;
  return false;
}

function buildEmailHtml(title, body, auteurNaam) {
  const safeBody = body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:#c0392b;padding:20px 24px;">
    <h1 style="color:#fff;margin:0;font-size:20px;">${CLUB_NAAM_KORT}</h1>
  </div>
  <div style="padding:24px;">
    <h2 style="color:#1a1a1a;margin-top:0;">${title}</h2>
    <p style="color:#333;line-height:1.7;">${safeBody}</p>
    <p style="color:#888;font-size:12px;margin-top:24px;">— ${auteurNaam}</p>
  </div>
  <div style="background:#f5f5f5;padding:16px 24px;font-size:12px;color:#888;">
    Ontvangen via de ${CLUB_NAAM_KORT} Clubapp.
  </div>
</div>`;
}

const S = {
  page:      { minHeight: '100vh', background: C.bg, color: C.textPrimary, padding: '16px' },
  title:     { fontSize: '22px', fontWeight: '700', marginBottom: '16px' },
  card:      { ...cardStyle(), marginBottom: '12px' },
  msgCard:   { ...cardStyle(), marginBottom: '10px', borderLeft: `3px solid ${C.red}` },
  inp:       { ...inputStyle, marginBottom: '10px' },
  textarea:  { ...inputStyle, marginBottom: '10px', minHeight: '100px', resize: 'vertical' },
  label:     { color: C.textSec, fontSize: '12px', marginBottom: '4px', display: 'block' },
  btn:       (v = 'primary') => buttonStyle(v),
  chip:      (sel) => ({
    background: sel ? C.redDim : C.bg,
    border: `1px solid ${sel ? C.red : C.borderSoft}`,
    color: sel ? C.red : C.textSec,
    padding: '5px 12px', borderRadius: '14px', cursor: 'pointer', fontSize: '12px',
    fontWeight: sel ? '700' : '400',
  }),
  badge:     { background: C.redDim, color: C.red, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', marginRight: '4px' },
  msgTitle:  { fontWeight: '700', fontSize: '16px', marginBottom: '6px' },
  msgBody:   { color: C.textSec, fontSize: '14px', lineHeight: '1.6', marginBottom: '10px' },
  msgMeta:   { display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: C.textMuted, fontSize: '12px' },
  modeBtn:   (sel) => ({
    padding: '7px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '12px', fontWeight: sel ? '700' : '400',
    border: `1px solid ${sel ? C.red : C.borderSoft}`,
    background: sel ? C.redDim : 'transparent', color: sel ? C.red : C.textSec,
  }),
  checkRow:  { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', cursor: 'pointer', fontSize: '14px' },
  infoBox:   { background: C.surface, border: `1px solid ${C.borderSoft}`, borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: C.textSec, marginBottom: '10px' },
};

export default function Communicatie() {
  const { role, profiel, lesgeverId, isBeheerder, isLid } = useAuth();
  const confirm = useConfirm();

  const [messages, setMessages]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [alleGroepen, setAlleGroepen]   = useState([]);
  const [trainerGroepIds, setTrainerGroepIds] = useState([]);
  const [showCompose, setShowCompose]   = useState(false);
  const [sending, setSending]           = useState(false);
  const [emailStatus, setEmailStatus]   = useState(null);

  const [form, setForm] = useState({
    title:       '',
    body:        '',
    doelgroepMode: 'rol',   // 'rol' | 'groep'
    targetRoles: ['alle'],   // for rol-mode
    groups:      [],          // for groep-mode (group IDs)
    stuurPush:   false,
    stuurEmail:  false,
  });

  useEffect(() => {
    getDocs(collection(db, COLLECTIONS.GROEPEN)).then(snap => {
      setAlleGroepen(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => a.naam.localeCompare(b.naam))
      );
    });
  }, []);

  useEffect(() => {
    if (!lesgeverId || isBeheerder) return;
    getDoc(doc(db, COLLECTIONS.LESGEVERS, lesgeverId)).then(snap => {
      if (snap.exists()) setTrainerGroepIds(snap.data().groepen || []);
    });
  }, [lesgeverId, isBeheerder]);

  useEffect(() => {
    const q = query(collection(db, 'communications'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
  }, []);

  const userGroepIds    = profiel?.groepen || [];
  const visibleMessages = isLid
    ? messages.filter(m => isRelevanteMessage(m, role, userGroepIds))
    : messages;

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

    setSending(true);
    setEmailStatus(null);

    const isSendToAll  = isBeheerder && form.doelgroepMode === 'rol' && form.targetRoles.includes('alle');
    const targetRoles  = isBeheerder && form.doelgroepMode === 'rol' && !isSendToAll
      ? form.targetRoles.filter(r => r !== 'alle') : [];
    const targetGroups = (form.doelgroepMode === 'groep' || !isBeheerder) ? form.groups : [];

    await addDoc(collection(db, 'communications'), {
      title:      form.title,
      body:       form.body,
      sendToAll:  isSendToAll,
      targetRoles,
      groups:     targetGroups,
      author:     role,
      authorUid:  profiel.uid,
      authorNaam: profiel.naam || role,
      createdAt:  serverTimestamp(),
    });

    if (form.stuurPush && isBeheerder) {
      if (isSendToAll) {
        stuurPushTrigger(PUSH_TYPES.CLUBBERICHT, { titel: form.title, bericht: form.body, doelRol: 'alle' });
      } else if (form.doelgroepMode === 'rol') {
        for (const rol of targetRoles) {
          stuurPushTrigger(PUSH_TYPES.CLUBBERICHT, { titel: form.title, bericht: form.body, doelRol: rol });
        }
      } else {
        stuurPushTrigger(PUSH_TYPES.CLUBBERICHT, { titel: form.title, bericht: form.body, doelRol: 'alle' });
      }
    }

    if (form.stuurEmail && isBeheerder) {
      try {
        const alleUsers = await getAllUsers();
        let doelUsers;
        if (isSendToAll) {
          doelUsers = alleUsers;
        } else if (form.doelgroepMode === 'rol') {
          doelUsers = alleUsers.filter(u => targetRoles.includes(u.rol || 'lid'));
        } else {
          doelUsers = alleUsers.filter(u =>
            (u.groepen || []).some(gId => targetGroups.includes(gId))
          );
        }
        const adressen = [...new Set(doelUsers.map(u => u.communicatieEmail || u.email).filter(Boolean))];
        if (adressen.length > 0) {
          await sendMail({
            to: adressen,
            message: { subject: form.title, html: buildEmailHtml(form.title, form.body, profiel.naam || role) },
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

    setForm({ title: '', body: '', doelgroepMode: 'rol', targetRoles: ['alle'], groups: [], stuurPush: false, stuurEmail: false });
    setShowCompose(false);
    setSending(false);
  }

  async function handleDelete(id) {
    const ok = await confirm({
      titel:         'Bericht verwijderen?',
      beschrijving:  'Dit bericht wordt definitief verwijderd voor alle ontvangers.',
      bevestigLabel: 'Ja, verwijderen',
      variant:       'danger',
    });
    if (!ok) return;
    await deleteDoc(doc(db, 'communications', id));
  }

  function renderDoelgroepBadges(msg) {
    if (msg.sendToAll) return <span style={S.badge}>Alle leden</span>;
    const rollen = (msg.targetRoles || []).map(r => ROL_OPTIES.find(o => o.value === r)?.label || r);
    const groepen = (msg.groups || []).map(g => groepLabel(g, alleGroepen));
    return [...rollen, ...groepen].map((label, i) => (
      <span key={i} style={S.badge}>{label}</span>
    ));
  }

  const doelLabel = isBeheerder && form.doelgroepMode === 'rol'
    ? (form.targetRoles.includes('alle') ? 'Iedereen' : form.targetRoles.map(r => ROL_OPTIES.find(o => o.value === r)?.label).filter(Boolean).join(' + '))
    : form.groups.map(id => groepLabel(id, alleGroepen)).join(' + ') || '—';

  const sendOk = form.title.trim() && form.body.trim()
    && (isBeheerder
      ? (form.doelgroepMode === 'rol' || form.groups.length > 0)
      : form.groups.length > 0);

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={S.title}>📣 Communicatie</div>
        {canWrite && (
          <button style={S.btn('primary')} onClick={() => setShowCompose(s => !s)}>
            {showCompose ? '✕ Sluiten' : '✍️ Nieuw bericht'}
          </button>
        )}
      </div>

      {emailStatus && (
        <div style={{ ...S.infoBox, background: 'rgba(39,174,96,0.12)', color: 'var(--success)', border: '1px solid rgba(39,174,96,0.3)', marginBottom: '12px' }}>
          {emailStatus}
        </div>
      )}

      {/* Compose form */}
      {showCompose && (
        <div style={S.card}>
          <h3 style={{ marginTop: 0, color: C.red }}>Nieuw bericht</h3>

          {/* Doelgroep — admin/bestuurslid */}
          {isBeheerder && (
            <>
              <label style={S.label}>Doelgroep</label>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button style={S.modeBtn(form.doelgroepMode === 'rol')} onClick={() => setForm(f => ({ ...f, doelgroepMode: 'rol', groups: [] }))}>
                  Naar rol
                </button>
                <button style={S.modeBtn(form.doelgroepMode === 'groep')} onClick={() => setForm(f => ({ ...f, doelgroepMode: 'groep', targetRoles: ['alle'] }))}>
                  Naar groep
                </button>
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
            </>
          )}

          {/* Doelgroep — trainer (eigen groepen) */}
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

          <label style={S.label}>Onderwerp</label>
          <input
            style={S.inp}
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Onderwerp van het bericht"
          />

          <label style={S.label}>Bericht</label>
          <textarea
            style={S.textarea}
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            placeholder="Typ hier uw bericht..."
          />

          {/* Push + Email opties (admin/bestuurslid) */}
          {isBeheerder && (
            <div style={{ marginBottom: '10px' }}>
              <label style={S.checkRow}>
                <input type="checkbox" checked={form.stuurPush} onChange={e => setForm(f => ({ ...f, stuurPush: e.target.checked }))} />
                🔔 Stuur ook als push-notificatie
              </label>
              <label style={S.checkRow}>
                <input type="checkbox" checked={form.stuurEmail} onChange={e => setForm(f => ({ ...f, stuurEmail: e.target.checked }))} />
                📧 Stuur ook als e-mail (naar communicatie-e-mailadres)
              </label>
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              style={{ ...S.btn('primary'), flex: 1 }}
              onClick={handleSend}
              disabled={sending || !sendOk}
            >
              {sending ? 'Versturen...' : `📨 Publiceren → ${doelLabel}`}
            </button>
            <button style={S.btn()} onClick={() => setShowCompose(false)}>Annuleren</button>
          </div>
        </div>
      )}

      {/* Berichten lijst */}
      {loading ? (
        <div style={{ color: '#aaa', textAlign: 'center', padding: '40px' }}>Laden...</div>
      ) : visibleMessages.length === 0 ? (
        <div style={{ color: '#aaa', textAlign: 'center', padding: '40px' }}>
          {isLid ? 'Geen berichten voor jou.' : 'Geen berichten.'}
        </div>
      ) : (
        visibleMessages.map(m => (
          <div key={m.id} style={S.msgCard}>
            <div style={S.msgTitle}>{m.title}</div>
            <div style={S.msgBody}>{m.body}</div>
            <div style={S.msgMeta}>
              <div>{renderDoelgroepBadges(m)}</div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span>{m.createdAt?.toDate ? m.createdAt.toDate().toLocaleString('nl-BE', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</span>
                <span style={{ background: C.surface, padding: '2px 6px', borderRadius: '8px', fontSize: '11px' }}>
                  {m.authorNaam || m.author || 'admin'}
                </span>
                {isBeheerder && (
                  <button
                    style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: '14px', padding: '2px' }}
                    onClick={() => handleDelete(m.id)}
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
