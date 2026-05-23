// src/pages/Evenementen.jsx
// Beheer van clubevenementen (eetfestijn, judoweekend, enz.)
// Enkel toegankelijk voor bestuurslid en admin

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, limit, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';
import EvenementDetailPanel from '../components/details/EvenementDetailPanel';

const TYPES = ['clubactiviteit', 'stage', 'meeting', 'tornooi', 'overig'];
const TYPE_LABELS = {
  clubactiviteit: 'Clubactiviteit',
  stage: 'Stage',
  meeting: 'Meeting',
  tornooi: 'Tornooi',
  overig: 'Overig',
};
const TYPE_ICONS = {
  clubactiviteit: '🎉',
  stage: '🥋',
  meeting: '📋',
  tornooi: '🏆',
  overig: '📌',
};

const S = {
  page: { minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: 'var(--space-4)' },
  title: { fontSize: 'var(--font-size-xl)', fontWeight: '700', marginBottom: 'var(--space-4)' },
  card: { background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-4)', marginBottom: 'var(--space-3)' },
  input: { width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', padding: '10px', fontSize: 'var(--font-size-md)', boxSizing: 'border-box', marginBottom: '10px' },
  textarea: { width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', padding: '10px', fontSize: 'var(--font-size-md)', boxSizing: 'border-box', marginBottom: '10px', minHeight: '80px', resize: 'vertical' },
  label: { color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-1)', display: 'block' },
  select: { width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', padding: '10px', fontSize: 'var(--font-size-md)', boxSizing: 'border-box', marginBottom: '10px' },
  btn: (v = 'primary') => ({
    background: v === 'primary' ? 'var(--accent-red)' : v === 'danger' ? '#7f1515' : 'var(--border-color)',
    border: 'none', color: 'var(--text-primary)', padding: '10px var(--space-4)',
    borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-md)', fontWeight: '600',
  }),
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 'var(--space-4)' },
  modalCard: { background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-6)', width: '100%', maxWidth: '440px' },
  typeBadge: () => ({
    background: 'rgba(192,57,43,0.15)',
    color: 'var(--danger)',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: 'var(--font-size-xs)',
    fontWeight: '600',
    display: 'inline-block',
    marginBottom: 'var(--space-1)',
  }),
  successMsg: { background: 'var(--success)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 'var(--font-size-md)', fontWeight: '600', marginBottom: 'var(--space-3)' },
};

const LEEG_FORM = { titel: '', datum: '', eindDatum: '', type: 'clubactiviteit', beschrijving: '', link: '' };

function formatDatum(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function isVoorbij(datum) {
  if (!datum) return false;
  return datum < new Date().toISOString().slice(0, 10);
}

export default function Evenementen() {
  const { isBeheerder } = useAuth();
  const confirm = useConfirm();
  const { id: detailId } = useParams();
  const navigate = useNavigate();
  const [evenementen, setEvenementen] = useState([]);
  const [laden, setLaden] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [bewerkId, setBewerkId] = useState(null);
  const [form, setForm] = useState(LEEG_FORM);
  const [opslaan, setOpslaan] = useState(false);
  const [succes, setSucces] = useState('');
  const [toonVoorbij, setToonVoorbij] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'evenementen'), orderBy('datum', 'asc'), limit(200));
    const unsub = onSnapshot(q, snap => {
      setEvenementen(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLaden(false);
    }, () => setLaden(false));
    return unsub;
  }, []);

  const openNieuw = () => {
    setBewerkId(null);
    setForm(LEEG_FORM);
    setShowModal(true);
  };

  const openBewerk = (ev) => {
    setBewerkId(ev.id);
    setForm({
      titel: ev.titel || '',
      datum: ev.datum || '',
      eindDatum: ev.eindDatum || '',
      type: ev.type || 'clubactiviteit',
      beschrijving: ev.beschrijving || '',
      link: ev.link || '',
    });
    setShowModal(true);
  };

  const sluitModal = () => {
    setShowModal(false);
    setBewerkId(null);
    setForm(LEEG_FORM);
  };

  const slaOp = async () => {
    if (!form.titel.trim() || !form.datum) return;
    setOpslaan(true);
    try {
      if (bewerkId) {
        await updateDoc(doc(db, 'evenementen', bewerkId), {
          ...form,
          bijgewerkt: serverTimestamp(),
        });
        setSucces('Evenement bijgewerkt');
      } else {
        await addDoc(collection(db, 'evenementen'), {
          ...form,
          aangemaakt: serverTimestamp(),
        });
        setSucces('Evenement toegevoegd');
      }
      setTimeout(() => setSucces(''), 2500);
      sluitModal();
    } finally {
      setOpslaan(false);
    }
  };

  const verwijder = async (id) => {
    const ok = await confirm({
      titel: 'Evenement verwijderen?',
      beschrijving: 'Dit evenement wordt definitief uit de agenda verwijderd.',
      bevestigLabel: 'Ja, verwijderen',
      variant: 'danger',
    });
    if (!ok) return;
    await deleteDoc(doc(db, 'evenementen', id));
  };

  if (!isBeheerder) {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>🔒</div>
          <div style={{ fontSize: 'var(--font-size-lg)' }}>Alleen beschikbaar voor bestuurslid of admin.</div>
        </div>
        {detailId && (
          <EvenementDetailPanel
            evenementId={detailId}
            onClose={() => navigate('/evenementen')}
          />
        )}
      </div>
    );
  }

  const komende = evenementen.filter(e => !isVoorbij(e.datum));
  const voorbij = evenementen.filter(e => isVoorbij(e.datum));

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={S.title}>🎉 Evenementen</div>
        <button onClick={openNieuw} style={S.btn('primary')}>+ Nieuw</button>
      </div>

      {succes && <div style={S.successMsg}>✓ {succes}</div>}

      {laden && <div style={{ color: 'var(--text-secondary)', padding: 'var(--space-6)', textAlign: 'center' }}>Laden...</div>}

      {!laden && komende.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px 0', fontSize: 'var(--font-size-md)' }}>
          Geen komende evenementen.<br />
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>Tik op + Nieuw om er een toe te voegen.</span>
        </div>
      )}

      {komende.map(ev => (
        <div key={ev.id} style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <div style={S.typeBadge(ev.type)}>
                {TYPE_ICONS[ev.type] || '📌'} {TYPE_LABELS[ev.type] || ev.type}
              </div>
              <div style={{ fontSize: '17px', fontWeight: '700', marginBottom: '4px' }}>{ev.titel}</div>
              <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: ev.beschrijving ? 'var(--space-2)' : '0' }}>
                📅 {formatDatum(ev.datum)}
                {ev.eindDatum && ev.eindDatum !== ev.datum && (
                  <span> – {formatDatum(ev.eindDatum)}</span>
                )}
              </div>
              {ev.beschrijving && (
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)', lineHeight: '1.5', marginBottom: ev.link ? 'var(--space-2)' : '0' }}>
                  {ev.beschrijving}
                </div>
              )}
              {ev.link && (
                <a
                  href={ev.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 'var(--font-size-sm)', color: 'var(--accent-red)', textDecoration: 'none' }}
                >
                  🔗 Link
                </a>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              <button onClick={() => openBewerk(ev)} style={S.btn('secondary')}>✏️</button>
              <button onClick={() => verwijder(ev.id)} style={S.btn('danger')}>🗑</button>
            </div>
          </div>
        </div>
      ))}

      {voorbij.length > 0 && (
        <div>
          <button
            onClick={() => setToonVoorbij(v => !v)}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', cursor: 'pointer', padding: 'var(--space-2) 0', marginBottom: 'var(--space-2)' }}
          >
            {toonVoorbij ? '▲' : '▼'} {voorbij.length} voorbije evenement{voorbij.length !== 1 ? 'en' : ''}
          </button>
          {toonVoorbij && voorbij.map(ev => (
            <div key={ev.id} style={{ ...S.card, opacity: 0.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', textDecoration: 'line-through', color: 'var(--text-secondary)' }}>{ev.titel}</div>
                  <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{formatDatum(ev.datum)}</div>
                </div>
                <button onClick={() => verwijder(ev.id)} style={S.btn('danger')}>🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={S.modal} onClick={sluitModal}>
          <div style={S.modalCard} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: '700', marginBottom: 'var(--space-4)' }}>
              {bewerkId ? 'Evenement bewerken' : 'Nieuw evenement'}
            </div>

            <label style={S.label}>Titel *</label>
            <input
              style={S.input}
              value={form.titel}
              onChange={e => setForm(f => ({ ...f, titel: e.target.value }))}
              placeholder="bv. Eetfestijn 2026"
              autoFocus
            />

            <label style={S.label}>Type</label>
            <select
              style={S.select}
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            >
              {TYPES.map(t => (
                <option key={t} value={t}>{TYPE_ICONS[t]} {TYPE_LABELS[t]}</option>
              ))}
            </select>

            <label style={S.label}>Datum *</label>
            <input
              type="date"
              style={S.input}
              value={form.datum}
              onChange={e => setForm(f => ({ ...f, datum: e.target.value }))}
            />

            <label style={S.label}>Einddatum (optioneel, voor meerdaagse events)</label>
            <input
              type="date"
              style={S.input}
              value={form.eindDatum}
              onChange={e => setForm(f => ({ ...f, eindDatum: e.target.value }))}
            />

            <label style={S.label}>Beschrijving (optioneel)</label>
            <textarea
              style={S.textarea}
              value={form.beschrijving}
              onChange={e => setForm(f => ({ ...f, beschrijving: e.target.value }))}
              placeholder="Korte omschrijving..."
            />

            <label style={S.label}>Link (optioneel)</label>
            <input
              style={S.input}
              value={form.link}
              onChange={e => setForm(f => ({ ...f, link: e.target.value }))}
              placeholder="https://..."
            />

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button onClick={sluitModal} style={S.btn('secondary')}>Annuleren</button>
              <button
                onClick={slaOp}
                disabled={opslaan || !form.titel.trim() || !form.datum}
                style={{ ...S.btn('primary'), opacity: (!form.titel.trim() || !form.datum) ? 0.5 : 1 }}
              >
                {opslaan ? 'Opslaan...' : 'Opslaan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailId && (
        <EvenementDetailPanel
          evenementId={detailId}
          onClose={() => navigate('/evenementen')}
        />
      )}
    </div>
  );
}
