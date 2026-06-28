// src/components/rapporten/LesgeversTab.jsx
import { useState, Fragment } from 'react';
import { TRAINING_STATUS } from '../trainingen/trainingStatus';
import { minutenNaarUren, formatUren, formatBedrag, vindLesgever } from '../uitbetalingen/uitbetalingHelpers';
import { bepaalSeizoen } from '../../utils/seizoenUtils';
import { C } from '../../styles/tokens';
import { S, Kpi, RowBg, Sectiekop, exportBtnStyle } from './RapportenStyles';
import { exportLesgevers } from './exportLesgevers';

const MAAND_NAMEN = ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'];
function maandLabel(maand) {
  const [, m] = maand.split('-');
  return MAAND_NAMEN[Number(m) - 1] || maand;
}

export default function LesgeversTab({ trainingen, groepenMap = {}, lesgeversLijst, tarieven, trendTrainingen, trendTarieven, seizoenJaar, seizoenLabel }) {
  // Enkel NORMAAL: samengevoegde groepen tellen niet mee als gegeven training.
  // Een lesgever die ingevuld staat bij een samengevoegde groep krijgt geen
  // uren of vergoeding — de training werd niet in die groep gegeven.
  const actief = trainingen.filter(t => t._status === TRAINING_STATUS.NORMAAL);
  const perLesgever = {};
  actief.forEach(t => {
    (t.lesgevers||[]).forEach(key => {
      const lsg = vindLesgever(key, lesgeversLijst);
      const id = lsg?.id || key;
      if (!perLesgever[id]) perLesgever[id] = { id, naam:lsg?.naam||key, type:lsg?.type||'', n:0, uren:0, bedrag:0, groepen:{}, maanden:{} };
      const uren     = minutenNaarUren(t.duurMinuten || t._groep?.duurMinuten || 60);
      const tarief   = tarieven[lsg?.type||'']?.bedragPerUur || 0;
      const groepId  = t.groepId || '?';
      const groepNaam= groepenMap[groepId]?.naam || groepId;
      perLesgever[id].n++;
      perLesgever[id].uren   += uren;
      perLesgever[id].bedrag += uren * tarief;
      if (!perLesgever[id].groepen[groepId]) perLesgever[id].groepen[groepId] = { naam:groepNaam, n:0, uren:0, datums:[] };
      const g = perLesgever[id].groepen[groepId];
      g.n++;
      g.uren += uren;
      g.datums.push(t.datum);
      const maand = (t.datum || '').slice(0, 7);
      if (maand) {
        if (!perLesgever[id].maanden[maand]) perLesgever[id].maanden[maand] = { maand, n:0, uren:0, bedrag:0 };
        const m = perLesgever[id].maanden[maand];
        m.n++;
        m.uren += uren;
        m.bedrag += uren * tarief;
      }
    });
  });

  // Seizoenvergelijking: trend-trainingen dekken het huidige + vorige seizoenen.
  const perLesgeverSeizoen = {};
  (trendTrainingen || []).forEach(t => {
    const sz = bepaalSeizoen(t.datum);
    if (!sz) return;
    (t.lesgevers||[]).forEach(key => {
      const lsg = vindLesgever(key, lesgeversLijst);
      const id  = lsg?.id || key;
      const uren   = minutenNaarUren(t.duurMinuten || 60);
      const tarief = (trendTarieven||{})[lsg?.type||'']?.bedragPerUur || 0;
      if (!perLesgeverSeizoen[id]) perLesgeverSeizoen[id] = { naam:lsg?.naam||key, seizoenen:{} };
      if (!perLesgeverSeizoen[id].seizoenen[sz]) perLesgeverSeizoen[id].seizoenen[sz] = { seizoen:sz, n:0, uren:0, bedrag:0 };
      const s = perLesgeverSeizoen[id].seizoenen[sz];
      s.n++;
      s.uren += uren;
      s.bedrag += uren * tarief;
    });
  });
  const lijst       = Object.values(perLesgever).sort((a,b) => b.uren - a.uren);
  const trainers    = lijst.filter(l => l.type !== 'assistent');
  const assistenten = lijst.filter(l => l.type === 'assistent');
  const totBedrag   = lijst.reduce((s,l) => s + l.bedrag, 0);
  const totUren     = lijst.reduce((s,l) => s + l.uren, 0);

  const [open, setOpen]         = useState(null); // naam van de open lesgever-rij
  const [openGroep, setOpenGroep] = useState(null); // groepId binnen de open lesgever-rij

  function LesgeversGroep({ titel, lijst: lg, kleur }) {
    if (!lg.length) return null;
    return (
      <div style={{ marginBottom:'20px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px', paddingBottom:'6px', borderBottom:`1px solid ${C.border}` }}>
          <span style={{ fontWeight:'700', fontSize:'14px' }}>{titel}</span>
          <span style={{ fontSize:'12px', color:C.textMuted, background:C.bg, border:`1px solid ${C.border}`, borderRadius:'999px', padding:'2px 10px' }}>{lg.length}</span>
          <span style={{ marginLeft:'auto', fontWeight:'800', color:kleur }}>{formatBedrag(lg.reduce((s,l)=>s+l.bedrag,0))}</span>
        </div>
        <div style={{ overflowX:'auto', borderRadius:'10px', border:`1px solid ${C.border}` }}>
          <table style={S.tbl}>
            <thead><tr style={{ background:C.bg }}>
              <th style={S.th}></th>
              <th style={S.th}>Naam</th>
              <th style={{ ...S.th, textAlign:'center' }}>Trainingen</th>
              <th style={S.thr}>Uren</th>
              <th style={{ ...S.thr, color:kleur }}>Vergoeding</th>
            </tr></thead>
            <tbody>
              {lg.map((l,i) => {
                const isOpen = open === l.naam;
                const groepenLijst = Object.entries(l.groepen).sort((a,b) => b[1].n - a[1].n);
                const maandenLijst = Object.values(l.maanden).sort((a,b) => a.maand.localeCompare(b.maand));
                const seizoenenLijst = Object.values(perLesgeverSeizoen[l.id]?.seizoenen || {}).sort((a,b) => b.seizoen.localeCompare(a.seizoen));
                return (
                  <Fragment key={l.naam}>
                    <tr style={{ background:RowBg(i), cursor:'pointer' }}
                        onClick={() => { setOpen(isOpen ? null : l.naam); setOpenGroep(null); }}>
                      <td style={{ ...S.td, width:'24px', color:C.textMuted }}>{isOpen ? '▾' : '▸'}</td>
                      <td style={{ ...S.td, fontWeight:'600' }}>{l.naam}</td>
                      <td style={{ ...S.tdr, color:C.textMuted }}>{l.n}×</td>
                      <td style={S.tdr}>{formatUren(l.uren)}</td>
                      <td style={{ ...S.tdr, color:kleur, fontWeight:'700' }}>{formatBedrag(l.bedrag)}</td>
                    </tr>
                    {isOpen && (
                      <tr style={{ background:C.bg }}>
                        <td></td>
                        <td colSpan={4} style={{ padding:'4px 12px 12px' }}>
                          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                            <tbody>
                              {groepenLijst.map(([groepId, g]) => {
                                const groepOpen = openGroep === groepId;
                                return (
                                  <Fragment key={groepId}>
                                    <tr style={{ cursor:'pointer', borderTop:`1px solid ${C.border}` }}
                                        onClick={(e) => { e.stopPropagation(); setOpenGroep(groepOpen ? null : groepId); }}>
                                      <td style={{ padding:'6px 8px', width:'20px', color:C.textMuted }}>{groepOpen ? '▾' : '▸'}</td>
                                      <td style={{ padding:'6px 8px', fontWeight:'600' }}>{g.naam}</td>
                                      <td style={{ padding:'6px 8px', textAlign:'right', color:C.textMuted }}>{g.n}×</td>
                                      <td style={{ padding:'6px 8px', textAlign:'right' }}>{formatUren(g.uren)}</td>
                                    </tr>
                                    {groepOpen && (
                                      <tr>
                                        <td></td>
                                        <td colSpan={3} style={{ padding:'4px 8px 10px', color:C.textMuted }}>
                                          {g.datums.slice().sort().map(d =>
                                            new Date(d+'T00:00:00').toLocaleDateString('nl-BE',{day:'numeric',month:'short',year:'numeric'})
                                          ).join(' · ')}
                                        </td>
                                      </tr>
                                    )}
                                  </Fragment>
                                );
                              })}
                            </tbody>
                          </table>

                          {maandenLijst.length > 1 && (
                            <div style={{ marginTop:'10px' }}>
                              <div style={{ fontWeight:'700', color:C.textMuted, marginBottom:'4px' }}>Per maand</div>
                              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                                <tbody>
                                  {maandenLijst.map(m => (
                                    <tr key={m.maand} style={{ borderTop:`1px solid ${C.border}` }}>
                                      <td style={{ padding:'4px 8px', fontWeight:'600', textTransform:'capitalize' }}>{maandLabel(m.maand)}</td>
                                      <td style={{ padding:'4px 8px', textAlign:'right', color:C.textMuted }}>{m.n}×</td>
                                      <td style={{ padding:'4px 8px', textAlign:'right' }}>{formatUren(m.uren)}</td>
                                      <td style={{ padding:'4px 8px', textAlign:'right', fontWeight:'700' }}>{formatBedrag(m.bedrag)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {seizoenenLijst.length > 1 && (
                            <div style={{ marginTop:'10px' }}>
                              <div style={{ fontWeight:'700', color:C.textMuted, marginBottom:'4px' }}>Vorige seizoenen</div>
                              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                                <tbody>
                                  {seizoenenLijst.map((s,si) => {
                                    const vorig = seizoenenLijst[si+1];
                                    const pct = vorig && vorig.uren > 0 ? Math.round((s.uren - vorig.uren) / vorig.uren * 100) : null;
                                    return (
                                      <tr key={s.seizoen} style={{ borderTop:`1px solid ${C.border}` }}>
                                        <td style={{ padding:'4px 8px', fontWeight:'600' }}>{s.seizoen}</td>
                                        <td style={{ padding:'4px 8px', textAlign:'right', color:C.textMuted }}>{s.n}×</td>
                                        <td style={{ padding:'4px 8px', textAlign:'right' }}>{formatUren(s.uren)}</td>
                                        <td style={{ padding:'4px 8px', textAlign:'right', fontWeight:'700' }}>{formatBedrag(s.bedrag)}</td>
                                        <td style={{ padding:'4px 8px', textAlign:'right', color: pct==null ? C.textMuted : (pct>=0 ? C.green : C.red) }}>
                                          {pct==null ? '—' : `${pct>=0?'+':''}${pct}%`}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              <tr style={{ background:C.bg, borderTop:`2px solid ${C.border}` }}>
                <td></td>
                <td style={{ ...S.td, fontWeight:'800' }}>Subtotaal</td>
                <td style={{ ...S.tdr, color:C.orange, fontWeight:'700' }}>{formatUren(lg.reduce((s,l)=>s+l.uren,0))}</td>
                <td style={{ ...S.tdr, color:kleur, fontWeight:'800' }}>{formatBedrag(lg.reduce((s,l)=>s+l.bedrag,0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={S.kpiGrid}>
        <Kpi label="Totaal uitbetaling"        value={formatBedrag(totBedrag)} color={C.green} sub="trainingen" />
        <Kpi label="Totaal uren"                value={`${totUren.toFixed(1)}u`} color={C.blue} />
        <Kpi label="Trainers"                   value={trainers.length}         color={C.red} />
        <Kpi label="Assistenten"                value={assistenten.length}      color={C.orange} />
        <Kpi label="Geregistreerde trainingen"  value={actief.length}           color={C.purple} />
      </div>
      {lijst.length === 0
        ? <div style={S.leeg}>Geen lesgevers/trainers geregistreerd voor dit seizoen.</div>
        : <>
            <Sectiekop extra={
              <button style={exportBtnStyle} onClick={() => exportLesgevers(lijst, perLesgeverSeizoen, totBedrag, totUren, seizoenLabel)}>
                📥 Exporteren (.xlsx)
              </button>
            }>Lesgevers</Sectiekop>
            <LesgeversGroep titel="🥋 Trainers" lijst={trainers} kleur={C.red} /><LesgeversGroep titel="🎓 Assistenten" lijst={assistenten} kleur={C.blue} />
          </>
      }
      <div style={S.infoBalk}>💡 Wedstrijdkosten (km-vergoedingen &amp; inkomgeld) vind je in de <strong style={{ marginLeft:'4px' }}>Uitbetalingen</strong>-pagina.</div>
    </div>
  );
}
