// Eerstvolgende activiteit — toont één prominente kaart met de eerstvolgende activiteit
// Gebruikt de gedeelde useAgendaItems-hook ipv eigen Firestore-queries
import React, { useMemo } from 'react';
import { formatDatum, vandaagISO } from '../trainingen/seizoenHelpers';
import useAgendaItems from '../../hooks/useAgendaItems';
import { typeKleur, typeLabel, typeEmoji } from '../agenda/agendaConstants';

export default function VolgendActiviteit({ profiel, onItemKlik }) {
  const { items, laden } = useAgendaItems({ profiel, alleenVanaf: vandaagISO() });

  const item = useMemo(() => {
    if (!items.length) return null;
    return items.find(i => !i.isGeenTraining) || items[0];
  }, [items]);

  if (laden) {
    return <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Laden...</div>;
  }
  if (!item) {
    return (
      <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-md)', textAlign: 'center', padding: 'var(--space-4) 0' }}>
        Geen activiteiten gepland
      </div>
    );
  }

  const isVandaag = item.datum === vandaagISO();
  const kleur = typeKleur(item.type);
  const borderKleur = isVandaag ? 'var(--success)' : kleur;
  const labelKleur = isVandaag ? 'var(--success)' : kleur;

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
        {isVandaag ? `${typeEmoji(item.type)} Vandaag` : `${typeEmoji(item.type)} ${typeLabel(item.type)}`}
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
