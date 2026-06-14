// src/pages/Events.jsx
// Unified event overview: wedstrijden, examens, evenementen in één pagina.
// Type-filter tabs bovenaan; kaartlijst; klikken → bestaande detail panels.
import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import WedstrijdDetailPanel from '../components/details/WedstrijdDetailPanel';
import ExamenDetailPanel from '../components/details/ExamenDetailPanel';
import EvenementDetailPanel from '../components/details/EvenementDetailPanel';
import { formatDatum } from '../utils/datumUtils';

const TYPE_TABS = [
  { id: 'alles',      label: 'Alles',         icon: '📋' },
  { id: 'wedstrijd',  label: 'Wedstrijden',    icon: '🏆' },
  { id: 'examen',     label: 'Examens',        icon: '📘' },
  { id: 'evenement',  label: 'Evenementen',    icon: '🎉' },
];

const TYPE_KLEUREN = {
  wedstrijd: { bg: 'rgba(231,76,60,0.12)',  kleur: '#c0392b', label: 'Wedstrijd' },
  examen:    { bg: 'rgba(52,152,219,0.12)', kleur: '#2980b9', label: 'Examen' },
  evenement: { bg: 'rgba(39,174,96,0.12)', kleur: '#27ae60', label: 'Evenement' },
};

const S = {
  page: {},
  titel: { fontSize: '24px', fontWeight: '800', marginBottom: '4px' },
  subtitel: { color: 'var(--text-secondary)', fontSize: 'var(--font-size-md)', marginBottom: '20px' },
  filterBalk: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' },
  tabs: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '0' },
  tab: (actief) => ({
    background: 'none', border: 'none',
    color: actief ? 'var(--accent-red)' : 'var(--text-secondary)',
    padding: '10px 16px', cursor: 'pointer',
    fontSize: 'var(--font-size-md)', fontWeight: actief ? '700' : '400',
    borderBottom: actief ? '2px solid var(--accent-red)' : '2px solid transparent',
    whiteSpace: 'nowrap', fontFamily: 'inherit',
  }),
  zoekInput: {
    padding: '8px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-size-md)',
    outline: 'none', minWidth: '200px', flex: 1,
  },
  toggleBtn: (actief) => ({
    padding: '8px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontFamily: 'inherit',
    border: '1px solid var(--border-color)', fontSize: 'var(--font-size-sm)', fontWeight: '500',
    background: actief ? 'var(--accent-red)' : 'var(--bg-card)',
    color: actief ? '#fff' : 'var(--text-secondary)',
  }),
  grid: { display: 'grid', gap: '12px' },
  kaart: {
    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)', padding: '16px', cursor: 'pointer',
    transition: 'border-color 0.15s, background 0.15s',
  },
  kaartBovenste: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' },
  naam: { fontSize: 'var(--font-size-md)', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '4px' },
  meta: { display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' },
  badge: (type) => ({
    display: 'inline-block', padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700',
    background: TYPE_KLEUREN[type]?.bg || 'rgba(0,0,0,0.08)',
    color: TYPE_KLEUREN[type]?.kleur || 'var(--text-secondary)',
    flexShrink: 0,
  }),
  leeg: { textAlign: 'center', padding: '48px 16px', color: 'var(--text-secondary)', fontSize: 'var(--font-size-md)' },
};

function datumNaarMs(datum) {
  if (!datum) return 0;
  if (typeof datum === 'object' && datum.toMillis) return datum.toMillis();
  if (typeof datum === 'object' && datum.seconds) return datum.seconds * 1000;
  return new Date(datum).getTime() || 0;
}

