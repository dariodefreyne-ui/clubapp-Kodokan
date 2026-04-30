// src/pages/Evenementen.jsx
// Beheer van clubevenementen (eetfestijn, judoweekend, enz.)
// Enkel toegankelijk voor beheerders

import React, { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

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
  page: { minHeight: '100vh', background: '#1a1a1a', color: '#fff', padding: '16px' },
  title: { fontSize: '22px', fontWeight: '700', marginBottom: '16px' },
  card: { background: '#2d2d2d', borderRadius: '12px', padding: '16px', marginBottom: '12px' },
  input: { width: '100%', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#fff', padding: '10px', fontSize: '15px', boxSizing: 'border-box', marginBottom: '10px' },
  textarea: { width: '100%', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#fff', padding: '10px', fontSize: '15px', boxSizing: 'border-box', marginBottom: '10px', minHeight: '80px', resize: 'vertical' },
  label: { color: '#aaa', fontSize: '12px', marginBottom: '4px', display: 'block' },
  select: { width: '100%', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#fff', padding: '10px', fontSize: '15px', boxSizing: 'border-box', marginBottom: '10px' },
  btn: (v = 'primary') => ({
    background: v === 'primary' ? '#c0392b' : v === 'danger' ? '#7f1515' : '#3a3a3a',
    border: 'none', color: '#fff', padding: '10px 16px',
    borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600',
  }),
  modal: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' },
  modalCard: { background: '#2d2d2d', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '440px' },
  typeBadge: () => ({
    background: 'rgba(192,57,43,0.15)',
    color: '#e74c3c',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '11px',
    fontWeight: '600',
    display: 'inline-block',
    marginBottom: '4px',
  }),
  successMsg: { background: '#27ae60', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', fontWeight: '600', marginBottom: '12px' },
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
  const [evenementen, setEvenementen] = useState([]);
  const [laden, setLaden] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [bewerkId, setBewerkId] = useState(null);
  const [form, setForm] = useState(LEEG_FORM);
  const [opslaan, setOpslaan] = useState(false);
  const [succes, setSucces] = useState('');
  const [toonVoorbij, setToonVoorbij] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'evenementen'), orderBy('datum', 'asc'));
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
    if (!window.confirm('Evenement verwijderen?')) return;
    await deleteDoc(doc(db, 'evenementen', id));
  };

  if (!isBeheerder) {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', padding: '60px', color: '#aaa' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <div style={{ fontSize: '18px' }}>Alleen beschikbaar voor beheerders.</div>
        </div>
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

      {laden && <div style={{ color: '#aaa', padding: '24px', textAlign: 'center' }}>Laden...</div>}

      {!laden && komende.length === 0 && (
        <div style={{ color: '#aaa', textAlign: 'center', padding: '40px 0', fontSize: '15px' }}>
          Geen komende evenementen.<br />
          <span style={{ fontSize: '13px', color: '#555' }}>Tik op + Nieuw om er een toe te voegen.</span>
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
              <div style={{ fontSize: '13px', color: '#aaa', marginBottom: ev.beschrijving ? '8px' : '0' }}>
                📅 {formatDatum(ev.datum)}
                {ev.eindDatum && ev.eindDatum !== ev.datum && (
                  <span> – {formatDatum(ev.eindDatum)}</span>
                )}
              </div>
              {ev.beschrijving && (
                <div style={{ fontSize: '13px', color: '#ccc', lineHeight: '1.5', marginBottom: ev.link ? '8px' : '0' }}>
                  {ev.beschrijving}
                </div>
              )}
              {ev.link && (
                <a
                  href={ev.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '13px', color: '#c0392b', textDecoration: 'none' }}
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
            style={{ background: 'none', border: 'none', color: '#555', fontSize: '13px', cursor: 'pointer', padding: '8px 0', marginBottom: '8px' }}
          >
            {toonVoorbij ? '▲' : '▼'} {voorbij.length} voorbije evenement{voorbij.length !== 1 ? 'en' : ''}
          </button>
          {toonVoorbij && voorbij.map(ev => (
            <div key={ev.id} style={{ ...S.card, opacity: 0.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '600', textDecoration: 'line-through', color: '#666' }}>{ev.titel}</div>
                  <div style={{ fontSize: '12px', color: '#555' }}>{formatDatum(ev.datum)}</div>
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
            <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>
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
    </div>
  );
}
