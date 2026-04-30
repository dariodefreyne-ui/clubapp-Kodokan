// src/pages/Dashboard.jsx
// Personal Dashboard — toont widgets op basis van rol en gebruikersvoorkeur
// Beheerder bepaalt welke paginas per rol beschikbaar zijn (instellingen/paginaRollen)
// Gebruiker kiest zelf welke snelkoppelingen op het dashboard staan

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  doc, getDoc, setDoc, collection, query, where,
  orderBy, limit, onSnapshot, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { vandaagISO, formatDatum, huidigSeizoen } from '../components/trainingen/seizoenHelpers';

const C = {
  bg:      '#1a1a1a',
  card:    '#2d2d2d',
  border:  '#3a3a3a',
  red:     '#c0392b',
  text:    '#ffffff',
  textSec: '#aaaaaa',
  green:   '#27ae60',
  orange:  '#e67e22',
};

const PAGINA_META = {
  '/trainingen':    { label: 'Trainingen',    icon: '📅' },
  '/leden':         { label: 'Leden',         icon: '👥' },
  '/wedstrijden':   { label: 'Wedstrijden',   icon: '🏆' },
  '/examens':       { label: 'Examens',       icon: '📘' },
  '/technieken':    { label: 'Technieken',    icon: '🥋' },
  '/uitbetalingen': { label: 'Uitbetalingen', icon: '💶' },
  '/winkel':        { label: 'Clubwinkel',    icon: '🛒' },
  '/verkoop':       { label: 'Verkoop',       icon: '💳' },
  '/stock':         { label: 'Stock',         icon: '📦' },
  '/rapporten':     { label: 'Rapporten',     icon: '📊' },
  '/communicatie':  { label: 'Communicatie',  icon: '📣' },
  '/documenten':    { label: 'Documenten',    icon: '📁' },
  '/eetfestijn':    { label: 'Eetfestijn',    icon: '🍝' },
  '/beheer':        { label: 'Beheer',        icon: '🔧' },
  '/profiel':       { label: 'Mijn profiel',  icon: '👤' },
};

// ─── Widget: Volgende Training ──────────────────────────────────────────────────
function VolgendTrainingWidget() {
  const [training, setTraining] = useState(null);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    const seizoen = huidigSeizoen();
    const q = query(
      collection(db, 'trainingen'),
      where('seizoen', '==', seizoen),
      where('datum', '>=', vandaagISO()),
      orderBy('datum', 'asc'),
      limit(1)
    );
    const unsub = onSnapshot(q, snap => {
      setTraining(snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null);
      setLaden(false);
    }, () => setLaden(false));
    return unsub;
  }, []);

  if (laden) return <div style={{ color: C.textSec, fontSize: '13px' }}>Laden...</div>;
  if (!training) return (
    <div style={{ color: C.textSec, fontSize: '14px', textAlign: 'center', padding: '16px 0' }}>
      Geen trainingen gepland
    </div>
  );

  const isVandaag = training.datum === vandaagISO();
  return (
    <div style={{
      background: C.bg,
      borderRadius: '10px',
      padding: '14px',
      border: `1px solid ${isVandaag ? C.green : C.orange}`,
    }}>
      <div style={{ fontSize: '11px', fontWeight: '700', color: isVandaag ? C.green : C.orange, marginBottom: '8px' }}>
        {isVandaag ? '🥋 Vandaag' : '⏭ Volgende training'}
      </div>
      <div style={{ fontSize: '18px', fontWeight: '800', marginBottom: '4px' }}>
        {formatDatum(training.datum)}
      </div>
      {training.groepNaam && (
        <div style={{ fontSize: '13px', color: C.textSec }}>{training.groepNaam}</div>
      )}
    </div>
  );
}

