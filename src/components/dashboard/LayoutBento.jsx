// Voorbeeld B: Bento Grid — modulaire tegels van ongelijke grootte
// Rij 1: week-strip (volle breedte)
// Rij 2: tegels (eerstvolgende activiteiten | clubberichten)
import React from 'react';
import EerstvolgendeActiviteiten from './EerstvolgendeActiviteiten';
import Berichten from './Berichten';
import WeekStrip from './WeekStrip';

function WidgetCard({ titel, children, style }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: 'var(--space-4)', ...style }}>
      {titel && (
        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {titel}
        </div>
      )}
      {children}
    </div>
  );
}

export default function LayoutBento({
  profiel,
  onItemKlik,
  onBerichtKlik,
  gelezen,
  onMarkeerGelezen,
  onBerichtenUnread,
  isAgendaZichtbaar,
  isCommunicatieZichtbaar,
  isDesktop,
}) {
  const kolommen = isCommunicatieZichtbaar ? 2 : 1;
  const bentoStyle = isDesktop
    ? { display: 'grid', gridTemplateColumns: `repeat(${kolommen}, 1fr)`, gap: 'var(--space-4)' }
    : { display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' };

  return (
    <>
      {/* Week-strip — volle breedte */}
      {isAgendaZichtbaar && (
        <WidgetCard titel="Deze week" style={{ marginBottom: 'var(--space-4)' }}>
          <WeekStrip profiel={profiel} onItemKlik={onItemKlik} />
        </WidgetCard>
      )}

      {/* Onderrij: eerstvolgende activiteiten + clubberichten */}
      <div style={bentoStyle}>
        <WidgetCard titel="Eerstvolgende activiteiten">
          <EerstvolgendeActiviteiten profiel={profiel} onItemKlik={onItemKlik} />
        </WidgetCard>
        {isCommunicatieZichtbaar && (
          <WidgetCard titel="Clubberichten">
            <Berichten
              onBerichtKlik={onBerichtKlik}
              gelezen={gelezen}
              onMarkeerGelezen={onMarkeerGelezen}
              onUnreadChange={onBerichtenUnread}
            />
          </WidgetCard>
        )}
      </div>
    </>
  );
}
