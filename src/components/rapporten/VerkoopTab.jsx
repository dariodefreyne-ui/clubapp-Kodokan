// src/components/rapporten/VerkoopTab.jsx
import { C } from '../../styles/tokens';
import { S, Kpi, RowBg } from './RapportenStyles';

export default function VerkoopTab({ data }) {
  return (
    <div>
      <div style={S.kpiGrid}>
        <Kpi label="Omzet dit seizoen"   value={`€${data.total.toFixed(2)}`} color={C.green} />
        <Kpi label="Transacties"          value={data.count}                  color={C.blue} />
        <Kpi label="Gem. per transactie" value={`€${data.count>0?(data.total/data.count).toFixed(2):'0.00'}`} color={C.orange} />
      </div>

      {/* Omzettrend over alle seizoenen */}
      {data.trend.length > 1 && (
        <div style={S.card}>
          <h3 style={S.h3}>Omzettrend per seizoen</h3>
          <div style={{ overflowX:'auto' }}>
            <table style={S.tbl}>
              <thead><tr>
                <th style={S.th}>Seizoen</th>
                <th style={S.thr}>Transacties</th>
                <th style={{ ...S.thr, color:C.green }}>Omzet</th>
                <th style={{ ...S.thr, width:'35%' }}></th>
              </tr></thead>
              <tbody>
                {data.trend.map((row,i) => {
                  const maxOmzet = Math.max(...data.trend.map(r=>r.totaal), 1);
                  return (
                    <tr key={row.seizoen} style={{ background:RowBg(i) }}>
                      <td style={{ ...S.td, fontWeight:'600' }}>{row.seizoen.replace('-','–')}</td>
                      <td style={{ ...S.tdr, color:C.textMuted }}>{row.count}</td>
                      <td style={{ ...S.tdr, color:C.green, fontWeight:'700' }}>€{row.totaal.toFixed(2)}</td>
                      <td style={S.tdr}><div style={S.bar(Math.round(row.totaal/maxOmzet*100), C.green)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={S.card}>
        <h3 style={S.h3}>Per dag (dit seizoen)</h3>
        {Object.keys(data.byDate).length === 0
          ? <div style={S.leeg}>Geen verkopen in dit seizoen.</div>
          : Object.entries(data.byDate).map(([date,tot]) => (
            <div key={date} style={{ display:'flex', justifyContent:'space-between', padding:'7px 0', borderBottom:`1px solid ${C.border}` }}>
              <span style={{ color:C.textSec }}>{date}</span>
              <span style={{ fontWeight:'700', color:C.green }}>€{tot.toFixed(2)}</span>
            </div>
          ))
        }
      </div>
      <div style={S.card}>
        <h3 style={S.h3}>Recente transacties (dit seizoen)</h3>
        {data.sales.length === 0
          ? <div style={S.leeg}>Geen transacties.</div>
          : data.sales.slice(0,30).map(s => (
            <div key={s.id} style={{ padding:'8px 0', borderBottom:`1px solid ${C.bg}` }}>
              <div style={{ display:'flex', justifyContent:'space-between' }}>
                <span style={{ color:C.textSec, fontSize:'12px' }}>{s._ts?.toDate?s._ts.toDate().toLocaleString('nl-BE'):'—'}</span>
                <span style={{ fontWeight:'700', color:C.green }}>€{(s._totaal||0).toFixed(2)}</span>
              </div>
              <div style={{ fontSize:'12px', color:C.textMuted, marginTop:'2px' }}>{(s.items||[]).map(i=>`${i.name} ${i.variant||''} ×${i.qty}`).join(' · ')}</div>
              <div style={{ fontSize:'12px', color:C.textMuted }}>Verkoper: {data.verkoperMap[s.verkoperUid]||s.koperNaam||'—'}</div>
            </div>
          ))
        }
      </div>
    </div>
  );
}