// ─── Widget: Snelkoppelingen (bewerkbaar) ──────────────────────────────────────
function SnelkoppelingenWidget({ beschikbarePaginas, favorieten, onWijzig }) {
  const navigate = useNavigate();
  const [bewerk, setBewerk] = useState(false);

  return (
    <div>
      {bewerk ? (
        <div>
          <div style={{ fontSize: '12px', color: C.textSec, marginBottom: '10px' }}>
            Tik op een pagina om toe te voegen of te verwijderen
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {beschikbarePaginas.map(pad => {
              const meta = PAGINA_META[pad];
              if (!meta) return null;
              const actief = favorieten.includes(pad);
              return (
                <button
                  key={pad}
                  onClick={() => {
                    const nieuw = actief
                      ? favorieten.filter(p => p !== pad)
                      : [...favorieten, pad];
                    onWijzig(nieuw);
                  }}
                  style={{
                    background: actief ? C.red : C.bg,
                    border: `1px solid ${actief ? C.red : C.border}`,
                    color: C.text,
                    padding: '8px 14px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  {meta.icon} {meta.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setBewerk(false)}
            style={{ background: C.red, border: 'none', color: C.text, padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
          >
            Klaar
          </button>
        </div>
      ) : (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px', marginBottom: '12px' }}>
            {(favorieten.length > 0 ? favorieten : beschikbarePaginas.slice(0, 6)).map(pad => {
              const meta = PAGINA_META[pad];
              if (!meta) return null;
              return (
                <button
                  key={pad}
                  onClick={() => navigate(pad)}
                  style={{
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    color: C.text,
                    borderRadius: '12px',
                    padding: '14px 8px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = C.red}
                  onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
                >
                  <span style={{ fontSize: '24px' }}>{meta.icon}</span>
                  <span style={{ fontSize: '11px', fontWeight: '600', lineHeight: '1.2' }}>{meta.label}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setBewerk(true)}
            style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textSec, padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}
          >
            ✏️ Aanpassen
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Widget: Recente clubberichten ─────────────────────────────────────────────
function BerichtenWidget() {
  const [berichten, setBerichten] = useState([]);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'communications'), orderBy('createdAt', 'desc'), limit(3));
    const unsub = onSnapshot(q, snap => {
      setBerichten(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLaden(false);
    }, () => setLaden(false));
    return unsub;
  }, []);

  if (laden) return <div style={{ color: C.textSec, fontSize: '13px' }}>Laden...</div>;
  if (berichten.length === 0) return (
    <div style={{ color: C.textSec, fontSize: '14px', textAlign: 'center', padding: '12px 0' }}>
      Geen berichten
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {berichten.map(b => (
        <div key={b.id} style={{ borderLeft: `3px solid ${C.red}`, paddingLeft: '12px' }}>
          <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '2px' }}>{b.title}</div>
          <div style={{ color: C.textSec, fontSize: '12px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {b.body}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Hoofd Dashboard component ─────────────────────────────────────────────────
export default function Dashboard() {
  const { profiel, isBeheerder, isTrainer } = useAuth();
  const [beschikbarePaginas, setBeschikbarePaginas] = useState([]);
  const [favorieten, setFavorieten] = useState([]);
  const [voorkeursLaden, setVoorkeursLaden] = useState(true);

  const rol = profiel?.rol ?? 'trainer';
  const naam = profiel?.naam || profiel?.email || 'Judo';
  const uur = new Date().getHours();
  const begroeting = uur < 12 ? 'Goedemorgen' : uur < 18 ? 'Goedemiddag' : 'Goedenavond';

  useEffect(() => {
    if (!profiel?.uid) return;

    Promise.all([
      getDoc(doc(db, 'instellingen', 'paginaRollen')),
      getDoc(doc(db, 'users', profiel.uid)),
    ]).then(([rolSnap, userSnap]) => {
      const rolConfig = rolSnap.exists() ? rolSnap.data() : {
        beheerder: Object.keys(PAGINA_META),
        trainer: ['/trainingen','/wedstrijden','/examens','/uitbetalingen','/communicatie'],
        lid: ['/wedstrijden','/examens','/communicatie'],
      };
      const paginas = rolConfig[rol] || [];
      setBeschikbarePaginas(paginas);

      const opgeslagen = userSnap.data()?.dashboardVolgorde || [];
      setFavorieten(opgeslagen.filter(p => paginas.includes(p)));

      setVoorkeursLaden(false);
    }).catch(() => setVoorkeursLaden(false));
  }, [profiel?.uid, rol]);

  const slaFavorietenOp = async (nieuweFavorieten) => {
    setFavorieten(nieuweFavorieten);
    if (!profiel?.uid) return;
    await setDoc(doc(db, 'users', profiel.uid), {
      dashboardVolgorde: nieuweFavorieten,
      bijgewerkt: serverTimestamp(),
    }, { merge: true });
  };

  if (voorkeursLaden) {
    return (
      <div style={{ minHeight: '100vh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: C.textSec }}>Laden...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.text, padding: '16px' }}>

      {/* Begroeting */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ fontSize: '22px', fontWeight: '800', marginBottom: '4px' }}>
          {begroeting}, {naam.split(' ')[0]} 👋
        </div>
        <div style={{ fontSize: '14px', color: C.textSec }}>
          {new Date().toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })}
          {' · '}
          <span style={{ color: C.red, fontWeight: '600', textTransform: 'capitalize' }}>{rol}</span>
        </div>
      </div>

      {/* Widget: Volgende training (enkel trainers en beheerders) */}
      {(isTrainer || isBeheerder) && beschikbarePaginas.includes('/trainingen') && (
        <div style={{ background: C.card, borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: C.textSec, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Volgende training
          </div>
          <VolgendTrainingWidget />
        </div>
      )}

      {/* Widget: Snelkoppelingen */}
      <div style={{ background: C.card, borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
        <div style={{ fontSize: '13px', fontWeight: '700', color: C.textSec, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Snelkoppelingen
        </div>
        <SnelkoppelingenWidget
          beschikbarePaginas={beschikbarePaginas}
          favorieten={favorieten}
          onWijzig={slaFavorietenOp}
        />
      </div>

      {/* Widget: Clubberichten */}
      {beschikbarePaginas.includes('/communicatie') && (
        <div style={{ background: C.card, borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: C.textSec, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Clubberichten
          </div>
          <BerichtenWidget />
        </div>
      )}

    </div>
  );
}
