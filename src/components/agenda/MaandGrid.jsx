// Maandkalender-grid — herbruikt door zowel Agenda-pagina als Dashboard mini-kalender
import React from 'react';
import { vandaagISO } from '../trainingen/seizoenHelpers';
import { DAGEN_KORT, typeKleur } from './agendaConstants';

export default function MaandGrid({ jaar, maand, items, onDagKlik, compact = false, geselecteerdeDag = null }) {
  const eerstedag = new Date(jaar, maand, 1);
  const startOffset = (eerstedag.getDay() + 6) % 7; // Maandag = 0
  const aantalDagen = new Date(jaar, maand + 1, 0).getDate();
  const vandaag = vandaagISO();

  const cellMinHeight = compact ? '34px' : '44px';
  const dagFontSize   = compact ? '12px' : '13px';
  const dotSize       = compact ? '5px' : '6px';
  const maxDots       = compact ? 2 : 3;

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
    const isGeselecteerd = iso === geselecteerdeDag;
    const isVerleden = iso < vandaag;

    cellen.push(
      <button
        key={iso}
        onClick={() => dagItems.length > 0 && onDagKlik && onDagKlik(iso, dagItems)}
        style={{
          background:    isGeselecteerd ? 'rgba(230,51,70,0.22)' : isVandaag ? 'rgba(192,57,43,0.12)' : 'transparent',
          border:        isGeselecteerd ? '2px solid var(--accent-red)' : isVandaag ? '1px solid var(--accent-red)' : '1px solid transparent',
          borderRadius:  '8px',
          padding:       '4px 2px',
          cursor:        dagItems.length > 0 ? 'pointer' : 'default',
          minHeight:     cellMinHeight,
          display:       'flex',
          flexDirection: 'column',
          alignItems:    'center',
          gap:           '2px',
          fontFamily:    'inherit',
          WebkitTapHighlightColor: 'transparent',
          transition:    'background 0.15s, border-color 0.15s',
        }}
      >
        <span style={{
          fontSize:   dagFontSize,
          fontWeight: isGeselecteerd || isVandaag ? '800' : '400',
          color:      isGeselecteerd ? 'var(--accent-red)' : isVandaag ? 'var(--accent-red)' : isVerleden ? 'var(--text-secondary)' : 'var(--text-primary)',
          lineHeight: '1.2',
        }}>
          {dag}
        </span>
        {dagItems.slice(0, maxDots).map((item, i) => (
          <span key={i} style={{
            width: dotSize, height: dotSize, borderRadius: '50%',
            background: typeKleur(item.type), flexShrink: 0,
          }} />
        ))}
        {dagItems.length > maxDots && (
          <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>+{dagItems.length - maxDots}</span>
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
