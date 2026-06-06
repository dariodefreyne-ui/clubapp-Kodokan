import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import Papa from 'papaparse';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast.jsx';
import CsvImportModal from '../components/leden/CsvImportModal';
import { berekenVeteranenSubcat, VET_SUBCATS } from '../utils/categorieLogica';
import { jaarUitGeboortedatum } from '../utils/ledenKoppeling';
import { useGordelOpties } from '../hooks/useGordelOpties';

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    paddingBottom: '32px',
  },
  header: {
    marginBottom: '20px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    margin: '0 0 4px 0',
  },
  subtitle: {
    fontSize: 'var(--font-size-md)',
    color: 'var(--text-secondary)',
    margin: 0,
  },
  topBar: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginBottom: '16px',
  },
  searchInput: {
    flex: '1 1 200px',
    padding: '10px 14px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)',
    outline: 'none',
    minWidth: '0',
  },
  select: {
    padding: '10px 14px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)',
    outline: 'none',
    cursor: 'pointer',
    flex: '0 1 140px',
  },
  btnPrimary: {
    padding: '10px 18px',
    background: 'var(--accent-red)',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    minHeight: '44px',
    transition: 'background 0.2s',
  },
  btnSecondary: {
    padding: '10px 18px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)',
    fontWeight: '500',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    minHeight: '44px',
    transition: 'background 0.2s',
  },
  statsBar: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  statChip: {
    padding: '6px 12px',
    background: 'var(--bg-card)',
    borderRadius: '20px',
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-secondary)',
  },
  statCount: {
    color: 'var(--accent-red)',
    fontWeight: '700',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '12px',
  },
  card: {
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px',
    cursor: 'pointer',
    border: '1px solid var(--border-color)',
    transition: 'border-color 0.2s, transform 0.1s',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
  },
  memberName: {
    fontSize: 'var(--font-size-base)',
    fontWeight: '600',
    color: 'var(--text-primary)',
    margin: 0,
    lineHeight: '1.3',
  },
  memberNum: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-secondary)',
    margin: '2px 0 0',
  },
  beltBadge: {
    padding: '3px 10px',
    borderRadius: 'var(--radius-lg)',
    fontSize: 'var(--font-size-sm)',
    fontWeight: '600',
    flexShrink: 0,
  },
  cardMeta: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  groupTag: {
    padding: '3px 8px',
    background: 'var(--bg-primary)',
    borderRadius: '6px',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border-color)',
  },
  inactiveTag: {
    padding: '3px 8px',
    background: 'rgba(192,57,43,0.2)',
    borderRadius: '6px',
    fontSize: 'var(--font-size-xs)',
    color: 'var(--accent-red)',
    border: '1px solid rgba(192,57,43,0.4)',
  },
  emptyState: {
    textAlign: 'center',
    padding: '60px 20px',
    color: 'var(--text-secondary)',
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  emptyTitle: {
    fontSize: 'var(--font-size-lg)',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    marginBottom: '8px',
  },
  loadingWrap: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '60px',
  },
  spinner: {
    width: '36px',
    height: '36px',
    border: '3px solid var(--border-color)',
    borderTop: '3px solid var(--accent-red)',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
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
        label:  g.label || g.code,
        bg:     kleur,
        color:  isDonker ? '#333333' : '#ffffff',
        border: isDonker ? '1px solid #ccc' : 'none',
      };
    });
    if (!map['wit']) map['wit'] = { label: 'Wit', bg: '#ffffff', color: '#333333', border: '1px solid #ccc' };
    return map;
  }, [gordelLijst]);

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('Alle');
  const [activeFilter, setActiveFilter] = useState('actief');
  const [showImport, setShowImport] = useState(false);

  // Actieve leden server-side gefilterd. 'actief != false' sluit expliciet inactieve
  // leden uit maar geeft ook documenten zonder 'actief' veld terug (oudere records).
  // Bewust GÉÉN server-side orderBy: zie eerdere toelichting over ontbrekende naamvelden.
  useEffect(() => {
    let q;
    if (activeFilter === 'inactief') {
      q = query(collection(db, 'members'), where('actief', '==', false));
    } else if (activeFilter === 'alle') {
      q = collection(db, 'members');
    } else {
      q = query(collection(db, 'members'), where('actief', '!=', false));
    }
    const unsub = onSnapshot(
      q,
      (snap) => {
        const lijst = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        lijst.sort((a, b) => (a.naam || '').localeCompare(b.naam || '', 'nl'));
        setMembers(lijst);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching members:', err);
        toast({ bericht: 'Fout bij laden van leden', type: 'error' });
        setLoading(false);
      }
    );
    return unsub;
  }, [activeFilter, toast]);

  const filtered = members.filter((m) => {
    const term = search.trim().toLowerCase();
    const matchSearch =
      !term ||
      (m.naam || '').toLowerCase().includes(term) ||
      String(m.lidnummer || '').toLowerCase().includes(term) ||
      (m.email || '').toLowerCase().includes(term);
    const matchGroup =
      groupFilter === 'Alle' ||
      (Array.isArray(m.groepen) && m.groepen.includes(groupFilter));
    return matchSearch && matchGroup;
  });

  const handleExportCSV = () => {
    // Exporteert de leden die momenteel aan de filters voldoen.
    const rows = filtered.map((m) => ({
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

  const totaal = members.length;
  const inactiveCount = members.filter((m) => m.actief === false).length;
  const activeCount = totaal - inactiveCount;

  return (
    <div style={styles.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={styles.header}>
        <h1 style={styles.title}>Ledenbeheer</h1>
        <p style={styles.subtitle}>Overzicht en beheer van alle clubleden</p>
      </div>

      {/* Top action bar */}
      <div style={styles.topBar}>
        <input
          type="search"
          placeholder="Zoek op naam, lidnummer of e-mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          style={styles.select}
        >
          <option value="Alle">Alle groepen</option>
          {alleGroepen.map((g) => (
            <option key={g.id} value={g.naam}>{g.naam}</option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          style={styles.select}
        >
          <option value="actief">Actief</option>
          <option value="inactief">Inactief</option>
          <option value="alle">Alle</option>
        </select>
        <button
          style={styles.btnSecondary}
          onClick={handleExportCSV}
          title="Exporteer naar CSV"
        >
          CSV
        </button>
        {isBeheerder && (
          <button
            style={styles.btnSecondary}
            onClick={() => setShowImport(true)}
          >
            CSV importeren
          </button>
        )}
        {isBeheerder && (
          <button
            style={styles.btnPrimary}
            onClick={() => navigate('/leden/nieuw')}
            onMouseOver={(e) => { e.currentTarget.style.background = '#a93226'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'var(--accent-red)'; }}
          >
            + Nieuw lid
          </button>
        )}
      </div>

      {showImport && (
        <CsvImportModal
          groepen={alleGroepen}
          onClose={() => setShowImport(false)}
          onImported={() => setShowImport(false)}
        />
      )}

      {/* Stats */}
      {!loading && (
        <div style={styles.statsBar}>
          <span style={styles.statChip}>
            Totaal: <span style={styles.statCount}>{totaal}</span>
          </span>
          <span style={styles.statChip}>
            Actief: <span style={styles.statCount}>{activeCount}</span>
          </span>
          <span style={styles.statChip}>
            Inactief: <span style={styles.statCount}>{inactiveCount}</span>
          </span>
          <span style={styles.statChip}>
            Getoond: <span style={styles.statCount}>{filtered.length}</span>
          </span>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={styles.loadingWrap}>
          <div style={styles.spinner} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>👥</div>
          <div style={styles.emptyTitle}>
            {members.length === 0 ? 'Nog geen leden' : 'Geen leden gevonden'}
          </div>
          <div style={{ fontSize: 'var(--font-size-md)' }}>
            {members.length === 0
              ? 'Voeg het eerste lid toe via de knop hierboven.'
              : 'Pas je zoekopdracht of filters aan.'}
          </div>
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((member) => {
            const belt = gordelConfig[member.gordel] || gordelConfig['wit'] || { label: member.gordel || '—', bg: '#cccccc', color: '#fff', border: 'none' };
            const isActive = member.actief !== false;
            const gebJaar = jaarUitGeboortedatum(member.geboortedatum);
            const vetSubcat = gebJaar ? berekenVeteranenSubcat(gebJaar) : null;
            return (
              <div
                key={member.id}
                style={styles.card}
                onClick={() => navigate(`/leden/${member.id}`)}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent-red)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                <div style={styles.cardTop}>
                  <div style={{ minWidth: 0 }}>
                    <p style={styles.memberName}>{member.naam || '—'}</p>
                    {member.lidnummer && (
                      <p style={styles.memberNum}>#{member.lidnummer}</p>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    <span
                      style={{
                        ...styles.beltBadge,
                        background: belt.bg,
                        color: belt.color,
                        border: belt.border,
                      }}
                    >
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
                  {Array.isArray(member.groepen) && member.groepen.map((g) => (
                    <span key={g} style={styles.groupTag}>{g}</span>
                  ))}
                  {!isActive && (
                    <span style={styles.inactiveTag}>Inactief</span>
                  )}
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
