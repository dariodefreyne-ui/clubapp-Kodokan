import React, { useState } from 'react';
import { C, CATEGORIE_COLORS } from './tokens';
import { formatDateShort, isUpcoming } from './SharedUI';

export default function JudokaOverviewPopup({ inschrijvingen, onClose }) {
  const [zoek, setZoek] = useState('');

  const byJudoka = {};
  for (const ins of inschrijvingen) {
    const naam = ins.judokaNaam || '—';
    if (!byJudoka[naam]) byJudoka[naam] = [];
    byJudoka[naam].push(ins);
  }

  const judokaNamen = Object.keys(byJudoka)
    .filter(n => !zoek || n.toLowerCase().includes(zoek.toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'nl'));

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:1000,
      background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center',
      padding:'20px',
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background:C.card, border:`1px solid ${C.border}`, borderRadius:'16px',
        width:'100%', maxWidth:'560px', maxHeight:'80vh',
        display:'flex', flexDirection:'column', overflow:'hidden',
        animation:'fadeIn 0.2s ease',
      }}>
        {/* Header */}
        <div style={{padding:'18px 20px 14px', borderBottom:`1px solid ${C.border}`, flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
            <div>
              <div style={{fontSize:'16px',fontWeight:'800',color:C.text}}>👥 Ingeschreven judoka's</div>
              <div style={{fontSize:'12px',color:C.textSec,marginTop:'2px'}}>
                {judokaNamen.length} judoka's · {inschrijvingen.length} inschrijvingen
              </div>
            </div>
            <button onClick={onClose} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:'8px',color:C.textSec,fontSize:'16px',cursor:'pointer',padding:'6px 10px',lineHeight:1,fontFamily:'inherit'}}>✕</button>
          </div>
          <input
            autoFocus
            placeholder="🔍 Zoek judoka..."
            value={zoek}
            onChange={e => setZoek(e.target.value)}
            style={{width:'100%',background:C.surface,border:`1px solid ${C.border}`,borderRadius:'8px',color:C.text,padding:'9px 12px',fontSize:'13px',fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
          />
        </div>

        {/* Lijst */}
        <div style={{flex:1,overflowY:'auto',padding:'12px 20px'}}>
          {judokaNamen.length === 0 ? (
            <div style={{color:C.textMut,textAlign:'center',padding:'32px',fontSize:'14px'}}>
              {zoek ? 'Geen judoka gevonden.' : 'Nog geen inschrijvingen.'}
            </div>
          ) : judokaNamen.map(naam => {
            const tornooien = byJudoka[naam].sort((a,b) => (a.eventDatum||'').localeCompare(b.eventDatum||''));
            return (
              <div key={naam} style={{marginBottom:'14px',paddingBottom:'14px',borderBottom:`1px solid ${C.border}`}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'8px'}}>
                  <span style={{
                    width:'32px',height:'32px',borderRadius:'50%',
                    background:C.redDim,border:`1px solid ${C.redBord}`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:'13px',fontWeight:'800',color:C.red,flexShrink:0,
                  }}>
                    {naam.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div style={{fontSize:'14px',fontWeight:'700',color:C.text}}>{naam}</div>
                    <div style={{fontSize:'11px',color:C.textMut}}>{tornooien.length} tornooi{tornooien.length!==1?'en':''}</div>
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'4px',paddingLeft:'42px'}}>
                  {tornooien.map((ins, i) => {
                    const cc = CATEGORIE_COLORS[ins.categorie] || {bg:C.surface,color:C.textSec,border:C.border};
                    const past = ins.eventDatum && !isUpcoming(ins.eventDatum);
                    return (
                      <div key={i} style={{
                        display:'flex',alignItems:'center',gap:'8px',
                        padding:'6px 10px',borderRadius:'8px',
                        background:C.surface,border:`1px solid ${C.border}`,
                        opacity: past ? 0.6 : 1,
                      }}>
                        <span style={{fontSize:'11px',color:C.textMut,minWidth:'52px',flexShrink:0}}>
                          {ins.eventDatum ? formatDateShort(ins.eventDatum) : '—'}
                        </span>
                        <span style={{fontSize:'13px',color:C.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {ins.eventNaam}
                        </span>
                        {ins.categorie && ins.categorie !== '—' && (
                          <span style={{background:cc.bg,color:cc.color,border:`1px solid ${cc.border}`,padding:'1px 7px',borderRadius:'999px',fontSize:'10px',fontWeight:'700',flexShrink:0}}>
                            {ins.categorie}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
