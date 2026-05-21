// Voorbeeld B: Bento Grid — modulaire tegels van ongelijke grootte
// Rij 1: week-strip (volle breedte)
// Rij 2: 3 tegels (eerstvolgende | snelkoppelingen | berichten)
import React from 'react';
import VolgendActiviteit from './VolgendActiviteit';
import Snelkoppelingen from './Snelkoppelingen';
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
  beschikbarePaginas,
  favorieten,
  onWijzigFavorieten,
  onItemKlik,
  onBerichtKlik,
  isAgendaZichtbaar,
  isCommunicatieZichtbaar,
  isDesktop,
}) {
  const bentoStyle = isDesktop
    ? { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }
    : { display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' };

  return (
    <>
      {/* Week-strip — volle breedte */}
      {isAgendaZichtbaar && (
        <WidgetCard titel="Deze week" style={{ marginBottom: 'var(--space-4)' }}>
          <WeekStrip profiel={profiel} onItemKlik={onItemKlik} />
        </WidgetCard>
      )}

      {/* Onderrij: 3 tegels naast elkaar op desktop */}
      <div style={bentoStyle}>
        {isAgendaZichtbaar && (
          <WidgetCard titel="Eerstvolgende">
            <VolgendActiviteit profiel={profiel} onItemKlik={onItemKlik} />
          </WidgetCard>
        )}
        <WidgetCard titel="Snelkoppelingen">
          <Snelkoppelingen
            beschikbarePaginas={beschikbarePaginas}
            favorieten={favorieten}
            onWijzig={onWijzigFavorieten}
            variant="compact"
          />
        </WidgetCard>
        {isCommunicatieZichtbaar && (
          <WidgetCard titel="Clubberichten">
            <Berichten onBerichtKlik={onBerichtKlik} />
          </WidgetCard>
        )}
      </div>
    </>
  );
}
