// src/pages/Agenda.jsx
// Gecombineerde clubagenda: trainingen + wedstrijden + examens + evenementen
// Maand- en lijstweergave, filters lokaal (worden in stap 2 naar profiel verplaatst)

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection, query, where, orderBy, getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { huidigSeizoen, vandaagISO } from '../components/trainingen/seizoenHelpers';
import { C, cardStyle, buttonStyle, badgeStyle, chipStyle, tabBarStyle, tabButtonStyle, inputStyle } from '../styles/tokens';

// ─── Evenement type kleuren ────────────────────────────────────────────────────
const TYPE_KLEUREN = {
  training: C.blue,
  wedstrijd: C.orange,
  examen: C.green,
  evenement: C.purple,
  clubactiviteit: C.purple,
  stage: C.green,
  meeting: C.textMuted,
  tornooi: C.orange,
  overig: C.textMuted,
};

const TYPE_LABELS = {
  training:       'Training',
  wedstrijd:      'Wedstrijd',
  examen:         'Examen',
  clubactiviteit: 'Clubactiviteit',
  stage:          'Stage',
  meeting:        'Meeting',
  tornooi:        'Tornooi',
  overig:         'Overig',
};

const DAGEN_KORT = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const MAANDEN_NL = ['Januari','Februari','Maart','April','Mei','Juni','Juli','Augustus','September','Oktober','November','December'];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function typeKleur(type) {
  return TYPE_KLEUREN[type] || TYPE_KLEUREN.overig;
}

function formatDatumLang(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// Normaliseer alle bronnen naar uniform formaat
function normaliseer(items) {
  return items
    .filter(i => i.datum)
    .sort((a, b) => a.datum.localeCompare(b.datum));
}

// ─── Data laden ────────────────────────────────────────────────────────────────
async function laadAgendaData(filters, profiel) {
  const seizoen = huidigSeizoen();
  const resultaten = [];

  // 1. Trainingen
  if (filters.toonTrainingen) {
    try {
      const q = query(
        collection(db, 'trainingen'),
        where('seizoen', '==', seizoen),
        orderBy('datum', 'asc')
      );
      const snap = await getDocs(q);
      snap.docs.forEach(d => {
        const t = d.data();
        const mijnGroepen = profiel?.groepen || [];
        if (filters.enkelMijnGroepen && mijnGroepen.length > 0) {
          if (!mijnGroepen.includes(t.groepId)) return;
        }
        resultaten.push({
          id:     d.id,
          datum:  t.datum,
          titel:  t.groepNaam || t.groepId || 'Training',
          type:   'training',
          bron:   'trainingen',
          bronId: d.id,
          extra:  { groepId: t.groepId, lesgevers: t.lesgevers || [] },
        });
      });
    } catch (e) { console.error('Trainingen laden mislukt:', e); }
  }

  // 2. Events (wedstrijden + examens) — beide gebruiken velden 'datum' en 'naam'
  if (filters.toonWedstrijden || filters.toonExamens) {
    try {
      const snap = await getDocs(collection(db, 'events'));
      snap.docs.forEach(d => {
        const e = d.data();
        const isWedstrijd = e.type === 'wedstrijd';
        const isExamen    = e.type === 'examen';

        if (isWedstrijd && !filters.toonWedstrijden) return;
        if (isExamen    && !filters.toonExamens)    return;
        if (!isWedstrijd && !isExamen)               return;

        const datum = e.datum;
        const titel = e.naam;
        if (!datum) return;

        resultaten.push({
          id:     d.id,
          datum,
          titel:  titel || (isExamen ? 'Examen' : 'Wedstrijd'),
          type:   e.type,
          bron:   'events',
          bronId: d.id,
          extra:  {
            locatie:   e.locatie || e.location || '',
            doelgroep: e.doelgroep || '',
          },
        });
      });
    } catch (e) { console.error('Events laden mislukt:', e); }
  }

  // 3. Evenementen
  if (filters.toonEvenementen) {
    try {
      const snap = await getDocs(query(collection(db, 'evenementen'), orderBy('datum', 'asc')));
      snap.docs.forEach(d => {
        const e = d.data();
        if (!e.datum) return;
        resultaten.push({
          id:     d.id,
          datum:  e.datum,
          titel:  e.titel || 'Evenement',
          type:   e.type || 'overig',
          bron:   'evenementen',
          bronId: d.id,
          extra:  { beschrijving: e.beschrijving || '', link: e.link || '', eindDatum: e.eindDatum || '' },
        });
      });
    } catch (e) { console.error('Evenementen laden mislukt:', e); }
  }

  return normaliseer(resultaten);
}

// ─── AgendaItem component ───────────────────────────────────────────────────────
function AgendaItem({ item, onClick }) {
  const kleur = typeKleur(item.type);
  const vandaag = vandaagISO();
  const isVandaag = item.datum === vandaag;
  const isVoorbij = item.datum < vandaag;

  return (
    <button
      onClick={() => onClick(item)}
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:             '12px',
        width:           '100%',
        background:      'var(--bg-card)',
        border:          `1px solid ${isVandaag ? kleur : 'var(--border-color)'}`,
        borderLeft:      `4px solid ${kleur}`,
        borderRadius:    '10px',
        padding:         '12px',
        cursor:          'pointer',
        textAlign:       'left',
        marginBottom:    '8px',
        opacity:         isVoorbij ? 0.55 : 1,
        fontFamily:      'inherit',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ minWidth: '48px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', fontWeight: '800', color: isVoorbij ? 'var(--text-secondary)' : 'var(--text-primary)', lineHeight: 1 }}>
          {new Date(item.datum + 'T00:00:00').getDate()}
        </div>
        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
          {new Date(item.datum + 'T00:00:00').toLocaleDateString('nl-BE', { month: 'short' })}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <span style={{
            fontSize: '10px', fontWeight: '700', color: kleur,
            background: `${kleur}22`, padding: '2px 6px', borderRadius: '6px',
            textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap',
          }}>
            {TYPE_LABELS[item.type] || item.type}
          </span>
          {isVandaag && (
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '700', color: 'var(--warning)', background: 'rgba(251,146,60,0.16)', padding: '2px 6px', borderRadius: '6px' }}>
              Vandaag
            </span>
          )}
        </div>
        <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', color: isVoorbij ? 'var(--text-secondary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {item.titel}
        </div>
        {item.extra?.locatie && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {item.extra.locatie}
          </div>
        )}
        {item.extra?.doelgroep && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            {item.extra.doelgroep}
          </div>
        )}
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-base)', flexShrink: 0 }}>{'>'}</div>
    </button>
  );
}

