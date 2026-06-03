// src/components/rapporten/WedstrijdenTab.jsx
import { C } from '../../styles/tokens';
import { S, Kpi, RowBg } from './RapportenStyles';

export default function WedstrijdenTab({ data }) {
  const { events, toernooien, inschrijvingen, perCategorie, perDeelnemer } = data;

  const totDeelnames  = inschrijvingen.length;
  const topDeelnemers = Object.values(perDeelnemer).sort((a,b) => b.nToernooien - a.nToernooien).slice(0,15);
  const maxN = topDeelnemers[0]?.nToernooien || 1;
  const aantalToernooien = (toernooien || []).length;

  return (
    <div>
      {events.length === 0
        ? <div style={S.leeg}>Geen wedstrijden in dit seizoen.</div>
        : <>
            <div style={S.kpiGrid}>
              <Kpi label="Wedstrijddagen"  value={events.length}          color={C.blue} />
              {aantalToernooien !== events.length && <Kpi label="Toernooien" value={aantalToernooien} color={C.purple} />}
              <Kpi label="Deelnames"       value={totDeelnames}           color={C.green} />
              <Kpi label="Unieke deelnemers" value={Object.keys(perDeelnemer).length} color={C.orange} />
              <Kpi label="Categorieën"     value={Object.keys(perCategorie).length} color={C.purple} />
            </div>

            {/* Per wedstrijd */}
            <div style={S.card}>
              <h3 style={S.h3}>Wedstrijden dit seizoen</h3>
              <div style={{ overflowX:'auto' }}>
                <table style={S.tbl}>
                  <thead><tr>
                    <th style={S.th}>Wedstrijd</th>
                    <th style={S.th}>Datum</th>
                    <th style={{ ...S.th }}>Doelgroep</th>
                    <th style={S.thr}>Deelnames</th>
                  </tr></thead>
                  <tbody>
                    {events.map((e,i) => {
                      const n = inschrijvingen.filter(x => x.eventId===e.id).length;
                      return (
                        <tr key={e.id} style={{ background:RowBg(i) }}>
                          <td style={{ ...S.td, fontWeight:'600' }}>{e.naam||e.name}</td>
                          <td style={{ ...S.td, color:C.textMuted }}>{e.datum||e.date}</td>
                          <td style={{ ...S.td, color:C.textMuted, fontSize:'12px' }}>{(e.doelgroepCodes||[]).join(', ')||'—'}</td>
                          <td style={{ ...S.tdr, color:n>0?C.green:C.textMuted, fontWeight:'600' }}>{n}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Per categorie */}
            {Object.keys(perCategorie).length > 0 && (
              <div style={S.card}>
                <h3 style={S.h3}>Deelnames per categorie</h3>
                <div style={{ overflowX:'auto' }}>
                  <table style={S.tbl}>
                    <thead><tr>
                      <th style={S.th}>Categorie</th>
                      <th style={S.thr}>Deelnames</th>
                      <th style={{ ...S.thr, width:'40%' }}></th>
                    </tr></thead>
                    <tbody>
                      {Object.entries(perCategorie).sort((a,b)=>b[1]-a[1]).map(([cat,n],i) => {
                        const maxCat = Math.max(...Object.values(perCategorie));
                        return (
                          <tr key={cat} style={{ background:RowBg(i) }}>
                            <td style={{ ...S.td, fontWeight:'600' }}>{cat}</td>
                            <td style={{ ...S.tdr, fontWeight:'700', color:C.green }}>{n}</td>
                            <td style={S.tdr}><div style={S.bar(Math.round(n/maxCat*100), C.green)} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Top deelnemers */}
            {topDeelnemers.length > 0 && (
              <div style={S.card}>
                <h3 style={S.h3}>Meest actieve deelnemers</h3>
                <div style={{ overflowX:'auto' }}>
                  <table style={S.tbl}>
                    <thead><tr>
                      <th style={S.th}>#</th>
                      <th style={S.th}>Naam</th>
                      <th style={S.thr}>Deelnames</th>
                      <th style={{ ...S.thr, color:C.blue }}>Toernooien %<br/><span style={{ fontSize:'10px', fontWeight:'400', color:C.textMuted }}>eigen categorie</span></th>
                      <th style={{ ...S.thr, width:'25%' }}></th>
                    </tr></thead>
                    <tbody>
                      {topDeelnemers.map((d,i) => {
                        const pctKleur = d.pct === null ? C.textMuted : d.pct >= 75 ? C.green : d.pct >= 50 ? C.orange : C.red;
                        return (
                          <tr key={d.naam+i} style={{ background:RowBg(i) }}>
                            <td style={{ ...S.td, color:C.textMuted, fontWeight:'700', width:'32px' }}>{i+1}</td>
                            <td style={{ ...S.td, fontWeight:'600' }}>{d.naam}</td>
                            <td style={{ ...S.tdr, fontWeight:'700', color:C.orange }}>{d.nToernooien}×</td>
                            <td style={{ ...S.tdr, fontWeight:'700', color:pctKleur }}>
                              {d.pct !== null
                                ? <>{d.pct}%<br/><span style={{ fontSize:'11px', fontWeight:'400', color:C.textMuted }}>{d.nToernooien}/{d.eligible} toern.</span></>
                                : '—'}
                            </td>
                            <td style={S.tdr}><div style={S.bar(d.pct ?? Math.round(d.nToernooien/maxN*100), C.blue)} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
      }
    </div>
  );
}
