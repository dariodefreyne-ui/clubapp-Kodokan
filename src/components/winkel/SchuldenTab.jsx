import React, { useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase';
import { fmtBedrag } from './winkelData';

export default function SchuldenTab({ openSales, profiel }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(new Set());
  const [confirmPayId, setConfirmPayId] = useState(null);
  const [payMethod, setPayMethod] = useState('overschrijving');

  const totaalSchuld = openSales.reduce((sum, sale) => sum + (sale.totaal || sale.total || 0), 0);

  const groepen = Object.values(openSales.reduce((acc, sale) => {
    const key = sale.koperNaam || 'Onbekend';
    if (!acc[key]) acc[key] = { naam: key, koperId: sale.koperId || null, sales: [] };
    acc[key].sales.push(sale);
    return acc;
  }, {}));

  function toggleExpanded(naam) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(naam) ? next.delete(naam) : next.add(naam);
      return next;
    });
  }

  async function markeerBetaald(id) {
    await updateDoc(doc(db, 'sales', id), {
      betaald: true,
      betaaldOp: serverTimestamp(),
      betaaldDoor: profiel?.uid || null,
      betaaldDoorNaam: profiel?.naam || profiel?.email || null,
      betaaldVia: payMethod,
    });
    setConfirmPayId(null);
    setPayMethod('overschrijving');
  }

  function datumLabel(sale) {
    const ts = sale.aangemaaktOp || sale.createdAt;
    return ts?.toDate ? ts.toDate().toLocaleDateString('nl-BE') : '-';
  }

  return (
    <div>
      {openSales.length > 0 ? (
        <div style={{ background: 'rgba(243,156,18,0.12)', border: '1px solid #f39c12', color: '#f39c12', borderRadius: '10px', padding: '12px', marginBottom: '16px', fontWeight: '700' }}>
          {openSales.length} openstaande schuld{openSales.length !== 1 ? 'en' : ''} - totaal {fmtBedrag(totaalSchuld)}
        </div>
      ) : (
        <div style={{ background: 'rgba(39,174,96,0.12)', border: '1px solid #27ae60', color: '#27ae60', borderRadius: '10px', padding: '12px', marginBottom: '16px', fontWeight: '700' }}>
          Alles betaald. Geen openstaande schulden.
        </div>
      )}

      {groepen.map(groep => {
        const groepTotaal = groep.sales.reduce((sum, sale) => sum + (sale.totaal || sale.total || 0), 0);
        const isExpanded = expanded.has(groep.naam);

        return (
          <div key={groep.naam} style={{ background: '#2d2d2d', border: '1px solid #3a3a3a', borderRadius: '12px', marginBottom: '10px', overflow: 'hidden' }}>
            <div onClick={() => toggleExpanded(groep.naam)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', cursor: 'pointer' }}>
              <div>
                {groep.koperId ? (
                  <span onClick={e => { e.stopPropagation(); navigate(`/leden/${groep.koperId}`); }} style={{ fontWeight: '700', fontSize: '15px', color: '#5dade2', textDecoration: 'underline', cursor: 'pointer' }}>
                    {groep.naam}
                  </span>
                ) : (
                  <span style={{ fontWeight: '700', fontSize: '15px' }}>{groep.naam}</span>
                )}
                <div style={{ color: '#aaa', fontSize: '12px', marginTop: '3px' }}>
                  {groep.sales.length} aankoop{groep.sales.length !== 1 ? 'en' : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: '800', fontSize: '18px' }}>{fmtBedrag(groepTotaal)}</div>
                <div style={{ color: '#aaa', fontSize: '12px' }}>{isExpanded ? '▲' : '▼'}</div>
              </div>
            </div>

            {isExpanded && (
              <div style={{ borderTop: '1px solid #3a3a3a', padding: '10px 16px' }}>
                {groep.sales.map(sale => (
                  <div key={sale.id} style={{ padding: '10px 0', borderBottom: '1px solid #3a3a3a' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                      <div>
                        <div style={{ color: '#aaa', fontSize: '12px' }}>{datumLabel(sale)} {sale.eventNaam ? '- ' + sale.eventNaam : ''} {sale.kassaNaam ? '- ' + sale.kassaNaam : ''}</div>
                        <div style={{ fontSize: '13px', marginTop: '4px' }}>
                          {(sale.items || []).map(item => `${item.naam || item.name || '-'} ${item.variant || ''} x${item.qty || 0}`).join(', ')}
                        </div>
                      </div>
                      <div style={{ fontWeight: '800' }}>{fmtBedrag(sale.totaal || sale.total || 0)}</div>
                    </div>

                    {confirmPayId === sale.id ? (
                      <div style={{ marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <select value={payMethod} onChange={e => setPayMethod(e.target.value)} style={{ background: '#1a1a1a', border: '1px solid #3a3a3a', color: '#fff', borderRadius: '6px', padding: '6px 8px', fontSize: '13px' }}>
                          <option value="overschrijving">Overschrijving</option>
                          <option value="cash">Cash</option>
                        </select>
                        <button onClick={() => markeerBetaald(sale.id)} style={{ background: '#27ae60', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Ja</button>
                        <button onClick={() => setConfirmPayId(null)} style={{ background: '#3a3a3a', border: 'none', color: '#fff', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Nee</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmPayId(sale.id)} style={{ marginTop: '8px', background: 'none', border: '1px solid #3a3a3a', color: '#aaa', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}>
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
