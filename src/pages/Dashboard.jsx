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

const TYPE_KLEUR = {
  training:       '#2980b9',
  wedstrijd:      '#e67e22',
  examen:         '#27ae60',
  clubactiviteit: '#8e44ad',
  stage:          '#16a085',
  meeting:        '#7f8c8d',
  tornooi:        '#e67e22',
  overig:         '#555555',
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

// ─── Widget: Komende activiteiten ──────────────────────────────────────────────
function KomendeActiviteitenWidget({ profiel }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [laden, setLaden] = useState(true);

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
              id:    doc.id,
              datum: t.datum,
              titel: t.groepNaam || t.groepId || 'Training',
              type:  'training',
              bron:  'trainingen',
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

    laad();
    return () => { actief = false; };
  }, [profiel?.uid]);

  const handleKlik = (item) => {
    if (item.bron === 'trainingen')                          navigate('/trainingen');
    if (item.bron === 'events' && item.type === 'wedstrijd') navigate('/wedstrijden');
    if (item.bron === 'events' && item.type === 'examen')    navigate('/examens');
    if (item.bron === 'evenementen')                         navigate('/evenementen');
  };

  if (laden) return <div style={{ color: '#aaa', fontSize: '13px' }}>Laden...</div>;

  if (items.length === 0) return (
    <div style={{ color: '#aaa', fontSize: '14px', textAlign: 'center', padding: '12px 0' }}>
      Geen komende activiteiten
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {items.map(item => {
        const kleur = TYPE_KLEUR[item.type] || '#555';
        const d = new Date(item.datum + 'T00:00:00');
        const isVandaag = item.datum === new Date().toISOString().slice(0, 10);
        return (
          <button
            key={`${item.bron}-${item.id}`}
            onClick={() => handleKlik(item)}
            style={{
              display:      'flex',
              alignItems:   'center',
              gap:          '10px',
              background:   '#1a1a1a',
              border:       `1px solid ${isVandaag ? kleur : '#3a3a3a'}`,
              borderLeft:   `3px solid ${kleur}`,
              borderRadius: '8px',
              padding:      '10px',
              cursor:       'pointer',
              textAlign:    'left',
              fontFamily:   'inherit',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{ minWidth: '36px', textAlign: 'center', flexShrink: 0 }}>
              <div style={{ fontSize: '16px', fontWeight: '800', color: '#fff', lineHeight: 1 }}>
                {d.getDate()}
              </div>
              <div style={{ fontSize: '10px', color: '#aaa', textTransform: 'uppercase' }}>
                {d.toLocaleDateString('nl-BE', { month: 'short' })}
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: kleur, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
                {TYPE_LABEL[item.type] || item.type}
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.titel}
              </div>
            </div>
            <div style={{ color: '#555', fontSize: '14px', flexShrink: 0 }}>{'>'}</div>
          </button>
        );
      })}
      <button
        onClick={() => navigate('/agenda')}
        style={{ background: 'transparent', border: '1px solid #3a3a3a', color: '#aaa', padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', marginTop: '2px' }}
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
          beheerder: allePaginas,
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

      {/* Widget: Komende activiteiten */}
      {beschikbarePaginas.includes('/agenda') && (
        <div style={{ background: C.card, borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: '700', color: C.textSec, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Komende activiteiten
          </div>
          <KomendeActiviteitenWidget profiel={profiel} />
        </div>
      )}

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
