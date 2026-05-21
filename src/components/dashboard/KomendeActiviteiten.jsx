// Lijst van eerstvolgende activiteiten (default 5 stuks)
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { vandaagISO } from '../trainingen/seizoenHelpers';
import useAgendaItems from '../../hooks/useAgendaItems';
import { typeKleur, typeLabel, typeEmoji } from '../agenda/agendaConstants';

export default function KomendeActiviteiten({ profiel, onItemKlik, maxItems = 5 }) {
  const navigate = useNavigate();
  const filters = profiel?.agendaFilters || {
    toonTrainingen: true, toonWedstrijden: true,
    toonExamens: true, toonEvenementen: true, enkelMijnGroepen: false,
  };

  const { items, laden } = useAgendaItems({ profiel, filters, alleenVanaf: vandaagISO() });
  const lijst = items.slice(0, maxItems);

  const handleKlik = (item) => {
    if (!onItemKlik) return;
    if (item.bron === 'trainingen')                                onItemKlik({ type: 'training', id: item.id });
    else if (item.bron === 'events' && item.type === 'wedstrijd')  onItemKlik({ type: 'wedstrijd', id: item.id });
    else if (item.bron === 'events' && item.type === 'examen')     onItemKlik({ type: 'examen', id: item.id });
    else if (item.bron === 'evenementen')                          onItemKlik({ type: 'evenement', id: item.id });
  };

  if (laden) return <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Laden...</div>;
  if (!lijst.length) return (
    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-md)', textAlign: 'center', padding: 'var(--space-3) 0' }}>
      Geen komende activiteiten
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {lijst.map(item => (
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
            {item.isGeenTraining ? '🚫' : typeEmoji(item.type)}
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
            <div style={{
              fontSize: 'var(--font-size-xs)',
              color: typeKleur(item.type),
              fontWeight: '600',
            }}>
              {typeLabel(item.type)}
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
