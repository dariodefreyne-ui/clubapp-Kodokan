import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { useAuth } from '../contexts/AuthContext';
import CsvImportModal from '../components/leden/CsvImportModal';
import NaamSplitsModal from '../components/leden/NaamSplitsModal';
import NaamSyncModal from '../components/leden/NaamSyncModal';
import { berekenVeteranenSubcat, isVetCode } from '../utils/categorieLogica';
import { berekenLidCategorieen } from '../utils/ledenCategorieen';
import {
  jaarUitGeboortedatum, lidWeergaveNaam, lidMatchtZoekterm, lidSorteerSleutel,
} from '../utils/ledenKoppeling';
import { bouwExportRijen } from '../utils/ledenImport';
import { useGordelOpties } from '../hooks/useGordelOpties';
import { useIsMobile } from '../hooks/useIsMobile';
import { DEFAULT_LEEFTIJDSCATEGORIEEN } from '../config/clubdataDefaults';
import {
  useLedenStore, useLedenFilters, onthoudLaatstGeopend, markeerLedenVerouderd,
} from '../hooks/useLedenStore';

const STATUS_OPTIES = [['actief', 'Actief'], ['inactief', 'Inactief'], ['alle', 'Alle']];

const styles = {
  page: {},
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: '12px', marginBottom: '14px',
  },
  title: { fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 2px 0' },
  subtitle: { fontSize: 'var(--font-size-md)', color: 'var(--text-secondary)', margin: 0 },
  searchRow: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', position: 'relative' },
  searchInput: {
    flex: '1 1 0', padding: '10px 14px', minHeight: '44px', boxSizing: 'border-box',
    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)', outline: 'none', minWidth: '0',
  },
  btnPrimary: {
    padding: '10px 16px', background: 'var(--accent-red)', border: 'none',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)', fontWeight: '600', cursor: 'pointer',
    whiteSpace: 'nowrap', minHeight: '44px', flexShrink: 0, fontFamily: 'inherit',
  },
  btnSecondary: {
    padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)', fontWeight: '500', cursor: 'pointer',
    whiteSpace: 'nowrap', minHeight: '44px', flexShrink: 0, fontFamily: 'inherit',
  },
  btnKlein: {
    padding: '4px 10px', background: 'transparent', border: 'none',
    color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', cursor: 'pointer',
    minHeight: '36px', fontFamily: 'inherit',
  },
  badge: {
    minWidth: '20px', height: '20px', padding: '0 6px', borderRadius: '10px',
    background: 'var(--accent-red)', color: 'var(--text-primary)',
    fontSize: 'var(--font-size-xs)', fontWeight: '700',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginLeft: '6px',
  },
  menu: {
    position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 41, minWidth: '230px',
    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', padding: '4px', boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    display: 'flex', flexDirection: 'column',
  },
  menuItem: {
    textAlign: 'left', padding: '10px 12px', minHeight: '44px', background: 'transparent',
    border: 'none', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)', cursor: 'pointer', fontFamily: 'inherit',
  },
  menuScheiding: { height: '1px', background: 'var(--border-color)', margin: '4px 0' },
  backdrop: { position: 'fixed', inset: 0, zIndex: 40, background: 'transparent' },
  filterPanel: {
    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)', padding: '12px 14px', marginBottom: '12px',
    display: 'flex', flexDirection: 'column', gap: '14px',
  },
  filterLabel: {
    display: 'block', marginBottom: '6px', fontSize: 'var(--font-size-xs)', fontWeight: '700',
    color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  chipRow: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  chip: (active, gestippeld = false) => ({
    padding: '6px 12px', borderRadius: '20px', cursor: 'pointer',
    border: active
      ? '1.5px solid var(--accent-red)'
      : `1px ${gestippeld ? 'dashed' : 'solid'} var(--border-color)`,
    background: active ? 'rgba(192,57,43,0.12)' : 'var(--bg-primary)',
    color: active ? 'var(--accent-red)' : 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)', fontWeight: active ? '700' : '400',
    whiteSpace: 'nowrap', minHeight: '36px', fontFamily: 'inherit',
    transition: 'all 0.15s',
  }),
  segment: {
    display: 'inline-flex', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', overflow: 'hidden',
  },
  segBtn: (active) => ({
    padding: '8px 16px', minHeight: '40px', border: 'none', cursor: 'pointer',
    background: active ? 'rgba(192,57,43,0.12)' : 'var(--bg-primary)',
    color: active ? 'var(--accent-red)' : 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)', fontWeight: active ? '700' : '400', fontFamily: 'inherit',
  }),
  filterFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' },
  actiefRij: { display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' },
  actiefChip: {
    padding: '4px 6px 4px 10px', borderRadius: '16px', border: '1.5px solid var(--accent-red)',
    background: 'rgba(192,57,43,0.12)', color: 'var(--accent-red)', cursor: 'pointer',
    fontSize: 'var(--font-size-sm)', fontWeight: '600', fontFamily: 'inherit', minHeight: '32px',
    display: 'inline-flex', alignItems: 'center', gap: '6px',
  },
  statsLine: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px',
    marginBottom: '8px', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)',
  },
  waarschuwing: {
    marginBottom: '8px', padding: '8px 12px', borderRadius: 'var(--radius-md)',
    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(340px, 100%), 1fr))',
    gap: '8px',
  },
  letter: {
    gridColumn: '1 / -1', padding: '10px 4px 2px', fontSize: 'var(--font-size-sm)',
    fontWeight: '700', color: 'var(--accent-red)', borderBottom: '1px solid var(--border-color)',
  },
  kaart: {
    background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '10px 12px',
    cursor: 'pointer', border: '1px solid var(--border-color)', minHeight: '56px',
    display: 'flex', alignItems: 'center', gap: '10px', boxSizing: 'border-box',
  },
  memberName: {
    fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-primary)',
    margin: 0, lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  memberMeta: {
    display: 'flex', flexWrap: 'wrap', gap: '2px 8px', marginTop: '2px',
    fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: '1.4',
  },
  beltBadge: { padding: '2px 10px', borderRadius: 'var(--radius-lg)', fontSize: 'var(--font-size-sm)', fontWeight: '600' },
  catBadge: (extra) => ({
    padding: '1px 7px', borderRadius: 'var(--radius-lg)',
    fontSize: 'var(--font-size-xs)', fontWeight: '700', whiteSpace: 'nowrap',
    background: 'var(--bg-primary)', color: 'var(--text-secondary)',
    border: `1px ${extra ? 'dashed' : 'solid'} var(--border-color)`,
    opacity: extra ? 0.85 : 1,
  }),
  vetBadge: {
    padding: '1px 7px', borderRadius: 'var(--radius-lg)',
    fontSize: 'var(--font-size-xs)', fontWeight: '700', whiteSpace: 'nowrap',
    background: 'rgba(20,184,166,0.15)', color: '#0d9488', border: '1px solid rgba(20,184,166,0.35)',
  },
  inactiefTag: { color: 'var(--accent-red)', fontWeight: '600' },
  emptyState: { textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' },
  emptyIcon: { fontSize: '48px', marginBottom: '16px' },
  emptyTitle: { fontSize: 'var(--font-size-lg)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' },
  loadingWrap: { display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px' },
  spinner: {
    width: '36px', height: '36px',
    border: '3px solid var(--border-color)', borderTop: '3px solid var(--accent-red)',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
};

const PAGINA_CSS = `
@keyframes spin { to { transform: rotate(360deg); } }
.lid-kaart:active { background: var(--bg-primary); }
.lid-kaart:focus-visible { outline: 2px solid var(--accent-red); outline-offset: 1px; }
@media (hover: hover) { .lid-kaart:hover { border-color: var(--accent-red); } }
`;

// Lijstweergave volgt de sortering (achternaam eerst), zodat het alfabet zichtbaar klopt.
// Ongesplitste (legacy) namen blijven zoals ze opgeslagen zijn.
function lijstNaam(m) {
  const v = String(m?.voornaam || '').trim();
  const a = String(m?.achternaam || '').trim();
  return v && a ? `${a} ${v}` : lidWeergaveNaam(m);
}

function startLetter(m) {
  const eerste = lidSorteerSleutel(m).normalize('NFD').replace(/[\u0300-\u036f]/g, '').charAt(0).toUpperCase();
  return /[A-Z]/.test(eerste) ? eerste : '#';
}

const LidKaart = memo(function LidKaart({ member, belt, lidInfo, onOpen }) {
  const isActive = member.actief !== false;
  const vergnummer = member.vergunningsnummer || member.lidnummer;
  const groepen = Array.isArray(member.groepen) ? member.groepen : [];
  const naam = lijstNaam(member) || '—';
  const open = () => onOpen(member.id);

  return (
    <div
      className="lid-kaart"
      style={styles.kaart}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      }}
    >
      <div style={{
        width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
        background: member.fotoUrl ? `url(${JSON.stringify(member.fotoUrl)})` : 'var(--bg-primary)',
        backgroundSize: 'cover', backgroundPosition: 'center',
        border: '1px solid var(--border-color)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '14px', color: 'var(--text-secondary)',
      }}>
        {!member.fotoUrl && '👤'}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={styles.memberName}>{naam}</p>
        <div style={styles.memberMeta}>
          {vergnummer && <span>#{vergnummer}</span>}
          {groepen.length > 0 && <span>{groepen.join(' · ')}</span>}
          {!isActive && <span style={styles.inactiefTag}>Inactief</span>}
          {member.bijdrageBetaald && <span style={{ color: 'var(--success)' }}>✓ Betaald</span>}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
        <span style={{ ...styles.beltBadge, background: belt.bg, color: belt.color, border: belt.border }}>
          {belt.label}
        </span>
        {(lidInfo.codes.length > 0 || lidInfo.vet) && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {lidInfo.codes.map(code => (
              <span key={code} style={styles.catBadge(code !== lidInfo.hoofd)}>{code}</span>
            ))}
            {lidInfo.vet && <span style={styles.vetBadge}>Vet. {lidInfo.vet.code}</span>}
          </div>
        )}
      </div>
    </div>
  );
});

