import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, addDoc, getDocs, query, where, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import { getMembers } from '../../services/firestoreService';
import { parseerMailTekst, fuzzyMatch } from '../../utils/mailParser';
import { berekenCategorie } from '../../utils/categorieLogica';
import { vindUniekLid, jaarUitGeboortedatum } from '../../utils/ledenKoppeling';
import { useAuth } from '../../contexts/AuthContext';
import { C } from './tokens';
import { btnStyle } from './SharedUI';

export default function MailImport({ events, onDone }) {
  const { configCache } = useAuth();
  const [tekst,       setTekst]       = useState('');
  const [preview,     setPreview]     = useState(null);
  const [importing,   setImporting]   = useState(false);
  const [result,      setResult]      = useState(null);
  const [manualNaam,  setManualNaam]  = useState('');
  const [formatError, setFormatError] = useState(false);
  const [showHelp,    setShowHelp]    = useState(false);
  const [leden,       setLeden]       = useState([]);

  useEffect(() => {
    getMembers()
      .then(lijst => setLeden(lijst.filter(m => m.actief !== false && m.active !== false)))
      .catch(console.error);
  }, []);

  // De mail betreft één judoka → zoek het bijhorende lid (uniek match).
  const judokaNaamHuidig = (manualNaam.trim() || preview?.naamJudoka || '').trim();
  const gekoppeldLid = useMemo(
    () => (judokaNaamHuidig ? vindUniekLid(judokaNaamHuidig, null, leden) : null),
    [judokaNaamHuidig, leden],
  );

  function handlePreview() {
    if (!tekst.trim()) return;
    setResult(null);
    setFormatError(false);
    const parsed = parseerMailTekst(tekst);
    if (!parsed.naamJudoka && parsed.inschrijvingen.length === 0) {
      setFormatError(true);
      return;
    }
    const metMatch = parsed.inschrijvingen.map(ins => {
      let tornooi = events.find(e=>e.datum===ins.datum&&fuzzyMatch(e.naam,ins.tornooiNaam));
      if (!tornooi) tornooi = events.find(e=>e.datum===ins.datum);
      if (!tornooi) tornooi = events.find(e=>fuzzyMatch(e.naam,ins.tornooiNaam));
      return {...ins, tornooi:tornooi||null, matched:!!tornooi};
    });
    setManualNaam('');
    setPreview({...parsed, inschrijvingen:metMatch});
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    const judokaNaam = manualNaam.trim() || preview.naamJudoka;
    // Koppel aan lid (uniek match); haal geboortejaar uit ledenbeheer indien gekend.
    const lid = vindUniekLid(judokaNaam, null, leden);
    const lidMemberId = lid ? lid.id : null;
    const lidGeboortejaar = lid ? jaarUitGeboortedatum(lid.geboortedatum) : null;
    let toegevoegd = 0, overgeslagen = 0, nietGekoppeld = 0, mislukt = 0;

    // Haal in één query alle bestaande inschrijvingen voor deze judoka op
    // → was voorheen 1 read per tornooi in de loop (N reads), nu 1 read totaal
    const bestaandeSnap = await getDocs(
      query(collection(db, 'inschrijvingen'), where('judokaNaam', '==', judokaNaam))
    );
    const bestaandeEventIds = new Set(bestaandeSnap.docs.map(d => d.data().eventId));

    for (const ins of preview.inschrijvingen) {
      if (!ins.ingeschreven) continue;
      if (!ins.tornooi) { nietGekoppeld++; continue; }
      if (bestaandeEventIds.has(ins.tornooi.id)) { overgeslagen++; continue; }
      try {
        const { cat } = berekenCategorie(lidGeboortejaar, ins.tornooi.datum, ins.tornooi.doelgroep, configCache?.categorieen);
        await addDoc(collection(db, 'inschrijvingen'), {
          eventId:      ins.tornooi.id,
          eventNaam:    ins.tornooi.naam,
          eventDatum:   ins.tornooi.datum,
          judokaNaam:   judokaNaam,
          geboortejaar: lidGeboortejaar,
          categorie:    cat,
          memberId:     lidMemberId,
          viaMailImport: true,
          addedAt:      serverTimestamp(),
        });
        toegevoegd++;
      } catch (e) { console.error('Import fout voor', ins.label, e); mislukt++; }
    }
    setResult({ toegevoegd, overgeslagen, nietGekoppeld, mislukt });
    setImporting(false);
    setPreview(null);
    setTekst('');
    onDone && onDone();
  }

  const ingeschrevenIns  = preview?.inschrijvingen.filter(i=>i.ingeschreven)||[];
  const nietIngeschreven = preview?.inschrijvingen.filter(i=>!i.ingeschreven)||[];
  const matchCount   = ingeschrevenIns.filter(i=>i.matched).length;
  const noMatchCount = ingeschrevenIns.filter(i=>!i.matched).length;

  return (
    <div style={{marginBottom:'20px'}}>
      {/* Header with help button */}
      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
        <span style={{fontWeight:'700',fontSize:'14px',color:C.text}}>📧 Mail importeren</span>
        <button
          onClick={()=>setShowHelp(s=>!s)}
          style={{width:'20px',height:'20px',borderRadius:'50%',border:`1px solid ${C.border}`,background:C.surface,color:C.textSec,fontSize:'11px',fontWeight:'700',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1,fontFamily:'inherit',flexShrink:0}}
        >?</button>
      </div>
      {showHelp&&(
        <div style={{marginBottom:'12px',padding:'12px 14px',borderRadius:'8px',background:C.surface,border:`1px solid ${C.border}`,fontSize:'12px',color:C.textSec,lineHeight:1.6}}>
          Plak de volledige tekst van de inschrijvingsbevestiging van Judo Vlaanderen.
          De tekst moet bevatten: naam judoka, tornooilijst met datums, en Ja/Nee per tornooi.
        </div>
      )}

      {!preview ? (
        <>
          <div style={{fontSize:'12px',color:C.textSec,marginBottom:'8px',fontWeight:'600'}}>Plak de volledige mail-tekst van de inschrijving hieronder:</div>
          <textarea value={tekst} onChange={e=>{setTekst(e.target.value);setFormatError(false);}}
            placeholder={`Voornaam en naam judokaAn Rut E-mailadresre.rut@gmail.comIppon Trophy Antwerpen (U15+) - 16 meiJaMansio cup Meise (U15+) - 22 maartGewicht (Enkel voor Kids Cup):Uitschrijven voor:`}
            style={{width:'100%',minHeight:'180px',background:C.surface,border:`1px solid ${C.border}`,borderRadius:'10px',color:C.text,padding:'12px 14px',fontSize:'13px',fontFamily:'monospace',resize:'vertical',outline:'none',boxSizing:'border-box'}} />
          {formatError&&(
            <div style={{marginTop:'8px',padding:'10px 14px',borderRadius:'8px',background:C.redDim,border:`1px solid ${C.redBord}`,fontSize:'13px',color:C.red}}>
              ⚠ Formaat niet herkend. Controleer of je de volledige inschrijvingsmail van Judo Vlaanderen hebt geplakt.
            </div>
          )}
          <button style={{...btnStyle('primary'),marginTop:'10px',width:'100%'}} onClick={handlePreview} disabled={!tekst.trim()}>🔍 Analyseren</button>
        </>
      ) : (
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:'10px',padding:'16px'}}>
          <div style={{marginBottom:'14px'}}>
            <div style={{fontSize:'11px',color:C.textSec,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'4px'}}>Judoka</div>
            {preview.naamJudoka ? (
              <div style={{fontSize:'16px',fontWeight:'700',color:C.text}}>{preview.naamJudoka}</div>
            ) : (
              <>
                <div style={{padding:'8px 12px',borderRadius:'8px',background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.3)',fontSize:'12px',color:C.orange,marginBottom:'8px'}}>
                  ⚠ Naam judoka niet gevonden — vul hieronder in:
                </div>
                <input
                  autoFocus
                  placeholder="Naam judoka"
                  value={manualNaam}
                  onChange={e=>setManualNaam(e.target.value)}
                  style={{width:'100%',background:C.card,border:`1px solid ${C.border}`,borderRadius:'8px',color:C.text,padding:'9px 12px',fontSize:'14px',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
                />
              </>
            )}
            {judokaNaamHuidig && (
              <div style={{marginTop:'6px',fontSize:'12px',color:gekoppeldLid?C.green:C.textMuted}}>
                {gekoppeldLid
                  ? `✓ Gekoppeld aan lid${jaarUitGeboortedatum(gekoppeldLid.geboortedatum)?` · °${jaarUitGeboortedatum(gekoppeldLid.geboortedatum)}`:''}`
                  : '○ Geen uniek lid gevonden — wordt als vrij veld opgeslagen'}
              </div>
            )}
          </div>
          <div style={{fontSize:'11px',color:C.textSec,textTransform:'uppercase',letterSpacing:'0.6px',marginBottom:'8px'}}>Ingeschreven voor ({ingeschrevenIns.length})</div>
          <div style={{display:'flex',flexDirection:'column',gap:'6px',marginBottom:'14px'}}>
            {ingeschrevenIns.length===0 ? (
              <div style={{fontSize:'13px',color:C.textMuted,padding:'8px 0'}}>Geen inschrijvingen gevonden.</div>
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
              <summary style={{fontSize:'12px',color:C.textMuted,cursor:'pointer',userSelect:'none'}}>
                {nietIngeschreven.length} tornooi{nietIngeschreven.length!==1?'s':''} niet aangeduid (toon)
              </summary>
              <div style={{display:'flex',flexDirection:'column',gap:'4px',marginTop:'8px'}}>
                {nietIngeschreven.map((ins,i)=>(
                  <div key={i} style={{fontSize:'12px',color:C.textMuted,padding:'4px 8px',background:C.card,borderRadius:'6px'}}>— {ins.label}</div>
                ))}
              </div>
            </details>
          )}
          <div style={{display:'flex',gap:'8px',marginBottom:'14px',flexWrap:'wrap'}}>
            <span style={{fontSize:'12px',color:C.green,background:'rgba(34,197,94,0.1)',padding:'4px 10px',borderRadius:'20px',border:'1px solid rgba(34,197,94,0.3)'}}>✓ {matchCount} gekoppeld</span>
            {noMatchCount>0&&<span style={{fontSize:'12px',color:C.red,background:C.redDim,padding:'4px 10px',borderRadius:'20px',border:`1px solid ${C.redBord}`}}>⚠ {noMatchCount} niet gevonden</span>}
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button style={{...btnStyle('primary'),flex:1}} onClick={handleImport} disabled={importing||matchCount===0||(!preview.naamJudoka&&!manualNaam.trim())}>
              {importing?'Importeren...':`✓ ${matchCount} inschrijving${matchCount!==1?'en':''} opslaan`}
            </button>
            <button style={btnStyle('ghost')} onClick={()=>{setPreview(null);setResult(null);}}>← Terug</button>
          </div>
        </div>
      )}
      {result&&(
        <div style={{marginTop:'10px',padding:'12px 14px',borderRadius:'8px',background:result.mislukt>0?'rgba(239,68,68,0.1)':'rgba(34,197,94,0.1)',border:`1px solid ${result.mislukt>0?'rgba(239,68,68,0.3)':'rgba(34,197,94,0.3)'}`,fontSize:'13px',color:result.mislukt>0?C.red:C.green}}>
          {result.mislukt>0?'⚠':'✓'} Import klaar — {result.toegevoegd} toegevoegd
          {result.overgeslagen>0&&`, ${result.overgeslagen} dubbel overgeslagen`}
          {result.nietGekoppeld>0&&`, ${result.nietGekoppeld} niet gekoppeld`}
          {result.mislukt>0&&`, ${result.mislukt} mislukt`}
        </div>
      )}
    </div>
  );
}
