import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  collection, addDoc, getDocs, doc, writeBatch, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import { C } from './tokens';

/**
 * Exporteert tornooien + inschrijvingen als één .xlsx met twee tabbladen.
 * @param {Array} events       - gefilterde events (of alle)
 * @param {Array} inschrijvingen - alle inschrijvingen van het seizoen
 * @param {string} seizoenLabel  - bv. "2025–2026"
 */
export function exportWedstrijden(events, inschrijvingen, seizoenLabel = '') {
  const wb = XLSX.utils.book_new();

  // ── Tabblad 1: Tornooien ──
  const tornooiHeaders = [
    'Datum','Naam','Doelgroep','Startuur','Einduur','Locatie','Adres',
    'Club','Clubnr','Provincie','Max deelnemers','# Matten','Opmerking',
    '# Inschrijvingen',
  ];
  const insByEvent = inschrijvingen.reduce((acc, i) => {
    if (!acc[i.eventId]) acc[i.eventId] = [];
    acc[i.eventId].push(i);
    return acc;
  }, {});
  const tornooiRows = events.map(e => [
    e.datum || '',
    e.naam || '',
    Array.isArray(e.doelgroepCodes) && e.doelgroepCodes.length > 0
      ? e.doelgroepCodes.join('-')
      : (e.doelgroep || ''),
    e.startuur || '',
    e.einduur || '',
    e.locatie || '',
    e.adres || '',
    e.club || '',
    e.clubnr || '',
    e.provincie || '',
    e.maxDln || '',
    e.aantalMatten || '',
    e.opmerking || '',
    (insByEvent[e.id] || []).length,
  ]);
  const wsTornooien = XLSX.utils.aoa_to_sheet([tornooiHeaders, ...tornooiRows]);
  wsTornooien['!cols'] = [
    {wch:12},{wch:35},{wch:18},{wch:10},{wch:10},{wch:25},{wch:35},
    {wch:20},{wch:8},{wch:8},{wch:14},{wch:10},{wch:30},{wch:14},
  ];
  XLSX.utils.book_append_sheet(wb, wsTornooien, 'Tornooien');

  // ── Tabblad 2: Inschrijvingen ──
  const insHeaders = [
    'Datum','Tornooi','Judoka','Geboortejaar','Categorie','Bevestigd',
  ];
  const eventById = events.reduce((acc, e) => { acc[e.id] = e; return acc; }, {});
  const insRows = [...inschrijvingen]
    .sort((a, b) => (a.eventDatum || '').localeCompare(b.eventDatum || '') || (a.judokaNaam || '').localeCompare(b.judokaNaam || ''))
    .map(i => [
      i.eventDatum || eventById[i.eventId]?.datum || '',
      i.eventNaam || eventById[i.eventId]?.naam || '',
      i.judokaNaam || '',
      i.geboortejaar || '',
      i.categorie || '',
      i.bevestigd ? 'Ja' : 'Nee',
    ]);
  const wsInschrijvingen = XLSX.utils.aoa_to_sheet([insHeaders, ...insRows]);
  wsInschrijvingen['!cols'] = [
    {wch:12},{wch:35},{wch:28},{wch:12},{wch:10},{wch:10},
  ];
  XLSX.utils.book_append_sheet(wb, wsInschrijvingen, 'Inschrijvingen');

  const bestandsnaam = seizoenLabel
    ? `wedstrijden_${seizoenLabel.replace('–', '-')}.xlsx`
    : 'wedstrijden_export.xlsx';
  XLSX.writeFile(wb, bestandsnaam);
}

