import React from 'react';
import { beheerBoom } from './productFacets';

// Inklapbare boomstructuur voor productbeheer:
// categorie → Nieuw/2e-hands → subrubriek (pak/broek/vest, Heren/Dames/...).
// Standaard alles ingeklapt (native <details> zonder `open`).

const wrap = { marginBottom: '8px', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-card)' };

function summaryStyle(level) {
  return {
    cursor: 'pointer', padding: '10px 12px', userSelect: 'none',
    fontWeight: level === 0 ? '800' : '700',
    fontSize: level === 0 ? '15px' : '14px',
    color: 'var(--text-primary)',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
  };
}

const telStyle = {
  background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '10px',
  padding: '1px 8px', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600',
};

// `toonStock`: badges tonen totale voorraad i.p.v. aantal productvarianten.
// Nodig in StockTab, waar "12" anders het aantal maten zou tonen i.p.v. de
// werkelijke stock (waardoor pak/broek/vest hetzelfde getal lijken te delen).
export default function ProductBoom({ producten, renderItem, toonStock = false }) {
  const boom = beheerBoom(producten);
  if (boom.length === 0) {
    return <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '30px', fontSize: 'var(--font-size-md)' }}>Geen producten</div>;
  }
  const badge = (aantal, stockAantal) => toonStock ? `${stockAantal} op stock` : aantal;
  return (
    <div>
      {boom.map(cat => (
        <details key={cat.category} style={wrap}>
          <summary style={summaryStyle(0)}><span>{cat.label}</span><span style={telStyle}>{badge(cat.aantal, cat.stockAantal)}</span></summary>
          <div style={{ padding: '0 8px 8px' }}>
            {cat.staten.map(staat => (
              <details key={staat.key} style={{ ...wrap, marginTop: '8px' }}>
                <summary style={summaryStyle(1)}><span>{staat.label}</span><span style={telStyle}>{badge(staat.items.length, staat.stockAantal)}</span></summary>
                <div style={{ padding: '0 8px 8px' }}>
                  {staat.subs.map(sub => sub.label ? (
                    <details key={sub.key} style={{ ...wrap, marginTop: '8px' }}>
                      <summary style={summaryStyle(2)}><span>{sub.label}</span><span style={telStyle}>{badge(sub.items.length, sub.stockAantal)}</span></summary>
                      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>{sub.items.map(renderItem)}</div>
                    </details>
                  ) : (
                    <div key={sub.key} style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>{sub.items.map(renderItem)}</div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}