export default function Ledenbeheer() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { isBeheerder, configCache } = useAuth();
  const alleGroepen = configCache?.groepen || [];
  const cfg = configCache?.categorieen;
  const { gordels: gordelLijst, kyuMap } = useGordelOpties();

  const gordelConfig = useMemo(() => {
    const map = {};
    gordelLijst.forEach(g => {
      const kleur = g.kleur || '#cccccc';
      const isDonker = kleur.toLowerCase() === '#ffffff' || kleur.toLowerCase() === '#fff';
      map[g.code] = {
        label: g.label || g.code,
        bg: kleur,
        color: isDonker ? '#333333' : '#ffffff',
        border: isDonker ? '1px solid #ccc' : 'none',
      };
    });
    if (!map['wit']) map['wit'] = { label: 'Wit', bg: '#ffffff', color: '#333333', border: '1px solid #ccc' };
    return map;
  }, [gordelLijst]);

  const [filters, zetFilters] = useLedenFilters();
  const [showImport, setShowImport] = useState(false);
  const [showNaamSplits, setShowNaamSplits] = useState(false);
  const [showNaamSync, setShowNaamSync] = useState(false);
  const [filterOpen, setFilterOpen] = useState(() => !isMobile);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const sluit = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', sluit);
    return () => window.removeEventListener('keydown', sluit);
  }, [menuOpen]);

  // Een opgeslagen groep die niet meer bestaat mag de lijst niet leegmaken.
  const groep = (alleGroepen.length === 0 || alleGroepen.some(g => g.naam === filters.groep)) ? filters.groep : '';
  const { actief: activeFilter, zoek } = filters;

  const {
    leden, loading, verversen, fout, vereistGroep, serverZoek, afgekapt, laadtijd, vernieuw,
  } = useLedenStore(activeFilter, groep, zoek);

  // Categorie-opties: ALLE geconfigureerde leeftijdscategorieën (excl. veteranen-subcodes).
  // De vlag `gebruikInFiltering` wordt hier bewust genegeerd: filteren op categorie is
  // client-side en kost geen reads, dus verbergen heeft op deze pagina geen nut.
  const categorieOpties = useMemo(() => {
    const geldig = (v) => v !== '' && v != null && Number.isFinite(Number(v));
    const bron = (cfg && cfg.length > 0) ? cfg : DEFAULT_LEEFTIJDSCATEGORIEEN;
    return bron
      .filter(c => c && c.code && !isVetCode(c.code) && geldig(c.vanLeeftijd) && geldig(c.totLeeftijd))
      .slice()
      .sort((a, b) => (a.volgorde ?? 0) - (b.volgorde ?? 0));
  }, [cfg]);

  const hoofdOpties = useMemo(() => categorieOpties.filter(c => c.extra !== true), [categorieOpties]);
  const extraOpties = useMemo(() => categorieOpties.filter(c => c.extra === true), [categorieOpties]);

  const optieCodes = useMemo(
    () => new Set([...categorieOpties.map(c => c.code), 'Veteranen', 'Onbekend']),
    [categorieOpties],
  );
  const actieveCats = useMemo(() => filters.cats.filter(c => optieCodes.has(c)), [filters.cats, optieCodes]);

  // Categorieën (hoofd + extra, bv. U15 + U14) volgen het huidige kalenderjaar en worden live
  // berekend uit de geboortedatum: geen opslag, geen extra reads, verspringt vanzelf op 1 januari.
  const info = useMemo(() => {
    const map = new Map();
    leden.forEach(m => {
      const jaar = jaarUitGeboortedatum(m.geboortedatum);
      const { hoofd, extras, codes } = berekenLidCategorieen(jaar, cfg);
      map.set(m.id, {
        jaar,
        hoofd,
        extras,
        codes,
        vet: jaar ? berekenVeteranenSubcat(jaar, null, cfg) : null,
      });
    });
    return map;
  }, [leden, cfg]);

  // Basis = groep + zoekterm (zonder categoriefilter) → ook de bron voor de aantallen.
  const basis = useMemo(() => {
    const term = zoek.trim();
    const termLaag = term.toLowerCase();
    return leden.filter(m => {
      if (groep && !(Array.isArray(m.groepen) && m.groepen.includes(groep))) return false;
      if (!term) return true;
      return (
        lidMatchtZoekterm(m, term) ||
        String(m.vergunningsnummer || m.lidnummer || '').toLowerCase().includes(termLaag) ||
        (m.email || '').toLowerCase().includes(termLaag)
      );
    });
  }, [leden, groep, zoek]);

  const aantallen = useMemo(() => {
    const tel = { Veteranen: 0, Onbekend: 0 };
    basis.forEach(m => {
      const i = info.get(m.id);
      if (!i) return;
      i.codes.forEach(c => { tel[c] = (tel[c] || 0) + 1; });
      if (i.vet) tel.Veteranen += 1;
      if (!i.jaar) tel.Onbekend += 1;
    });
    return tel;
  }, [basis, info]);

  const filtered = useMemo(() => {
    if (actieveCats.length === 0) return basis;
    return basis.filter(m => {
      const i = info.get(m.id);
      if (!i) return false;
      return actieveCats.some(c => (c === 'Veteranen' ? !!i.vet : c === 'Onbekend' ? !i.jaar : i.codes.includes(c)));
    });
  }, [basis, info, actieveCats]);

  // Lijst met alfabetische scheidingsletters (leden zijn al gesorteerd door de store).
  const lijstItems = useMemo(() => {
    const items = [];
    let vorige = null;
    filtered.forEach(m => {
      const letter = startLetter(m);
      if (letter !== vorige) {
        items.push({ type: 'letter', key: `letter-${letter}`, letter });
        vorige = letter;
      }
      items.push({ type: 'lid', key: m.id, member: m });
    });
    return items;
  }, [filtered]);

  // Export: hoofd- en extra categorieën samen in één (informatieve) kolom.
  const categorieVan = (m) => info.get(m.id)?.codes.join(' / ') ?? '';

  // Zelfde kolommen als de import (incl. LidID): export → Excel → import werkt als round-trip.
  const handleExportCSV = () => {
    const rows = bouwExportRijen(filtered, { categorieVan, kyuMap });
    const csv = Papa.unparse(rows, { delimiter: ';' });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leden_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportXlsx = async () => {
    try {
      const [{ maakLedenWorkbook }, { downloadWorkbook }] = await Promise.all([
        import('../utils/ledenXlsx'),
        import('../components/rapporten/exportHelpers'),
      ]);
      const wb = await maakLedenWorkbook(bouwExportRijen(filtered, { categorieVan, kyuMap }));
      await downloadWorkbook(wb, `leden_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      console.error('Excel-export mislukt', e);
      window.alert('Excel-export mislukt. Probeer opnieuw of gebruik CSV.');
    }
  };

  const toggleCat = (code) => zetFilters(f => ({
    cats: f.cats.includes(code) ? f.cats.filter(c => c !== code) : [...f.cats, code],
  }));

  const openLid = useCallback((id) => {
    onthoudLaatstGeopend(id);
    navigate(`/leden/${id}`);
  }, [navigate]);

  const nieuwLid = () => {
    markeerLedenVerouderd();
    navigate('/leden/nieuw');
  };

  const kiesMenu = (actie) => { setMenuOpen(false); actie(); };

  const catLabel = (code) => categorieOpties.find(c => c.code === code)?.label || code;

  // Samenvatting van actieve filters (zichtbaar als het paneel dicht is).
  const actieveChips = [];
  if (activeFilter !== 'actief') {
    actieveChips.push({
      key: 'status',
      label: activeFilter === 'inactief' ? 'Inactief' : 'Alle statussen',
      wis: () => zetFilters({ actief: 'actief' }),
    });
  }
  if (groep) actieveChips.push({ key: 'groep', label: groep, wis: () => zetFilters({ groep: '' }) });
  actieveCats.forEach(c => actieveChips.push({ key: `cat-${c}`, label: catLabel(c), wis: () => toggleCat(c) }));
  const wisAlleFilters = () => zetFilters({ groep: '', actief: 'actief', cats: [] });

  const wachtOpGroepKeuze = vereistGroep && !groep && !serverZoek;
  const toonStats = !loading && !fout && !wachtOpGroepKeuze;
  const toonPaneel = filterOpen || wachtOpGroepKeuze;
  const bijgewerktOm = laadtijd
    ? new Date(laadtijd).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
    : null;

  const catChip = (code, label, gestippeld = false) => {
    const actief = actieveCats.includes(code);
    const aantal = aantallen[code] || 0;
    return (
      <button
        key={code}
        type="button"
        aria-pressed={actief}
        style={{ ...styles.chip(actief, gestippeld), opacity: aantal === 0 && !actief ? 0.5 : 1 }}
        onClick={() => toggleCat(code)}
      >
        {label} ({aantal})
      </button>
    );
  };

  const aantalTekst = !toonStats
    ? 'Overzicht en beheer van alle clubleden'
    : filtered.length === leden.length
      ? `${filtered.length} ${filtered.length === 1 ? 'lid' : 'leden'}`
      : `${filtered.length} van ${leden.length} leden`;

  return (
    <div style={styles.page}>
      <style>{PAGINA_CSS}</style>

      <div style={styles.header}>
        <div style={{ minWidth: 0 }}>
          <h1 style={styles.title}>Ledenbeheer</h1>
          <p style={styles.subtitle}>{aantalTekst}</p>
        </div>
        {isBeheerder && (
          <button
            style={styles.btnPrimary}
            onClick={nieuwLid}
            onMouseOver={e => { e.currentTarget.style.background = '#a93226'; }}
            onMouseOut={e => { e.currentTarget.style.background = 'var(--accent-red)'; }}
          >
            + Nieuw lid
          </button>
        )}
      </div>

      {/* Zoeken + filters + acties */}
      <div style={styles.searchRow}>
        <input
          type="search"
          placeholder="Zoek op naam, nummer of e-mail"
          value={zoek}
          onChange={e => zetFilters({ zoek: e.target.value })}
          style={styles.searchInput}
          aria-label="Zoeken"
        />
        <button
          type="button"
          style={styles.btnSecondary}
          aria-expanded={toonPaneel}
          aria-controls="ledenFilterPaneel"
          onClick={() => setFilterOpen(o => !o)}
        >
          Filters
          {actieveChips.length > 0 && <span style={styles.badge}>{actieveChips.length}</span>}
        </button>
        <button
          type="button"
          style={styles.btnSecondary}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Meer acties"
          onClick={() => setMenuOpen(o => !o)}
        >
          ⋯
        </button>

        {menuOpen && (
          <>
            <div style={styles.backdrop} onClick={() => setMenuOpen(false)} />
            <div style={styles.menu} role="menu">
              <button role="menuitem" style={styles.menuItem} onClick={() => kiesMenu(handleExportCSV)}>
                Exporteer CSV
              </button>
              <button role="menuitem" style={styles.menuItem} onClick={() => kiesMenu(handleExportXlsx)}>
                Exporteer Excel
              </button>
              {isBeheerder && (
                <>
                  <div style={styles.menuScheiding} />
                  <button role="menuitem" style={styles.menuItem} onClick={() => kiesMenu(() => setShowImport(true))}>
                    Importeren
                  </button>
                  <button role="menuitem" style={styles.menuItem} onClick={() => kiesMenu(() => setShowNaamSplits(true))}>
                    Namen splitsen
                  </button>
                  <button role="menuitem" style={styles.menuItem} onClick={() => kiesMenu(() => setShowNaamSync(true))}>
                    Namen synchroniseren
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Filterpaneel */}
      {toonPaneel && (
        <div id="ledenFilterPaneel" style={styles.filterPanel}>
          <div>
            <span style={styles.filterLabel}>Status</span>
            <div style={styles.segment} role="group" aria-label="Status">
              {STATUS_OPTIES.map(([waarde, label]) => (
                <button
                  key={waarde}
                  type="button"
                  aria-pressed={activeFilter === waarde}
                  style={styles.segBtn(activeFilter === waarde)}
                  onClick={() => zetFilters({ actief: waarde })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {alleGroepen.length > 0 && (
            <div>
              <span style={styles.filterLabel}>Groep</span>
              <div style={styles.chipRow}>
                {alleGroepen.map(g => (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={groep === g.naam}
                    style={styles.chip(groep === g.naam)}
                    onClick={() => zetFilters(f => ({ groep: f.groep === g.naam ? '' : g.naam }))}
                  >
                    {g.naam}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <span style={styles.filterLabel}>Categorie</span>
            <div style={styles.chipRow}>
              {hoofdOpties.map(c => catChip(c.code, c.label || c.code))}
              {catChip('Veteranen', 'Veteranen')}
              {catChip('Onbekend', 'Onbekend')}
            </div>
          </div>

          {extraOpties.length > 0 && (
            <div>
              <span style={styles.filterLabel}>Extra categorie</span>
              <div style={styles.chipRow}>
                {extraOpties.map(c => catChip(c.code, c.label || c.code, true))}
              </div>
            </div>
          )}

          <div style={styles.filterFooter}>
            {actieveChips.length > 0
              ? <button type="button" style={styles.btnKlein} onClick={wisAlleFilters}>Filters wissen</button>
              : <span />}
            {toonStats && !wachtOpGroepKeuze && (
              <button type="button" style={styles.btnPrimary} onClick={() => setFilterOpen(false)}>
                Toon {filtered.length} {filtered.length === 1 ? 'lid' : 'leden'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Actieve filters als compacte chips (paneel dicht) */}
      {!toonPaneel && actieveChips.length > 0 && (
        <div style={styles.actiefRij}>
          {actieveChips.map(c => (
            <button key={c.key} type="button" style={styles.actiefChip} onClick={c.wis} aria-label={`Filter ${c.label} verwijderen`}>
              {c.label} <span aria-hidden="true">✕</span>
            </button>
          ))}
          <button type="button" style={styles.btnKlein} onClick={wisAlleFilters}>Alles wissen</button>
        </div>
      )}

      {showImport && (
        <CsvImportModal
          groepen={alleGroepen}
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); vernieuw(); }}
        />
      )}

      {showNaamSplits && (
        <NaamSplitsModal
          onClose={() => setShowNaamSplits(false)}
          onKlaar={() => vernieuw()}
        />
      )}

      {showNaamSync && (
        <NaamSyncModal
          onClose={() => setShowNaamSync(false)}
          onKlaar={() => vernieuw()}
        />
      )}

      {/* Status-regel */}
      {toonStats && (
        <>
          <div style={styles.statsLine}>
            <span>{bijgewerktOm ? `Bijgewerkt om ${bijgewerktOm}` : ''}</span>
            <button
              type="button"
              style={styles.btnKlein}
              onClick={() => vernieuw()}
              disabled={verversen}
              title="Haal de leden opnieuw op van de server"
            >
              {verversen ? 'Vernieuwen…' : '↻ Vernieuwen'}
            </button>
          </div>
          {afgekapt && (
            <div style={styles.waarschuwing}>
              Eerste {leden.length} leden getoond — kies een groep om te verfijnen.
            </div>
          )}
        </>
      )}

      {/* Content */}
      {loading ? (
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
        </div>
      ) : fout ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>⚠️</div>
          <div style={styles.emptyTitle}>Leden laden mislukt</div>
          <button style={{ ...styles.btnSecondary, marginTop: '14px' }} onClick={() => vernieuw()}>
            Opnieuw proberen
          </button>
        </div>
      ) : wachtOpGroepKeuze ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>👥</div>
          <div style={styles.emptyTitle}>Kies een groep of zoek op naam</div>
          <div style={{ fontSize: 'var(--font-size-md)' }}>
            Er zijn te veel leden om in één keer te laden. Kies een groep bij de filters,
            of typ minimaal 3 tekens om te zoeken.
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🔍</div>
          <div style={styles.emptyTitle}>Geen leden gevonden</div>
          <div style={{ fontSize: 'var(--font-size-md)' }}>Pas je zoekopdracht of filters aan.</div>
          {actieveChips.length > 0 && (
            <button style={{ ...styles.btnSecondary, marginTop: '14px' }} onClick={wisAlleFilters}>
              Filters wissen
            </button>
          )}
        </div>
      ) : (
        <div style={styles.grid}>
          {lijstItems.map(item => {
            if (item.type === 'letter') {
              return <div key={item.key} style={styles.letter} aria-hidden="true">{item.letter}</div>;
            }
            const m = item.member;
            const belt = gordelConfig[m.gordel] || gordelConfig['wit'] || { label: m.gordel || '—', bg: '#cccccc', color: '#fff', border: 'none' };
            return (
              <LidKaart
                key={item.key}
                member={m}
                belt={belt}
                lidInfo={info.get(m.id)}
                onOpen={openLid}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