export default function ExcelImport({ onDone }) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus]     = useState(null);
  const fileRef = useRef();

  function downloadTemplate() {
    const headers = ['Datum','Naam','Doelgroep','Startuur','Einduur',
                     '# matten','Max # dln','Locatie','Adres','Clubnr',
                     'Club','Provincie','Opmerking'];
    const example = ['21/03/2026','Mansio Cup','U11-U13','8:30','15:00',
                     '4','400','Sportschuur Wolvertem',
                     'Populierenlaan 20, 1861 Wolvertem','2138',
                     'JC Mansio','VBR','Voorbeeld opmerking'];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws['!cols'] = [
      {wch:12},{wch:35},{wch:18},{wch:10},{wch:10},
      {wch:10},{wch:10},{wch:25},{wch:35},{wch:8},
      {wch:20},{wch:8},{wch:30},
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tornooien');
    XLSX.writeFile(wb, 'tornooien_template.xlsx');
  }

  async function processFile(file) {
    if (!file) return;
    setStatus('importing');
    try {
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf,{type:'array',cellDates:true});
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws,{header:1});
      const headerRow = rows.findIndex(r=>r.some(c=>String(c).toLowerCase().includes('datum')));
      if (headerRow===-1) { setStatus({error:'Geen geldige header gevonden.'}); return; }
      const headers = rows[headerRow].map(h=>String(h||'').toLowerCase().trim());
      const idx = k=>headers.findIndex(h=>h.includes(k));
      const colDatum=idx('datum'),colNaam=idx('naam'),colDoel=idx('doelgroep'),colStart=idx('startuur'),
            colEind=idx('einduur'),colMatten=idx('matten'),colMax=idx('max'),colLocatie=idx('locatie'),
            colAdres=idx('adres'),colClubNr=idx('clubnr'),
            colClub=headers.findIndex((h,i)=>h==='club'&&i!==colClubNr),colProv=idx('provincie'),
            colOpmerking=idx('opmerking');
      const dataRows = rows.slice(headerRow+1).filter(r=>r[colDatum]&&r[colNaam]);
      const snap = await getDocs(collection(db,'events'));
      const existing = snap.docs.map(d=>({id:d.id,...d.data()})).filter(e=>e.type==='wedstrijd');
      const batch = writeBatch(db);
      let added=0,updated=0;
      for (const row of dataRows) {
        const rawDate=row[colDatum];
        let dateStr='';
        if (rawDate instanceof Date) dateStr=rawDate.toISOString().slice(0,10);
        else if (typeof rawDate==='string') dateStr=rawDate.slice(0,10);
        else if (typeof rawDate==='number') dateStr=new Date(Math.round((rawDate-25569)*86400*1000)).toISOString().slice(0,10);
        const naam=String(row[colNaam]||'').trim();
        const doelgroep=String(row[colDoel]||'').trim();
        if (!naam) continue;
        const data={
          type:'wedstrijd',datum:dateStr,naam,doelgroep,
          doelgroepCodes: doelgroep
            ? doelgroep.split(/[-\/]/).map(s=>s.trim()).filter(Boolean)
            : [],
          startuur:    colStart>=0?String(row[colStart]||''):'',
          einduur:     colEind>=0?String(row[colEind]||''):'',
          aantalMatten:colMatten>=0?String(row[colMatten]||''):'',
          maxDln:      colMax>=0?String(row[colMax]||''):'',
          locatie:     colLocatie>=0?String(row[colLocatie]||''):'',
          adres:       colAdres>=0?String(row[colAdres]||''):'',
          clubnr:      colClubNr>=0?String(row[colClubNr]||''):'',
          club:        colClub>=0?String(row[colClub]||''):'',
          provincie:   colProv>=0?String(row[colProv]||''):'',
          opmerking:   colOpmerking>=0?String(row[colOpmerking]||''):'',
        };
        const match=
          existing.find(e=>e.datum===dateStr&&e.naam?.trim().toLowerCase()===naam.toLowerCase()&&e.doelgroep?.trim().toLowerCase()===doelgroep.toLowerCase())||
          existing.find(e=>e.datum===dateStr&&e.naam?.trim().toLowerCase()===naam.toLowerCase())||
          existing.find(e=>e.naam?.trim().toLowerCase()===naam.toLowerCase()&&e.doelgroep?.trim().toLowerCase()===doelgroep.toLowerCase());
        if (match) { batch.update(doc(db,'events',match.id),{...data,updatedAt:serverTimestamp()}); updated++; }
        else { batch.set(doc(collection(db,'events')),{...data,createdAt:serverTimestamp()}); added++; }
      }
      await batch.commit();
      setStatus({added,updated,total:dataRows.length});
      onDone&&onDone();
    } catch(e) { console.error(e); setStatus({error:e.message||'Onbekende fout.'}); }
  }

  return (
    <div style={{marginBottom:'20px'}}>
      <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);processFile(e.dataTransfer.files[0]);}}
        onClick={()=>fileRef.current?.click()}
        style={{border:`2px dashed ${dragging?C.red:C.border}`,borderRadius:'10px',padding:'18px',textAlign:'center',cursor:'pointer',background:dragging?C.redDim:C.surface,transition:'all 0.2s'}}>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={e=>processFile(e.target.files[0])} />
        <div style={{fontSize:'24px',marginBottom:'6px'}}>📊</div>
        <div style={{fontSize:'13px',color:C.textSec,fontWeight:'600'}}>{status==='importing'?'⏳ Importeren...':'Sleep Excel-bestand hier of klik om te kiezen'}</div>
        <div style={{fontSize:'11px',color:C.textMut,marginTop:'4px'}}>Judo Vlaanderen kalender (.xlsx)</div>
      </div>
      {status&&status!=='importing'&&(
        <div style={{marginTop:'10px',padding:'12px 14px',borderRadius:'8px',background:status.error?'rgba(230,57,70,0.1)':'rgba(34,197,94,0.1)',border:`1px solid ${status.error?C.red:C.green}`,fontSize:'13px',color:status.error?'var(--danger)':C.green}}>
          {status.error?`❌ ${status.error}`:`✓ Import klaar — ${status.added} nieuw, ${status.updated} bijgewerkt (van ${status.total} rijen)`}
        </div>
      )}
      <button
        onClick={downloadTemplate}
        style={{
          marginTop:'8px', width:'100%', background:'none',
          border:`1px solid ${C.border}`, borderRadius:'8px',
          color:C.textSec, padding:'8px', cursor:'pointer',
          fontFamily:'inherit', fontSize:'12px',
        }}
      >
        📥 Download leeg template (.xlsx)
      </button>
    </div>
  );
}
