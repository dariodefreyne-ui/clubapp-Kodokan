import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import { useAuth } from '../contexts/AuthContext';
import CsvImportModal from '../components/leden/CsvImportModal';
import NaamSplitsModal from '../components/leden/NaamSplitsModal';
import NaamSyncModal from '../components/leden/NaamSyncModal';
import { berekenVeteranenSubcat, berekenRuweCategorie, isVetCode } from '../utils/categorieLogica';
import { jaarUitGeboortedatum, lidWeergaveNaam, lidMatchtZoekterm } from '../utils/ledenKoppeling';
import { bouwExportRijen } from '../utils/ledenImport';
import { useGordelOpties } from '../hooks/useGordelOpties';
import { DEFAULT_LEEFTIJDSCATEGORIEEN } from '../config/clubdataDefaults';
import {
  useLedenStore, useLedenFilters, onthoudLaatstGeopend, markeerLedenVerouderd,
} from '../hooks/useLedenStore';

const styles = {
  page: {},
  header: { marginBottom: '20px' },
  title: { fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px 0' },
  subtitle: { fontSize: 'var(--font-size-md)', color: 'var(--text-secondary)', margin: 0 },
  topBar: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '12px' },
  searchInput: {
    flex: '1 1 200px', padding: '10px 14px',
    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)', outline: 'none', minWidth: '0',
  },
  select: {
    padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)', outline: 'none', cursor: 'pointer', flex: '0 1 140px',
  },
  btnPrimary: {
    padding: '10px 18px', background: 'var(--accent-red)', border: 'none',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)', fontWeight: '600', cursor: 'pointer',
    whiteSpace: 'nowrap', minHeight: '44px',
  },
  btnSecondary: {
    padding: '10px 18px', background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)', fontWeight: '500', cursor: 'pointer',
    whiteSpace: 'nowrap', minHeight: '44px',
  },
  chipRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' },
  chip: (active) => ({
    padding: '7px 14px', borderRadius: '20px', cursor: 'pointer',
    border: active ? '1.5px solid var(--accent-red)' : '1px solid var(--border-color)',
    background: active ? 'rgba(192,57,43,0.12)' : 'var(--bg-card)',
    color: active ? 'var(--accent-red)' : 'var(--text-secondary)',
    fontSize: 'var(--font-size-sm)', fontWeight: active ? '700' : '400',
    whiteSpace: 'nowrap', minHeight: '36px', fontFamily: 'inherit',
    transition: 'all 0.15s',
  }),
  statsBar: { display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' },
  statChip: {
    padding: '6px 12px', background: 'var(--bg-card)',
    borderRadius: '20px', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)',
  },
  statCount: { color: 'var(--accent-red)', fontWeight: '700' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))',
    gap: '12px',
  },
  card: {
    background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px',
    cursor: 'pointer', border: '1px solid var(--border-color)',
    transition: 'border-color 0.2s, transform 0.1s',
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' },
  memberName: { fontSize: 'var(--font-size-base)', fontWeight: '600', color: 'var(--text-primary)', margin: 0, lineHeight: '1.3' },
  memberNum: { fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', margin: '2px 0 0' },
  beltBadge: { padding: '3px 10px', borderRadius: 'var(--radius-lg)', fontSize: 'var(--font-size-sm)', fontWeight: '600', flexShrink: 0 },
  cardMeta: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  groupTag: {
    padding: '3px 8px', background: 'var(--bg-primary)', borderRadius: '6px',
    fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)',
  },
  inactiveTag: {
    padding: '3px 8px', background: 'rgba(192,57,43,0.2)', borderRadius: '6px',
    fontSize: 'var(--font-size-xs)', color: 'var(--accent-red)', border: '1px solid rgba(192,57,43,0.4)',
  },
  emptyState: { textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' },
  emptyIcon: { fontSize: '48px', marginBottom: '16px' },
  emptyTitle: { fontSize: 'var(--font-size-lg)', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' },
  catRow: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' },
  catLabel: { fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: '600', marginRight: '2px' },
  loadingWrap: { display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px' },
  spinner: {
    width: '36px', height: '36px',
    border: '3px solid var(--border-color)', borderTop: '3px solid var(--accent-red)',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
  },
};

export default function Ledenbeheer() {
  const navigate = useNavigate();
  const { isBeheerder, configCache } = useAuth();
  const alleGroepen = configCache?.groepen || [];
  const cfg = configCache?.categorieen;
  const { gordels: gordelLijst, kyuMap } = useGordelOpties();

  const gordelConfig = React.useMemo(() => {
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

  const optieCodes = useMemo(
    () => new Set([...categorieOpties.map(c => c.code), 'Veteranen', 'Onbekend']),
    [categorieOpties],
  );
  const actieveCats = useMemo(() => filters.cats.filter(c => optieCodes.has(c)), [filters.cats, optieCodes]);

  // Categorie (U13, U15, ...) volgt het huidige kalenderjaar en wordt live berekend
  // uit de geboortedatum: geen opslag, geen extra reads, verspringt vanzelf op 1 januari.
  const info = useMemo(() => {
    const map = new Map();
    leden.forEach(m => {
      const jaar = jaarUitGeboortedatum(m.geboortedatum);
      map.set(m.id, {
        jaar,
        cat: jaar ? berekenRuweCategorie(jaar, null, cfg) : null,
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
      if (i.cat) tel[i.cat] = (tel[i.cat] || 0) + 1;
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
      return actieveCats.some(c => (c === 'Veteranen' ? !!i.vet : c === 'Onbekend' ? !i.jaar : i.cat === c));
    });
  }, [basis, info, actieveCats]);

  const categorieVan = (m) => info.get(m.id)?.cat ?? null;

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

  const openLid = (id) => {
    onthoudLaatstGeopend(id);
    navigate(`/leden/${id}`);
  };

  const nieuwLid = () => {
    markeerLedenVerouderd();
    navigate('/leden/nieuw');
  };

  const wachtOpGroepKeuze = vereistGroep && !groep && !serverZoek;
  const toonStats = !loading && !fout && !wachtOpGroepKeuze;
  const bijgewerktOm = laadtijd
    ? new Date(laadtijd).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
    : null;

  const catChip = (code, label) => {
    const actief = actieveCats.includes(code);
    const aantal = aantallen[code] || 0;
    return (
      <button
        key={code}
        type="button"
        aria-pressed={actief}
        style={{ ...styles.chip(actief), opacity: aantal === 0 && !actief ? 0.5 : 1 }}
        onClick={() => toggleCat(code)}
      >
        {label} ({aantal})
      </button>
    );
  };

  return (
    <div style={styles.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={styles.header}>
        <h1 style={styles.title}>Ledenbeheer</h1>
        <p style={styles.subtitle}>Overzicht en beheer van alle clubleden</p>
      </div>

      {/* Actie-knoppenrij */}
      <div style={styles.topBar}>
        <input
          type="search"
          placeholder="Zoek op naam, vergunningsnummer of e-mail..."
          value={zoek}
          onChange={e => zetFilters({ zoek: e.target.value })}
          style={styles.searchInput}
        />
        <select value={activeFilter} onChange={e => zetFilters({ actief: e.target.value })} style={styles.select} aria-label="Status">
          <option value="actief">Actief</option>
          <option value="inactief">Inactief</option>
          <option value="alle">Alle</option>
        </select>
        <button style={styles.btnSecondary} onClick={handleExportCSV} title="Exporteer gefilterde leden naar CSV">
          CSV
        </button>
        <button style={styles.btnSecondary} onClick={handleExportXlsx} title="Exporteer gefilterde leden naar Excel (.xlsx), bewerkbaar en terug te importeren">
          Excel
        </button>
        {isBeheerder && (
          <button style={styles.btnSecondary} onClick={() => setShowNaamSplits(true)} title="Voornaam en achternaam apart zetten voor bestaande leden">
            Namen splitsen
          </button>
        )}
        {isBeheerder && (
          <button style={styles.btnSecondary} onClick={() => setShowNaamSync(true)} title="Naam in inschrijvingen, examens en registraties gelijktrekken met het lid">
            Namen synchroniseren
          </button>
        )}
        {isBeheerder && (
          <button style={styles.btnSecondary} onClick={() => setShowImport(true)}>
            Importeren
          </button>
        )}
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

      {/* Groep-chips */}
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

      {/* Categorie-chips (multi-select, met aantallen) */}
      <div style={styles.catRow}>
        <span style={styles.catLabel}>Categorie</span>
        {categorieOpties.map(c => catChip(c.code, c.label || c.code))}
        {catChip('Veteranen', 'Veteranen')}
        {catChip('Onbekend', 'Onbekend')}
        {actieveCats.length > 0 && (
          <button
            type="button"
            style={{ ...styles.btnSecondary, padding: '4px 10px', fontSize: 'var(--font-size-xs)', minHeight: '32px' }}
            onClick={() => zetFilters({ cats: [] })}
          >
            Wis categorie
          </button>
        )}
      </div>

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

      {/* Stats */}
      {toonStats && (
        <div style={styles.statsBar}>
          <span style={styles.statChip}>
            Geladen: <span style={styles.statCount}>{leden.length}</span>
          </span>
          {filtered.length !== leden.length && (
            <span style={styles.statChip}>
              Getoond: <span style={styles.statCount}>{filtered.length}</span>
            </span>
          )}
          {bijgewerktOm && (
            <span style={styles.statChip}>Bijgewerkt om {bijgewerktOm}</span>
          )}
          {afgekapt && (
            <span style={styles.statChip}>
              Eerste {leden.length} leden getoond — kies een groep om te verfijnen
            </span>
          )}
          <button
            style={{ ...styles.btnSecondary, padding: '4px 10px', fontSize: 'var(--font-size-xs)' }}
            onClick={() => vernieuw()}
            disabled={verversen}
            title="Haal de leden opnieuw op van de server"
          >
            {verversen ? 'Vernieuwen…' : '🔄 Vernieuwen'}
          </button>
        </div>
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
            Er zijn te veel leden om in één keer te laden. Kies een groep via de chips
            hierboven, of typ minimaal 3 tekens om te zoeken.
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>🔍</div>
          <div style={styles.emptyTitle}>Geen leden gevonden</div>
          <div style={{ fontSize: 'var(--font-size-md)' }}>Pas je zoekopdracht of filters aan.</div>
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map(member => {
            const belt = gordelConfig[member.gordel] || gordelConfig['wit'] || { label: member.gordel || '—', bg: '#cccccc', color: '#fff', border: 'none' };
            const isActive = member.actief !== false;
            const lidInfo = info.get(member.id);
            const vetSubcat = lidInfo?.vet ?? null;
            const categorie = lidInfo?.cat ?? null;
            const vergnummer = member.vergunningsnummer || member.lidnummer;
            return (
              <div
                key={member.id}
                style={styles.card}
                onClick={() => openLid(member.id)}
                onMouseOver={e => {
                  e.currentTarget.style.borderColor = 'var(--accent-red)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={e => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={styles.cardTop}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                      background: member.fotoUrl ? `url(${member.fotoUrl})` : 'var(--bg-primary)',
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      border: '1px solid var(--border-color)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', color: 'var(--text-secondary)',
                    }}>
                      {!member.fotoUrl && '👤'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={styles.memberName}>{lidWeergaveNaam(member) || '—'}</p>
                      {vergnummer && (
                        <p style={styles.memberNum}>#{vergnummer}</p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ ...styles.beltBadge, background: belt.bg, color: belt.color, border: belt.border }}>
                      {belt.label}
                    </span>
                    {categorie && (
                      <span style={{
                        padding: '2px 7px', borderRadius: 'var(--radius-lg)',
                        fontSize: 'var(--font-size-xs)', fontWeight: '700',
                        background: 'var(--bg-primary)', color: 'var(--text-secondary)',
                        border: '1px solid var(--border-color)', whiteSpace: 'nowrap',
                      }}>
                        {categorie}
                      </span>
                    )}
                    {vetSubcat && (
                      <span style={{
                        padding: '2px 7px', borderRadius: 'var(--radius-lg)',
                        fontSize: 'var(--font-size-xs)', fontWeight: '700',
                        background: 'rgba(20,184,166,0.15)', color: '#0d9488',
                        border: '1px solid rgba(20,184,166,0.35)', whiteSpace: 'nowrap',
                      }}>
                        Vet. {vetSubcat.code}
                      </span>
                    )}
                  </div>
                </div>

                <div style={styles.cardMeta}>
                  {Array.isArray(member.groepen) && member.groepen.map(g => (
                    <span key={g} style={styles.groupTag}>{g}</span>
                  ))}
                  {!isActive && <span style={styles.inactiveTag}>Inactief</span>}
                  {member.bijdrageBetaald && (
                    <span style={{ ...styles.groupTag, color: 'var(--success)', borderColor: 'var(--success)' }}>
                      ✓ Betaald
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
