// src/components/rapporten/WinkelTab.jsx
import { C } from '../../styles/tokens';
import { S, Kpi, RowBg } from './RapportenStyles';

export default function WinkelTab({ data }) {
  return (
    <div>
      <div style={S.infoBalk}>ℹ️ Winkelstatistieken tonen alle tijden (stocktelling is niet seizoensgebonden).</div>
      <div style={S.kpiGrid}>
        <Kpi label="Stockwaarde"     value={`€${data.totalValue.toFixed(0)}`}  color={C.blue} />
        <Kpi label="Omzet totaal"    value={`€${data.totalRevenue.toFixed(0)}`} color={C.green} />
        <Kpi label="Marge totaal"    value={`€${data.margin.toFixed(0)}`}       color={C.orange} />
        <Kpi label="Items in stock"  value={data.products.reduce((s,p)=>s+(p.stock||0),0)} color={C.purple} />
      </div>
      <div style={S.card}>
        <h3 style={S.h3}>Productoverzicht</h3>
        <div style={{ overflowX:'auto' }}>
          <table style={S.tbl}>
            <thead><tr>
              <th style={S.th}>Product</th><th style={S.th}>Variant</th>
              <th style={S.thr}>Stock</th><th style={S.thr}>Verkocht</th>
              <th style={S.thr}>Omzet</th><th style={S.thr}>Marge</th>
            </tr></thead>
            <tbody>
              {data.products.map((p,i) => (
                <tr key={p.id} style={{ background:RowBg(i) }}>
                  <td style={{ ...S.td, fontWeight:'600' }}>{p.name}</td>
                  <td style={{ ...S.td, color:C.textMuted }}>{p.variant}</td>
                  <td style={{ ...S.tdr, color:(p.stock||0)<=0?C.red:(p.stock||0)<3?C.orange:C.green, fontWeight:'600' }}>{p.stock||0}</td>
                  <td style={S.tdr}>{p.soldCount||0}</td>
                  <td style={S.tdr}>€{((p.price||0)*(p.soldCount||0)).toFixed(2)}</td>
                  <td style={S.tdr}>€{(((p.price||0)-(p.costPrice||0))*(p.soldCount||0)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
