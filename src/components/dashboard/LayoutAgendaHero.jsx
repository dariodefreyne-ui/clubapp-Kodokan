// Voorbeeld A: Agenda Hero — Maandkalender groot links, eerstvolgende + komende rechts.
// Responsive: 2-koloms op desktop (>=1024px), gestapeld op mobiel.
import React from 'react';
import EerstvolgendeActiviteiten from './EerstvolgendeActiviteiten';
import KomendeActiviteiten from './KomendeActiviteiten';
import Berichten from './Berichten';
import DashboardMaandKalender from './DashboardMaandKalender';

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

export default function LayoutAgendaHero({
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
  const heroGridStyle = isDesktop
    ? { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }
    : { display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' };

  return (
    <>
      {/* Hoofdrij: kalender (groot) + zijbalk (eerstvolgende + komende) */}
      <div style={heroGridStyle}>
        {isAgendaZichtbaar && (
          <WidgetCard titel="Agenda">
            <DashboardMaandKalender profiel={profiel} onItemKlik={onItemKlik} />
          </WidgetCard>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <WidgetCard titel="Eerstvolgende activiteiten">
            <EerstvolgendeActiviteiten profiel={profiel} onItemKlik={onItemKlik} />
          </WidgetCard>
          {isAgendaZichtbaar && (
            <WidgetCard titel="Komende activiteiten">
              <KomendeActiviteiten profiel={profiel} onItemKlik={onItemKlik} />
            </WidgetCard>
          )}
        </div>
      </div>

      {/* Onderrij: clubberichten */}
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
    </>
  );
}
