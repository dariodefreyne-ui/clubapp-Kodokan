// src/pages/Dashboard.jsx
// Personal Dashboard — toont widgets op basis van rol en gebruikersvoorkeur
// Beheerder bepaalt welke paginas per rol beschikbaar zijn (instellingen/paginaRollen)
// Gebruiker kiest zelf welke snelkoppelingen op het dashboard staan

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  doc, getDoc, setDoc, collection, query, where,
  orderBy, limit, onSnapshot, serverTimestamp, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { vandaagISO, formatDatum, huidigSeizoen } from '../components/trainingen/seizoenHelpers';
import { DEFAULT_GEEN_TRAINING_MARKERS, markersUitSettings, getClubSettings, isGeenTrainingTekst } from '../services/firestoreService';
import { C, cardStyle, badgeStyle, buttonStyle, chipStyle } from '../styles/tokens';
import TrainingDetailPanel from '../components/details/TrainingDetailPanel';
import WedstrijdDetailPanel from '../components/details/WedstrijdDetailPanel';
import ExamenDetailPanel from '../components/details/ExamenDetailPanel';
import EvenementDetailPanel from '../components/details/EvenementDetailPanel';
import DetailModal from '../components/details/DetailModal';

const TYPE_KLEUR = {
  training: C.blue,
  wedstrijd: C.orange,
  examen: C.green,
  clubactiviteit: C.purple,
  stage: C.green,
  meeting: C.textMuted,
  tornooi: C.orange,
  overig: C.textMuted,
};

const TYPE_LABEL = {
  training:       'Training',
  wedstrijd:      'Wedstrijd',
  examen:         'Examen',
  clubactiviteit: 'Clubactiviteit',
  stage:          'Stage',
  meeting:        'Meeting',
  tornooi:        'Tornooi',
  overig:         'Overig',
};

const PAGINA_META = {
  '/trainingen':    { label: 'Trainingen',    icon: '📅' },
  '/leden':         { label: 'Leden',         icon: '👥' },
  '/wedstrijden':   { label: 'Wedstrijden',   icon: '🏆' },
  '/examens':       { label: 'Examens',       icon: '📘' },
  '/technieken':    { label: 'Technieken',    icon: '🥋' },
  '/uitbetalingen': { label: 'Uitbetalingen', icon: '💶' },
  '/winkel':        { label: 'Winkel',        icon: '🛒' },
  '/rapporten':     { label: 'Rapporten',     icon: '📊' },
  '/communicatie':  { label: 'Communicatie',  icon: '📣' },
  '/documenten':    { label: 'Documenten',    icon: '📁' },
  '/eetfestijn':    { label: 'Eetfestijn',    icon: '🍝' },
  '/beheer':        { label: 'Beheer',        icon: '🔧' },
  '/profiel':       { label: 'Mijn profiel',  icon: '👤' },
};

