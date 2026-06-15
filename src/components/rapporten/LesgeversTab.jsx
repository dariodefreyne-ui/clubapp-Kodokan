// src/components/rapporten/LesgeversTab.jsx
import { TRAINING_STATUS } from '../trainingen/trainingStatus';
import { minutenNaarUren, formatUren, formatBedrag, vindLesgever } from '../uitbetalingen/uitbetalingHelpers';
import { C } from '../../styles/tokens';
import { S, Kpi, RowBg } from './RapportenStyles';

export default function LesgeversTab({ trainingen, lesgeversLijst, tarieven }) {
  // Enkel NORMAAL: samengevoegde groepen tellen niet mee als gegeven training.
  // Een lesgever die ingevuld staat bij een samengevoegde groep krijgt geen
  // uren of vergoeding — de training werd niet in die groep gegeven.
  const actief = trainingen.filter(t => t._status === TRAINING_STATUS.NORMAAL);
  const perLesgever = {};
  actief.forEach(t => {
    (t.lesgevers||[]).forEach(key => {
      const lsg = vindLesgever(key, lesgeversLijst);
      const id = lsg?.id || key;
      if (!perLesgever[id]) perLesgever[id] = { naam:lsg?.naam||key, type:lsg?.type||'', n:0, uren:0, bedrag:0 };
      const uren   = minutenNaarUren(t.duurMinuten || t._groep?.duurMinuten || 60);
      const tarief = tarieven[lsg?.type||'']?.bedragPerUur || 0;
      perLesgever[id].n++;
      perLesgever[id].uren   += uren;
      perLesgever[id].bedrag += uren * tarief;
    });
  });
  const lijst       = Object.values(perLesgever).sort((a,b) => b.uren - a.uren);
  const trainers    = lijst.filter(l => l.type !== 'assistent');
  const assistenten = lijst.filter(l => l.type === 'assistent');
  const totBedrag   = lijst.reduce((s,l) => s + l.bedrag, 0);
  const totUren     = lijst.reduce((s,l) => s + l.uren, 0);

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
              <th style={S.th}>Naam</th>
              <th style={{ ...S.th, textAlign:'center' }}>Trainingen</th>
              <th style={S.thr}>Uren</th>
              <th style={{ ...S.thr, color:kleur }}>Vergoeding</th>
            </tr></thead>
            <tbody>
              {lg.map((l,i) => (
                <tr key={l.naam} style={{ background:RowBg(i) }}>
                  <td style={{ ...S.td, fontWeight:'600' }}>{l.naam}</td>
                  <td style={{ ...S.tdr, color:C.textMuted }}>{l.n}×</td>
                  <td style={S.tdr}>{formatUren(l.uren)}</td>
                  <td style={{ ...S.tdr, color:kleur, fontWeight:'700' }}>{formatBedrag(l.bedrag)}</td>
                </tr>
              ))}
              <tr style={{ background:C.bg, borderTop:`2px solid ${C.border}` }}>
                <td colSpan={2} style={{ ...S.td, fontWeight:'800' }}>Subtotaal</td>
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
        <Kpi label="Trainers & initiators"      value={trainers.length}         color={C.red} />
        <Kpi label="Assistenten"                value={assistenten.length}      color={C.orange} />
        <Kpi label="Geregistreerde trainingen"  value={actief.length}           color={C.purple} />
      </div>
      {lijst.length === 0
        ? <div style={S.leeg}>Geen lesgevers/trainers geregistreerd voor dit seizoen.</div>
        : <><LesgeversGroep titel="🥋 Trainers & initiators" lijst={trainers} kleur={C.red} /><LesgeversGroep titel="🎓 Assistenten" lijst={assistenten} kleur={C.blue} /></>
      }
      <div style={S.infoBalk}>💡 Wedstrijdkosten (km-vergoedingen &amp; inkomgeld) vind je in de <strong style={{ marginLeft:'4px' }}>Uitbetalingen</strong>-pagina.</div>
    </div>
  );
}
