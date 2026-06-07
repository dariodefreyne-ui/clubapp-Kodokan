import React, { useState } from 'react';
import { C, MONTHS_NL } from './tokens';
import { DoelgroepBadges, isSoonish, isUpcoming, isToday } from './SharedUI';

export default function TournamentCard({ event, isSelected, onClick, judokaCount, ikBenIngeschreven }) {
  const [hov, setHov] = useState(false);
  const today    = isToday(event.datum);
  const soon     = isSoonish(event.datum);
  const upcoming = isUpcoming(event.datum);
  const past     = !upcoming;

  // Linkerbalk kleur: vandaag = amber, binnenkort = geel, komend = groen, voorbij = grijs
  const accentColor = isSelected ? C.red
    : today   ? C.orange
    : soon    ? '#f59e0b'
    : past    ? C.textMuted
    : C.green;

  return (
    <button
      onClick={onClick}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>setHov(false)}
      style={{
        display:'flex',alignItems:'stretch',gap:0,width:'100%',
        background: isSelected ? C.redDim : hov ? C.cardHover : C.card,
        border:`1px solid ${isSelected ? C.red : hov ? C.border : C.border}`,
        borderLeft:`3px solid ${accentColor}`,
        borderRadius:'10px',cursor:'pointer',textAlign:'left',
        transition:'all 0.12s',fontFamily:'inherit',outline:'none',
        opacity: past ? 0.6 : 1,
        WebkitTapHighlightColor:'transparent',overflow:'hidden',
      }}
    >
      {/* Datumkolom */}
      <div style={{
        minWidth:'50px',maxWidth:'50px',padding:'10px 6px',
        display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
        borderRight:`1px solid ${C.border}`,
        background: isSelected ? 'rgba(230,57,70,0.08)' : today ? 'rgba(245,158,11,0.08)' : 'transparent',
      }}>
        <span style={{fontSize:'17px',fontWeight:'800',color: isSelected ? C.red : today ? C.orange : C.text,lineHeight:1}}>
          {event.datum ? new Date(event.datum).getDate() : '—'}
        </span>
        <span style={{fontSize:'9px',color:C.textSec,textTransform:'uppercase',letterSpacing:'0.5px',marginTop:'2px'}}>
          {event.datum ? MONTHS_NL[new Date(event.datum).getMonth()] : ''}
        </span>
        {today && <span style={{fontSize:'8px',color:C.orange,fontWeight:'700',marginTop:'3px'}}>VANDAAG</span>}
      </div>

      {/* Info */}
      <div style={{flex:1,padding:'9px 11px',minWidth:0}}>
        <div style={{
          fontWeight:'700',fontSize:'13px',color: past ? C.textSec : C.text,
          marginBottom:'5px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
        }}>
          {event.naam}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'5px',flexWrap:'wrap'}}>
          <DoelgroepBadges doelgroep={event.doelgroep} />
          {event.provincie && (
            <span style={{fontSize:'10px',color:C.textMuted,background:C.surface,padding:'1px 5px',borderRadius:'4px',border:`1px solid ${C.border}`}}>
              {event.provincie}
            </span>
          )}
          {event.locatie && (
            <span style={{fontSize:'10px',color:C.textMuted,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100px'}}>
              📍 {event.locatie}
            </span>
          )}
        </div>
      </div>

      {/* Ingeschreven-badge voor lid */}
      {ikBenIngeschreven && (
        <div style={{
          padding:'8px 10px',display:'flex',flexDirection:'column',
          alignItems:'center',justifyContent:'center',minWidth:'46px',
          background:'rgba(34,197,94,0.12)',borderLeft:`1px solid rgba(34,197,94,0.4)`,
        }}>
          <span style={{fontSize:'14px',lineHeight:1}}>✓</span>
          <span style={{fontSize:'8px',color:'var(--success, #22c55e)',textTransform:'uppercase',letterSpacing:'0.3px',marginTop:'2px',fontWeight:'700'}}>ingeschr.</span>
        </div>
      )}

      {/* Judoka-teller — enkel als er inschrijvingen zijn en lid niet al een badge heeft */}
      {judokaCount > 0 && !ikBenIngeschreven && (
        <div style={{
          padding:'8px 12px',display:'flex',flexDirection:'column',
          alignItems:'center',justifyContent:'center',minWidth:'46px',
          background: C.redDim, borderLeft:`1px solid ${C.redBord}`,
        }}>
          <span style={{fontSize:'16px',fontWeight:'800',color:C.red,lineHeight:1}}>{judokaCount}</span>
          <span style={{fontSize:'8px',color:C.red,textTransform:'uppercase',opacity:0.7,letterSpacing:'0.3px'}}>leden</span>
        </div>
      )}
      {/* Teller naast ingeschreven-badge tonen */}
      {judokaCount > 0 && ikBenIngeschreven && (
        <div style={{
          padding:'4px 8px',display:'flex',flexDirection:'column',
          alignItems:'center',justifyContent:'center',minWidth:'36px',
          background: C.redDim, borderLeft:`1px solid ${C.redBord}`,
        }}>
          <span style={{fontSize:'13px',fontWeight:'800',color:C.red,lineHeight:1}}>{judokaCount}</span>
          <span style={{fontSize:'7px',color:C.red,textTransform:'uppercase',opacity:0.7}}>tot.</span>
        </div>
      )}
    </button>
  );
}
