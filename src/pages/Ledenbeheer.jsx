import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, getDocsFromServer, limit, query, where } from 'firebase/firestore';
import Papa from 'papaparse';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast.jsx';
import CsvImportModal from '../components/leden/CsvImportModal';
import { berekenVeteranenSubcat } from '../utils/categorieLogica';
import { jaarUitGeboortedatum } from '../utils/ledenKoppeling';
import { useGordelOpties } from '../hooks/useGordelOpties';

const MAX_LEDEN_PER_LADING = 500;

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
  const toast = useToast();
  const alleGroepen = configCache?.groepen || [];
  const { gordels: gordelLijst } = useGordelOpties();

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

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [heeftGezocht, setHeeftGezocht] = useState(false);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('actief');
  const [showImport, setShowImport] = useState(false);
  const zoekTimerRef = useRef(null);

  async function laadLeden(groep, actief) {
    setLoading(true);
    try {
      let q;
      if (groep) {
        if (actief === 'inactief') {
          q = query(collection(db, 'members'), where('actief', '==', false), where('groepen', 'array-contains', groep));
        } else if (actief === 'alle') {
          q = query(collection(db, 'members'), where('groepen', 'array-contains', groep), limit(MAX_LEDEN_PER_LADING));
        } else {
          q = query(collection(db, 'members'), where('actief', '!=', false), where('groepen', 'array-contains', groep));
        }
      } else {
        if (actief === 'inactief') {
          q = query(collection(db, 'members'), where('actief', '==', false));
        } else if (actief === 'alle') {
          q = query(collection(db, 'members'), limit(MAX_LEDEN_PER_LADING));
        } else {
          q = query(collection(db, 'members'), where('actief', '!=', false));
        }
      }
      // Forceer een verse server-fetch i.p.v. de lokale IndexedDB-cache — anders
      // kan een onbetrouwbare netwerkdetectie (vooral op iOS/iPadOS) stilletjes
      // verouderde data tonen zonder foutmelding.
      let snap;
      try {
        snap = await getDocsFromServer(q);
      } catch {
        snap = await getDocs(q); // offline: val terug op cache
      }
      const lijst = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      lijst.sort((a, b) => (a.naam || '').localeCompare(b.naam || '', 'nl'));
      setMembers(lijst);
      setHeeftGezocht(true);
      if (actief === 'alle' && lijst.length === MAX_LEDEN_PER_LADING) {
        toast({ bericht: `Eerste ${MAX_LEDEN_PER_LADING} leden getoond. Gebruik een groepfilter of zoekterm om verder te verfijnen.`, type: 'info' });
      }
    } catch (err) {
      console.error('Error fetching members:', err);
      toast({ bericht: 'Fout bij laden van leden', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  // Laad leden wanneer groepchip geselecteerd wordt
  useEffect(() => {
    if (!groupFilter) {
      setMembers([]);
      setHeeftGezocht(false);
      return;
    }
    laadLeden(groupFilter, activeFilter);
  }, [groupFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Herlaad bij wijziging actief-filter (enkel als al gezocht via groepchip)
  useEffect(() => {
    if (heeftGezocht && groupFilter) {
      laadLeden(groupFilter, activeFilter);
    }
  }, [activeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced naamzoekopdracht wanneer geen groep geselecteerd is (min. 3 tekens)
  useEffect(() => {
    if (groupFilter) return;
    clearTimeout(zoekTimerRef.current);
    const term = search.trim();
    if (term.length >= 3) {
      zoekTimerRef.current = setTimeout(() => laadLeden('', activeFilter), 450);
    } else if (term.length === 0 && heeftGezocht) {
      setMembers([]);
      setHeeftGezocht(false);
    }
    return () => clearTimeout(zoekTimerRef.current);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = members.filter(m => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      (m.naam || '').toLowerCase().includes(term) ||
      String(m.vergunningsnummer || m.lidnummer || '').toLowerCase().includes(term) ||
      (m.email || '').toLowerCase().includes(term)
    );
  });

  const handleExportCSV = () => {
    const rows = filtered.map(m => ({
      Vergunningsnummer: m.vergunningsnummer || '',
      Lidnummer: m.lidnummer || '',
      Naam: m.naam || '',
      Geboortedatum: m.geboortedatum || '',
      Email: m.email || '',
      Telefoon: m.telefoon || '',
      Gordel: m.gordel || '',
      Groepen: Array.isArray(m.groepen) ? m.groepen.join('; ') : '',
      Actief: m.actief !== false ? 'Ja' : 'Nee',
      IngeschrevenJaar: m.ingeschrevenJaar || '',
      BijdrageBetaald: m.bijdrageBetaald ? 'Ja' : 'Nee',
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leden_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toonStats = heeftGezocht && !loading;

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
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <select value={activeFilter} onChange={e => setActiveFilter(e.target.value)} style={styles.select}>
          <option value="actief">Actief</option>
          <option value="inactief">Inactief</option>
          <option value="alle">Alle</option>
        </select>
        <button style={styles.btnSecondary} onClick={handleExportCSV} title="Exporteer gefilterde leden naar CSV">
          CSV
        </button>
        {isBeheerder && (
          <button style={styles.btnSecondary} onClick={() => setShowImport(true)}>
            CSV importeren
          </button>
        )}
        {isBeheerder && (
          <button
            style={styles.btnPrimary}
            onClick={() => navigate('/leden/nieuw')}
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
            style={styles.chip(groupFilter === g.naam)}
            onClick={() => setGroupFilter(prev => prev === g.naam ? '' : g.naam)}
          >
            {g.naam}
          </button>
        ))}
      </div>

      {showImport && (
        <CsvImportModal
          groepen={alleGroepen}
          onClose={() => setShowImport(false)}
          onImported={() => setShowImport(false)}
        />
      )}

      {/* Stats */}
      {toonStats && (
        <div style={styles.statsBar}>
          <span style={styles.statChip}>
            Geladen: <span style={styles.statCount}>{members.length}</span>
          </span>
          {filtered.length !== members.length && (
            <span style={styles.statChip}>
              Getoond: <span style={styles.statCount}>{filtered.length}</span>
            </span>
          )}
          <button
            style={{ ...styles.btnSecondary, padding: '4px 10px', fontSize: 'var(--font-size-xs)' }}
            onClick={() => laadLeden(groupFilter, activeFilter)}
            title="Haal de leden opnieuw op van de server"
          >
            🔄 Vernieuwen
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
        </div>
      ) : !heeftGezocht ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>👥</div>
          <div style={styles.emptyTitle}>Selecteer een groep of zoek op naam</div>
          <div style={{ fontSize: 'var(--font-size-md)' }}>
            Kies een groep via de chips hierboven, typ minimaal 3 tekens om op naam te zoeken,
            of toon alle leden.
          </div>
          <button
            style={{ ...styles.btnSecondary, marginTop: '14px' }}
            onClick={() => laadLeden('', activeFilter)}
          >
            Toon alle leden
          </button>
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
            const gebJaar = jaarUitGeboortedatum(member.geboortedatum);
            const vetSubcat = gebJaar ? berekenVeteranenSubcat(gebJaar, null, configCache?.categorieen) : null;
            const vergnummer = member.vergunningsnummer || member.lidnummer;
            return (
              <div
                key={member.id}
                style={styles.card}
                onClick={() => navigate(`/leden/${member.id}`)}
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
                      <p style={styles.memberName}>{member.naam || '—'}</p>
                      {vergnummer && (
                        <p style={styles.memberNum}>#{vergnummer}</p>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span style={{ ...styles.beltBadge, background: belt.bg, color: belt.color, border: belt.border }}>
                      {belt.label}
                    </span>
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
