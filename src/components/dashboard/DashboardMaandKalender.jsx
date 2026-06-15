// Dashboard-versie van de MaandGrid: inclusief maand-navigatie en dag-popup.
// Hergebruikt de MaandGrid-component uit components/agenda/.
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MaandGrid from '../agenda/MaandGrid';
import { MAANDEN_NL, typeKleur, typeLabel, typeEmoji } from '../agenda/agendaConstants';
import useAgendaItems from '../../hooks/useAgendaItems';
import { vandaagISO } from '../trainingen/seizoenHelpers';

function DagPopup({ datum, items, onSluit, onItemKlik }) {
  if (!datum) return null;
  const d = new Date(datum + 'T00:00:00');
  const langDatum = d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px' }}
      onClick={onSluit}
      onKeyDown={e => e.key === 'Escape' && onSluit()}
    >
      <div
        style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)', padding: 'var(--space-5)', width: '100%', maxWidth: '500px', maxHeight: '70vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-popup-titel"
      >
        <div id="dashboard-popup-titel" style={{ fontSize: 'var(--font-size-md)', fontWeight: '700', marginBottom: '14px', color: 'var(--text-secondary)' }}>
          {langDatum}
        </div>
        {items.map(item => {
          const kleur = typeKleur(item.type);
          return (
            <button
              key={`${item.bron}-${item.id}`}
              onClick={() => { onSluit(); onItemKlik(item); }}
              onMouseEnter={e => { e.currentTarget.style.background = `${kleur}15`; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-primary)'; }}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                background: 'var(--bg-primary)',
                border: `1px solid var(--border-color)`,
                borderLeft: `4px solid ${kleur}`,
                borderRadius: '10px', padding: '12px', marginBottom: '8px',
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', color: 'inherit',
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontSize: '20px' }}>{typeEmoji(item.type)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: kleur, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>
                  {typeLabel(item.type)}
                </div>
                <div style={{ fontSize: 'var(--font-size-md)', fontWeight: '600' }}>{item.titel}</div>
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>›</span>
            </button>
          );
        })}
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

export default function DashboardMaandKalender({ profiel, onItemKlik }) {
  const navigate = useNavigate();
  const vandaag = new Date();
  const [maand, setMaand] = useState(vandaag.getMonth());
  const [jaar, setJaar] = useState(vandaag.getFullYear());
  const [dagPopup, setDagPopup] = useState(null);

  const filters = profiel?.agendaFilters || {
    toonTrainingen: true, toonWedstrijden: true,
    toonExamens: true, toonEvenementen: true, enkelMijnGroepen: false,
  };

  const { items, laden } = useAgendaItems({ profiel, filters });

  const itemsDezeMaand = useMemo(() => {
    const prefix = `${jaar}-${String(maand + 1).padStart(2, '0')}`;
    return items.filter(i => i.datum.startsWith(prefix));
  }, [items, jaar, maand]);

  const vorigeMaand = () => {
    if (maand === 0) { setMaand(11); setJaar(j => j - 1); }
    else setMaand(m => m - 1);
  };
  const volgendeMaand = () => {
    if (maand === 11) { setMaand(0); setJaar(j => j + 1); }
    else setMaand(m => m + 1);
  };

  const handleItemKlik = (item) => {
    if (!onItemKlik) return;
    if (item.bron === 'trainingen')                                onItemKlik({ type: 'training', id: item.id });
    else if (item.bron === 'events' && item.type === 'wedstrijd')  onItemKlik({ type: 'wedstrijd', id: item.id });
    else if (item.bron === 'events' && item.type === 'examen')     onItemKlik({ type: 'examen', id: item.id });
    else if (item.bron === 'evenementen')                          onItemKlik({ type: 'evenement', id: item.id });
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button onClick={vorigeMaand} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit' }}>{'<'}</button>
        <div style={{ fontWeight: '700', fontSize: 'var(--font-size-md)' }}>{MAANDEN_NL[maand]} {jaar}</div>
        <button onClick={volgendeMaand} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontFamily: 'inherit' }}>{'>'}</button>
      </div>

      {laden ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Laden...</div>
      ) : (
        <MaandGrid
          jaar={jaar}
          maand={maand}
          items={itemsDezeMaand}
          onDagKlik={(datum, dagItems) => setDagPopup({ datum, items: dagItems })}
          geselecteerdeDag={dagPopup?.datum ?? null}
        />
      )}

      <button
        onClick={() => navigate('/agenda')}
        style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: 'var(--space-2) var(--space-3)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontFamily: 'inherit', marginTop: '12px', width: '100%' }}
      >
        Naar volledige agenda
      </button>

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
