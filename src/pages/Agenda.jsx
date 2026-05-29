// src/pages/Agenda.jsx
// Gecombineerde clubagenda: trainingen + wedstrijden + examens + evenementen
// Maand- en lijstweergave, filters lokaal (worden in stap 2 naar profiel verplaatst)

import React, { useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useLesgevers } from '../contexts/LesgeversContext.jsx';
import { vandaagISO } from '../components/trainingen/seizoenHelpers';
import useAgendaItems from '../hooks/useAgendaItems';
import MaandGrid from '../components/agenda/MaandGrid';
import { TYPE_KLEUREN, TYPE_LABELS, MAANDEN_NL, typeKleur } from '../components/agenda/agendaConstants';
import { TRAINING_STATUS, STATUS_LABELS, STATUS_EMOJI } from '../components/trainingen/trainingStatus';
import TrainingDetailPanel from '../components/details/TrainingDetailPanel';
import WedstrijdDetailPanel from '../components/details/WedstrijdDetailPanel';
import ExamenDetailPanel from '../components/details/ExamenDetailPanel';
import EvenementDetailPanel from '../components/details/EvenementDetailPanel';

function formatDatumLang(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ─── AgendaItem component ───────────────────────────────────────────────────────
function AgendaItem({ item, onClick, alleLesgevers, isLid, onGroepKlik }) {
  const kleur = typeKleur(item.type);
  const vandaag = vandaagISO();
  const isVandaag = item.datum === vandaag;
  const isVoorbij = item.datum < vandaag;
  const isTraining = item.type === 'training';

  const lesgeversNamen = useMemo(() => {
    if (!isTraining) return [];
    const ids = item.extra?.lesgevers || [];
    return ids.map(id => (alleLesgevers || []).find(l => l.id === id)?.naam || id);
  }, [item, alleLesgevers, isTraining]);

  const uur = item.startTijd
    ? item.eindTijd ? `${item.startTijd} – ${item.eindTijd}` : item.startTijd
    : null;

  const status = isTraining ? (item.status || TRAINING_STATUS.NORMAAL) : TRAINING_STATUS.NORMAAL;
  const isGeannuleerd  = status === TRAINING_STATUS.GEANNULEERD;
  const isGeen         = status === TRAINING_STATUS.GEEN;
  const isSamengevoegd = status === TRAINING_STATUS.SAMENGEVOEGD;
  const doorstreept    = isGeannuleerd || isGeen;

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
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '700', color: 'var(--warning)', background: 'rgba(243,156,18,0.15)', padding: '2px 6px', borderRadius: '6px' }}>
              Vandaag
            </span>
          )}
          {isTraining && isGeannuleerd && (
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '700', color: 'var(--danger)', background: 'rgba(230,57,70,0.15)', padding: '2px 6px', borderRadius: '6px' }}>
              {STATUS_EMOJI.geannuleerd} {STATUS_LABELS.geannuleerd}
            </span>
          )}
          {isTraining && isGeen && (
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '600', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '6px' }}>
              {STATUS_EMOJI.geen} {STATUS_LABELS.geen}
            </span>
          )}
          {isTraining && isSamengevoegd && (
            <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: '700', color: TYPE_KLEUREN.evenement, background: `${TYPE_KLEUREN.evenement}22`, padding: '2px 6px', borderRadius: '6px' }}>
              {STATUS_EMOJI.samengevoegd} Samen met {item.samengevoegdMetNaam || 'andere groep'}
            </span>
          )}
        </div>
        {isTraining ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {!isLid && onGroepKlik ? (
              <span
                onClick={(e) => { e.stopPropagation(); onGroepKlik(item); }}
                style={{
                  fontSize: 'var(--font-size-md)', fontWeight: '600',
                  color: 'var(--accent-red)', textDecoration: 'underline',
                  cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}
              >
                {item.titel}
              </span>
            ) : (
              <span style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', color: isVoorbij || doorstreept ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: doorstreept ? 'line-through' : 'none' }}>
                {item.titel}
              </span>
            )}
            {uur && !doorstreept && (
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {uur}
              </span>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '600', color: isVoorbij ? 'var(--text-secondary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {item.titel}
          </div>
        )}
        {isTraining && isSamengevoegd && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: TYPE_KLEUREN.evenement, marginTop: '2px', fontWeight: '600' }}>
            Sluit aan bij {item.samengevoegdMetNaam || 'een andere groep'}{uur ? ` · ${uur}` : ''}
          </div>
        )}
        {isTraining && isGeen && item.opmerking && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '2px', textDecoration: 'line-through' }}>
            {item.opmerking}
          </div>
        )}
        {isTraining && !doorstreept && lesgeversNamen.length > 0 && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {lesgeversNamen.join(' · ')}
          </div>
        )}
        {!isTraining && item.extra?.locatie && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {item.extra.locatie}
          </div>
        )}
        {!isTraining && item.extra?.doelgroep && (
          <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
            {item.extra.doelgroep}
          </div>
        )}
      </div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-base)', flexShrink: 0 }}>{'>'}</div>
    </button>
  );
}

