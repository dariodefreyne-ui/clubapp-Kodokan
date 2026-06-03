// src/components/rapporten/LedenTab.jsx
import { C } from '../../styles/tokens';
import { S, Kpi, RowBg } from './RapportenStyles';

export default function LedenTab({ data, seizoenJaar }) {
  const { members, actievHuidig, actievVorig, nieuw, gestopt, actievPerSeizoen, groepAttLijst } = data;

  const seizoenStr  = `${seizoenJaar}-${seizoenJaar+1}`;
  const totaal      = members.length;
  const actief      = actievHuidig.size;
  const inactief    = totaal - actief;
  const nieuwN      = nieuw.length;
  const gestoptN    = gestopt.length;
  // Leden die vorig seizoen actief waren maar dit seizoen niet
  const verlaten    = [...actievVorig].filter(id => !actievHuidig.has(id)).length;

  // Trend: actieve leden per seizoen
  const seizoenVolgorde = Object.keys(actievPerSeizoen).sort().reverse();

  // Gordelverdeling actieve leden dit seizoen
  const actieveMembersLijst = members.filter(m => actievHuidig.has(m.id));
  const gordelVerdeling = {};
  actieveMembersLijst.forEach(m => {
    const b = m.gordel || m.belt || 'onbekend';
    gordelVerdeling[b] = (gordelVerdeling[b]||0) + 1;
  });
  const GORDEL_ORDER = ['wit','geel','oranje','groen','blauw','bruin','zwart'];
  const gordelSorted = [
    ...GORDEL_ORDER.filter(g => gordelVerdeling[g]).map(g => [g, gordelVerdeling[g]]),
    ...Object.entries(gordelVerdeling).filter(([g]) => !GORDEL_ORDER.includes(g)),
  ];

  const maxAtt = Math.max(...groepAttLijst.map(g => g.pct), 1);

  return (
    <div>
      <div style={S.kpiGrid}>
        <Kpi label="Leden totaal"           value={totaal}   color={C.blue} />
        <Kpi label="Actief dit seizoen"      value={actief}   color={C.green} sub={`${Math.round(actief/totaal*100)}% v/d leden`} />
        <Kpi label="Inactief dit seizoen"    value={inactief} color={C.textMuted} />
        <Kpi label="Nieuw dit seizoen"       value={nieuwN}   color={C.orange} />
        <Kpi label="Gestopt dit seizoen"     value={gestoptN} color={C.red} />
        <Kpi label="Niet teruggekeerd"       value={verlaten} color={C.purple} sub="actief vorig, niet dit seizoen" />
      </div>

      {/* Aanwezigheids% per groep */}
      <div style={S.card}>
        <h3 style={S.h3}>Aanwezigheidspercentage per groep</h3>
        <div style={{ fontSize:'12px', color:C.textMuted, marginBottom:'12px' }}>
          Berekend als: totaal aanwezigen ÷ (leden in groep × aantal gegeven trainingen)
        </div>
        {groepAttLijst.length === 0
          ? <div style={S.leeg}>Geen data beschikbaar.</div>
          : <div style={{ overflowX:'auto' }}>
              <table style={S.tbl}>
                <thead><tr>
                  <th style={S.th}>Groep</th>
                  <th style={S.thr}>Leden</th>
                  <th style={S.thr}>Trainingen</th>
                  <th style={S.thr}>Verwacht</th>
                  <th style={S.thr}>Aanwezig</th>
                  <th style={{ ...S.thr, color:C.green }}>%</th>
                </tr></thead>
                <tbody>
                  {groepAttLijst.map((g,i) => (
                    <tr key={g.naam} style={{ background:RowBg(i) }}>
                      <td style={{ ...S.td, fontWeight:'600' }}>{g.naam}</td>
                      <td style={S.tdr}>{g.leden}</td>
                      <td style={S.tdr}>{g.trainingen}</td>
                      <td style={{ ...S.tdr, color:C.textMuted }}>{g.verwacht}</td>
                      <td style={S.tdr}>{g.totaalAtt}</td>
                      <td style={{ ...S.tdr, fontWeight:'700', color: g.pct>=70?C.green:g.pct>=50?C.orange:C.red }}>{g.pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
        }
      </div>

      {/* Gordelverdeling actieve leden */}
      <div style={S.card}>
        <h3 style={S.h3}>Gordelverdeling (actieve leden dit seizoen)</h3>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
          {gordelSorted.map(([gordel, n]) => (
            <div key={gordel} style={{ display:'flex', alignItems:'center', gap:'6px', background:C.bg, border:`1px solid ${C.border}`, borderRadius:'8px', padding:'6px 12px' }}>
              <span style={{ ...S.beltBadge(gordel), marginLeft:0 }}>{gordel}</span>
              <span style={{ fontSize:'14px', fontWeight:'700', color:C.textPrimary }}>{n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Ledenverloop per seizoen */}
      <div style={S.card}>
        <h3 style={S.h3}>Actieve leden per seizoen</h3>
        <div style={{ fontSize:'12px', color:C.textMuted, marginBottom:'12px' }}>Gebaseerd op aanwezigheidsregistraties (≥ 1 training aanwezig = actief dat seizoen).</div>
        {seizoenVolgorde.length === 0
          ? <div style={S.leeg}>Geen historische data.</div>
          : <div style={{ overflowX:'auto' }}>
              <table style={S.tbl}>
                <thead><tr>
                  <th style={S.th}>Seizoen</th>
                  <th style={S.thr}>Actieve leden</th>
                  <th style={S.thr}></th>
                </tr></thead>
                <tbody>
                  {seizoenVolgorde.map((sz,i) => {
                    const n = actievPerSeizoen[sz]?.size || 0;
                    const maxN = Math.max(...seizoenVolgorde.map(s => actievPerSeizoen[s]?.size||0), 1);
                    const isHuidig = sz === seizoenStr;
                    return (
                      <tr key={sz} style={{ background:RowBg(i) }}>
                        <td style={{ ...S.td, fontWeight: isHuidig?'700':'400' }}>
                          {sz.replace('-', '–')}
                          {isHuidig && <span style={{ marginLeft:'6px', fontSize:'10px', background:C.redDim, color:C.red, border:`1px solid ${C.redBord}`, borderRadius:'4px', padding:'1px 5px' }}>huidig</span>}
                        </td>
                        <td style={{ ...S.tdr, fontWeight:'700', color:C.blue }}>{n}</td>
                        <td style={{ ...S.tdr, width:'40%', minWidth:'120px' }}>
                          <div style={S.bar(Math.round(n/maxN*100), C.blue)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
        }
      </div>

      {/* Nieuwe leden dit seizoen */}
      {nieuw.length > 0 && (
        <div style={S.card}>
          <h3 style={S.h3}>Nieuwe leden dit seizoen ({nieuw.length})</h3>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
            {nieuw.sort((a,b) => (a.naam||'').localeCompare(b.naam||'')).map(m => (
              <span key={m.id} style={{ background:C.bg, border:`1px solid ${C.border}`, borderRadius:'6px', padding:'4px 10px', fontSize:'12px', color:C.textPrimary }}>
                {m.naam}
                {(m.gordel||m.belt) && <span style={{ ...S.beltBadge(m.gordel||m.belt), marginLeft:'4px' }}>{m.gordel||m.belt}</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
