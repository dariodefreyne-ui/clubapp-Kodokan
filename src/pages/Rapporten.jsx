import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';

const TABS = ['aanwezigheid','winkel','verkoop','examens'];
const TAB_LABELS = { aanwezigheid:'📅 Aanwezigheid', winkel:'📦 Stock', verkoop:'💳 Verkoop', examens:'📘 Examens' };

const S = {
  page: { minHeight:'100vh', background:'var(--bg-primary)', color:'var(--text-primary)', padding:'var(--space-4)' },
  title: { fontSize:'var(--font-size-xl)', fontWeight:'700', marginBottom:'var(--space-4)' },
  tabs: { display:'flex', gap:'0', marginBottom:'var(--space-5)', borderBottom:'1px solid var(--border-color)', flexWrap:'wrap' },
  tab: (a) => ({ background:'none', border:'none', color:a?'var(--accent-red)':'var(--text-secondary)', padding:'10px 14px', cursor:'pointer', fontSize:'var(--font-size-md)', fontWeight:a?'700':'400', borderBottom:a?'2px solid var(--accent-red)':'2px solid transparent', whiteSpace:'nowrap' }),
  card: { background:'var(--bg-card)', borderRadius:'var(--radius-lg)', padding:'var(--space-4)', marginBottom:'var(--space-3)' },
  statRow: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))', gap:'10px', marginBottom:'var(--space-4)' },
  statCard: (c) => ({ background:'var(--bg-card)', borderRadius:'10px', padding:'14px', borderLeft:`3px solid ${c}` }),
  statNum: { fontSize:'24px', fontWeight:'700' },
  statLabel: { color:'var(--text-secondary)', fontSize:'var(--font-size-sm)', marginTop:'2px' },
  table: { width:'100%', borderCollapse:'collapse' },
  th: { textAlign:'left', padding:'10px 8px', color:'var(--text-secondary)', fontSize:'var(--font-size-sm)', borderBottom:'1px solid var(--border-color)', fontWeight:'600' },
  td: { padding:'10px 8px', borderBottom:'1px solid var(--bg-card)', fontSize:'var(--font-size-sm)', verticalAlign:'top' },
  bar: (pct,color) => ({ height:'20px', background:`linear-gradient(90deg,${color} ${pct}%,var(--bg-primary) ${pct}%)`, borderRadius:'4px', width:'100%', marginTop:'4px' }),
  beltBadge: (b) => {
    const COLORS = { wit:{bg:'#fff',color:'#333'}, geel:{bg:'#f1c40f',color:'#333'}, oranje:{bg:'#e67e22',color:'#fff'}, groen:{bg:'#27ae60',color:'#fff'}, blauw:{bg:'#3498db',color:'#fff'}, bruin:{bg:'#8B4513',color:'#fff'}, zwart:{bg:'#1a1a1a',color:'#fff',border:'1px solid #555'} };
    return { ...(COLORS[b]||{}), padding:'2px 8px', borderRadius:'10px', fontSize:'var(--font-size-xs)', fontWeight:'700', display:'inline-block' };
  },
};

