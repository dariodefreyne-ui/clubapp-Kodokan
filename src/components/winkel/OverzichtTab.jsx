import React, { useState } from 'react';
import { fmtBedrag } from './winkelData';

export default function OverzichtTab({ allSales }) {
  const [filter, setFilter] = useState('alle');

  const filtered = allSales.filter(s => {
    if (filter === 'open')           return !s.betaald;
    if (filter === 'betaald')        return s.betaald;
    if (filter === 'cash')           return s.betaalmethode === 'cash';
    if (filter === 'overschrijving') return s.betaalmethode === 'overschrijving';
    return true;
  });

  const totaalOpen    = allSales.filter(s => !s.betaald).reduce((sum, s) => sum + (s.totaal || 0), 0);
  const totaalBetaald = allSales.filter(s => s.betaald).reduce((sum, s)  => sum + (s.totaal || 0), 0);

  function datumLabel(s) {
    const ts = s.aangemaaktOp || s.createdAt;
    return ts?.toDate ? ts.toDate().toLocaleDateString('nl-BE') : '-';
  }

  return (
    <div>
      {/* Samenvatting */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'16px' }}>
        <div style={{ background:'rgba(192,57,43,0.15)', border:'1px solid #c0392b', borderRadius:'12px', padding:'12px' }}>
          <div style={{ fontSize:'20px', fontWeight:'800', color:'#c0392b' }}>{fmtBedrag(totaalOpen)}</div>
          <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>Openstaand</div>
        </div>
        <div style={{ background:'rgba(39,174,96,0.1)', border:'1px solid #27ae60', borderRadius:'12px', padding:'12px' }}>
          <div style={{ fontSize:'20px', fontWeight:'800', color:'#27ae60' }}>{fmtBedrag(totaalBetaald)}</div>
          <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>Betaald</div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:'6px', overflowX:'auto', paddingBottom:'12px', marginBottom:'16px', WebkitOverflowScrolling:'touch' }}>
        {[
          ['alle',           'Alle'],
          ['open',           'Openstaand'],
          ['betaald',        'Betaald'],
          ['cash',           '💵 Cash'],
          ['overschrijving', '🏦 Overschrijving'],
        ].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} style={{
            flexShrink:0, background: filter === v ? '#c0392b' : '#2d2d2d',
            border:'none', color:'#fff', padding:'7px 14px', borderRadius:'20px',
            cursor:'pointer', fontSize:'13px', fontWeight: filter === v ? '600' : '400',
          }}>{l}</button>
        ))}
      </div>

      {/* Verkopenlijst */}
      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {filtered.map(s => {
          const isCash    = s.betaalmethode === 'cash';
          const isBetaald = s.betaald;
          return (
            <div key={s.id} style={{
              background:   '#2d2d2d',
              borderRadius: '12px',
              padding:      '14px 16px',
              border:       '1.5px solid ' + (isBetaald ? '#2a2a2a' : '#c0392b'),
              display:      'flex',
              gap:          '12px',
              alignItems:   'flex-start',
            }}>
              {/* Statusbalk links */}
              <div style={{ width:'4px', borderRadius:'2px', alignSelf:'stretch', background: isBetaald ? '#27ae60' : '#c0392b', flexShrink:0 }} />

              <div style={{ flex:1, minWidth:0 }}>
                {/* Naam + datum */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'4px' }}>
                  <div style={{ fontWeight:'700', fontSize:'14px' }}>{s.koperNaam || '-'}</div>
                  <div style={{ fontSize:'11px', color:'#777', flexShrink:0, marginLeft:'8px' }}>{datumLabel(s)}</div>
                </div>

                {/* Items */}
                <div style={{ fontSize:'12px', color:'#888', marginBottom:'8px' }}>
                  {(s.items || []).map(i => i.naam + ' ' + i.variant + ' x' + i.qty).join(' \xb7 ')}
                </div>

                {/* Badges */}
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', alignItems:'center' }}>
                  <span style={{
                    background:   isCash ? 'rgba(39,174,96,0.15)' : 'rgba(52,152,219,0.15)',
                    border:       '1px solid ' + (isCash ? '#27ae60' : '#3498db'),
                    color:        isCash ? '#27ae60' : '#3498db',
                    borderRadius: '6px', padding:'2px 8px', fontSize:'11px', fontWeight:'700',
                  }}>
                    {isCash ? '💵 Cash' : '🏦 Overschrijving'}
                  </span>
                  <span style={{
                    background:   isBetaald ? 'rgba(39,174,96,0.15)' : 'rgba(192,57,43,0.15)',
                    border:       '1px solid ' + (isBetaald ? '#27ae60' : '#c0392b'),
                    color:        isBetaald ? '#27ae60' : '#c0392b',
                    borderRadius: '6px', padding:'2px 8px', fontSize:'11px', fontWeight:'700',
                  }}>
                    {isBetaald ? '✓ Betaald' : 'Openstaand'}
                  </span>
                </div>
              </div>

              {/* Bedrag */}
              <div style={{ fontWeight:'800', fontSize:'17px', color: isBetaald ? '#666' : '#c0392b', flexShrink:0 }}>
                {fmtBedrag(s.totaal || 0)}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div style={{ color:'#555', textAlign:'center', padding:'40px', fontSize:'14px' }}>
            Geen resultaten
          </div>
        )}
      </div>
    </div>
  );
}
