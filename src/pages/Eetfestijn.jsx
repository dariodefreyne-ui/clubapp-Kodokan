import React from 'react';

const EETFESTIJN_URL = 'https://kodokan-merchtem---eetfestijn.web.app/';

const S = {
  page: { minHeight:'100vh', background:'#1a1a1a', color:'#fff', padding:'16px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', textAlign:'center' },
  card: { background:'#2d2d2d', borderRadius:'16px', padding:'32px 24px', maxWidth:'400px', width:'100%' },
  icon: { fontSize:'64px', marginBottom:'16px' },
  title: { fontSize:'24px', fontWeight:'700', marginBottom:'8px' },
  subtitle: { color:'#aaa', fontSize:'15px', marginBottom:'32px', lineHeight:'1.5' },
  launchBtn: { display:'block', background:'#c0392b', border:'none', color:'#fff', padding:'18px 24px', borderRadius:'12px', cursor:'pointer', fontSize:'18px', fontWeight:'700', textDecoration:'none', width:'100%', marginBottom:'12px' },
  openBtn: { display:'block', background:'#2d2d2d', border:'1px solid #3a3a3a', color:'#aaa', padding:'12px 24px', borderRadius:'12px', cursor:'pointer', fontSize:'14px', textDecoration:'none', width:'100%' },
  divider: { borderTop:'1px solid #3a3a3a', margin:'24px 0' },
  infoRow: { display:'flex', justifyContent:'space-between', fontSize:'13px', padding:'6px 0', borderBottom:'1px solid #2a2a2a' },
};

export default function Eetfestijn() {
  function launch() {
    window.location.href = EETFESTIJN_URL;
  }

  function openInTab() {
    window.open(EETFESTIJN_URL, '_blank', 'noopener,noreferrer');
  }

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.icon}>🍝</div>
        <div style={S.title}>Eetfestijn App</div>
        <div style={S.subtitle}>
          De eetfestijn wordt beheerd via een aparte, gespecialiseerde app met kassa, keuken- en barstations.
        </div>

        <a style={S.launchBtn} href={EETFESTIJN_URL}>
          🚀 App openen
        </a>
        <button style={S.openBtn} onClick={openInTab}>
          ↗ Openen in nieuw tabblad
        </button>

        <div style={S.divider} />

        <div style={{ textAlign:'left' }}>
          <div style={{ color:'#aaa', fontSize:'12px', marginBottom:'8px', fontWeight:'700', textTransform:'uppercase' }}>Wat zit in de app</div>
          {[
            ['🛒', 'Bestellingen', 'Tafels & bestellingen registreren'],
            ['💰', 'Kassa', 'Betalingen & kasoverzicht'],
            ['🍳', 'Keukenstation', 'Bestellingen voor de keuken'],
            ['🍹', 'Barstation', 'Bestellingen voor de bar'],
            ['🍮', 'Dessertstation', 'Bestellingen voor desserts'],
            ['📊', 'Rapporten', 'Dagelijks overzicht & statistieken'],
          ].map(([icon, label, desc]) => (
            <div key={label} style={{ display:'flex', gap:'12px', padding:'10px 0', borderBottom:'1px solid #2a2a2a', alignItems:'center' }}>
              <span style={{ fontSize:'20px', width:'28px', textAlign:'center' }}>{icon}</span>
              <div>
                <div style={{ fontSize:'14px', fontWeight:'600' }}>{label}</div>
                <div style={{ fontSize:'12px', color:'#aaa' }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={S.divider} />

        <div style={{ textAlign:'left', fontSize:'12px', color:'#555' }}>
          <div style={S.infoRow}>
            <span>Project</span>
            <span>kodokan-merchtem---eetfestijn</span>
          </div>
          <div style={S.infoRow}>
            <span>URL</span>
            <span>kodokan-merchtem---eetfestijn.web.app</span>
          </div>
        </div>
      </div>
    </div>
  );
}
