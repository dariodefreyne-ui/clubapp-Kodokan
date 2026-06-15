// Lijst van eerstvolgende activiteiten (default 5 stuks)
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { vandaagISO } from '../trainingen/seizoenHelpers';
import useAgendaItems from '../../hooks/useAgendaItems';
import { typeKleur, typeLabel, typeEmoji } from '../agenda/agendaConstants';

function formatDagHeader(isoDate) {
  const d = new Date(isoDate + 'T00:00:00');
  const vandaag = vandaagISO();
  const morgen = new Date(vandaag + 'T00:00:00');
  morgen.setDate(morgen.getDate() + 1);
  const morgenStr = morgen.toISOString().slice(0, 10);
  if (isoDate === vandaag) return 'Vandaag';
  if (isoDate === morgenStr) return 'Morgen';
  return d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'short' });
}

export default function KomendeActiviteiten({ profiel, onItemKlik, maxItems = 5 }) {
  const navigate = useNavigate();
  const [actiefId, setActiefId] = useState(null);
  const filters = profiel?.agendaFilters || {
    toonTrainingen: true, toonWedstrijden: true,
    toonExamens: true, toonEvenementen: true, enkelMijnGroepen: false,
  };

  const { items, laden } = useAgendaItems({ profiel, filters, alleenVanaf: vandaagISO() });
  const lijst = items.slice(0, maxItems);

  const handleKlik = (item) => {
    setActiefId(item.id);
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

  // Groepeer per dag
  const perDag = [];
  lijst.forEach(item => {
    const last = perDag[perDag.length - 1];
    if (last && last.datum === item.datum) { last.items.push(item); }
    else { perDag.push({ datum: item.datum, items: [item] }); }
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {perDag.map(({ datum, items: dagItems }, dagIdx) => (
        <div key={datum}>
          {/* Dag-scheidingslijn */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            margin: dagIdx === 0 ? '0 0 6px' : '10px 0 6px',
          }}>
            <span style={{
              fontSize: '10px', fontWeight: '800', color: datum === vandaagISO() ? 'var(--accent-red)' : 'var(--text-secondary)',
              textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap',
            }}>
              {formatDagHeader(datum)}
            </span>
            <div style={{ flex: 1, height: '1px', background: datum === vandaagISO() ? 'rgba(230,51,70,0.25)' : 'var(--border-color)' }} />
          </div>

          {dagItems.map(item => {
            const kleur = typeKleur(item.type);
            const geselecteerd = item.id === actiefId;
            return (
              <button
                key={`${item.bron}-${item.id}`}
                onClick={() => handleKlik(item)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '7px 8px',
                  marginBottom: '2px',
                  background: geselecteerd ? `${kleur}18` : 'transparent',
                  border: geselecteerd ? `1px solid ${kleur}` : '1px solid transparent',
                  borderLeft: `3px solid ${geselecteerd ? kleur : 'var(--border-color)'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  opacity: item.isGeenTraining ? 0.6 : 1,
                  transition: 'background 0.15s, border-color 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onMouseEnter={e => { if (!geselecteerd) e.currentTarget.style.background = 'var(--bg-card)'; }}
                onMouseLeave={e => { if (!geselecteerd) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ fontSize: '16px', width: '24px', textAlign: 'center', flexShrink: 0 }}>
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
                  {item.startTijd && (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                      {item.startTijd}{item.eindTijd ? ` – ${item.eindTijd}` : ''}
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: kleur, background: `${kleur}22`, padding: '2px 7px', borderRadius: '10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {typeLabel(item.type)}
                </div>
              </button>
            );
          })}
        </div>
      ))}
      <button
        onClick={() => navigate('/agenda')}
        style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontFamily: 'inherit', marginTop: '10px' }}
      >
        Volledige agenda →
      </button>
    </div>
  );
}
