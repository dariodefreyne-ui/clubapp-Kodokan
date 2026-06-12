// src/components/rapporten/TrainingenTab.jsx
import { useState } from 'react';
import { TRAINING_STATUS } from '../trainingen/trainingStatus';
import { minutenNaarUren } from '../uitbetalingen/uitbetalingHelpers';
import { laadTechnieken } from '../../hooks/useRapportenData';
import { isGeenTrainingTekst, DEFAULT_PROVINCIALE_MARKERS } from '../../services/firestoreService';
import { C } from '../../styles/tokens';
import { S, Kpi, Sectiekop, RowBg } from './RapportenStyles';

const DAG_AFG = { maandag:'ma', dinsdag:'di', woensdag:'woe', donderdag:'do', vrijdag:'vri', zaterdag:'zat', zondag:'zo' };

const GROEP_VOLGORDE = ['Groep 1 woe', 'Groep 1 zat', 'Groep 2', 'Groep 3', 'Groep 2&3', 'Groep 4', 'U13+'];

export default function TrainingenTab({ trainingen, groepenMap }) {
  const [techData,  setTechData]  = useState(null);
  const [techLaden, setTechLaden] = useState(false);

  const totaal       = trainingen.length;
  const normaal      = trainingen.filter(t => t._status === TRAINING_STATUS.NORMAAL).length;
  const geannuleerd  = trainingen.filter(t => t._status === TRAINING_STATUS.GEANNULEERD).length;
  const samengevoegd = trainingen.filter(t => t._status === TRAINING_STATUS.SAMENGEVOEGD).length;
  const geen         = trainingen.filter(t => t._status === TRAINING_STATUS.GEEN).length;
  const metTwee      = trainingen.filter(t =>
    (t._status === TRAINING_STATUS.NORMAAL || t._status === TRAINING_STATUS.SAMENGEVOEGD)
    && (t.lesgevers||[]).length >= 2
  ).length;

  // Prov. training: tel enkel via U13+ én enkel trainingen waarvan de opmerking
  // een provinciale marker bevat (prov. training / tornooi / judoweekend).
  // Zo worden vakantieweken en "sporthal gesloten" niet meegeteld.
  const u13PlusIds = new Set(
    Object.entries(groepenMap)
      .filter(([, g]) => (g.naam||'') === 'U13+')
      .map(([id]) => id)
  );
  const provTraining = trainingen.filter(t =>
    u13PlusIds.has(t.groepId) &&
    isGeenTrainingTekst(t.opmerking, DEFAULT_PROVINCIALE_MARKERS)
  ).length;

  const perGroep = {};
  trainingen.forEach(t => {
    const gId = t.groepId || '?';
    if (!perGroep[gId]) {
      const g = groepenMap[gId] || {};
      perGroep[gId] = { naam:g.naam||gId, dag:g.dag||null, provinciaal:!!g.volgtProvincialeKalender, totaal:0, normaal:0, geannuleerd:0, samengevoegd:0, geen:0, metTwee:0, uren:0 };
    }
    const s = perGroep[gId];
    s.totaal++;
    s[t._status] = (s[t._status]||0) + 1;
    const isActief = t._status === TRAINING_STATUS.NORMAAL || t._status === TRAINING_STATUS.SAMENGEVOEGD;
    if (isActief && (t.lesgevers||[]).length >= 2) s.metTwee++;
    if (isActief) s.uren += minutenNaarUren(t.duurMinuten || t._groep?.duurMinuten || 60);
  });

  // Voeg dag-afkorting toe wanneer meerdere groepen dezelfde naam delen
  const naamTelling = {};
  Object.values(perGroep).forEach(g => { naamTelling[g.naam] = (naamTelling[g.naam]||0) + 1; });

  const groepenLijst = Object.values(perGroep)
    .map(g => {
      const dagAfg = g.dag ? (DAG_AFG[g.dag.toLowerCase()] || g.dag) : null;
      const displayNaam = naamTelling[g.naam] > 1 && dagAfg ? `${g.naam} ${dagAfg}` : g.naam;
      return { ...g, displayNaam };
    })
    .sort((a, b) => {
      const ai = GROEP_VOLGORDE.indexOf(a.displayNaam);
      const bi = GROEP_VOLGORDE.indexOf(b.displayNaam);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.naam.localeCompare(b.naam);
    });

  const totalUren = groepenLijst.reduce((s,g) => s + g.uren, 0);

  async function loadTech() {
    setTechLaden(true);
    const ids = trainingen.filter(t => t._status === TRAINING_STATUS.NORMAAL || t._status === TRAINING_STATUS.SAMENGEVOEGD).map(t => t.id);
    setTechData(await laadTechnieken(ids));
    setTechLaden(false);
  }

  return (
    <div>
      <div style={S.kpiGrid}>
        <Kpi label="Totaal gepland"   value={totaal}               color={C.blue} />
        <Kpi label="Gegeven"          value={normaal + samengevoegd} color={C.green} sub={`${totalUren.toFixed(1)} uur`} />
        <Kpi label="Geannuleerd"      value={geannuleerd}          color={C.red} />
        <Kpi label="Prov. training"   value={provTraining}         color={C.textMuted} sub="U13+" />
        <Kpi label="Samengevoegd"     value={samengevoegd}         color={C.purple} />
        <Kpi label="Met 2 lesgevers"  value={metTwee}              color={C.orange} />
      </div>

      <div style={S.card}>
        <h3 style={S.h3}>Per groep</h3>
        <div style={{ overflowX:'auto' }}>
          <table style={S.tbl}>
            <thead>
              <tr>
                <th style={S.th}>Groep</th>
                <th style={S.thr}>Gepland</th>
                <th style={{ ...S.thr, color:C.green }}>Gegeven</th>
                <th style={{ ...S.thr, color:C.red }}>Geann.</th>
                <th style={{ ...S.thr, color:C.purple }}>Samenv.</th>
                <th style={S.thr}>Geen</th>
                <th style={{ ...S.thr, color:C.orange }}>2 lesgevers</th>
                <th style={{ ...S.thr, color:C.blue }}>Uren</th>
              </tr>
            </thead>
            <tbody>
              {groepenLijst.map((g,i) => (
                <tr key={g.displayNaam} style={{ background: RowBg(i) }}>
                  <td style={S.td}>
                    <span style={{ fontWeight:'600' }}>{g.displayNaam}</span>
                    {g.provinciaal && <span style={{ marginLeft:'6px', fontSize:'10px', background:C.blueDim, color:C.blue, border:`1px solid rgba(56,189,248,0.3)`, borderRadius:'4px', padding:'1px 5px' }}>prov.</span>}
                  </td>
                  <td style={S.tdr}>{g.totaal}</td>
                  <td style={{ ...S.tdr, color:C.green, fontWeight:'600' }}>{g.normaal||0}</td>
                  <td style={{ ...S.tdr, color:(g.geannuleerd||0)>0?C.red:C.textMuted }}>{g.geannuleerd||0}</td>
                  <td style={{ ...S.tdr, color:(g.samengevoegd||0)>0?C.purple:C.textMuted }}>{g.samengevoegd||0}</td>
                  <td style={{ ...S.tdr, color:C.textMuted }}>{g.geen||0}</td>
                  <td style={{ ...S.tdr, color:g.metTwee>0?C.orange:C.textMuted }}>{g.metTwee}</td>
                  <td style={{ ...S.tdr, color:C.blue }}>{g.uren.toFixed(1)}u</td>
                </tr>
              ))}
              {groepenLijst.length > 1 && (
                <tr style={{ background:C.bg, borderTop:`2px solid ${C.border}` }}>
                  <td style={{ ...S.td, fontWeight:'800' }}>Totaal</td>
                  <td style={{ ...S.tdr, fontWeight:'700' }}>{totaal}</td>
                  <td style={{ ...S.tdr, color:C.green, fontWeight:'700' }}>{normaal}</td>
                  <td style={{ ...S.tdr, color:C.red, fontWeight:'700' }}>{geannuleerd}</td>
                  <td style={{ ...S.tdr, color:C.purple, fontWeight:'700' }}>{samengevoegd}</td>
                  <td style={{ ...S.tdr, fontWeight:'700' }}>{geen}</td>
                  <td style={{ ...S.tdr, color:C.orange, fontWeight:'700' }}>{metTwee}</td>
                  <td style={{ ...S.tdr, color:C.blue, fontWeight:'700' }}>{totalUren.toFixed(1)}u</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={S.card}>
        <Sectiekop extra={!techData && <button style={S.loadBtn} onClick={loadTech} disabled={techLaden}>{techLaden?'Laden…':'Laad technieken'}</button>}>
          🥋 Technieken aan bod
        </Sectiekop>
        {!techData && !techLaden && (
          <div style={{ fontSize:'13px', color:C.textMuted }}>Klik op "Laad technieken" om te zien welke technieken dit seizoen aan bod zijn gekomen.</div>
        )}
        {techData && (
          techData.length === 0
            ? <div style={S.leeg}>Geen technieken geregistreerd voor dit seizoen.</div>
            : <>
                <div style={{ fontSize:'12px', color:C.textMuted, marginBottom:'12px' }}>{techData.length} technieken · {techData.reduce((s,t)=>s+t.totaal,0)}× gegeven</div>
                <div style={{ overflowX:'auto' }}>
                  <table style={S.tbl}>
                    <thead><tr>
                      <th style={S.th}>Techniek</th>
                      <th style={S.thr}>Totaal</th>
                      <th style={{ ...S.thr, color:C.green }}>Basis</th>
                      <th style={{ ...S.thr, color:C.orange }}>Verdieping</th>
                    </tr></thead>
                    <tbody>
                      {techData.slice(0,60).map((t,i) => (
                        <tr key={t.naam} style={{ background:RowBg(i) }}>
                          <td style={S.td}>{t.naam}</td>
                          <td style={{ ...S.tdr, fontWeight:'700' }}>{t.totaal}×</td>
                          <td style={{ ...S.tdr, color:C.green }}>{t.basis||'—'}</td>
                          <td style={{ ...S.tdr, color:C.orange }}>{t.verdieping||'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
        )}
      </div>
    </div>
  );
}