// ─── MaandGrid component ────────────────────────────────────────────────────────
function MaandGrid({ jaar, maand, items, onDagKlik }) {
  const eerstedag = new Date(jaar, maand, 1);
  const startOffset = (eerstedag.getDay() + 6) % 7; // Maandag = 0
  const aantalDagen = new Date(jaar, maand + 1, 0).getDate();
  const vandaag = vandaagISO();

  const perDatum = {};
  items.forEach(item => {
    if (!perDatum[item.datum]) perDatum[item.datum] = [];
    perDatum[item.datum].push(item);
  });

  const cellen = [];
  for (let i = 0; i < startOffset; i++) {
    cellen.push(<div key={`leeg-${i}`} />);
  }
  for (let dag = 1; dag <= aantalDagen; dag++) {
    const iso = `${jaar}-${String(maand + 1).padStart(2, '0')}-${String(dag).padStart(2, '0')}`;
    const dagItems = perDatum[iso] || [];
    const isVandaag = iso === vandaag;
    const isVerleden = iso < vandaag;

    cellen.push(
      <button
        key={iso}
        onClick={() => dagItems.length > 0 && onDagKlik(iso, dagItems)}
        style={{
          background:    isVandaag ? 'rgba(230,51,70,0.16)' : 'transparent',
          border:        isVandaag ? '1px solid var(--accent-red)' : '1px solid transparent',
          borderRadius:  '8px',
          padding:       '4px 2px',
          cursor:        dagItems.length > 0 ? 'pointer' : 'default',
          minHeight:     '44px',
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           '2px',
          fontFamily:    'inherit',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <span style={{
          fontSize:   '13px',
          fontWeight: isVandaag ? '800' : '400',
          color:      isVandaag ? 'var(--accent-red)' : isVerleden ? 'var(--text-secondary)' : 'var(--text-primary)',
          lineHeight: '1.2',
        }}>
          {dag}
        </span>
        {dagItems.slice(0, 3).map((item, i) => (
          <span key={i} style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: typeKleur(item.type), flexShrink: 0,
          }} />
        ))}
        {dagItems.length > 3 && (
          <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>+{dagItems.length - 3}</span>
        )}
      </button>
    );
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
        {DAGEN_KORT.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: '600', padding: '4px 0' }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {cellen}
      </div>
    </div>
  );
}

