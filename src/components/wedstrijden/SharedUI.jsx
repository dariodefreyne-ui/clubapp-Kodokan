import React, { useState } from 'react';
import { C, CATEGORIE_COLORS, getCatColor } from './tokens';
import { buttonStyle, badgeStyle } from '../../styles/tokens';
import { VET_SUBCATS } from '../../utils/categorieLogica';

const VET_COLOR = { bg: 'rgba(20,184,166,0.15)', color: '#0d9488', border: 'rgba(20,184,166,0.35)' };

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
export function DoelgroepBadges({ doelgroep, doelgroepCodes }) {
  const codes = doelgroepCodes?.length > 0
    ? doelgroepCodes.map(s => s.trim())
    : (doelgroep || '').split(/[-\/]/).map(s => s.trim()).filter(Boolean);
  const unique = [...new Set(codes)].filter(Boolean);
  if (unique.length === 0) return null;
  return (
    <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
      {unique.map(cat => {
        const c = getCatColor(cat);
        return <Badge key={cat} label={cat} style={{background:c.bg,color:c.color,border:`1px solid ${c.border}`}} />;
      })}
    </div>
  );
}
export function btnStyle(v = 'primary') {
  return buttonStyle(v);
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
          fontSize:'10px',color:muted?C.textMuted:C.red,
          transition:'transform 0.2s',display:'inline-block',
          transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>▶</span>
      )}
      <span style={{fontSize:'11px',fontWeight:'800',textTransform:'uppercase',letterSpacing:'1.2px',color:muted?C.textMuted:C.red}}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{fontSize:'11px',color:C.textMuted,fontWeight:'600'}}>({count})</span>
      )}
      <div style={{flex:1,height:'1px',background:C.border}} />
      {collapsible && (
        <span style={{fontSize:'11px',color:C.textMuted}}>
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

/**
 * Veteranen doelgroep selector — toont "Veteranen" als toggle met een uitklapbaar
 * accordion voor de V1-V9 leeftijdsgroepen. Integreert naadloos in doelgroepCodes.
 */
export function VeteranenSelector({ doelgroepCodes = [], onChange }) {
  const vetActief = doelgroepCodes.includes('Veteranen');
  const [open, setOpen] = useState(vetActief);

  function toggleVet() {
    if (vetActief) {
      onChange(doelgroepCodes.filter(c => c !== 'Veteranen' && !/^V\d$/.test(c)));
      setOpen(false);
    } else {
      onChange([...doelgroepCodes, 'Veteranen']);
      setOpen(true);
    }
  }

  function toggleSubcat(code) {
    if (doelgroepCodes.includes(code)) {
      onChange(doelgroepCodes.filter(c => c !== code));
    } else {
      onChange([...doelgroepCodes, code]);
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <label style={{
        display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
        background: vetActief ? VET_COLOR.bg : C.surface,
        border: `1px solid ${vetActief ? VET_COLOR.border : C.border}`,
        borderRadius: open && vetActief ? '8px 8px 0 0' : '8px',
        padding: '6px 10px',
        color: vetActief ? VET_COLOR.color : C.textSec,
        fontSize: '13px', fontWeight: '700', transition: 'all 0.12s',
        userSelect: 'none',
      }}>
        <input type="checkbox" style={{ display: 'none' }} checked={vetActief} onChange={toggleVet} />
        🏅 Veteranen
        <span style={{ fontSize: '10px', color: vetActief ? VET_COLOR.color : C.textMuted, fontWeight: '500', marginLeft: '2px' }}>30+</span>
        {vetActief && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); e.preventDefault(); setOpen(o => !o); }}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: VET_COLOR.color, fontSize: '11px', padding: 0, fontWeight: '700' }}
          >
            {open ? '▲ inklappen' : '▼ subcats'}
          </button>
        )}
      </label>

      {vetActief && open && (
        <div style={{
          padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: '6px',
          background: 'rgba(20,184,166,0.05)',
          border: `1px solid rgba(20,184,166,0.25)`, borderTop: 'none',
          borderRadius: '0 0 8px 8px',
        }}>
          <div style={{ width: '100%', fontSize: '11px', color: VET_COLOR.color, fontWeight: '600', marginBottom: '4px', opacity: 0.8 }}>
            Leeftijdsgroepen (optioneel — leeg = alle veteranen toegelaten):
          </div>
          {VET_SUBCATS.map(s => {
            const sel = doelgroepCodes.includes(s.code);
            return (
              <label key={s.code} style={{
                display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer',
                background: sel ? VET_COLOR.bg : C.surface,
                border: `1px solid ${sel ? VET_COLOR.border : C.border}`,
                borderRadius: '6px', padding: '4px 9px',
                color: sel ? VET_COLOR.color : C.textSec, fontSize: '12px', fontWeight: '700',
                transition: 'all 0.1s',
              }}>
                <input type="checkbox" style={{ display: 'none' }} checked={sel} onChange={() => toggleSubcat(s.code)} />
                {s.code}
                <span style={{ fontWeight: '400', fontSize: '10px', color: sel ? VET_COLOR.color : C.textMuted }}>{s.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Maandlabel-scheider tussen cards */
export function MonthDivider({ label }) {
  return (
    <div style={{display:'flex',alignItems:'center',gap:'8px',margin:'10px 0 4px'}}>
      <span style={{fontSize:'10px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'1px',color:C.textMuted}}>{label}</span>
      <div style={{flex:1,height:'1px',background:C.border,opacity:0.5}} />
    </div>
  );
}