// ─── Widget: Volgende activiteit ───────────────────────────────────────────────
function VolgendActiviteitWidget({ onItemKlik, profiel }) {
  const [item, setItem] = useState(null);
  const [laden, setLaden] = useState(true);
  const [geenTrainingMarkers, setGeenTrainingMarkers] = useState(DEFAULT_GEEN_TRAINING_MARKERS);

  useEffect(() => {
    let actief = true;
    const vandaag = vandaagISO();
    const isLid = profiel?.rol === 'lid';

    async function laad() {
      const resultaten = [];

      // 1. Trainingen
      try {
        const seizoen = huidigSeizoen();
        const snap = await getDocs(query(
          collection(db, 'trainingen'),
          where('seizoen', '==', seizoen),
          orderBy('datum', 'asc')
        ));
        snap.docs.forEach(d => {
          const t = d.data();
          if (!t.datum || t.datum < vandaag) return;
          if (isLid && (profiel?.groepen || []).length > 0) {
            if (!profiel.groepen.includes(t.groepId)) return;
          }
          resultaten.push({
            id:             d.id,
            datum:          t.datum,
            titel:          t.groepNaam || t.groepId || 'Training',
            type:           'training',
            bron:           'trainingen',
            isGeenTraining: isGeenTrainingTekst(t.opmerking, geenTrainingMarkers),
            opmerking:      t.opmerking || '',
            startTijd:      t.startTijd || null,
            eindTijd:       t.eindTijd || null,
          });
        });
      } catch (e) { console.error('Eerstvolgende trainingen:', e); }

      // 2. Events (wedstrijden + examens) — clubbreed, geen groepsfilter
      try {
        const snap = await getDocs(collection(db, 'events'));
        snap.docs.forEach(d => {
          const e = d.data();
          if (e.type !== 'wedstrijd' && e.type !== 'examen') return;
          if (!e.datum || e.datum < vandaag) return;
          resultaten.push({
            id:    d.id,
            datum: e.datum,
            titel: e.naam || e.type,
            type:  e.type,
            bron:  'events',
          });
        });
      } catch (e) { console.error('Eerstvolgende events:', e); }

      // 3. Evenementen — clubbreed, geen groepsfilter
      try {
        const snap = await getDocs(
          query(collection(db, 'evenementen'), orderBy('datum', 'asc'))
        );
        snap.docs.forEach(d => {
          const e = d.data();
          if (!e.datum || e.datum < vandaag) return;
          resultaten.push({
            id:    d.id,
            datum: e.datum,
            titel: e.titel || 'Evenement',
            type:  e.type || 'overig',
            bron:  'evenementen',
          });
        });
      } catch (e) { console.error('Eerstvolgende evenementen:', e); }

      if (!actief) return;
      resultaten.sort((a, b) => a.datum.localeCompare(b.datum));
      // Sla geen-training items over; val terug op eerste geen-training als er niets echt is
      const eersteEcht = resultaten.find(r => !r.isGeenTraining);
      setItem(eersteEcht || resultaten[0] || null);
      setLaden(false);
    }

    getClubSettings().then(settings => {
      if (settings) setGeenTrainingMarkers(markersUitSettings(settings));
    });
    laad();
    return () => { actief = false; };
  }, [profiel?.uid]);

  if (laden) return <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Laden...</div>;
  if (!item) return (
    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-md)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
      Geen activiteiten gepland
    </div>
  );

  const isVandaag = item.datum === vandaagISO();
  const emoji =
    item.type === 'training'  ? '🥋' :
    item.type === 'wedstrijd' ? '🏆' :
    item.type === 'examen'    ? '📋' : '📅';
  const typeLabel =
    item.type === 'training'  ? 'Training' :
    item.type === 'wedstrijd' ? 'Wedstrijd' :
    item.type === 'examen'    ? 'Examen' : 'Evenement';
  const borderKleur = isVandaag
    ? 'var(--success)'
    : item.type === 'training'  ? C.blue
    : item.type === 'wedstrijd' ? C.orange
    : item.type === 'examen'    ? C.green
    : C.purple;
  const labelKleur = isVandaag ? 'var(--success)' : borderKleur;

  const handleKlik = () => {
    if (!onItemKlik) return;
    if (item.bron === 'trainingen')                                onItemKlik({ type: 'training', id: item.id });
    else if (item.bron === 'events' && item.type === 'wedstrijd')  onItemKlik({ type: 'wedstrijd', id: item.id });
    else if (item.bron === 'events' && item.type === 'examen')     onItemKlik({ type: 'examen', id: item.id });
    else if (item.bron === 'evenementen')                          onItemKlik({ type: 'evenement', id: item.id });
  };

  return (
    <button
      onClick={handleKlik}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: 'var(--bg-primary)',
        borderRadius: '10px',
        padding: '14px',
        border: `1px solid ${borderKleur}`,
        cursor: 'pointer',
        color: 'inherit',
        fontFamily: 'inherit',
      }}
    >
      <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: '700', color: labelKleur, marginBottom: 'var(--space-2)' }}>
        {isVandaag ? `${emoji} Vandaag` : `${emoji} ${typeLabel}`}
      </div>
      <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: '800', marginBottom: 'var(--space-1)' }}>
        {formatDatum(item.datum)}
      </div>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
        {item.titel}
        {item.startTijd && item.eindTijd && (
          <span style={{ marginLeft: '8px', color: 'var(--text-muted)' }}>
            {item.startTijd} – {item.eindTijd}
          </span>
        )}
      </div>
    </button>
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
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            Tik op een pagina om toe te voegen of te verwijderen
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
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
                    background: actief ? 'var(--accent-red)' : 'var(--bg-primary)',
                    border: `1px solid ${actief ? 'var(--accent-red)' : 'var(--border-color)'}`,
                    color: 'var(--text-primary)',
                    padding: 'var(--space-2) 14px',
                    borderRadius: '20px',
                    cursor: 'pointer',
                    fontSize: 'var(--font-size-sm)',
                  }}
                >
                  {meta.icon} {meta.label}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setBewerk(false)}
            style={{ background: 'var(--accent-red)', border: 'none', color: 'var(--text-primary)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: '600' }}
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
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-primary)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '14px 8px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-red)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <span style={{ fontSize: '24px' }}>{meta.icon}</span>
                  <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', lineHeight: '1.2' }}>{meta.label}</span>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setBewerk(true)}
            style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '6px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' }}
          >
            ✏️ Aanpassen
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Widget: Recente clubberichten ─────────────────────────────────────────────
function BerichtenWidget({ onBerichtKlik }) {
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

  if (laden) return <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Laden...</div>;
  if (berichten.length === 0) return (
    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-md)', textAlign: 'center', padding: 'var(--space-3) 0' }}>
      Geen berichten
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {berichten.map(b => (
        <button
          key={b.id}
          onClick={() => onBerichtKlik && onBerichtKlik({ title: b.title, body: b.body })}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            background: 'transparent', border: 'none',
            borderLeft: '3px solid var(--accent-red)',
            paddingLeft: 'var(--space-3)', paddingTop: 0, paddingBottom: 0, paddingRight: 0,
            cursor: 'pointer', color: 'inherit', fontFamily: 'inherit',
          }}
        >
          <div style={{ fontWeight: '600', fontSize: 'var(--font-size-md)', marginBottom: '2px' }}>{b.title}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {b.body}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Widget: Komende activiteiten ──────────────────────────────────────────────
function KomendeActiviteitenWidget({ profiel, onItemKlik }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [laden, setLaden] = useState(true);
  const [geenTrainingMarkers, setGeenTrainingMarkers] = useState(DEFAULT_GEEN_TRAINING_MARKERS);

  useEffect(() => {
    let actief = true;
    const filters = profiel?.agendaFilters || {
      toonTrainingen: true, toonWedstrijden: true,
      toonExamens: true, toonEvenementen: true, enkelMijnGroepen: false,
    };
    const vandaag = new Date().toISOString().slice(0, 10);

    async function laad() {
      const resultaten = [];

      // 1. Trainingen: gebruik bestaande index (seizoen + datum)
      // Filter op datum >= vandaag client-side om extra index te vermijden
      if (filters.toonTrainingen) {
        try {
          const d = new Date();
          const m = d.getMonth();
          const j = d.getFullYear();
          const seizoen = m >= 8 ? `${j}-${j+1}` : `${j-1}-${j}`;
          const snap = await getDocs(query(
            collection(db, 'trainingen'),
            where('seizoen', '==', seizoen),
            orderBy('datum', 'asc')
          ));
          snap.docs.forEach(doc => {
            const t = doc.data();
            if (t.datum < vandaag) return;
            if (filters.enkelMijnGroepen && (profiel?.groepen || []).length > 0) {
              if (!(profiel.groepen).includes(t.groepId)) return;
            }
            resultaten.push({
              id:             doc.id,
              datum:          t.datum,
              titel:          t.groepNaam || t.groepId || 'Training',
              type:           'training',
              bron:           'trainingen',
              isGeenTraining: isGeenTrainingTekst(t.opmerking, geenTrainingMarkers),
              opmerking:      t.opmerking || '',
            });
          });
        } catch (e) { console.error('Widget trainingen:', e); }
      }

      // 2. Events (wedstrijden + examens) — volledige collectie, client-side filteren
      if (filters.toonWedstrijden || filters.toonExamens) {
        try {
          const snap = await getDocs(collection(db, 'events'));
          snap.docs.forEach(doc => {
            const e = doc.data();
            const isW = e.type === 'wedstrijd';
            const isE = e.type === 'examen';
            if (isW && !filters.toonWedstrijden) return;
            if (isE && !filters.toonExamens)    return;
            if (!isW && !isE)                    return;
            const datum = e.datum;
            const titel = e.naam;
            if (!datum || datum < vandaag) return;
            resultaten.push({
              id:    doc.id,
              datum,
              titel: titel || e.type,
              type:  e.type,
              bron:  'events',
            });
          });
        } catch (e) { console.error('Widget events:', e); }
      }

      // 3. Evenementen: orderBy datum, client-side filter >= vandaag
      if (filters.toonEvenementen) {
        try {
          const snap = await getDocs(
            query(collection(db, 'evenementen'), orderBy('datum', 'asc'))
          );
          snap.docs.forEach(doc => {
            const e = doc.data();
            if (!e.datum || e.datum < vandaag) return;
            resultaten.push({
              id:    doc.id,
              datum: e.datum,
              titel: e.titel || 'Evenement',
              type:  e.type || 'overig',
              bron:  'evenementen',
            });
          });
        } catch (e) { console.error('Widget evenementen:', e); }
      }

      if (!actief) return;
      resultaten.sort((a, b) => a.datum.localeCompare(b.datum));
      setItems(resultaten.slice(0, 5));
      setLaden(false);
    }

    getClubSettings().then(settings => {
      if (settings) setGeenTrainingMarkers(markersUitSettings(settings));
    });
    laad();
    return () => { actief = false; };
  }, [profiel?.uid]);

  const handleKlik = (item) => {
    if (item.bron === 'trainingen')                                onItemKlik({ type: 'training', id: item.id });
    else if (item.bron === 'events' && item.type === 'wedstrijd')  onItemKlik({ type: 'wedstrijd', id: item.id });
    else if (item.bron === 'events' && item.type === 'examen')     onItemKlik({ type: 'examen', id: item.id });
    else if (item.bron === 'evenementen')                          onItemKlik({ type: 'evenement', id: item.id });
  };

  if (laden) return <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Laden...</div>;

  if (items.length === 0) return (
    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-md)', textAlign: 'center', padding: 'var(--space-3) 0' }}>
      Geen komende activiteiten
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.map(item => (
        <div key={`${item.bron}-${item.id}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 0',
            borderBottom: '1px solid var(--border-color)',
            opacity: item.isGeenTraining ? 0.6 : 1,
            cursor: 'pointer',
          }}
          onClick={() => handleKlik(item)}
        >
          <div style={{ fontSize: 'var(--font-size-lg)', width: '28px', textAlign: 'center', flexShrink: 0 }}>
            {item.isGeenTraining ? '🚫' : item.type === 'training' ? '🥋' : item.type === 'wedstrijd' ? '🏆' : item.type === 'examen' ? '📋' : '📅'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: '600',
              color: item.isGeenTraining ? 'var(--text-secondary)' : 'var(--text-primary)',
              textDecoration: item.isGeenTraining ? 'line-through' : 'none',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {item.titel}
              {item.isGeenTraining && (
                <span style={{ marginLeft: '6px', fontWeight: '400', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textDecoration: 'none' }}>
                  ({item.opmerking || 'Geen training'})
                </span>
              )}
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
              {new Date(item.datum).toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })}
            </div>
          </div>
        </div>
      ))}
      <button
        onClick={() => navigate('/agenda')}
        style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontFamily: 'inherit', marginTop: '2px' }}
      >
        Volledige agenda
      </button>
    </div>
  );
}

// ─── Hoofd Dashboard component ─────────────────────────────────────────────────
export default function Dashboard() {
  const { profiel, isBeheerder, isTrainer } = useAuth();
  const [beschikbarePaginas, setBeschikbarePaginas] = useState([]);
  const [favorieten, setFavorieten] = useState([]);
  const [voorkeursLaden, setVoorkeursLaden] = useState(true);
  const [actiefDetail, setActiefDetail] = useState(null);
  const [berichtModal, setBerichtModal] = useState(null);

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
      const allePaginas = Object.keys(PAGINA_META);

      let paginas;
      if (rol === 'admin') {
        paginas = allePaginas;
      } else {
        const rolConfig = rolSnap.exists() ? rolSnap.data() : {
          admin: allePaginas,
          bestuurslid: allePaginas,
          trainer: ['/trainingen','/wedstrijden','/examens','/uitbetalingen','/communicatie'],
          lid: ['/wedstrijden','/examens','/communicatie'],
        };
        paginas = rolConfig[rol] || [];
      }

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
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Laden...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: 'var(--space-4)' }}>

      {/* Begroeting */}
      <div style={{ ...cardStyle({ gradient: true }), marginBottom: 'var(--space-6)' }}>
        <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: '800', marginBottom: 'var(--space-1)' }}>
          {begroeting}, {naam.split(' ')[0]} 👋
        </div>
        <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-secondary)' }}>
          {new Date().toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })}
          {' · '}
          <span style={{ color: 'var(--accent-red)', fontWeight: '600', textTransform: 'capitalize' }}>{rol}</span>
        </div>
      </div>

      {/* Widget: Eerstvolgende activiteit — zichtbaar voor alle rollen */}
      {beschikbarePaginas.includes('/agenda') && (
        <div style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Eerstvolgende
          </div>
          <VolgendActiviteitWidget onItemKlik={setActiefDetail} profiel={profiel} />
        </div>
      )}

      {/* Widget: Snelkoppelingen */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Snelkoppelingen
        </div>
        <SnelkoppelingenWidget
          beschikbarePaginas={beschikbarePaginas}
          favorieten={favorieten}
          onWijzig={slaFavorietenOp}
        />
      </div>

      {/* Widget: Komende activiteiten */}
      {beschikbarePaginas.includes('/agenda') && (
        <div style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Komende activiteiten
          </div>
          <KomendeActiviteitenWidget profiel={profiel} onItemKlik={setActiefDetail} />
        </div>
      )}

      {/* Widget: Clubberichten */}
      {beschikbarePaginas.includes('/communicatie') && (
        <div style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Clubberichten
          </div>
          <BerichtenWidget onBerichtKlik={setBerichtModal} />
        </div>
      )}

      {actiefDetail?.type === 'training' && (
        <TrainingDetailPanel trainingId={actiefDetail.id} onClose={() => setActiefDetail(null)} />
      )}
      {actiefDetail?.type === 'wedstrijd' && (
        <WedstrijdDetailPanel eventId={actiefDetail.id} onClose={() => setActiefDetail(null)} />
      )}
      {actiefDetail?.type === 'examen' && (
        <ExamenDetailPanel eventId={actiefDetail.id} onClose={() => setActiefDetail(null)} />
      )}
      {actiefDetail?.type === 'evenement' && (
        <EvenementDetailPanel evenementId={actiefDetail.id} onClose={() => setActiefDetail(null)} />
      )}
      {berichtModal && (
        <DetailModal open={true} onClose={() => setBerichtModal(null)} title={berichtModal.title} accentKleur={C.red}>
          <div style={{ whiteSpace: 'pre-wrap', color: C.textPrimary }}>{berichtModal.body}</div>
        </DetailModal>
      )}
    </div>
  );
}
