// src/components/rapporten/AanwezigheidTab.jsx
import { C } from '../../styles/tokens';
import { S, Kpi, RowBg, exportBtnStyle } from './RapportenStyles';
import { exportAanwezigheid } from './exportAanwezigheid';
import { maandLabel } from './exportHelpers';

export default function AanwezigheidTab({ leden, perGroep = [], seizoenLabel }) {
  const max     = Math.max(...leden.map(m => m.aanwezigheid), 1);
  const totaal  = leden.reduce((s,m) => s + m.aanwezigheid, 0);
  const actief  = leden.filter(m => m.aanwezigheid > 0);
  const gem     = actief.length > 0 ? Math.round(totaal / actief.length) : 0;

  const perGordel = {};
  leden.forEach(m => { const b = m.gordel||m.belt||'onbekend'; perGordel[b] = (perGordel[b]||0)+1; });
  const GORDEL_ORDER = ['wit','geel','oranje','groen','blauw','bruin','zwart'];
  const gordelSorted = [
    ...GORDEL_ORDER.filter(g => perGordel[g]).map(g => [g, perGordel[g]]),
    ...Object.entries(perGordel).filter(([g]) => !GORDEL_ORDER.includes(g)),
  ];

  return (
    <div>
      <div style={S.kpiGrid}>
        <Kpi label="Leden totaal"         value={leden.length}  color={C.blue} />
        <Kpi label="Actief dit seizoen"   value={actief.length} color={C.green} />
        <Kpi label="Inactief dit seizoen" value={leden.length-actief.length} color={C.textMuted} />
        <Kpi label="Totaal aanwezigheden" value={totaal}        color={C.orange} />
        <Kpi label="Gem. per actief lid"  value={gem}           color={C.purple} />
      </div>
      <div style={S.card}>
        <h3 style={S.h3}>Gordelverdeling</h3>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
          {gordelSorted.map(([gordel, n]) => (
            <div key={gordel} style={{ display:'flex', alignItems:'center', gap:'6px', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'6px 12px' }}>
              <span style={{ ...S.beltBadge(gordel), marginLeft:0 }}>{gordel}</span>
              <span style={{ fontSize:'14px', fontWeight:'700', color:C.textPrimary }}>{n}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={S.card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
          <h3 style={{ ...S.h3, margin:0 }}>Maandoverzicht per groep</h3>
          <button
            onClick={() => exportAanwezigheid(perGroep, leden, gordelSorted, seizoenLabel)}
            disabled={perGroep.length === 0}
            style={{ ...exportBtnStyle, opacity: perGroep.length === 0 ? 0.5 : 1 }}
          >
            📥 Exporteren (.xlsx)
          </button>
        </div>
        {perGroep.length === 0
          ? <div style={S.leeg}>Geen trainingen met aanwezigheidsdata voor dit seizoen.</div>
          : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                <thead>
                  <tr style={{ textAlign:'left', color:C.textMuted, borderBottom:`1px solid ${C.border}` }}>
                    <th style={{ padding:'6px 8px' }}>Maand</th>
                    <th style={{ padding:'6px 8px' }}>Groep</th>
                    <th style={{ padding:'6px 8px', textAlign:'right' }}>Trainingen</th>
                    <th style={{ padding:'6px 8px', textAlign:'right' }}>Leden</th>
                    <th style={{ padding:'6px 8px', textAlign:'right' }}>Aanwezig</th>
                    <th style={{ padding:'6px 8px', textAlign:'right' }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {perGroep.map((r, i) => (
                    <tr key={`${r.maand}|${r.groep}`} style={{ background: RowBg(i) }}>
                      <td style={{ padding:'6px 8px', color:C.textPrimary }}>{maandLabel(r.maand)}</td>
                      <td style={{ padding:'6px 8px', color:C.textPrimary, fontWeight:'600' }}>{r.groep}</td>
                      <td style={{ padding:'6px 8px', textAlign:'right', color:C.textSec }}>{r.trainingen}</td>
                      <td style={{ padding:'6px 8px', textAlign:'right', color:C.textSec }}>{r.leden}</td>
                      <td style={{ padding:'6px 8px', textAlign:'right', color:C.textSec }}>{r.totaalAtt}</td>
                      <td style={{ padding:'6px 8px', textAlign:'right', fontWeight:'700', color: r.pct >= 70 ? C.green : r.pct >= 40 ? C.orange : C.red }}>{r.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
      </div>

      <div style={S.card}>
        <h3 style={S.h3}>Aanwezigheid per lid</h3>
        {leden.length === 0
          ? <div style={S.leeg}>Geen aanwezigheidsdata voor dit seizoen.</div>
          : leden.map(m => (
            <div key={m.id} style={{ marginBottom:'10px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <span style={{ fontWeight:'600', fontSize:'13px' }}>{m.naam||m.name}</span>
                  {(m.gordel||m.belt) && <span style={S.beltBadge(m.gordel||m.belt)}>{m.gordel||m.belt}</span>}
                </div>
                <span style={{ fontWeight:'700', color: m.aanwezigheid>0?C.red:C.textMuted }}>{m.aanwezigheid}×</span>
              </div>
              <div style={S.bar(Math.round(m.aanwezigheid/max*100), C.red)} />
            </div>
          ))
        }
      </div>
    </div>
  );
}