// ─── DagPopup component ─────────────────────────────────────────────────────────
function DagPopup({ datum, items, onSluit, onItemKlik }) {
  if (!datum) return null;
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px' }}
      onClick={onSluit}
    >
      <div
        style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', width: '100%', maxWidth: '500px', maxHeight: '70vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '700', marginBottom: '14px', color: 'var(--text-secondary)' }}>
          {formatDatumLang(datum)}
        </div>
        {items.map(item => (
          <AgendaItem key={item.id} item={item} onClick={(i) => { onSluit(); onItemKlik(i); }} />
        ))}
        <button
          onClick={onSluit}
          style={{ width: '100%', marginTop: '8px', padding: '12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 'var(--font-size-md)', fontFamily: 'inherit' }}
        >
          Sluiten
        </button>
      </div>
    </div>
  );
}

// ─── FilterBar component ────────────────────────────────────────────────────────
function FilterBar({ filters, onChange, profiel }) {
  const heeftGroepen = (profiel?.groepen || []).length > 0;
  const toggle = (key) => onChange({ ...filters, [key]: !filters[key] });

  const filterKnop = (key, label, kleur) => (
    <button
      key={key}
      onClick={() => toggle(key)}
      style={{
        background:  filters[key] ? `${kleur}22` : 'var(--bg-primary)',
        border:      `1px solid ${filters[key] ? kleur : 'var(--border-color)'}`,
        color:       filters[key] ? kleur : 'var(--text-secondary)',
        padding:     '6px 12px',
        borderRadius:'16px',
        cursor:      'pointer',
        fontSize:    '12px',
        fontWeight:  filters[key] ? '700' : '400',
        whiteSpace:  'nowrap',
        fontFamily:  'inherit',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
      {filterKnop('toonTrainingen',  'Trainingen',  TYPE_KLEUREN.training)}
      {filterKnop('toonWedstrijden', 'Wedstrijden', TYPE_KLEUREN.wedstrijd)}
      {filterKnop('toonExamens',     'Examens',     TYPE_KLEUREN.examen)}
      {filterKnop('toonEvenementen', 'Evenementen', TYPE_KLEUREN.evenement)}
      {heeftGroepen && filters.toonTrainingen && (
        <button
          onClick={() => toggle('enkelMijnGroepen')}
          style={{
            background:  filters.enkelMijnGroepen ? 'rgba(230,51,70,0.16)' : 'var(--bg-primary)',
            border:      `1px solid ${filters.enkelMijnGroepen ? 'var(--accent-red)' : 'var(--border-color)'}`,
            color:       filters.enkelMijnGroepen ? 'var(--accent-red)' : 'var(--text-secondary)',
            padding:     '6px 12px',
            borderRadius:'16px',
            cursor:      'pointer',
            fontSize:    '12px',
            fontWeight:  filters.enkelMijnGroepen ? '700' : '400',
            whiteSpace:  'nowrap',
            fontFamily:  'inherit',
          }}
        >
          Mijn groepen
        </button>
      )}
    </div>
  );
}

// ─── Hoofd component ────────────────────────────────────────────────────────────
const STANDAARD_FILTERS = {
  toonTrainingen:   true,
  toonWedstrijden:  true,
  toonExamens:      true,
  toonEvenementen:  true,
  enkelMijnGroepen: false,
};

export default function Agenda() {
  const { profiel, slaProfielOp } = useAuth();
  const navigate = useNavigate();

  const vandaag = new Date();
  const [weergave, setWeergave] = useState('lijst');
  const [maand, setMaand]       = useState(vandaag.getMonth());
  const [jaar, setJaar]         = useState(vandaag.getFullYear());
  const [filters, setFilters] = useState(() => {
    const opgeslagen = profiel?.agendaFilters;
    if (!opgeslagen) return STANDAARD_FILTERS;
    return { ...STANDAARD_FILTERS, ...opgeslagen };
  });
  const [items, setItems]       = useState([]);
  const [laden, setLaden]       = useState(true);
  const [dagPopup, setDagPopup] = useState(null);

  useEffect(() => {
    let actief = true;
    setLaden(true);
    laadAgendaData(filters, profiel).then(data => {
      if (actief) { setItems(data); setLaden(false); }
    });
    return () => { actief = false; };
  }, [filters, profiel?.uid]);

  const itemsDezeManand = useMemo(() => {
    const prefix = `${jaar}-${String(maand + 1).padStart(2, '0')}`;
    return items.filter(i => i.datum.startsWith(prefix));
  }, [items, jaar, maand]);

  const lijstItems = useMemo(() => {
    const grens = new Date();
    grens.setDate(grens.getDate() - 7);
    const grensDatum = grens.toISOString().slice(0, 10);
    return items.filter(i => i.datum >= grensDatum);
  }, [items]);

  const handleItemKlik = (item) => {
    if (item.bron === 'trainingen')                              navigate('/trainingen');
    if (item.bron === 'events' && item.type === 'wedstrijd')    navigate('/wedstrijden');
    if (item.bron === 'events' && item.type === 'examen')       navigate('/examens');
    if (item.bron === 'evenementen')                            navigate('/evenementen');
  };

  const vorigeMaand = () => {
    if (maand === 0) { setMaand(11); setJaar(j => j - 1); }
    else setMaand(m => m - 1);
  };
  const volgendeMaand = () => {
    if (maand === 11) { setMaand(0); setJaar(j => j + 1); }
    else setMaand(m => m + 1);
  };

  const groepenPerMaand = useMemo(() => {
    const map = new Map();
    lijstItems.forEach(item => {
      const d = new Date(item.datum + 'T00:00:00');
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!map.has(key)) map.set(key, { label: `${MAANDEN_NL[d.getMonth()]} ${d.getFullYear()}`, items: [] });
      map.get(key).items.push(item);
    });
    return [...map.values()];
  }, [lijstItems]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: 'var(--space-4)' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ fontSize: '22px', fontWeight: '800' }}>Agenda</div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setWeergave('lijst')}
            style={{ background: weergave === 'lijst' ? 'var(--accent-red)' : 'var(--bg-card)', border: 'none', color: 'var(--text-primary)', padding: '8px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: weergave === 'lijst' ? '700' : '400', fontFamily: 'inherit' }}
          >
            Lijst
          </button>
          <button
            onClick={() => setWeergave('maand')}
            style={{ background: weergave === 'maand' ? 'var(--accent-red)' : 'var(--bg-card)', border: 'none', color: 'var(--text-primary)', padding: '8px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: weergave === 'maand' ? '700' : '400', fontFamily: 'inherit' }}
          >
            Maand
          </button>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        filters={filters}
        onChange={(nieuweFilters) => {
          setFilters(nieuweFilters);
          slaProfielOp({ agendaFilters: nieuweFilters });
        }}
        profiel={profiel}
      />

      {/* Maandnavigatie */}
      {weergave === 'maand' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
          <button onClick={vorigeMaand} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '20px', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}>{'<'}</button>
          <div style={{ fontWeight: '700', fontSize: 'var(--font-size-base)' }}>{MAANDEN_NL[maand]} {jaar}</div>
          <button onClick={volgendeMaand} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '20px', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}>{'>'}</button>
        </div>
      )}

      {/* Laadstatus */}
      {laden && (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Laden...</div>
      )}

      {/* Maandweergave */}
      {!laden && weergave === 'maand' && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '12px' }}>
          <MaandGrid
            jaar={jaar}
            maand={maand}
            items={itemsDezeManand}
            onDagKlik={(datum, dagItems) => setDagPopup({ datum, items: dagItems })}
          />
        </div>
      )}

      {/* Lijstweergave */}
      {!laden && weergave === 'lijst' && (
        <div>
          {groepenPerMaand.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              Geen items gevonden voor de geselecteerde filters.
            </div>
          )}
          {groepenPerMaand.map(groep => (
            <div key={groep.label} style={{ marginBottom: '24px' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', paddingLeft: '4px' }}>
                {groep.label}
              </div>
              {groep.items.map(item => (
                <AgendaItem key={`${item.bron}-${item.id}`} item={item} onClick={handleItemKlik} />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Dag popup */}
      {dagPopup && (
        <DagPopup
          datum={dagPopup.datum}
          items={dagPopup.items}
          onSluit={() => setDagPopup(null)}
          onItemKlik={handleItemKlik}
        />
      )}
    </div>
  );
}
