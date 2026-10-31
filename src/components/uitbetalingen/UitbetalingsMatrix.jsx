// ─── UitbetalingsMatrix (trainingen) ──────────────────────────────────────────
// Matrix per lesgever × datum. Totalen (uren, €/u, totaal) staan vóór de datums zodat ze
// meteen zichtbaar zijn. Klik op rij → correctie-pop-up voor die lesgever.
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { getClubSettings, markersUitSettings, markersProvinciaalUitSettings } from '../../services/firestoreService';
import { bepaalTrainingStatus, TRAINING_STATUS } from '../trainingen/trainingStatus';
import { C } from '../trainingen/tokens';
import {
  minutenNaarUren, formatUren, formatBedrag, normNaam, bouwMatrixRijen, formatDagKort, formatDagnaam, afrond2,
} from './uitbetalingHelpers';
import { exporteerTrainingenXlsx } from './uitbetalingExport';
import AanwezigheidCorrectieModal from './AanwezigheidCorrectieModal';

export default function UitbetalingsMatrix({ periode, lesgeversLijst, tarieven, tarieftypes, filterLesgeverId, groepenLijst = [] }) {
  const [data, setData]         = useState(null);   // { datums, lesgevers: {id:{datum:uren}}, trainingen: Training[] }
  const [laden, setLaden]       = useState(false);
  const [fout, setFout]         = useState('');
  const [exportFout, setExportFout] = useState('');
  const [correctieVoor, setCorrectieVoor] = useState(null); // lesgeverId waarvoor de correctie-pop-up open staat/animeert
  const [correctieOpen, setCorrectieOpen] = useState(false); // blijft false tijdens sluit-animatie, correctieVoor blijft staan tot daarna
  const [recentGecorrigeerd, setRecentGecorrigeerd] = useState({}); // {lesgeverId: aantal} — zichtbaar tot page reload

  // Memoized Map: O(1) lesgever-lookup i.p.v. O(n) per vindLesgever call
  const lesgeversMap = React.useMemo(() => {
    const m = new Map();
    for (const l of lesgeversLijst) {
      m.set(l.id, l);
      if (l.uid) m.set(l.uid, l);
      if (l.naam) m.set(normNaam(l.naam), l);
    }
    return m;
  }, [lesgeversLijst]);


  const laad = useCallback(async()=>{
    if (!periode) return;
    setLaden(true); setFout('');
    try {
      const snap = await getDocs(query(collection(db,'trainingen'),where('datum','>=',periode.van),where('datum','<=',periode.tot),orderBy('datum','asc')));
      const groepenMap = {};
      groepenLijst.forEach(g=>{ groepenMap[g.id]=g; });
      const settings = await getClubSettings();
      const geenMarkers = markersUitSettings(settings);
      const provincialeMarkers = markersProvinciaalUitSettings(settings);

      // Enkel NORMAAL: een samengevoegde groep heeft de training niet gegeven.
      // Een lesgever ingevuld bij een samengevoegde groep wordt niet uitbetaald.
      const normaleTrainingen = snap.docs.map(d=>({
        id:d.id,...d.data(),
        _uren: minutenNaarUren(d.data().duurMinuten || groepenMap[d.data().groepId]?.duurMinuten || 60),
        _groepNaam: groepenMap[d.data().groepId]?.naam || '',
      })).filter(t => {
        const status = bepaalTrainingStatus(t, { geenMarkers, provincialeMarkers, volgtProvincialeKalender: !!groepenMap[t.groepId]?.volgtProvincialeKalender });
        return status === TRAINING_STATUS.NORMAAL;
      });

      // Trainingen die wél doorgingen maar waar nog niemand werd ingevuld —
      // deze tellen niet mee in de matrix (geen uren toe te wijzen) maar
      // moeten zichtbaar blijven zodat ze niet stilletjes vergeten worden.
      const zonderLesgever = normaleTrainingen.filter(t => (t.lesgevers||[]).length === 0);
      const trainingen = normaleTrainingen.filter(t => (t.lesgevers||[]).length > 0);

      if (trainingen.length===0) { setData({datums:[],lesgevers:{},trainingen:[],zonderLesgever}); return; }

      const datums = [...new Set(trainingen.map(t=>t.datum))].sort();
      const matrix = {};
      for (const t of trainingen) {
        for (const rawKey of (t.lesgevers||[])) {
          const id = lesgeversMap.get(rawKey)?.id || lesgeversMap.get(normNaam(rawKey))?.id || rawKey;
          if (!matrix[id]) matrix[id]={};
          if (!matrix[id][t.datum]) matrix[id][t.datum] = { uren: 0, groepen: [] };
          const cel = matrix[id][t.datum];
          cel.uren += t._uren;
          // Eén lesgever kan op één dag meerdere groepen geven (bv. 2 trainingen
          // na elkaar) — toon dan alle groepnamen i.p.v. enkel het totaal aantal uur.
          if (t._groepNaam && !cel.groepen.includes(t._groepNaam)) cel.groepen.push(t._groepNaam);
        }
      }
      const gefilterd = filterLesgeverId
        ? Object.fromEntries(Object.entries(matrix).filter(([id])=>id===filterLesgeverId))
        : matrix;

      setData({datums, lesgevers:gefilterd, trainingen, zonderLesgever});
    } catch(e) { setFout('Laden mislukt: '+e.message); }
    finally { setLaden(false); }
  }, [periode, groepenLijst]);

  useEffect(()=>{ laad(); },[laad]);

  const exporteer = async ()=>{
    if (!data) return;
    setExportFout('');
    try {
      await exporteerTrainingenXlsx({ rijen: bouwMatrixRijen({ data, lesgeversLijst, tarieven, tarieftypes }), datums: data.datums, periode });
    } catch(e) { setExportFout('Export mislukt: '+e.message); }
  };

  if (!periode) return null;
  if (laden) return <div style={{color:C.textMuted,padding:'20px'}}>Laden…</div>;
  if (fout)  return <div style={{color:'var(--danger)',padding:'20px'}}>{fout}</div>;
  if (!data) return null;

  const ontbrekendBanner = data.zonderLesgever?.length > 0 && (
    <div style={{background:C.orangeDim||'rgba(245,158,11,0.12)',border:`1px solid ${C.orange}`,borderRadius:'10px',padding:'12px 14px',marginBottom:'14px'}}>
      <div style={{fontSize:'13px',fontWeight:'700',color:C.orange,marginBottom:'8px'}}>
        ⚠️ {data.zonderLesgever.length} training{data.zonderLesgever.length!==1?'en':''} zonder ingevulde lesgever
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:'4px'}}>
        {data.zonderLesgever.map(t=>(
          <Link key={t.id} to={`/trainingen/${t.id}?edit=1`} style={{fontSize:'12px',color:C.textPrimary,textDecoration:'none',display:'flex',gap:'8px'}}>
            <span style={{color:C.textMuted}}>{new Date(t.datum+'T00:00:00').toLocaleDateString('nl-BE',{day:'numeric',month:'short'})}</span>
            <span style={{fontWeight:'600'}}>{t._groepNaam||t.groepId}</span>
            <span style={{color:C.blue,marginLeft:'auto'}}>invullen →</span>
          </Link>
        ))}
      </div>
    </div>
  );

  if (data.datums.length===0) return (
    <div>
      {ontbrekendBanner}
      <div style={{color:C.textMuted,fontSize:'14px',padding:'12px 0',fontStyle:'italic'}}>Geen trainingen met lesgevers in deze periode.</div>
    </div>
  );

  const rijen = bouwMatrixRijen({ data, lesgeversLijst, tarieven, tarieftypes });
  const somUren   = afrond2(rijen.reduce((s,r)=>s+r.uren,0));
  const somBedrag = afrond2(rijen.reduce((s,r)=>s+(r.bedrag||0),0));
  const openCorrectie = (id)=>{ setCorrectieVoor(id); setCorrectieOpen(true); };

  const TH = {padding:'10px 8px',color:C.textMuted,fontWeight:'700',whiteSpace:'nowrap',position:'sticky',top:0,zIndex:1,background:C.card};

  return (
    <div style={{paddingTop:'12px'}}>
      {ontbrekendBanner}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:'10px',flexWrap:'wrap',marginBottom:'10px'}}>
        <div style={{fontSize:'13px',color:C.textSec}}>
          <strong style={{color:C.textPrimary}}>{rijen.length} lesgever{rijen.length!==1?'s':''}</strong> · {formatUren(somUren)} · <strong style={{color:C.green}}>{formatBedrag(somBedrag)}</strong>
        </div>
        <button onClick={exporteer} style={{padding:'9px 14px',background:C.green,border:'none',borderRadius:'8px',color:'white',cursor:'pointer',fontSize:'12px',fontWeight:'700'}}>📤 Excel exporteren</button>
      </div>
      {exportFout && <div style={{color:'var(--danger)',fontSize:'12px',marginBottom:'8px'}}>{exportFout}</div>}
      {/* overflowX:'auto' maakt deze div ook impliciet een Y-scrollcontainer (CSS-regel:
          als overflow-x niet 'visible' is, wordt overflow-y van 'visible' naar 'auto'
          omgezet) — zonder begrensde maxHeight groeit de div mee met de inhoud en
          'scrolt' hij intern nooit, waardoor position:sticky in de thead nooit zichtbaar
          vastklikt bij het scrollen van de pagina. Met maxHeight+overflowY:'auto' wordt
          deze div de echte scroll-viewport, en werkt sticky (top én left) wel correct. */}
      <div style={{overflowX:'auto',overflowY:'auto',maxHeight:'min(65vh,520px)',borderRadius:'10px',border:`1px solid ${C.border}`}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px',minWidth:'480px'}}>
          <thead>
            <tr style={{background:C.card}}>
              <th style={{...TH,padding:'10px 12px',textAlign:'left',left:0,zIndex:2,borderRight:`1px solid ${C.border}`}}>Lesgever</th>
              <th style={{...TH,textAlign:'right'}}>Uren</th>
              <th style={{...TH,textAlign:'right'}}>€/u</th>
              <th style={{...TH,textAlign:'right',color:C.green}}>Totaal €</th>
              <th style={{...TH,width:'44px',borderRight:`2px solid ${C.border}`}}><span style={{position:'absolute',width:'1px',height:'1px',overflow:'hidden'}}>Corrigeren</span></th>
              {data.datums.map(d=>(
                <th key={d} style={{...TH,textAlign:'center',minWidth:'96px',lineHeight:1.25}}>
                  <div style={{fontSize:'10px',fontWeight:'600',textTransform:'uppercase'}}>{formatDagnaam(d)}</div>
                  <div>{formatDagKort(d)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rijen.map((r,idx)=>{
              const bg = idx%2===0?C.bg:C.card;
              return (
                <tr key={r.id} style={{background:bg,cursor:'pointer',borderTop:`1px solid ${C.border}`}}
                    onClick={()=>openCorrectie(r.id)}
                    onKeyDown={e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openCorrectie(r.id); } }}
                    tabIndex={0} role="button" aria-label={`Aanwezigheid corrigeren voor ${r.naam}`}>
                  <td style={{padding:'12px',color:C.textPrimary,fontWeight:'600',position:'sticky',left:0,background:bg,borderRight:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>
                    <div>{r.naam}</div>
                    {r.typeLabel && <div style={{fontSize:'11px',fontWeight:'400',color:C.textMuted}}>{r.typeLabel}</div>}
                  </td>
                  <td style={{padding:'12px 8px',textAlign:'right',color:C.textPrimary,fontWeight:'700',whiteSpace:'nowrap'}}>{formatUren(r.uren)}</td>
                  <td style={{padding:'12px 8px',textAlign:'right',color:C.textMuted,whiteSpace:'nowrap'}}>{r.tarief>0?`€${r.tarief}`:'—'}</td>
                  <td style={{padding:'12px 8px',textAlign:'right',color:C.green,fontWeight:'700',whiteSpace:'nowrap'}}>
                    {r.bedrag!=null ? formatBedrag(r.bedrag)
                      : r.uren>0 ? <span title="Geen tarief ingesteld voor dit type — niet in het totaal" style={{color:C.orange,fontSize:'11px'}}>⚠ geen tarief</span>
                      : '—'}
                  </td>
                  <td style={{padding:'12px 6px',textAlign:'center',whiteSpace:'nowrap',borderRight:`2px solid ${C.border}`}}>
                    {recentGecorrigeerd[r.id] > 0 && (
                      <span title={`${recentGecorrigeerd[r.id]} training${recentGecorrigeerd[r.id]!==1?'en':''} net gecorrigeerd`}
                            style={{fontSize:'10px',fontWeight:'800',color:C.blue,background:C.blueDim,borderRadius:'999px',padding:'2px 6px',marginRight:'4px'}}>
                        ✓{recentGecorrigeerd[r.id]}
                      </span>
                    )}
                    <span aria-hidden="true" title="Aanwezigheid corrigeren" style={{color:C.textSec,fontWeight:'700'}}>✎</span>
                  </td>
                  {data.datums.map(d=>{
                    const cel = r.cellen[d];
                    const u = cel?.uren||0;
                    return (
                      <td key={d} style={{padding:'12px 8px',textAlign:'center',color:u>0?C.textPrimary:C.textMuted}}
                          title={cel ? `${cel.groepen.join(' + ')} · ${u}u` : undefined}>
                        {cel ? (
                          <div style={{display:'flex',flexDirection:'column',gap:'2px',lineHeight:1.2}}>
                            <span style={{fontSize:'11px',fontWeight:'700',whiteSpace:'nowrap',maxWidth:'90px',overflow:'hidden',textOverflow:'ellipsis'}}>
                              {cel.groepen.join(' + ')}
                            </span>
                            <span style={{fontSize:'10px',color:C.textMuted}}>{u}u</span>
                          </div>
                        ) : '·'}
                      </td>
                    );
                  })}
                </tr>
              );
            })}

            {/* Totaalrij */}
            <tr style={{background:C.card,borderTop:`2px solid ${C.border}`}}>
              <td style={{padding:'10px 12px',color:C.textPrimary,fontWeight:'800',position:'sticky',left:0,background:C.card,borderRight:`1px solid ${C.border}`}}>TOTAAL</td>
              <td style={{padding:'10px 8px',textAlign:'right',color:C.orange,fontWeight:'800',whiteSpace:'nowrap'}}>{formatUren(somUren)}</td>
              <td/>
              <td style={{padding:'10px 8px',textAlign:'right',color:C.green,fontWeight:'800',whiteSpace:'nowrap'}}>{formatBedrag(somBedrag)}</td>
              <td style={{borderRight:`2px solid ${C.border}`}}/>
              {data.datums.map(d=>{
                const tot=afrond2(rijen.reduce((s,r)=>s+(r.cellen[d]?.uren||0),0));
                return <td key={d} style={{padding:'10px 8px',textAlign:'center',color:C.orange,fontWeight:'700',fontSize:'11px'}}>{tot>0?`${tot}u`:''}</td>;
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {correctieVoor && lesgeversLijst.find(l=>l.id===correctieVoor) && (
        <AanwezigheidCorrectieModal
          open={correctieOpen}
          lesgever={lesgeversLijst.find(l=>l.id===correctieVoor)}
          periode={periode}
          groepenLijst={groepenLijst}
          tarieven={tarieven}
          onClose={()=>setCorrectieOpen(false)}
          onOpgeslagen={(aantal)=>{ laad(); setRecentGecorrigeerd(prev=>({...prev,[correctieVoor]:aantal})); }}
        />
      )}
    </div>
  );
}
