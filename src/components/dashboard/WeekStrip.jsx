// Horizontale week-strip (Ma–Zo) met activiteiten per dag — voor het Bento-dashboard
// Klik op een activiteit opent het detail-panel via onItemKlik.
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAgendaItems from '../../hooks/useAgendaItems';
import { vandaagISO } from '../trainingen/seizoenHelpers';
import { DAGEN_KORT, typeKleur, typeEmoji } from '../agenda/agendaConstants';

function maandagVanWeek(d) {
  const x = new Date(d);
  const dag = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dag);
  return x;
}

function isoVan(date) {
  return date.toISOString().slice(0, 10);
}

export default function WeekStrip({ profiel, onItemKlik }) {
  const navigate = useNavigate();
  const [offset, setOffset] = useState(0); // weken vooruit/achteruit t.o.v. huidige week

  const startVanWeek = useMemo(() => {
    const d = maandagVanWeek(new Date());
    d.setDate(d.getDate() + offset * 7);
    return d;
  }, [offset]);

  const eindVanWeek = useMemo(() => {
    const d = new Date(startVanWeek);
    d.setDate(d.getDate() + 6);
    return d;
  }, [startVanWeek]);

  const filters = profiel?.agendaFilters || {
    toonTrainingen: true, toonWedstrijden: true,
    toonExamens: true, toonEvenementen: true, enkelMijnGroepen: false,
  };

  const { items, laden } = useAgendaItems({
    profiel,
    filters,
    alleenVanaf: isoVan(startVanWeek),
    alleenTot: isoVan(eindVanWeek),
  });

  const itemsPerDag = useMemo(() => {
    const map = {};
    items.forEach(item => {
      if (!map[item.datum]) map[item.datum] = [];
      map[item.datum].push(item);
    });
    return map;
  }, [items]);

  const dagen = useMemo(() => {
    const lijst = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startVanWeek);
      d.setDate(d.getDate() + i);
      lijst.push({ date: d, iso: isoVan(d) });
    }
    return lijst;
  }, [startVanWeek]);

  const vandaag = vandaagISO();

  const handleKlik = (item) => {
    if (!onItemKlik) return;
    if (item.bron === 'trainingen')                                onItemKlik({ type: 'training', id: item.id });
    else if (item.bron === 'events' && item.type === 'wedstrijd')  onItemKlik({ type: 'wedstrijd', id: item.id });
    else if (item.bron === 'events' && item.type === 'examen')     onItemKlik({ type: 'examen', id: item.id });
    else if (item.bron === 'evenementen')                          onItemKlik({ type: 'evenement', id: item.id });
  };

  const weekLabel = `${startVanWeek.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })} – ${eindVanWeek.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <button onClick={() => setOffset(o => o - 1)} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>{'<'}</button>
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--text-secondary)' }}>
          {offset === 0 ? 'Deze week' : offset === 1 ? 'Volgende week' : offset === -1 ? 'Vorige week' : weekLabel}
          <span style={{ marginLeft: '8px', color: 'var(--text-muted)', fontWeight: '400' }}>{weekLabel}</span>
        </div>
        <button onClick={() => setOffset(o => o + 1)} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '32px', height: '32px', borderRadius: '8px', cursor: 'pointer', fontFamily: 'inherit' }}>{'>'}</button>
      </div>

      {laden ? (
        <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Laden...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
          {dagen.map((d, i) => {
            const dagItems = itemsPerDag[d.iso] || [];
            const isVandaag = d.iso === vandaag;
            return (
              <div key={d.iso}
                style={{
                  background: 'var(--bg-primary)',
                  border: isVandaag ? '1px solid var(--accent-red)' : '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  padding: '8px 6px',
                  minHeight: '120px',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                <div style={{ textAlign: 'center', marginBottom: '6px' }}>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: isVandaag ? 'var(--accent-red)' : 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>
                    {DAGEN_KORT[i]}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-md)', fontWeight: isVandaag ? '800' : '600', color: isVandaag ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                    {d.date.getDate()}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                  {dagItems.slice(0, 3).map(item => {
                    const kleur = typeKleur(item.type);
                    return (
                      <button
                        key={`${item.bron}-${item.id}`}
                        onClick={() => handleKlik(item)}
                        title={item.titel}
                        style={{
                          background: `${kleur}22`,
                          border: 'none',
                          borderLeft: `3px solid ${kleur}`,
                          color: 'var(--text-primary)',
                          padding: '4px 6px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '11px',
                          textAlign: 'left',
                          fontFamily: 'inherit',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          opacity: item.isGeenTraining ? 0.5 : 1,
                          textDecoration: item.isGeenTraining ? 'line-through' : 'none',
                        }}
                      >
                        {typeEmoji(item.type)} {item.titel}
                      </button>
                    );
                  })}
                  {dagItems.length > 3 && (
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center' }}>
                      +{dagItems.length - 3} meer
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={() => navigate('/agenda')}
        style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: 'var(--space-2)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontFamily: 'inherit', marginTop: '10px', width: '100%' }}
      >
        Naar volledige agenda
      </button>
    </div>
  );
}
