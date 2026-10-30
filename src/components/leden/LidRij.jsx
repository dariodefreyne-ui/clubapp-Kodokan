// src/components/leden/LidRij.jsx
// Compacte ledenrij: gordel = smalle kleurstreep (+ tekstlabel, dus niet enkel kleur),
// categorie = vette tekst naast de naam. Echte link: toetsenbord + nieuw tabblad werken.
import React from 'react';
import { Link } from 'react-router-dom';
import { lidWeergaveNaam } from '../../utils/ledenKoppeling';

const MAX_GROEPEN = 3;

function initialen(naam) {
  const d = String(naam || '').split(/\s+/).filter(Boolean);
  if (d.length === 0) return '?';
  return ((d[0][0] || '') + (d.length > 1 ? d[d.length - 1][0] : '')).toUpperCase();
}

const s = {
  rij: {
    display: 'flex', alignItems: 'center', gap: '12px', minHeight: '56px',
    padding: '8px 14px 8px 10px', background: 'var(--bg-card)',
    border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)', textDecoration: 'none',
  },
  streep: {
    width: '6px', alignSelf: 'stretch', minHeight: '32px', borderRadius: '3px',
    flexShrink: 0, boxShadow: '0 0 0 1px rgba(148,163,184,0.45)',
  },
  avatar: {
    width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
    background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 'var(--font-size-sm)', fontWeight: '700', color: 'var(--text-secondary)',
  },
  naamLijn: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 },
  naam: {
    fontSize: 'var(--font-size-base)', fontWeight: '600', lineHeight: '1.3',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0,
  },
  cat: {
    padding: '1px 8px', borderRadius: '6px', flexShrink: 0, whiteSpace: 'nowrap',
    fontSize: 'var(--font-size-sm)', fontWeight: '700', color: 'var(--text-primary)',
    background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
  },
  vet: {
    padding: '1px 8px', borderRadius: '6px', flexShrink: 0, whiteSpace: 'nowrap',
    fontSize: 'var(--font-size-sm)', fontWeight: '700', color: '#0d9488',
    background: 'rgba(20,184,166,0.15)', border: '1px solid rgba(20,184,166,0.35)',
  },
  subLijn: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px',
    marginTop: '3px', fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)',
  },
  tag: {
    padding: '1px 7px', background: 'var(--bg-primary)', borderRadius: '6px',
    border: '1px solid var(--border-color)', color: 'var(--text-secondary)',
  },
  inactief: {
    padding: '1px 7px', background: 'rgba(192,57,43,0.2)', borderRadius: '6px',
    border: '1px solid rgba(192,57,43,0.4)', color: 'var(--accent-red)',
  },
  betaald: {
    padding: '1px 7px', background: 'var(--bg-primary)', borderRadius: '6px',
    border: '1px solid var(--success)', color: 'var(--success)',
  },
  gordelLabel: {
    flexShrink: 0, fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', whiteSpace: 'nowrap',
  },
};

export default function LidRij({ member, cat, vet, belt, isMobile, onOpen }) {
  const naam = lidWeergaveNaam(member) || '—';
  const nummer = member.vergunningsnummer || member.lidnummer;
  const groepen = Array.isArray(member.groepen) ? member.groepen : [];

  const klik = (e) => {
    // Enkel een gewone linkerklik onthoudt het lid; Ctrl/Cmd/Shift-klik opent een nieuw tabblad.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    onOpen(member.id);
  };

  return (
    <Link to={`/leden/${member.id}`} onClick={klik} className="leden-rij" style={s.rij}>
      <span aria-hidden="true" title={belt.label} style={{ ...s.streep, background: belt.bg }} />
      <span style={s.avatar} aria-hidden="true">
        {member.fotoUrl
          ? <img src={member.fotoUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initialen(naam)}
      </span>

      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={s.naamLijn}>
          <span style={s.naam}>{naam}</span>
          {cat && <span style={s.cat}>{cat}</span>}
          {vet && <span style={s.vet}>Vet. {vet.code}</span>}
        </span>
        <span style={s.subLijn}>
          {isMobile && <span style={{ ...s.gordelLabel, fontSize: 'var(--font-size-xs)' }}>{belt.label}</span>}
          {nummer && <span>#{nummer}</span>}
          {groepen.slice(0, MAX_GROEPEN).map(g => <span key={g} style={s.tag}>{g}</span>)}
          {groepen.length > MAX_GROEPEN && <span style={s.tag}>+{groepen.length - MAX_GROEPEN}</span>}
          {member.actief === false && <span style={s.inactief}>Inactief</span>}
          {member.bijdrageBetaald && <span style={s.betaald}>Betaald</span>}
        </span>
      </span>

      {!isMobile && <span style={s.gordelLabel}>{belt.label}</span>}
    </Link>
  );
}