export default function Rapporten() {
  const [tab, setTab] = useState('aanwezigheid');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({});

  async function loadAttendance() {
    setLoading(true);
    const membersSnap = await getDocs(collection(db,'members'));
    const members = membersSnap.docs.map(d=>({id:d.id,...d.data()}));
    const stats = [];
    for (const m of members) {
      const attSnap = await getDocs(collection(db,'members',m.id,'attendance'));
      stats.push({ ...m, attendanceCount: attSnap.size, attendance: attSnap.docs.map(d=>d.data()) });
    }
    stats.sort((a,b) => b.attendanceCount - a.attendanceCount);
    setData(d => ({ ...d, aanwezigheid: stats }));
    setLoading(false);
  }

  async function loadWinkel() {
    setLoading(true);
    const snap = await getDocs(query(collection(db,'products'), orderBy('soldCount','desc')));
    const products = snap.docs.map(d=>({id:d.id,...d.data()}));
    const totalStock = products.reduce((s,p)=>s+(p.stock||0),0);
    const totalValue = products.reduce((s,p)=>s+(p.costPrice||0)*(p.stock||0),0);
    const totalRevenue = products.reduce((s,p)=>s+(p.price||0)*(p.soldCount||0),0);
    const totalCost = products.reduce((s,p)=>s+(p.costPrice||0)*(p.soldCount||0),0);
    setData(d => ({ ...d, winkel: { products, totalStock, totalValue, totalRevenue, totalCost, margin: totalRevenue-totalCost } }));
    setLoading(false);
  }

  async function loadVerkoop() {
    setLoading(true);
    const [salesSnap, usersSnap] = await Promise.all([
      getDocs(query(collection(db,'sales'), orderBy('aangemaaktOp','desc'))),
      getDocs(collection(db,'users')),
    ]);
    const verkoperMap = {};
    usersSnap.docs.forEach(d => { const u = d.data(); verkoperMap[d.id] = u.naam || u.displayName || d.id; });
    const sales = salesSnap.docs.map(d => {
      const sd = d.data();
      return { id: d.id, ...sd, _totaal: sd.totaal ?? sd.total ?? 0, _ts: sd.aangemaaktOp || sd.createdAt };
    });
    const total = sales.reduce((s,sale)=>s+(sale._totaal||0),0);
    const byDate = {};
    sales.forEach(s => {
      const d = s._ts?.toDate ? s._ts.toDate().toLocaleDateString('nl-BE') : '—';
      byDate[d] = (byDate[d]||0) + (s._totaal||0);
    });
    setData(d => ({ ...d, verkoop: { sales, total, byDate, count: sales.length, verkoperMap } }));
    setLoading(false);
  }

  async function loadExamens() {
    setLoading(true);
    const evSnap = await getDocs(query(collection(db,'events'), where('type','==','examen')));
    const events = evSnap.docs.map(d=>({id:d.id,...d.data()}));
    const results = [];
    for (const ev of events) {
      const regSnap = await getDocs(collection(db,'events',ev.id,'registrations'));
      const regs = regSnap.docs.map(d=>d.data());
      const passed = regs.filter(r=>r.result==='geslaagd').length;
      const total = regs.filter(r=>r.result!=='afwezig').length;
      results.push({ ...ev, candidates: regs.length, passed, failed: regs.filter(r=>r.result==='niet_geslaagd').length, absent: regs.filter(r=>r.result==='afwezig').length, passRate: total>0?Math.round(passed/total*100):0 });
    }
    setData(d => ({ ...d, examens: results }));
    setLoading(false);
  }

  function handleTabChange(t) {
    setTab(t);
    if (!data[t]) {
      if (t==='aanwezigheid') loadAttendance();
      if (t==='winkel') loadWinkel();
      if (t==='verkoop') loadVerkoop();
      if (t==='examens') loadExamens();
    }
  }

  useEffect(() => { loadAttendance(); }, []);

  const maxCount = data.aanwezigheid ? Math.max(...data.aanwezigheid.map(m=>m.attendanceCount), 1) : 1;

  return (
    <div style={S.page}>
      <div style={S.title}>📊 Rapporten</div>
      <div style={S.tabs}>
        {TABS.map(t => <button key={t} style={S.tab(tab===t)} onClick={() => handleTabChange(t)}>{TAB_LABELS[t]}</button>)}
      </div>

      {loading && <div style={{ color:'var(--text-secondary)', textAlign:'center', padding:'30px' }}>Berekenen...</div>}

      {!loading && tab === 'aanwezigheid' && data.aanwezigheid && (
        <div>
          <div style={S.statRow}>
            <div style={S.statCard('#3498db')}>
              <div style={S.statNum}>{data.aanwezigheid.length}</div>
              <div style={S.statLabel}>Leden</div>
            </div>
            <div style={S.statCard('#27ae60')}>
              <div style={S.statNum}>{data.aanwezigheid.reduce((s,m)=>s+m.attendanceCount,0)}</div>
              <div style={S.statLabel}>Totaal aanw.</div>
            </div>
            <div style={S.statCard('#f39c12')}>
              <div style={S.statNum}>
                {data.aanwezigheid.length > 0 ? Math.round(data.aanwezigheid.reduce((s,m)=>s+m.attendanceCount,0)/data.aanwezigheid.length) : 0}
              </div>
              <div style={S.statLabel}>Gem. per lid</div>
            </div>
          </div>
          <div style={S.card}>
            <h3 style={{ marginTop:0 }}>Aanwezigheid per lid</h3>
            {data.aanwezigheid.map(m => (
              <div key={m.id} style={{ marginBottom:'12px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <span style={{ fontWeight:'600', fontSize:'14px' }}>{m.name}</span>
                    {m.belt && <span style={{ ...S.beltBadge(m.belt), marginLeft:'6px' }}>{m.belt}</span>}
                  </div>
                  <span style={{ fontWeight:'700', color:'var(--accent-red)' }}>{m.attendanceCount}×</span>
                </div>
                <div style={S.bar(Math.round(m.attendanceCount/maxCount*100),'var(--accent-red)')} />
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && tab === 'winkel' && data.winkel && (
        <div>
          <div style={S.statRow}>
            {[['Stockwaarde',`€${data.winkel.totalValue.toFixed(0)}`, '#3498db'],['Omzet',`€${data.winkel.totalRevenue.toFixed(0)}`,'#27ae60'],['Marge',`€${data.winkel.margin.toFixed(0)}`,'#f39c12'],['Producten',data.winkel.totalStock,'#9b59b6']].map(([l,v,c])=>(
              <div key={l} style={S.statCard(c)}>
                <div style={S.statNum}>{v}</div>
                <div style={S.statLabel}>{l}</div>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <h3 style={{ marginTop:0 }}>Producten overzicht</h3>
            <div style={{ overflowX:'auto' }}>
              <table style={S.table}>
                <thead><tr>
                  <th style={S.th}>Product</th><th style={S.th}>Variant</th><th style={S.th}>Stock</th>
                  <th style={S.th}>Verkocht</th><th style={S.th}>Omzet</th><th style={S.th}>Marge</th>
                </tr></thead>
                <tbody>
                  {data.winkel.products.map(p=>(
                    <tr key={p.id}>
                      <td style={S.td}>{p.name}</td>
                      <td style={S.td}><span style={{ color:'var(--text-secondary)' }}>{p.variant}</span></td>
                      <td style={S.td}><span style={{ color:(p.stock||0)<=0?'#e74c3c':(p.stock||0)<3?'#f39c12':'#27ae60', fontWeight:'600' }}>{p.stock||0}</span></td>
                      <td style={S.td}>{p.soldCount||0}</td>
                      <td style={S.td}>€{((p.price||0)*(p.soldCount||0)).toFixed(2)}</td>
                      <td style={S.td}>€{(((p.price||0)-(p.costPrice||0))*(p.soldCount||0)).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && tab === 'verkoop' && data.verkoop && (
        <div>
          <div style={S.statRow}>
            <div style={S.statCard('#27ae60')}><div style={S.statNum}>€{data.verkoop.total.toFixed(2)}</div><div style={S.statLabel}>Totale omzet</div></div>
            <div style={S.statCard('#3498db')}><div style={S.statNum}>{data.verkoop.count}</div><div style={S.statLabel}>Transacties</div></div>
            <div style={S.statCard('#f39c12')}><div style={S.statNum}>€{data.verkoop.count>0?(data.verkoop.total/data.verkoop.count).toFixed(2):0}</div><div style={S.statLabel}>Gem. verkoop</div></div>
          </div>
          <div style={S.card}>
            <h3 style={{ marginTop:0 }}>Per dag</h3>
            {Object.entries(data.verkoop.byDate).map(([date,total])=>(
              <div key={date} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border-color)' }}>
                <span style={{ color:'var(--text-secondary)' }}>{date}</span>
                <span style={{ fontWeight:'700', color:'var(--success)' }}>€{total.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <h3 style={{ marginTop:0 }}>Recente transacties</h3>
            {data.verkoop.sales.slice(0,20).map(s=>(
              <div key={s.id} style={{ padding:'8px 0', borderBottom:'1px solid var(--bg-card)' }}>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'var(--text-secondary)', fontSize:'var(--font-size-sm)' }}>{s._ts?.toDate ? s._ts.toDate().toLocaleString('nl-BE') : '—'}</span>
                  <span style={{ fontWeight:'700', color:'var(--success)' }}>€{(s._totaal||0).toFixed(2)}</span>
                </div>
                <div style={{ fontSize:'var(--font-size-sm)', color:'var(--text-secondary)', marginTop:'2px' }}>{(s.items||[]).map(i=>`${i.name} ${i.variant} ×${i.qty}`).join(' · ')}</div>
                <div style={{ fontSize:'var(--font-size-sm)', color:'var(--text-secondary)', marginTop:'2px' }}>Verkoper: {data.verkoop.verkoperMap[s.verkoperUid] || s.koperNaam || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && tab === 'examens' && data.examens && (
        <div>
          {data.examens.length === 0 ? (
            <div style={{ color:'var(--text-secondary)', textAlign:'center', padding:'40px' }}>Geen examendata.</div>
          ) : (
            <div style={S.card}>
              <h3 style={{ marginTop:0 }}>Examenresultaten</h3>
              <div style={{ overflowX:'auto' }}>
                <table style={S.table}>
                  <thead><tr>
                    <th style={S.th}>Examen</th><th style={S.th}>Datum</th><th style={S.th}>Kandidaten</th>
                    <th style={S.th}>Geslaagd</th><th style={S.th}>Niet geslaagd</th><th style={S.th}>Slaagpct.</th>
                  </tr></thead>
                  <tbody>
                    {data.examens.map(e=>(
                      <tr key={e.id}>
                        <td style={S.td}><b>{e.name}</b></td>
                        <td style={S.td}>{e.date}</td>
                        <td style={S.td}>{e.candidates}</td>
                        <td style={S.td}><span style={{ color:'var(--success)', fontWeight:'600' }}>{e.passed}</span></td>
                        <td style={S.td}><span style={{ color:'var(--danger)', fontWeight:'600' }}>{e.failed}</span></td>
                        <td style={S.td}><span style={{ color: e.passRate>=70?'var(--success)':'var(--warning)', fontWeight:'700' }}>{e.passRate}%</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
