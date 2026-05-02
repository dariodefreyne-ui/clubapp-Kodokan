import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNavigate } from 'react-router-dom';
import { fmtBedrag } from './winkelData';

// ─── SCHULDEN TAB ─────────────────────────────────────────────────────────────
// §4.6 — ontvangt openSales als prop van Winkel.jsx (parent-listener)
// Geen eigen Firestore onSnapshot — dubbele listener is verwijderd

export default function SchuldenTab({ openSales }) {
  const navigate       = useNavigate();
  const [expanded,     setExpanded]     = useState(new Set());
  const [confirmPayId, setConfirmPayId] = useState(null);

  // §4.6 — totaalSchuld: ondersteunt zowel totaal als total (legacy veldnaam)
  const totaalSchuld = openSales.reduce((s, x) => s + (x.totaal || x.total || 0), 0);

  // §4.6 — groepen: identieke group-by logica op koperNaam
  const groepen = Object.values(
    openSales.reduce((acc, s) => {
      const key = s.koperNaam || 'Onbekend';
      if (!acc[key]) acc[key] = { naam: key, koperId: s.koperId || null, sales: [] };
      acc[key].sales.push(s);
      return acc;
    }, {})
  );

  function toggleExpanded(naam) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(naam) ? next.delete(naam) : next.add(naam);
      return next;
    });
  }

  // §4.6 — markeerBetaald: updateDoc ongewijzigd
  async function markeerBetaald(id) {
    await updateDoc(doc(db, 'sales', id), { betaald: true });
    setConfirmPayId(null);
  }

  function datumLabel(s) {
    const ts = s.aangemaaktOp || s.createdAt;
    return ts?.toDate ? ts.toDate().toLocaleDateString('nl-BE') : '—';
  }

  return (
    <div>
      {openSales.length > 0 ? (
        <div style={{ background:'rgba(192,57,43,0.2)', border:'1px solid #c0392b', borderRadius:'10px', padding:'14px 16px', marginBottom:'20px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px' }}>
          <div style={{ fontWeight:'700', fontSize:'15px' }}>
            {openSales.length} openstaande schuld{openSales.length !== 1 ? 'en' : ''} &mdash; totaal {fmtBedrag(totaalSchuld)}
          </div>
        </div>
      ) : (
        <div style={{ background:'rgba(39,174,96,0.1)', border:'1px solid #27ae60', borderRadius:'10px', padding:'16px', marginBottom:'20px', textAlign:'center', color:'#27ae60', fontWeight:'700', fontSize:'16px' }}>
          Alles betaald! Geen openstaande schulden.
        </div>
      )}

      {groepen.map(groep => {
        const groepTotaal = groep.sales.reduce((s, x) => s + (x.totaal || x.total || 0), 0);
        const isExpanded  = expanded.has(groep.naam);
        return (
          <div key={groep.naam} style={{ background:'#2d2d2d', borderRadius:'10px', marginBottom:'10px', overflow:'hidden' }}>
            <div onClick={() => toggleExpanded(groep.naam)}
              style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 16px', cursor:'pointer' }}>
              <div>
                {/* §4.6 — navigate() voor klik op gekoppeld lid ongewijzigd */}
                {groep.koperId ? (
                  <span
                    onClick={e => { e.stopPropagation(); navigate(`/leden/${groep.koperId}`); }}
                    style={{ fontWeight:'700', fontSize:'15px', color:'#5dade2', textDecoration:'underline', cursor:'pointer' }}>
                    {groep.naam}
                  </span>
                ) : (
                  <span style={{ fontWeight:'700', fontSize:'15px' }}>{groep.naam}</span>
                )}
                <div style={{ fontSize:'12px', color:'#aaa', marginTop:'2px' }}>
                  {groep.sales.length} aankoop{groep.sales.length !== 1 ? 'en' : ''}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                <span style={{ fontWeight:'700', fontSize:'16px', color:'#c0392b' }}>{fmtBedrag(groepTotaal)}</span>
                <span style={{ color:'#666', fontSize:'14px' }}>{isExpanded ? '▲' : '▼'}</span>
              </div>
            </div>

            {isExpanded && (
              <div style={{ borderTop:'1px solid #3a3a3a' }}>
                {groep.sales.map(s => (
                  <div key={s.id} style={{ padding:'12px 16px', borderBottom:'1px solid #252525' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'6px' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:'12px', color:'#777' }}>{datumLabel(s)}</div>
                        <div style={{ fontSize:'13px', color:'#ccc', marginTop:'3px' }}>
                          {(s.items || []).map(i => `${i.name} ${i.variant} x${i.qty}`).join(', ')}
                        </div>
                      </div>
                      <div style={{ fontWeight:'700', fontSize:'15px', color:'#c0392b', marginLeft:'12px', flexShrink:0 }}>
                        {fmtBedrag(s.totaal || s.total || 0)}
                      </div>
                    </div>
                    {confirmPayId === s.id ? (
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'8px' }}>
                        <span style={{ fontSize:'13px', color:'#f39c12' }}>Zeker?</span>
                        <button onClick={() => markeerBetaald(s.id)}
                          style={{ background:'#27ae60', border:'none', color:'#fff', padding:'6px 12px', borderRadius:'6px', cursor:'pointer', fontSize:'13px', fontWeight:'600' }}>
                          Ja
                        </button>
                        <button onClick={() => setConfirmPayId(null)}
                          style={{ background:'#3a3a3a', border:'none', color:'#fff', padding:'6px 12px', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}>
                          Nee
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmPayId(s.id)}
                        style={{ marginTop:'8px', background:'none', border:'1px solid #3a3a3a', color:'#aaa', padding:'6px 12px', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>
                        Markeer als betaald
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