export default function Events() {
  const { isBeheerder } = useAuth();
  const [events, setEvents] = useState([]);
  const [laden, setLaden] = useState(true);
  const [actieveTab, setActieveTab] = useState('alles');
  const [zoek, setZoek] = useState('');
  const [toonVoorbij, setToonVoorbij] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState(null);

  useEffect(() => {
    setLaden(true);
    const nu = Date.now();
    Promise.all([
      getDocs(query(collection(db, 'events'), orderBy('datum', 'desc'))),
      getDocs(query(collection(db, 'evenementen'), orderBy('datum', 'desc'))),
    ]).then(([eventsSnap, evenementenSnap]) => {
      const eventsData = eventsSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          type: data.type === 'examen' ? 'examen' : 'wedstrijd',
          naam: data.naam || data.name || '(Geen naam)',
          datum: data.datum || data.date || '',
          locatie: data.locatie || data.location || '',
          doelgroep: data.doelgroep || data.category || '',
          _ms: datumNaarMs(data.datum || data.date),
          _bron: 'events',
        };
      });

      const evenementenData = evenementenSnap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          type: 'evenement',
          naam: data.titel || data.naam || '(Geen naam)',
          datum: data.datum || '',
          locatie: data.locatie || '',
          beschrijving: data.beschrijving || '',
          _ms: datumNaarMs(data.datum),
          _bron: 'evenementen',
        };
      });

      const alles = [...eventsData, ...evenementenData].sort((a, b) => b._ms - a._ms);
      setEvents(alles);
      setLaden(false);
    }).catch(() => setLaden(false));
  }, []);

  const nu = Date.now();
  const gefilterd = events
    .filter(e => {
      if (actieveTab !== 'alles' && e.type !== actieveTab) return false;
      if (!toonVoorbij && e._ms < nu) return false;
      if (zoek && !e.naam.toLowerCase().includes(zoek.toLowerCase()) && !e.locatie?.toLowerCase().includes(zoek.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => toonVoorbij ? b._ms - a._ms : a._ms - b._ms);

  function openDetail(event) {
    setGeselecteerd(event);
  }

  function sluitDetail() {
    setGeselecteerd(null);
  }

  const aankomend = events.filter(e => e._ms >= nu).length;

  return (
    <div style={S.page}>
      <div style={S.titel}>Evenementen</div>
      <div style={S.subtitel}>
        {aankomend} aankomende evenementen
      </div>

      <div style={S.tabs}>
        {TYPE_TABS.map(t => (
          <button key={t.id} style={S.tab(actieveTab === t.id)} onClick={() => setActieveTab(t.id)}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div style={S.filterBalk}>
        <input
          style={S.zoekInput}
          placeholder="Zoeken..."
          value={zoek}
          onChange={e => setZoek(e.target.value)}
        />
        <button style={S.toggleBtn(toonVoorbij)} onClick={() => setToonVoorbij(v => !v)}>
          {toonVoorbij ? 'Verborgen: voorbij' : 'Toon voorbij'}
        </button>
      </div>

      {laden ? (
        <div style={S.leeg}>Laden...</div>
      ) : gefilterd.length === 0 ? (
        <div style={S.leeg}>
          {zoek ? `Geen resultaten voor "${zoek}"` : toonVoorbij ? 'Geen evenementen' : 'Geen aankomende evenementen'}
        </div>
      ) : (
        <div style={S.grid}>
          {gefilterd.map(event => (
            <div
              key={`${event._bron}-${event.id}`}
              style={S.kaart}
              onClick={() => openDetail(event)}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-red)'; e.currentTarget.style.background = 'var(--bg-primary)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.background = 'var(--bg-card)'; }}
            >
              <div style={S.kaartBovenste}>
                <div style={S.naam}>{event.naam}</div>
                <span style={S.badge(event.type)}>{TYPE_KLEUREN[event.type]?.label || event.type}</span>
              </div>
              <div style={S.meta}>
                {event.datum && <span>📅 {formatDatum(event.datum)}</span>}
                {event.locatie && <span>📍 {event.locatie}</span>}
                {event.doelgroep && <span>👥 {event.doelgroep}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail panels */}
      {geselecteerd?.type === 'wedstrijd' && (
        <WedstrijdDetailPanel eventId={geselecteerd.id} onClose={sluitDetail} />
      )}
      {geselecteerd?.type === 'examen' && (
        <ExamenDetailPanel eventId={geselecteerd.id} onClose={sluitDetail} />
      )}
      {geselecteerd?.type === 'evenement' && (
        <EvenementDetailPanel evenementId={geselecteerd.id} onClose={sluitDetail} />
      )}
    </div>
  );
}
