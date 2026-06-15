// ─── UitbetalingsMatrix (trainingen) ──────────────────────────────────────────
// Matrix per lesgever × datum. Klik op rij → toont trainingen in periode voor
// die lesgever, met inline toggle van aanwezigheid.
import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, getDocs, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { setMetAudit } from '../../services/firestoreService';
import { bepaalTrainingStatus, TRAINING_STATUS } from '../trainingen/trainingStatus';
import { Workbook } from 'exceljs';
import { C } from '../trainingen/tokens';
import {
  minutenNaarUren, formatUren, formatBedrag, formatDatumLeesbaar, normNaam, vindLesgever, SAVE_BTN,
} from './uitbetalingHelpers';

export default function UitbetalingsMatrix({ periode, lesgeversLijst, tarieven, tarieftypes, filterLesgeverId }) {
  const [data, setData]         = useState(null);   // { datums, lesgevers: {id:{datum:uren}}, trainingen: Training[] }
  const [laden, setLaden]       = useState(false);
  const [fout, setFout]         = useState('');
  const [openLesgever, setOpenL]= useState(null);   // lesgeverId van openstaande rij
  const [saving, setSaving]     = useState({});     // { trainingId: bool }
  const [saved, setSaved]       = useState({});     // { trainingId: bool }
  // localLesgevers: { trainingId: lesgeversArray } — lokale kopie voor direct tonen
  const [localLsg, setLocalLsg] = useState({});

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
      const groepenSnap = await getDocs(collection(db,'groepen'));
      const groepenMap = {};
      groepenSnap.docs.forEach(d=>{ groepenMap[d.id]=d.data(); });

      // Enkel NORMAAL: een samengevoegde groep heeft de training niet gegeven.
      // Een lesgever ingevuld bij een samengevoegde groep wordt niet uitbetaald.
      const trainingen = snap.docs.map(d=>({
        id:d.id,...d.data(),
        _uren: minutenNaarUren(d.data().duurMinuten || groepenMap[d.data().groepId]?.duurMinuten || 60),
        _groepNaam: groepenMap[d.data().groepId]?.naam || '',
      })).filter(t => {
        const status = bepaalTrainingStatus(t, { volgtProvincialeKalender: !!groepenMap[t.groepId]?.volgtProvincialeKalender });
        return status === TRAINING_STATUS.NORMAAL && (t.lesgevers||[]).length > 0;
      });

      if (trainingen.length===0) { setData({datums:[],lesgevers:{},trainingen:[]}); return; }

      const datums = [...new Set(trainingen.map(t=>t.datum))].sort();
      const matrix = {};
      for (const t of trainingen) {
        for (const rawKey of (t.lesgevers||[])) {
          const id = lesgeversMap.get(rawKey)?.id || lesgeversMap.get(normNaam(rawKey))?.id || rawKey;
          if (!matrix[id]) matrix[id]={};
          matrix[id][t.datum] = (matrix[id][t.datum]||0) + t._uren;
        }
      }
      const gefilterd = filterLesgeverId
        ? Object.fromEntries(Object.entries(matrix).filter(([id])=>id===filterLesgeverId))
        : matrix;

      // init localLsg met huidige lesgevers per training
      const initLocal = {};
      trainingen.forEach(t=>{ initLocal[t.id]=[...(t.lesgevers||[])]; });
      setLocalLsg(initLocal);
      setData({datums, lesgevers:gefilterd, trainingen});
    } catch(e) { setFout('Laden mislukt: '+e.message); }
    finally { setLaden(false); }
  }, [periode]);

  useEffect(()=>{ laad(); },[laad]);

  // Toggle aanwezigheid van een lesgever in een training (lokaal)
  function toggleAanwezig(trainingId, lesgeverId) {
    setLocalLsg(prev=>{
      const huidig = prev[trainingId] || [];
      const zitErin = huidig.includes(lesgeverId);
      return {...prev, [trainingId]: zitErin ? huidig.filter(x=>x!==lesgeverId) : [...huidig, lesgeverId]};
    });
  }

  async function slaTrainingOp(training) {
    const tId = training.id;
    setSaving(prev=>({...prev,[tId]:true}));
    try {
      const nieuweLesgevers = localLsg[tId] || [];
      await setMetAudit(doc(db,'trainingen',tId), { lesgevers: nieuweLesgevers }, { merge:true });
      setSaved(prev=>({...prev,[tId]:true}));
      setTimeout(()=>setSaved(prev=>{ const n={...prev}; delete n[tId]; return n; }), 2500);
      // Herbereken matrix lokaal
      setData(prev=>{
        if (!prev) return prev;
        // rebuild volledig
        const matrix = {};
        const bijgewerkte = prev.trainingen.map(t=>t.id===tId?{...t,lesgevers:nieuweLesgevers}:t);
        for (const t of bijgewerkte) {
          for (const rawKey of (t.lesgevers||[])) {
            const id = lesgeversMap.get(rawKey)?.id || lesgeversMap.get(normNaam(rawKey))?.id || rawKey;
            if (!matrix[id]) matrix[id]={};
            matrix[id][t.datum] = (matrix[id][t.datum]||0) + t._uren;
          }
        }
        const gefilterd = filterLesgeverId
          ? Object.fromEntries(Object.entries(matrix).filter(([id])=>id===filterLesgeverId))
          : matrix;
        return {...prev, lesgevers:gefilterd, trainingen:bijgewerkte};
      });
    } catch(e) { console.error(e); }
    finally { setSaving(prev=>{ const n={...prev}; delete n[tId]; return n; }); }
  }

  const exporteerMatrix = async ()=>{
    if (!data) return;
    const sorted = Object.keys(data.lesgevers).sort((a,b)=>
      (lesgeversLijst.find(l=>l.id===a)?.naam??a).localeCompare(lesgeversLijst.find(l=>l.id===b)?.naam??b));
    const header = ['Lesgever','Type',
      ...data.datums.map(d=>new Date(d+'T00:00:00').toLocaleDateString('nl-BE',{day:'numeric',month:'short'})),
      'Uren','€/u','Totaal €'];
    const rows = [header];
    for (const id of sorted) {
      const info     = lesgeversLijst.find(l=>l.id===id);
      const naam     = info?.naam??id;
      const typeId   = info?.type||'';
      const typeLabel= tarieftypes.find(t=>t.id===typeId)?.label||'';
      const tarief   = tarieven[typeId]?.bedragPerUur||0;
      let totU=0;
      const dagCellen = data.datums.map(d=>{ const u=data.lesgevers[id]?.[d]||0; totU+=u; return u||''; });
      rows.push([naam, typeLabel, ...dagCellen, totU, tarief||'', tarief>0?Math.round(totU*tarief*100)/100:'']);
    }
    const wb = new Workbook();
    const ws = wb.addWorksheet('Uitbetaling');
    ws.addRows(rows);
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `uitbetaling_${periode.naam.replace(/\s/g,'_')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!periode) return null;
  if (laden) return <div style={{color:C.textMuted,padding:'20px'}}>Laden…</div>;
  if (fout)  return <div style={{color:'var(--danger)',padding:'20px'}}>{fout}</div>;
  if (!data) return null;
  if (data.datums.length===0) return <div style={{color:C.textMuted,fontSize:'14px',padding:'12px 0',fontStyle:'italic'}}>Geen trainingen met lesgevers in deze periode.</div>;

  const gesorteerd = Object.keys(data.lesgevers).sort((a,b)=>
    (lesgeversLijst.find(l=>l.id===a)?.naam??a).localeCompare(lesgeversLijst.find(l=>l.id===b)?.naam??b));
  const totaalBedrag = gesorteerd.reduce((sum,id)=>{
    const tarief=tarieven[lesgeversLijst.find(l=>l.id===id)?.type||'']?.bedragPerUur||0;
    return sum+data.datums.reduce((s,d)=>s+(data.lesgevers[id][d]||0),0)*tarief;
  },0);

  return (
    <div style={{paddingTop:'12px'}}>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'10px'}}>
        <button onClick={exporteerMatrix} style={{padding:'7px 14px',background:C.green,border:'none',borderRadius:'8px',color:'white',cursor:'pointer',fontSize:'12px',fontWeight:'700'}}>📤 Excel exporteren</button>
      </div>
      <div style={{overflowX:'auto',borderRadius:'10px',border:`1px solid ${C.border}`}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px',minWidth:'600px'}}>
          <thead>
            <tr style={{background:C.card}}>
              <th style={{padding:'10px 12px',textAlign:'left',color:C.textMuted,fontWeight:'700',position:'sticky',left:0,background:C.card,borderRight:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>Lesgever</th>
              <th style={{padding:'10px 8px',textAlign:'left',color:C.textMuted,fontWeight:'700',whiteSpace:'nowrap'}}>Type</th>
              {data.datums.map(d=>(
                <th key={d} style={{padding:'10px 8px',textAlign:'center',color:C.textMuted,fontWeight:'700',whiteSpace:'nowrap',minWidth:'72px'}}>
                  {new Date(d+'T00:00:00').toLocaleDateString('nl-BE',{day:'numeric',month:'short'})}
                </th>
              ))}
              <th style={{padding:'10px 8px',textAlign:'right',color:C.textMuted,fontWeight:'700',whiteSpace:'nowrap',borderLeft:`1px solid ${C.border}`}}>Uren</th>
              <th style={{padding:'10px 8px',textAlign:'right',color:C.textMuted,fontWeight:'700',whiteSpace:'nowrap'}}>€/u</th>
              <th style={{padding:'10px 8px',textAlign:'right',color:C.green,fontWeight:'700',whiteSpace:'nowrap'}}>Totaal €</th>
              <th style={{padding:'10px 8px',width:'28px'}}></th>
            </tr>
          </thead>
          <tbody>
            {gesorteerd.map((id,idx)=>{
              const info     = lesgeversLijst.find(l=>l.id===id);
              const naam     = info?.naam??id;
              const typeId   = info?.type||'';
              const typeLabel= tarieftypes.find(t=>t.id===typeId)?.label||'—';
              const tarief   = tarieven[typeId]?.bedragPerUur||0;
              const isOpen   = openLesgever===id;
              let totU=0;

              // Trainingen voor deze lesgever in de periode
              const mijnTrainingen = (data.trainingen||[]).filter(t=>{
                const lsgIds = (localLsg[t.id]||[]).map(rawKey=>vindLesgever(rawKey,lesgeversLijst)?.id||rawKey);
                return lsgIds.includes(id) || (t.lesgevers||[]).map(k=>vindLesgever(k,lesgeversLijst)?.id||k).includes(id);
              });

              return (
                <React.Fragment key={id}>
                  {/* Samengevatte matrix-rij — klikbaar */}
                  <tr style={{background:isOpen?'rgba(255,255,255,0.06)':(idx%2===0?C.bg:C.card),cursor:'pointer',borderTop:`1px solid ${C.border}`}}
                      onClick={()=>setOpenL(isOpen?null:id)}>
                    <td style={{padding:'10px 12px',color:C.textPrimary,fontWeight:'600',position:'sticky',left:0,background:isOpen?'rgba(40,40,50,0.98)':(idx%2===0?C.bg:C.card),borderRight:`1px solid ${C.border}`,whiteSpace:'nowrap'}}>{naam}</td>
                    <td style={{padding:'10px 8px',color:C.textMuted,fontSize:'11px'}}>{typeLabel}</td>
                    {data.datums.map(d=>{ const u=data.lesgevers[id]?.[d]||0; totU+=u; return (
                      <td key={d} style={{padding:'10px 8px',textAlign:'center',color:u>0?C.textPrimary:C.textMuted}}>{u>0?`${u}u`:'·'}</td>
                    ); })}
                    <td style={{padding:'10px 8px',textAlign:'right',color:C.textPrimary,fontWeight:'700',borderLeft:`1px solid ${C.border}`}}>{formatUren(totU)}</td>
                    <td style={{padding:'10px 8px',textAlign:'right',color:C.textMuted}}>{tarief>0?`€${tarief}`:'—'}</td>
                    <td style={{padding:'10px 8px',textAlign:'right',color:C.green,fontWeight:'700'}}>{tarief>0?formatBedrag(totU*tarief):'—'}</td>
                    <td style={{padding:'10px 8px',textAlign:'right',color:C.textMuted,fontSize:'11px'}}>{isOpen?'▲':'▼'}</td>
                  </tr>

                  {/* Detail-rijen: trainingen van deze lesgever */}
                  {isOpen && (
                    <tr style={{borderTop:`1px solid ${C.border}`}}>
                      <td colSpan={data.datums.length+5} style={{padding:0}}>
                        <div style={{background:'rgba(255,255,255,0.03)',padding:'12px 16px 16px 40px'}}>
                          <div style={{fontSize:'11px',fontWeight:'700',color:C.textMuted,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'10px'}}>
                            Trainingen in periode — aanwezigheid aanpassen
                          </div>
                          {/* Trainingen: aanwezige eerst, afwezige dimmed eronder */}
                          {(data.trainingen||[]).length===0
                            ? <div style={{color:C.textMuted,fontSize:'13px'}}>Geen trainingen.</div>
                            : (() => {
                                const gesorteerdeTrainingen = [...(data.trainingen||[])].sort((a,b) => {
                                  const aAanw = (localLsg[a.id]||[]).map(k=>vindLesgever(k,lesgeversLijst)?.id||k).includes(id);
                                  const bAanw = (localLsg[b.id]||[]).map(k=>vindLesgever(k,lesgeversLijst)?.id||k).includes(id);
                                  if (aAanw !== bAanw) return aAanw ? -1 : 1;
                                  return a.datum.localeCompare(b.datum);
                                });
                                const aantalAanwezig = gesorteerdeTrainingen.filter(t =>
                                  (localLsg[t.id]||[]).map(k=>vindLesgever(k,lesgeversLijst)?.id||k).includes(id)
                                ).length;
                                return (<>
                                  {gesorteerdeTrainingen.map(t=>{
                                    const lsgList = localLsg[t.id] || [];
                                    const lsgIds  = lsgList.map(k=>vindLesgever(k,lesgeversLijst)?.id||k);
                                    const isAanwezig = lsgIds.includes(id);
                                    const isSavingT  = !!saving[t.id];
                                    const isSavedT   = !!saved[t.id];
                                    return (
                                      <div key={t.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 12px',background:isAanwezig?'rgba(34,197,94,0.08)':C.card,border:`1px solid ${isAanwezig?'rgba(34,197,94,0.25)':C.border}`,borderRadius:'8px',marginBottom:'6px',opacity:isAanwezig?1:0.45}}>
                                        <input type="checkbox" checked={isAanwezig}
                                          onChange={()=>toggleAanwezig(t.id,id)}
                                          style={{accentColor:C.green,width:'16px',height:'16px',cursor:'pointer',flexShrink:0}}
                                        />
                                        <div style={{flex:1,minWidth:0}}>
                                          <div style={{fontSize:'13px',fontWeight:isAanwezig?'600':'400',color:C.textPrimary}}>{formatDatumLeesbaar(t.datum)}</div>
                                          {t._groepNaam && <div style={{fontSize:'11px',color:C.textMuted}}>{t._groepNaam}</div>}
                                        </div>
                                        <span style={{fontSize:'12px',color:C.textSec,flexShrink:0}}>{formatUren(t._uren)}</span>
                                        {tarief>0 && isAanwezig && (
                                          <span style={{fontSize:'12px',color:C.green,fontWeight:'700',flexShrink:0}}>{formatBedrag(t._uren*tarief)}</span>
                                        )}
                                        {isSavedT ? (
                                          <span style={{fontSize:'11px',color:C.green,fontWeight:'700',flexShrink:0}}>✓</span>
                                        ) : (
                                          <button onClick={()=>slaTrainingOp(t)} disabled={isSavingT}
                                            style={{...SAVE_BTN,flexShrink:0,opacity:isSavingT?0.6:1}}>
                                            {isSavingT?'…':'Opslaan'}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                  <div style={{marginTop:'10px',fontSize:'12px',color:C.textMuted,fontStyle:'italic'}}>
                                    {aantalAanwezig} van {gesorteerdeTrainingen.length} training{gesorteerdeTrainingen.length!==1?'en':''} aanwezig
                                  </div>
                                </>);
                              })()
                          }
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {/* Totaalrij */}
            <tr style={{background:C.card,borderTop:`2px solid ${C.border}`}}>
              <td style={{padding:'10px 12px',color:C.textPrimary,fontWeight:'800',position:'sticky',left:0,background:C.card,borderRight:`1px solid ${C.border}`}}>TOTAAL</td>
              <td/>
              {data.datums.map(d=>{
                const tot=gesorteerd.reduce((s,id)=>s+(data.lesgevers[id]?.[d]||0),0);
                return <td key={d} style={{padding:'10px 8px',textAlign:'center',color:C.orange,fontWeight:'700',fontSize:'11px'}}>{tot>0?`${Math.round(tot*100)/100}u`:''}</td>;
              })}
              <td style={{padding:'10px 8px',textAlign:'right',color:C.orange,fontWeight:'800',borderLeft:`1px solid ${C.border}`}}>
                {formatUren(gesorteerd.reduce((s,id)=>s+data.datums.reduce((ss,d)=>ss+(data.lesgevers[id]?.[d]||0),0),0))}
              </td>
              <td/>
              <td style={{padding:'10px 8px',textAlign:'right',color:C.green,fontWeight:'800'}}>{formatBedrag(totaalBedrag)}</td>
              <td/>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
