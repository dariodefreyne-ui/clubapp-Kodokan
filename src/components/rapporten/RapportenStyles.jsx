// src/components/rapporten/RapportenStyles.js
// Design tokens en kleine herbruikbare componenten voor de Rapporten-pagina.

import { C, buttonStyle } from '../../styles/tokens';

export const exportBtnStyle = { ...buttonStyle('subtle'), padding: '6px 12px', fontSize: '12px', minHeight: 'auto' };

export const S = {
  page:     {},
  header:   { marginBottom: '20px', paddingBottom: '16px', borderBottom: `1px solid ${C.border}` },
  title:    { margin: '0 0 4px', fontSize: 'clamp(20px,5vw,26px)', fontWeight: '800' },
  subtitle: { margin: 0, fontSize: '14px', color: C.textSec },
  sLabel:   { fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px' },
  chipRij:  { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' },
  chip:     (a) => ({ padding: '6px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: a ? C.red : C.card, border: `1px solid ${a ? C.red : C.border}`, color: a ? '#fff' : C.textSec, fontFamily: 'inherit' }),
  tabBar:   { display: 'flex', gap: 0, overflowX: 'auto', borderBottom: `1px solid ${C.border}`, marginBottom: '20px' },
  tab:      (a) => ({ background: 'none', border: 'none', borderBottom: `2px solid ${a ? C.red : 'transparent'}`, color: a ? C.textPrimary : C.textMuted, padding: '10px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: a ? '700' : '400', whiteSpace: 'nowrap', fontFamily: 'inherit' }),
  card:     { background: C.card, borderRadius: '12px', padding: '16px', border: `1px solid ${C.border}`, marginBottom: '16px' },
  kpiGrid:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: '12px', marginBottom: '24px' },
  kpi:      (c) => ({ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '14px 16px', borderLeft: `3px solid ${c || C.blue}` }),
  kpiNum:   (c) => ({ fontSize: '22px', fontWeight: '800', color: c || C.textPrimary }),
  kpiLbl:   { fontSize: '11px', color: C.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' },
  kpiSub:   { fontSize: '11px', color: C.textMuted, marginTop: '2px' },
  tbl:      { width: '100%', borderCollapse: 'collapse' },
  th:       { padding: '8px 10px', textAlign: 'left',  color: C.textMuted, fontWeight: '700', fontSize: '11px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' },
  thr:      { padding: '8px 10px', textAlign: 'right', color: C.textMuted, fontWeight: '700', fontSize: '11px', borderBottom: `1px solid ${C.border}`, whiteSpace: 'nowrap' },
  td:       { padding: '8px 10px', fontSize: '13px', textAlign: 'left',  borderBottom: `1px solid ${C.border}`, color: C.textPrimary },
  tdr:      { padding: '8px 10px', fontSize: '13px', textAlign: 'right', borderBottom: `1px solid ${C.border}`, color: C.textPrimary },
  bar:      (p, c) => ({ height: '14px', background: `linear-gradient(90deg,${c||C.red} ${p}%,${C.bg} ${p}%)`, borderRadius: '4px', marginTop: '4px' }),
  leeg:     { color: C.textMuted, textAlign: 'center', padding: '40px', fontStyle: 'italic', fontSize: '14px' },
  loadBtn:  { padding: '8px 16px', background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '13px', fontWeight: '600', fontFamily: 'inherit' },
  h3:       { margin: '0 0 12px', fontSize: '15px', fontWeight: '700' },
  beltBadge:(b) => {
    const m = { wit:'#fff', geel:'#f1c40f', oranje:'#e67e22', groen:'#27ae60', blauw:'#3498db', bruin:'#8B4513', zwart:'#1a1a1a' };
    return { marginLeft:'6px', padding:'1px 7px', borderRadius:'10px', fontSize:'11px', fontWeight:'700', background: m[b]||'#555', color: ['wit','geel'].includes(b)?'#333':'#fff', border: b==='zwart'?'1px solid #555':'none' };
  },
  infoBalk: { fontSize:'12px', color:C.textMuted, marginBottom:'16px', display:'flex', alignItems:'center', gap:'6px', padding:'10px', background:C.bg, borderRadius:'8px', border:`1px solid ${C.border}` },
};

export function Kpi({ label, value, color, sub }) {
  return (
    <div style={S.kpi(color)}>
      <div style={S.kpiNum(color)}>{value}</div>
      <div style={S.kpiLbl}>{label}</div>
      {sub && <div style={S.kpiSub}>{sub}</div>}
    </div>
  );
}

export function Sectiekop({ children, extra }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
      <h3 style={{ margin:0, fontSize:'15px', fontWeight:'700' }}>{children}</h3>
      {extra}
    </div>
  );
}

export function RowBg(i) { return i % 2 === 0 ? C.card : C.bg; }
