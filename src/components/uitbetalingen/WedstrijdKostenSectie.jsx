// ─── WedstrijdKostenSectie ─────────────────────────────────────────────────────
// Gecombineerde tabel per begeleider. Open-klikken toont detailrijen met inline edit.
import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc } from 'firebase/firestore';
import { db } from '../../firebase';
import { updateMetAudit } from '../../services/firestoreService';
import { Workbook } from 'exceljs';
import { C } from '../trainingen/tokens';
import { formatBedrag, formatDatumLeesbaar, vindLesgever, INPUT, SAVE_BTN } from './uitbetalingHelpers';

export default function WedstrijdKostenSectie({ periode, lesgeverId: myLesgeverId, isBeheerder, tarieven, lesgeversLijst }) {
  const [events, setEvents]       = useState([]);
  const [laden, setLaden]         = useState(true);
  const [openBegeleider, setOpen] = useState(null);
  // edit-state: { [eventId_naam]: { km, inkom } }
  const [edits, setEdits]         = useState({});
  const [saving, setSaving]       = useState({});
  const [saved, setSaved]         = useState({});   // { [key]: true } voor vinkje-feedback

  useEffect(()=>{
    if (!periode) return;
    setLaden(true);
    // getDocs i.p.v. onSnapshot: wedstrijdkosten hoeven niet live te updaten
    getDocs(collection(db,'events')).then(snap=>{
      setEvents(snap.docs.map(d=>({id:d.id,...d.data()})).filter(e=>
        e.type==='wedstrijd' && e.datum>=periode.van && e.datum<=periode.tot &&
        Array.isArray(e.begeleiders) && e.begeleiders.length>0
      ));
      setLaden(false);
    }).catch(()=>setLaden(false));
  },[periode]);

  const kmTarief = tarieven['kilometer']?.bedragPerKm || 0;

  // Bouw rijen — naam wordt live opgezocht via lesgeverId zodat een naamswijziging
  // in ledenbeheer/lesgevers meteen overal klopt (de naam in events.begeleiders[]
  // is enkel een snapshot van het moment van toevoegen en kan verouderd zijn).
  const rijen = [];
  for (const ev of events) {
    for (const b of (ev.begeleiders||[]).filter(x=>x.aanwezig!==false)) {
      if (!isBeheerder && b.lesgeverId !== myLesgeverId) continue;
      const naam = vindLesgever(b.lesgeverId, lesgeversLijst)?.naam || b.naam || '—';
      const groepKey = b.lesgeverId || naam;
      rijen.push({ eventId:ev.id, eventNaam:ev.naam||ev.datum, datum:ev.datum, naam, groepKey, lesgeverId:b.lesgeverId, km:parseFloat(b.km)||0, inkom:parseFloat(b.inkom)||0, _rawEvent:ev });
    }
  }

  if (laden) return <div style={{color:C.textMuted,fontSize:'13px',padding:'12px 0'}}>Wedstrijden laden…</div>;
  if (rijen.length===0) return <div style={{color:C.textMuted,fontSize:'13px',fontStyle:'italic',padding:'8px 0'}}>Geen wedstrijdkosten in deze periode.</div>;

  // Groepeer per begeleider (op lesgeverId, niet op naam — voorkomt opsplitsing bij naamswijziging)
  const perBeg = {};
  for (const r of rijen) {
    if (!perBeg[r.groepKey]) perBeg[r.groepKey]={naam:r.naam,groepKey:r.groepKey,km:0,kmBedrag:0,inkom:0,events:[]};
    perBeg[r.groepKey].km       += r.km;
    perBeg[r.groepKey].kmBedrag += r.km*kmTarief;
    perBeg[r.groepKey].inkom    += r.inkom;
    perBeg[r.groepKey].events.push(r);
  }
  const lijst = Object.values(perBeg).sort((a,b)=>(b.kmBedrag+b.inkom)-(a.kmBedrag+a.inkom));

  const totKm   = lijst.reduce((s,b)=>s+b.km,0);
  const totKmB  = lijst.reduce((s,b)=>s+b.kmBedrag,0);
  const totInk  = lijst.reduce((s,b)=>s+b.inkom,0);

  const exporteer = async () => {
    const header = ['Begeleider','Wedstrijd','Datum','Km','Km-vergoeding','Inkom','Totaal'];
    const rows = [header];
    for (const b of lijst) {
      for (const r of b.events) {
        const kmBedrag = r.km*kmTarief;
        rows.push([b.naam, r.eventNaam, formatDatumLeesbaar(r.datum), r.km, kmTarief>0?Math.round(kmBedrag*100)/100:'', r.inkom, Math.round((kmBedrag+r.inkom)*100)/100]);
      }
      rows.push([`TOTAAL ${b.naam}`, '', '', Math.round(b.km*100)/100, kmTarief>0?Math.round(b.kmBedrag*100)/100:'', Math.round(b.inkom*100)/100, Math.round((b.kmBedrag+b.inkom)*100)/100]);
    }
    rows.push(['TOTAAL', '', '', Math.round(totKm*100)/100, kmTarief>0?Math.round(totKmB*100)/100:'', Math.round(totInk*100)/100, Math.round((totKmB+totInk)*100)/100]);
    const wb = new Workbook();
    const ws = wb.addWorksheet('Wedstrijdkosten');
    ws.addRows(rows);
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `wedstrijdkosten_${(periode?.naam||'periode').replace(/\s/g,'_')}.xlsx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const editKey = (eventId, groepKey) => `${eventId}__${groepKey}`;

  function getEditVal(ek, veld, fallback) {
    return edits[ek]?.[veld] !== undefined ? edits[ek][veld] : String(fallback);
  }
  function setEditVal(ek, veld, val) {
    setEdits(prev=>({...prev,[ek]:{...prev[ek],[veld]:val}}));
  }

  async function slaOp(r) {
    const ek = editKey(r.eventId, r.groepKey);
    const nieuweKm    = parseFloat(getEditVal(ek,'km',r.km))   || 0;
    const nieuweInkom = parseFloat(getEditVal(ek,'inkom',r.inkom)) || 0;
    setSaving(prev=>({...prev,[ek]:true}));
    try {
      const ev = events.find(e=>e.id===r.eventId);
      if (!ev) return;
      const nieuweBegeleiders = (ev.begeleiders||[]).map(b=>{
        if (b.naam !== r.naam && b.lesgeverId !== r.lesgeverId) return b;
        return {...b, naam:r.naam, km:nieuweKm, inkom:nieuweInkom};
      });
      await updateMetAudit(doc(db,'events',r.eventId), { begeleiders:nieuweBegeleiders });
      // clear edit state
      setEdits(prev=>{ const n={...prev}; delete n[ek]; return n; });
      setSaved(prev=>({...prev,[ek]:true}));
      setTimeout(()=>setSaved(prev=>{ const n={...prev}; delete n[ek]; return n; }), 2000);
    } catch(e) { console.error(e); alert(`Opslaan mislukt: ${e.message}`); }
    finally { setSaving(prev=>{ const n={...prev}; delete n[ek]; return n; }); }
  }

  const thS={ padding:'8px 10px', textAlign:'left', color:C.textMuted, fontWeight:'700', fontSize:'11px', borderBottom:`1px solid ${C.border}`, whiteSpace:'nowrap' };
  const tdS=(right=false,extra={})=>({ padding:'8px 10px', color:C.textPrimary, fontSize:'12px', textAlign:right?'right':'left', borderBottom:`1px solid ${C.border}`, ...extra });

  return (
    <div style={{paddingTop:'12px'}}>
      <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'10px'}}>
        <button onClick={exporteer} style={{padding:'7px 14px',background:C.green,border:'none',borderRadius:'8px',color:'white',cursor:'pointer',fontSize:'12px',fontWeight:'700'}}>📤 Excel exporteren</button>
      </div>
      <div style={{overflowX:'auto',borderRadius:'10px',border:`1px solid ${C.border}`}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12px'}}>
          <thead>
            <tr style={{background:C.card}}>
              <th style={{...thS,position:'sticky',top:0,zIndex:1,background:C.card}}>Begeleider</th>
              <th style={{...thS,textAlign:'right',position:'sticky',top:0,zIndex:1,background:C.card}}>Km</th>
              <th style={{...thS,textAlign:'right',color:C.orange,position:'sticky',top:0,zIndex:1,background:C.card}}>Km-vergoeding</th>
              <th style={{...thS,textAlign:'right',color:C.blue,position:'sticky',top:0,zIndex:1,background:C.card}}>Inkom</th>
              <th style={{...thS,textAlign:'right',color:C.green,position:'sticky',top:0,zIndex:1,background:C.card}}>Totaal</th>
              <th style={{...thS,position:'sticky',top:0,zIndex:1,background:C.card}}></th>
            </tr>
          </thead>
          <tbody>
            {lijst.map((b,i)=>{
              const isOpen = openBegeleider===b.groepKey;
              return (
                <React.Fragment key={b.groepKey}>
                  {/* Samengevatte rij — klikbaar */}
                  <tr style={{background:isOpen?'rgba(255,255,255,0.06)':(i%2===0?C.bg:C.card), cursor:'pointer'}}
                      onClick={()=>setOpen(isOpen?null:b.groepKey)}>
                    <td style={{...tdS(),fontWeight:'700'}}>{b.naam}</td>
                    <td style={tdS(true)}>{b.km>0?`${Number(b.km).toFixed(2)} km`:'—'}</td>
                    <td style={{...tdS(true),color:C.orange,fontWeight:'600'}}>{b.kmBedrag>0?formatBedrag(b.kmBedrag):'—'}</td>
                    <td style={{...tdS(true),color:C.blue,fontWeight:'600'}}>{b.inkom>0?formatBedrag(b.inkom):'—'}</td>
                    <td style={{...tdS(true),color:C.green,fontWeight:'700'}}>{formatBedrag(b.kmBedrag+b.inkom)}</td>
                    <td style={{...tdS(),color:C.textMuted,fontSize:'11px',textAlign:'right'}}>{isOpen?'▲':'▼'}</td>
                  </tr>

                  {/* Detail per wedstrijd — inline bewerkbaar */}
                  {isOpen && b.events.map(r=>{
                    const ek = editKey(r.eventId, r.groepKey);
                    const isSaving = !!saving[ek];
                    const isSaved  = !!saved[ek];
                    const heeftEdit = !!edits[ek];
                    const kmVal    = getEditVal(ek,'km',r.km);
                    const inkomVal = getEditVal(ek,'inkom',r.inkom);
                    const kmNum    = parseFloat(kmVal)||0;
                    const inkNum   = parseFloat(inkomVal)||0;
                    const kmBedrag = kmNum*kmTarief;
                    const totaal   = kmBedrag+inkNum;
                    return (
                      <tr key={ek} style={{background:'rgba(255,255,255,0.03)',borderTop:`1px solid ${C.border}`}}>
                        {/* Wedstrijd naam + datum */}
                        <td style={{...tdS(),paddingLeft:'24px'}}>
                          <div style={{color:C.textSec,fontStyle:'italic',fontSize:'12px'}}>↳ {r.eventNaam}</div>
                          <div style={{color:C.textMuted,fontSize:'11px'}}>{formatDatumLeesbaar(r.datum)}</div>
                        </td>
                        {/* Km — bewerkbaar */}
                        <td style={tdS(true)}>
                          <div style={{display:'flex',alignItems:'center',gap:'4px',justifyContent:'flex-end'}}>
                            <input
                              type="number" min="0" step="1"
                              value={kmVal}
                              onChange={e=>setEditVal(ek,'km',e.target.value)}
                              style={{...INPUT}}
                            />
                            <span style={{fontSize:'11px',color:C.textMuted}}>km</span>
                          </div>
                        </td>
                        {/* Km-bedrag — berekend */}
                        <td style={{...tdS(true),color:C.orange}}>
                          {kmTarief>0 ? formatBedrag(kmBedrag) : '—'}
                        </td>
                        {/* Inkom — bewerkbaar */}
                        <td style={tdS(true)}>
                          <div style={{display:'flex',alignItems:'center',gap:'4px',justifyContent:'flex-end'}}>
                            <span style={{fontSize:'11px',color:C.textMuted}}>€</span>
                            <input
                              type="number" min="0" step="0.50"
                              value={inkomVal}
                              onChange={e=>setEditVal(ek,'inkom',e.target.value)}
                              style={{...INPUT}}
                            />
                          </div>
                        </td>
                        {/* Totaal */}
                        <td style={{...tdS(true),color:C.green,fontWeight:'600'}}>{formatBedrag(totaal)}</td>
                        {/* Opslaan */}
                        <td style={{...tdS(),minWidth:'90px'}}>
                          {isSaved ? (
                            <span style={{color:C.green,fontSize:'12px',fontWeight:'700'}}>✓ Opgeslagen</span>
                          ) : (
                            <div style={{display:'flex',gap:'4px',justifyContent:'flex-end'}}>
                              <button onClick={e=>{e.stopPropagation();slaOp(r);}} disabled={isSaving}
                                style={{...SAVE_BTN,opacity:isSaving?0.6:1}}>
                                {isSaving?'…':'Opslaan'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}

            {/* Totaalrij */}
            <tr style={{background:C.card,borderTop:`2px solid ${C.border}`}}>
              <td style={{...tdS(),fontWeight:'800',color:C.textPrimary}}>TOTAAL</td>
              <td style={{...tdS(true),fontWeight:'700',color:C.textPrimary}}>{Number(totKm).toFixed(2)} km</td>
              <td style={{...tdS(true),fontWeight:'800',color:C.orange}}>{formatBedrag(totKmB)}</td>
              <td style={{...tdS(true),fontWeight:'800',color:C.blue}}>{formatBedrag(totInk)}</td>
              <td style={{...tdS(true),fontWeight:'800',color:C.green}}>{formatBedrag(totKmB+totInk)}</td>
              <td style={tdS()}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
