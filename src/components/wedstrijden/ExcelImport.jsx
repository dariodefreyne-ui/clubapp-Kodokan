import React, { useState, useRef } from 'react';
import {
  collection, addDoc, getDocs, doc, writeBatch, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase';
import { C } from './tokens';
import { addKalenderTrigger } from '../../services/firestoreService';
import { huidigSeizoenStartJaar, seizoenBereikVanJaar } from '../trainingen/seizoenHelpers';

/**
 * Exporteert tornooien + inschrijvingen als één .xlsx met twee tabbladen.
 * @param {Array} events       - gefilterde events (of alle)
 * @param {Array} inschrijvingen - alle inschrijvingen van het seizoen
 * @param {string} seizoenLabel  - bv. "2025–2026"
 */
export async function exportWedstrijden(events, inschrijvingen, seizoenLabel = '') {
  const { Workbook } = await import('exceljs');
  const wb = new Workbook();

  // ── Tabblad 1: Tornooien ──
  const wsTornooien = wb.addWorksheet('Tornooien');
  wsTornooien.columns = [
    {width:12},{width:35},{width:18},{width:10},{width:10},{width:25},{width:35},
    {width:20},{width:8},{width:8},{width:14},{width:10},{width:30},{width:14},
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
  wsTornooien.addRows([
    ['Datum','Naam','Doelgroep','Startuur','Einduur','Locatie','Adres',
     'Club','Clubnr','Provincie','Max deelnemers','# Matten','Opmerking','# Inschrijvingen'],
    ...tornooiRows,
  ]);

  // ── Tabblad 2: Inschrijvingen ──
  const wsInschrijvingen = wb.addWorksheet('Inschrijvingen');
  wsInschrijvingen.columns = [
    {width:12},{width:35},{width:28},{width:12},{width:10},{width:10},
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
  wsInschrijvingen.addRows([
    ['Datum','Tornooi','Judoka','Geboortejaar','Categorie','Bevestigd'],
    ...insRows,
  ]);

  const bestandsnaam = seizoenLabel
    ? `wedstrijden_${seizoenLabel.replace('–', '-')}.xlsx`
    : 'wedstrijden_export.xlsx';
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = bestandsnaam;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function ExcelImport({ onDone }) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus]     = useState(null);
  // Laatste import-resultaat bijhouden voor kalender-trigger knop.
  const [importResult, setImportResult] = useState(null); // { toegevoegd, bijgewerkt, verwijderd }
  const [kalenderStatus, setKalenderStatus] = useState(null); // null | 'bezig' | 'ok' | 'fout'
  const fileRef = useRef();

  async function downloadTemplate() {
    const { Workbook } = await import('exceljs');
    const wb = new Workbook();
    const ws = wb.addWorksheet('Tornooien');
    ws.columns = [
      {width:12},{width:35},{width:18},{width:10},{width:10},
      {width:10},{width:10},{width:25},{width:35},{width:8},
      {width:20},{width:8},{width:30},
    ];
    ws.addRows([
      ['Datum','Naam','Doelgroep','Startuur','Einduur','# matten','Max # dln','Locatie','Adres','Clubnr','Club','Provincie','Opmerking'],
      ['21/03/2026','Mansio Cup','U11-U13','8:30','15:00','4','400','Sportschuur Wolvertem','Populierenlaan 20, 1861 Wolvertem','2138','JC Mansio','VBR','Voorbeeld opmerking'],
    ]);
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tornooien_template.xlsx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function processFile(file) {
    if (!file) return;
    setStatus('importing');
    try {
      const buf = await file.arrayBuffer();
      const { Workbook } = await import('exceljs');
      const wb = new Workbook();
      await wb.xlsx.load(buf);
      const ws = wb.worksheets[0];
      const rows = [];
      const colCount = ws.actualColumnCount;
      ws.eachRow({ includeEmpty: true }, (row) => {
        const rowArr = [];
        for (let c = 1; c <= colCount; c++) {
          const val = row.getCell(c).value;
          rowArr.push(val !== null && val !== undefined ? val : '');
        }
        rows.push(rowArr);
      });
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
      const toegevoegdLijst=[], bijgewerktLijst=[];
      for (const row of dataRows) {
        const rawDate=row[colDatum];
        let dateStr='';
        if (rawDate instanceof Date) dateStr=rawDate.toISOString().slice(0,10);
        else if (typeof rawDate==='string') dateStr=rawDate.slice(0,10);
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
        if (match) {
          batch.update(doc(db,'events',match.id),{...data,updatedAt:serverTimestamp()});
          updated++;
          bijgewerktLijst.push({ id: match.id, naam, datum: dateStr, doelgroep });
        } else {
          const newRef = doc(collection(db,'events'));
          batch.set(newRef,{...data,createdAt:serverTimestamp()});
          added++;
          toegevoegdLijst.push({ id: newRef.id, naam, datum: dateStr, doelgroep });
        }
      }
      await batch.commit();

      // Detecteer verwijderde tornooien: existing events van dit seizoen die
      // niet voorkomen in de geüploade Excel worden als verwijderd beschouwd.
      // Seizoensbereik: september van het huidig startjaar t/m juni van het volgende jaar.
      const nu = new Date();
      const seizoenStartJaar = nu.getMonth() >= 8 ? nu.getFullYear() : nu.getFullYear() - 1;
      const seizoenStart = `${seizoenStartJaar}-09-01`;
      const seizoenEinde = `${seizoenStartJaar + 1}-06-30`;

      const gematchteIds = new Set([
        ...bijgewerktLijst.map(e => e.id),
      ]);
      const verwijderdLijst = existing.filter(e => {
        if (!e.datum) return false;
        if (e.datum < seizoenStart || e.datum > seizoenEinde) return false; // buiten seizoen
        return !gematchteIds.has(e.id); // niet bijgewerkt = niet in Excel
      }).map(e => ({ id: e.id, naam: e.naam || '', datum: e.datum || '', doelgroep: e.doelgroep || '' }));

      setStatus({added, updated, verwijderd: verwijderdLijst.length, total: dataRows.length});
      setImportResult({ toegevoegd: toegevoegdLijst, bijgewerkt: bijgewerktLijst, verwijderd: verwijderdLijst });
      setKalenderStatus(null);
      onDone&&onDone();
    } catch(e) { console.error(e); setStatus({error:e.message||'Onbekende fout.'}); }
  }

  return (
    <div style={{marginBottom:'20px'}}>
      <div onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)}
        onDrop={e=>{e.preventDefault();setDragging(false);processFile(e.dataTransfer.files[0]);}}
        onClick={()=>fileRef.current?.click()}
        style={{border:`2px dashed ${dragging?C.red:C.border}`,borderRadius:'10px',padding:'18px',textAlign:'center',cursor:'pointer',background:dragging?C.redDim:C.surface,transition:'all 0.2s'}}>
        <input ref={fileRef} type="file" accept=".xlsx" style={{display:'none'}} onChange={e=>processFile(e.target.files[0])} />
        <div style={{fontSize:'24px',marginBottom:'6px'}}>📊</div>
        <div style={{fontSize:'13px',color:C.textSec,fontWeight:'600'}}>{status==='importing'?'⏳ Importeren...':'Sleep Excel-bestand hier of klik om te kiezen'}</div>
        <div style={{fontSize:'11px',color:C.textMuted,marginTop:'4px'}}>Judo Vlaanderen kalender (.xlsx)</div>
      </div>
      {status&&status!=='importing'&&(
        <div style={{marginTop:'10px',padding:'12px 14px',borderRadius:'8px',background:status.error?'rgba(230,57,70,0.1)':'rgba(34,197,94,0.1)',border:`1px solid ${status.error?C.red:C.green}`,fontSize:'13px',color:status.error?'var(--danger)':C.green}}>
          {status.error
            ? `❌ ${status.error}`
            : `✓ Import klaar — ${status.added} nieuw, ${status.updated} bijgewerkt${status.verwijderd > 0 ? `, ${status.verwijderd} niet meer in Excel` : ''} (van ${status.total} rijen)`
          }
        </div>
      )}
      {importResult && !status?.error && (
        <div style={{marginTop:'10px',padding:'12px 14px',borderRadius:'8px',background:'rgba(30,58,138,0.06)',border:'1px solid rgba(30,58,138,0.2)',fontSize:'13px'}}>
          <div style={{fontWeight:'600',color:'var(--text)',marginBottom:'6px'}}>📣 Leden verwittigen</div>
          <div style={{color:'var(--text-secondary)',fontSize:'12px',marginBottom:'8px'}}>
            Stuur een kalenderoverzicht naar alle leden met wedstrijden-voorkeur aan (push) en de vaste mailadressen uit Instellingen.
            Nieuw toegevoegde tornooien worden gemarkeerd met ✦, verwijderde doorgestreept.
          </div>
          <button
            onClick={async () => {
              setKalenderStatus('bezig');
              try {
                const startJaar = huidigSeizoenStartJaar();
                const bereik = seizoenBereikVanJaar(startJaar);
                await addKalenderTrigger({
                  seizoen: `${startJaar}-${startJaar + 1}`,
                  seizoenLabel: bereik.label,
                  toegevoegd: importResult.toegevoegd,
                  bijgewerkt: importResult.bijgewerkt,
                  verwijderd: importResult.verwijderd,
                });
                setKalenderStatus('ok');
              } catch(e) {
                console.error(e);
                setKalenderStatus('fout');
              }
            }}
            disabled={kalenderStatus === 'bezig' || kalenderStatus === 'ok'}
            style={{
              width:'100%', padding:'9px 12px', borderRadius:'7px', border:'none',
              background: kalenderStatus === 'ok' ? C.green : kalenderStatus === 'fout' ? C.red : 'var(--accent)',
              color:'#fff', fontWeight:'600', fontSize:'13px', cursor: kalenderStatus === 'ok' ? 'default' : 'pointer',
              fontFamily:'inherit', opacity: kalenderStatus === 'bezig' ? 0.7 : 1, transition:'all 0.2s',
            }}
          >
            {kalenderStatus === 'bezig' && '⏳ Bezig...'}
            {kalenderStatus === 'ok' && '✓ Melding verzonden!'}
            {kalenderStatus === 'fout' && '❌ Mislukt — probeer opnieuw'}
            {!kalenderStatus && (() => {
              const delen = [];
              if (importResult.toegevoegd.length > 0) delen.push(`${importResult.toegevoegd.length} nieuw`);
              if (importResult.verwijderd.length > 0) delen.push(`${importResult.verwijderd.length} verwijderd`);
              return `📣 Stuur kalenderoverzicht${delen.length > 0 ? ` (${delen.join(', ')})` : ''}`;
            })()}
          </button>
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
