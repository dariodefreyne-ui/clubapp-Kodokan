import React, { useState } from 'react';
import {
  collection, addDoc, getDocs, query, where, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { parseerMailTekst, fuzzyMatch } from '../../utils/mailParser';
import { berekenCategorie } from '../../utils/categorieLogica';
import { C } from './tokens';
import { btnStyle } from './SharedUI';

export default function MailImport({ events, onDone }) {
  const [tekst,     setTekst]     = useState('');
  const [preview,   setPreview]   = useState(null);
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState(null);

  function handlePreview() {
    if (!tekst.trim()) return;
    setResult(null);
    const parsed = parseerMailTekst(tekst);
    const metMatch = parsed.inschrijvingen.map(ins => {
      let tornooi = events.find(e=>e.datum===ins.datum&&fuzzyMatch(e.naam,ins.tornooiNaam));
      if (!tornooi) tornooi = events.find(e=>e.datum===ins.datum);
      if (!tornooi) tornooi = events.find(e=>fuzzyMatch(e.naam,ins.tornooiNaam));
      return {...ins, tornooi:tornooi||null, matched:!!tornooi};
    });
    setPreview({...parsed, inschrijvingen:metMatch});
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    let toegevoegd=0,overgeslagen=0,nietGekoppeld=0;
    for (const ins of preview.inschrijvingen) {
      if (!ins.ingeschreven) continue;
      if (!ins.tornooi) { nietGekoppeld++; continue; }
      try {
        const {cat} = berekenCategorie(null, ins.tornooi.datum, ins.tornooi.doelgroep);
        const bestaandSnap = await getDocs(query(collection(db,'inschrijvingen'),where('eventId','==',ins.tornooi.id),where('judokaNaam','==',preview.naamJudoka)));
        if (!bestaandSnap.empty) { overgeslagen++; continue; }
        await addDoc(collection(db,'inschrijvingen'), {
          eventId:      ins.tornooi.id,
          eventNaam:    ins.tornooi.naam,
          eventDatum:   ins.tornooi.datum,
          judokaNaam:   preview.naamJudoka,
          geboortejaar: null,
          categorie:    cat,
          viaMailImport:true,
          addedAt:      serverTimestamp(),
        });
        toegevoegd++;
      } catch(e) { console.error('Import fout voor',ins.label,e); }
    }
    setResult({toegevoegd,overgeslagen,nietGekoppeld});
    setImporting(false);
    setPreview(null);
    setTekst('');
    onDone&&onDone();
  }

  const ingeschrevenIns  = preview?.inschrijvingen.filter(i=>i.ingeschreven)||[];
  const nietIngeschreven = preview?.inschrijvingen.filter(i=>!i.ingeschreven)||[];
  const matchCount   = ingeschrevenIns.filter(i=>i.matched).length;
  const noMatchCount = ingeschrevenIns.filter(i=>!i.matched).length;

  return (
    <div style={{marginBottom:'20px'}}>
      {!preview ? (
        <>
          <div style={{fontSize:'12px',color:C.textSec,marginBottom:'8px',fontWeight:'600'}}>Plak de volledige mail-tekst van de inschrijving hieronder:</div>
          <textarea value={tekst} onChange={e=>setTekst(e.target.value)}
            placeholder={`Voornaam en naam judokaAn Rut E-mailadresre.rut@gmail.comIppon Trophy Antwerpen (U15+) - 16 meiJaMansio cup Meise (U15+) - 22 maartGewicht (Enkel voor Kids Cup):Uitschrijven voor:`}
            style={{width:'100%',minHeight:'180px',background:C.surface,border:`1px solid ${C.border}`,borderRadius:'10px',color:C.text,padding:'12px 14px',fontSize:'13px',fontFamily:'monospace',resize:'vertical',outline:'none',boxSizing:'border-box'}} />
          <button style={{...btnStyle('primary'),marginTop:'10px',width:'100%'}} onClick={handlePreview} disabled={!tekst.trim()}>🔍 Analyseren</button>
        </>
      ) : (
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'16px'}}>
          <div style={{marginBottom:'14px'}}>
            <div style={{fontSize:'11px',color:C.textSec,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'4px'}}>Judoka</div>
            <div style={{fontSize:'16px',fontWeight:'700',color:C.text}}>{preview.naamJudoka||'⚠ Naam niet gevonden'}</div>
          </div>
          <div style={{fontSize:'11px',color:C.textSec,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'8px'}}>Ingeschreven voor ({ingeschrevenIns.length})</div>
          <div style={{display:'flex',flexDirection:'column',gap:'6px',marginBottom:'14px'}}>
            {ingeschrevenIns.length===0 ? (
              <div style={{fontSize:'13px',color:C.textMut,padding:'8px 0'}}>Geen inschrijvingen gevonden.</div>
            ) : ingeschrevenIns.map((ins,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 12px',background:ins.matched?'rgba(34,197,94,0.08)':'rgba(230,57,70,0.08)',border:`1px solid ${ins.matched?'rgba(34,197,94,0.3)':C.redBord}`,borderRadius:'8px'}}>
                <span style={{fontSize:'16px'}}>{ins.matched?'✓':'⚠'}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'12px',color:C.textSec,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ins.label}</div>
                  {ins.tornooi
                    ? <div style={{fontSize:'13px',color:C.green,fontWeight:'600'}}>→ {ins.tornooi.naam} ({ins.datum})</div>
                    : <div style={{fontSize:'12px',color:C.red}}>Geen tornooi gevonden{ins.datum?` voor ${ins.datum}`:' (geen datum herkend)'}</div>}
                </div>
              </div>
            ))}
          </div>
          {nietIngeschreven.length>0&&(
            <details style={{marginBottom:'14px'}}>
              <summary style={{fontSize:'12px',color:C.textMut,cursor:'pointer',userSelect:'none'}}>
                {nietIngeschreven.length} tornooi{nietIngeschreven.length!==1?'s':''} niet aangeduid (toon)
              </summary>
              <div style={{display:'flex',flexDirection:'column',gap:'4px',marginTop:'8px'}}>
                {nietIngeschreven.map((ins,i)=>(
                  <div key={i} style={{fontSize:'12px',color:C.textMut,padding:'4px 8px',background:C.card,borderRadius:'6px'}}>— {ins.label}</div>
                ))}
              </div>
            </details>
          )}
          <div style={{display:'flex',gap:'8px',marginBottom:'14px',flexWrap:'wrap'}}>
            <span style={{fontSize:'12px',color:C.green,background:'rgba(34,197,94,0.1)',padding:'4px 10px',borderRadius:'20px',border:'1px solid rgba(34,197,94,0.3)'}}>✓ {matchCount} gekoppeld</span>
            {noMatchCount>0&&<span style={{fontSize:'12px',color:C.red,background:C.redDim,padding:'4px 10px',borderRadius:'20px',border:`1px solid ${C.redBord}`}}>⚠ {noMatchCount} niet gevonden</span>}
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button style={{...btnStyle('primary'),flex:1}} onClick={handleImport} disabled={importing||matchCount===0}>
              {importing?'Importeren...':`✓ ${matchCount} inschrijving${matchCount!==1?'en':''} opslaan`}
            </button>
            <button style={btnStyle('ghost')} onClick={()=>{setPreview(null);setResult(null);}}>← Terug</button>
          </div>
        </div>
      )}
      {result&&(
        <div style={{marginTop:'10px',padding:'12px 14px',borderRadius:'8px',background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.3)',fontSize:'13px',color:C.green}}>
          ✓ Import klaar — {result.toegevoegd} toegevoegd
          {result.overgeslagen>0&&`, ${result.overgeslagen} dubbel overgeslagen`}
          {result.nietGekoppeld>0&&`, ${result.nietGekoppeld} niet gekoppeld`}
        </div>
      )}
    </div>
  );
}