// ─── DagPopup component ─────────────────────────────────────────────────────────
function DagPopup({ datum, items, onSluit, onItemKlik, alleLesgevers, isLid, onGroepKlik }) {
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
          <AgendaItem key={item.id} item={item} onClick={(i) => { onSluit(); onItemKlik(i); }} alleLesgevers={alleLesgevers} isLid={isLid} onGroepKlik={(i) => { onSluit(); onGroepKlik(i); }} />
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
            background:  filters.enkelMijnGroepen ? 'rgba(192,57,43,0.15)' : 'var(--bg-primary)',
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
  const { lesgevers: alleLesgevers } = useLesgevers();
  const isLid = profiel?.rol === 'lid';

  const handleGroepKlik = (item) => {
    setActiefDetail({ type: 'training', id: item.id });
  };

  const vandaag = new Date();
  const [weergave, setWeergave] = useState('maand');
  const [maand, setMaand]       = useState(vandaag.getMonth());
  const [jaar, setJaar]         = useState(vandaag.getFullYear());
  const [filters, setFilters] = useState(() => {
    const opgeslagen = profiel?.agendaFilters;
    if (!opgeslagen) return STANDAARD_FILTERS;
    return { ...STANDAARD_FILTERS, ...opgeslagen };
  });
  const [dagPopup, setDagPopup] = useState(null);
  const [actiefDetail, setActiefDetail] = useState(null);
  const [toonVerleden, setToonVerleden] = useState(false);

  const { items, laden } = useAgendaItems({ filters, profiel });

  const itemsDezeManand = useMemo(() => {
    const prefix = `${jaar}-${String(maand + 1).padStart(2, '0')}`;
    return items.filter(i => i.datum.startsWith(prefix));
  }, [items, jaar, maand]);

  const lijstItems = useMemo(() => {
    const vensterStart = new Date(jaar, maand, 1);
    const vensterEinde = new Date(jaar, maand + 3, 0); // einde van maand+2
    const startStr = vensterStart.toISOString().slice(0, 10);
    const eindeStr = vensterEinde.toISOString().slice(0, 10);
    const vandaagStr = vandaagISO();
    const effectiefStart = (!toonVerleden && vandaagStr > startStr) ? vandaagStr : startStr;
    return items.filter(i => i.datum >= effectiefStart && i.datum <= eindeStr);
  }, [items, jaar, maand, toonVerleden]);

  const handleItemKlik = (item) => {
    if (item.bron === 'trainingen')                                setActiefDetail({ type: 'training', id: item.id });
    else if (item.bron === 'events' && item.type === 'wedstrijd') setActiefDetail({ type: 'wedstrijd', id: item.id });
    else if (item.bron === 'events' && item.type === 'examen')    setActiefDetail({ type: 'examen', id: item.id });
    else if (item.bron === 'evenementen')                         setActiefDetail({ type: 'evenement', id: item.id });
  };

  const vorigeMaand = () => {
    if (maand === 0) { setMaand(11); setJaar(j => j - 1); }
    else setMaand(m => m - 1);
  };
  const volgendeMaand = () => {
    if (maand === 11) { setMaand(0); setJaar(j => j + 1); }
    else setMaand(m => m + 1);
  };
  const naarVandaag = () => { setMaand(vandaag.getMonth()); setJaar(vandaag.getFullYear()); };

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)', padding: '10px 14px' }}>
        <button onClick={vorigeMaand} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '20px', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}>{'<'}</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ fontWeight: '700', fontSize: 'var(--font-size-base)' }}>{MAANDEN_NL[maand]} {jaar}</div>
          {(maand !== vandaag.getMonth() || jaar !== vandaag.getFullYear()) && (
            <button
              onClick={naarVandaag}
              style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '3px 10px', borderRadius: '12px', cursor: 'pointer', fontSize: '11px', fontWeight: '600', fontFamily: 'inherit' }}
            >
              Vandaag
            </button>
          )}
        </div>
        <button onClick={volgendeMaand} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '20px', cursor: 'pointer', padding: '4px 8px', fontFamily: 'inherit' }}>{'>'}</button>
      </div>

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
      {!laden && weergave === 'lijst' && (() => {
        const vensterStartIsVerleden = new Date(jaar, maand, 1) < vandaag;
        return (
          <div>
            {vensterStartIsVerleden && (
              <div style={{ marginBottom: '12px' }}>
                <button
                  onClick={() => setToonVerleden(v => !v)}
                  style={{
                    background: toonVerleden ? 'rgba(148,163,184,0.12)' : 'var(--bg-primary)',
                    border: `1px solid ${toonVerleden ? 'var(--text-secondary)' : 'var(--border-color)'}`,
                    color: toonVerleden ? 'var(--text-primary)' : 'var(--text-secondary)',
                    padding: '6px 14px', borderRadius: '16px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: toonVerleden ? '700' : '400',
                    whiteSpace: 'nowrap', fontFamily: 'inherit',
                  }}
                >
                  {toonVerleden ? '↑ Voorbije activiteiten verbergen' : '↓ Toon voorbije activiteiten'}
                </button>
              </div>
            )}
            {groepenPerMaand.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
                Geen activiteiten gevonden{!toonVerleden && vensterStartIsVerleden ? ' — gebruik de toggle om voorbije te tonen' : ''}.
              </div>
            )}
            {groepenPerMaand.map(groep => (
              <div key={groep.label} style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', paddingLeft: '4px' }}>
                  {groep.label}
                </div>
                {groep.items.map(item => (
                  <AgendaItem key={`${item.bron}-${item.id}`} item={item} onClick={handleItemKlik} alleLesgevers={alleLesgevers} isLid={isLid} onGroepKlik={handleGroepKlik} />
                ))}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Dag popup */}
      {dagPopup && (
        <DagPopup
          datum={dagPopup.datum}
          items={dagPopup.items}
          onSluit={() => setDagPopup(null)}
          onItemKlik={handleItemKlik}
          alleLesgevers={alleLesgevers}
          isLid={isLid}
          onGroepKlik={handleGroepKlik}
        />
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
    </div>
  );
}
