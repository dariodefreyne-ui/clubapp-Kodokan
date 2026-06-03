// src/components/rapporten/ExamensTab.jsx
import { C } from '../../styles/tokens';
import { S, Kpi, RowBg } from './RapportenStyles';

export default function ExamensTab({ examens }) {
  const totKandidaten = examens.reduce((s,e) => s + e.candidates, 0);
  const totGeslaagd   = examens.reduce((s,e) => s + e.passed, 0);
  const globaalPct    = totKandidaten > 0 ? Math.round(totGeslaagd/totKandidaten*100) : 0;

  if (examens.length === 0) return <div style={S.leeg}>Geen examens in dit seizoen.</div>;

  return (
    <div>
      <div style={S.kpiGrid}>
        <Kpi label="Examens"         value={examens.length} color={C.blue} />
        <Kpi label="Kandidaten"      value={totKandidaten}  color={C.orange} />
        <Kpi label="Geslaagd"        value={totGeslaagd}    color={C.green} />
        <Kpi label="Slaagpercentage" value={`${globaalPct}%`} color={globaalPct>=70?C.green:C.orange} />
      </div>
      <div style={S.card}>
        <h3 style={S.h3}>Examenresultaten</h3>
        <div style={{ overflowX:'auto' }}>
          <table style={S.tbl}>
            <thead><tr>
              <th style={S.th}>Examen</th><th style={S.th}>Datum</th>
              <th style={S.thr}>Kandidaten</th>
              <th style={{ ...S.thr, color:C.green }}>Geslaagd</th>
              <th style={{ ...S.thr, color:C.red }}>Niet geslaagd</th>
              <th style={S.thr}>Slaagpct.</th>
            </tr></thead>
            <tbody>
              {examens.sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map((e,i) => (
                <tr key={e.id} style={{ background:RowBg(i) }}>
                  <td style={{ ...S.td, fontWeight:'600' }}>{e.name||e.naam}</td>
                  <td style={{ ...S.td, color:C.textMuted }}>{e.date}</td>
                  <td style={S.tdr}>{e.candidates}</td>
                  <td style={{ ...S.tdr, color:C.green, fontWeight:'600' }}>{e.passed}</td>
                  <td style={{ ...S.tdr, color:C.red, fontWeight:'600' }}>{e.failed}</td>
                  <td style={{ ...S.tdr, color:e.passRate>=70?C.green:C.orange, fontWeight:'700' }}>{e.passRate}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
