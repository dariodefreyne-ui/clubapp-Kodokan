import React, { useState } from 'react';
import { C, CATEGORIE_COLORS } from './tokens';

export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('nl-BE', {weekday:'short',day:'numeric',month:'short',year:'numeric'});
}
export function formatDateShort(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('nl-BE', {day:'numeric',month:'short'});
}
export function isUpcoming(d) { return d && new Date(d) >= new Date(new Date().setHours(0,0,0,0)); }
export function isSoonish(d) {
  if (!d) return false;
  const diff = new Date(d) - new Date();
  return diff > 0 && diff < 1000*60*60*24*14;
}
export function isToday(d) {
  if (!d) return false;
  const t = new Date(); const ev = new Date(d);
  return ev.getFullYear()===t.getFullYear() && ev.getMonth()===t.getMonth() && ev.getDate()===t.getDate();
}

export function Badge({ label, style={} }) {
  return <span style={{display:'inline-block',padding:'2px 9px',borderRadius:'999px',fontSize:'11px',fontWeight:'700',letterSpacing:'0.4px',...style}}>{label}</span>;
}
export function DoelgroepBadges({ doelgroep }) {
  if (!doelgroep) return null;
  const unique = [...new Set(doelgroep.split(/[-\/]/).map(s=>s.trim()).filter(Boolean))];
  return (
    <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
      {unique.map(cat => {
        const c = CATEGORIE_COLORS[cat] || {bg:C.card,color:C.textSec,border:C.border};
        return <Badge key={cat} label={cat} style={{background:c.bg,color:c.color,border:`1px solid ${c.border}`}} />;
      })}
    </div>
  );
}
export function btnStyle(v='primary') {
  const base = {border:'none',borderRadius:'8px',cursor:'pointer',fontSize:'13px',fontWeight:'600',padding:'10px 16px',fontFamily:'inherit',transition:'background 0.15s'};
  if (v==='primary') return {...base,background:C.red,color:'#fff'};
  if (v==='danger')  return {...base,background:'#e74c3c',color:'#fff'};
  if (v==='ghost')   return {...base,background:C.surface,border:`1px solid ${C.border}`,color:C.textSec};
  return base;
}
export function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'9px 0',borderBottom:`1px solid ${C.border}`,gap:'12px'}}>
      <span style={{fontSize:'12px',color:C.textSec,flexShrink:0,paddingTop:'2px'}}>{label}</span>
      <span style={{fontSize:'14px',color:C.text,textAlign:'right'}}>{value}</span>
    </div>
  );
}
export function Field({ label, children }) {
  return (
    <div>
      <label style={{fontSize:'11px',color:C.textSec,textTransform:'uppercase',letterSpacing:'0.6px',display:'block',marginBottom:'5px',fontWeight:'600'}}>{label}</label>
      {children}
    </div>
  );
}

/**
 * Section met optionele collapse.
 * defaultOpen=false → staat standaard toegeklapt (voor voorbije tornooien).
 */
export function Section({ label, children, muted=false, collapsible=false, defaultOpen=true, count }) {
  const [open, setOpen] = useState(defaultOpen);

  const header = (
    <div
      onClick={collapsible ? ()=>setOpen(o=>!o) : undefined}
      style={{
        display:'flex',alignItems:'center',gap:'10px',marginBottom: open ? '10px' : 0,
        cursor: collapsible ? 'pointer' : 'default',
        userSelect:'none', WebkitUserSelect:'none',
      }}
    >
      {collapsible && (
        <span style={{
          fontSize:'10px',color:muted?C.textMut:C.red,
          transition:'transform 0.2s',display:'inline-block',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>▶</span>
      )}
      <span style={{fontSize:'11px',fontWeight:'800',textTransform:'uppercase',letterSpacing:'1.2px',color:muted?C.textMut:C.red}}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{fontSize:'11px',color:C.textMut,fontWeight:'600'}}>({count})</span>
      )}
      <div style={{flex:1,height:'1px',background:C.border}} />
      {collapsible && (
        <span style={{fontSize:'11px',color:C.textMut}}>
          {open ? 'Inklappen' : 'Uitklappen'}
        </span>
      )}
    </div>
  );

  return (
    <div style={{marginBottom:'28px'}}>
      {header}
      {(!collapsible || open) && (
        <div style={{display:'flex',flexDirection:'column',gap:'6px',animation:'fadeIn 0.15s ease'}}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Maandlabel-scheider tussen cards */
export function MonthDivider({ label }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:'8px',margin:'10px 0 4px'}}>
      <span style={{fontSize:'10px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'1px',color:C.textMut}}>{label}</span>
      <div style={{flex:1,height:'1px',background:C.border,opacity:0.5}} />
    </div>
  );
}
