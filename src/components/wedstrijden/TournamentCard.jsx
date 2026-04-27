import React, { useState } from 'react';
import { C, MONTHS_NL } from './tokens';
import { DoelgroepBadges, isSoonish, isUpcoming } from './SharedUI';

export default function TournamentCard({ event, isSelected, onClick, judokaCount }) {
  const [hov, setHov] = useState(false);
  const soon     = isSoonish(event.datum);
  const upcoming = isUpcoming(event.datum);
  const past     = !upcoming;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display:'flex',alignItems:'stretch',gap:0,width:'100%',
        background:isSelected||hov?C.cardHov:C.card,
        border:`1px solid ${isSelected?C.red:C.border}`,
        borderLeft:`3px solid ${isSelected?C.red:soon?C.amber:past?C.textMut:C.green}`,
        borderRadius:'10px',cursor:'pointer',textAlign:'left',
        transition:'all 0.15s',fontFamily:'inherit',outline:'none',
        opacity:past?0.65:1,WebkitTapHighlightColor:'transparent',overflow:'hidden',
      }}
    >
      <div style={{minWidth:'54px',padding:'12px 8px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',borderRight:`1px solid ${C.border}`,background:isSelected?C.redDim:'transparent'}}>
        <span style={{fontSize:'18px',fontWeight:'800',color:isSelected?C.red:C.text,lineHeight:1}}>
          {event.datum ? new Date(event.datum).getDate() : '—'}
        </span>
        <span style={{fontSize:'10px',color:C.textSec,textTransform:'uppercase',letterSpacing:'0.5px',marginTop:'2px'}}>
          {event.datum ? MONTHS_NL[new Date(event.datum).getMonth()] : ''}
        </span>
      </div>
      <div style={{flex:1,padding:'10px 12px',minWidth:0}}>
        <div style={{fontWeight:'700',fontSize:'13px',color:C.text,marginBottom:'4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {event.naam}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}>
          <DoelgroepBadges doelgroep={event.doelgroep} />
          {event.provincie && (
            <span style={{fontSize:'10px',color:C.textMut,background:C.surface,padding:'1px 6px',borderRadius:'4px',border:`1px solid ${C.border}`}}>
              {event.provincie}
            </span>
          )}
        </div>
      </div>
      {judokaCount > 0 && (
        <div style={{padding:'10px 14px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minWidth:'50px',background:C.redDim,borderLeft:`1px solid ${C.redBord}`}}>
          <span style={{fontSize:'18px',fontWeight:'800',color:C.red,lineHeight:1}}>{judokaCount}</span>
          <span style={{fontSize:'9px',color:C.red,textTransform:'uppercase',opacity:0.7}}>leden</span>
        </div>
      )}
    </button>
  );
}
