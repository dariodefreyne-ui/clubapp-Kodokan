import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  limit,
  startAfter,
  getCountFromServer,
} from 'firebase/firestore';
import Papa from 'papaparse';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast.jsx';
import CsvImportModal from '../components/leden/CsvImportModal';

const BELT_CONFIG = {
  wit:    { label: 'Wit',    bg: '#ffffff', color: '#333333', border: '1px solid #ccc' },
  geel:   { label: 'Geel',   bg: '#f1c40f', color: '#333333', border: 'none' },
  oranje: { label: 'Oranje', bg: '#e67e22', color: '#ffffff', border: 'none' },
  groen:  { label: 'Groen',  bg: '#27ae60', color: '#ffffff', border: 'none' },
  blauw:  { label: 'Blauw',  bg: '#3498db', color: '#ffffff', border: 'none' },
  bruin:  { label: 'Bruin',  bg: '#8B4513', color: '#ffffff', border: 'none' },
  zwart:  { label: 'Zwart',  bg: '#333333', color: '#ffffff', border: 'none' },
};

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

  const PAGE_SIZE = 50;
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const lastDocRef = useRef(null);
  const [counts, setCounts] = useState({ totaal: 0, inactief: 0 });
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('Alle');
  const [activeFilter, setActiveFilter] = useState('actief');
  const [showImport, setShowImport] = useState(false);

  // Bouwt de Firestore-query voor de ledenlijst. Met een zoekterm gebeurt het
  // zoeken server-side op het naamLower-veld (prefix-bereik), zodat álle leden
  // doorzoekbaar zijn — niet enkel de reeds geladen pagina. Zonder zoekterm wordt
  // gewoon op naam gepagineerd. `cursor` (laatste doc) zet de volgende pagina.
  const bouwLedenQuery = useCallback((zoekterm, cursor) => {
    const colRef = collection(db, 'members');
    const term = zoekterm.trim().toLowerCase();
    const constraints = term
      ? [orderBy('naamLower'), where('naamLower', '>=', term), where('naamLower', '<', term + '')]
      : [orderBy('naam')];
    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(limit(PAGE_SIZE));
    return query(colRef, ...constraints);
  }, []);

  const laadEerstePagina = useCallback(async (zoekterm) => {
    setLoading(true);
    try {
      const snap = await getDocs(bouwLedenQuery(zoekterm, null));
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      lastDocRef.current = snap.docs[snap.docs.length - 1] || null;
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error fetching members:', err);
      toast({ bericht: 'Fout bij laden van leden', type: 'error' });
      setMembers([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [bouwLedenQuery, toast]);

  const laadMeer = useCallback(async () => {
    if (!lastDocRef.current || loadingMore) return;
    setLoadingMore(true);
    try {
      const snap = await getDocs(bouwLedenQuery(search, lastDocRef.current));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMembers((prev) => [...prev, ...data]);
      lastDocRef.current = snap.docs[snap.docs.length - 1] || lastDocRef.current;
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (err) {
      console.error('Error loading more members:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [bouwLedenQuery, search, loadingMore]);

  // Totalen via server-side aggregatie (getCountFromServer) — accuraat én goedkoop,
  // los van hoeveel leden er geladen zijn. Missende `actief` telt als actief.
  const laadCounts = useCallback(async () => {
    try {
      const [totaalSnap, inactiefSnap] = await Promise.all([
        getCountFromServer(collection(db, 'members')),
        getCountFromServer(query(collection(db, 'members'), where('actief', '==', false))),
      ]);
      setCounts({ totaal: totaalSnap.data().count, inactief: inactiefSnap.data().count });
    } catch (err) {
      console.error('Error counting members:', err);
    }
  }, []);

  // Debounce de zoekterm zodat niet elke toetsaanslag een query afvuurt.
  useEffect(() => {
    const vertraging = search.trim() ? 300 : 0;
    const t = setTimeout(() => { laadEerstePagina(search); }, vertraging);
    return () => clearTimeout(t);
  }, [search, laadEerstePagina]);

  useEffect(() => { laadCounts(); }, [laadCounts]);

  // Zoeken gebeurt server-side; hier enkel nog groep- en actief-filter op de
  // geladen pagina's.
  const filtered = members.filter((m) => {
    const matchGroup =
      groupFilter === 'Alle' ||
      (Array.isArray(m.groepen) && m.groepen.includes(groupFilter));
    const isActive = m.actief !== false;
    const matchActive =
      activeFilter === 'alle' ||
      (activeFilter === 'actief' && isActive) ||
      (activeFilter === 'inactief' && !isActive);
    return matchGroup && matchActive;
  });

  const handleExportCSV = async () => {
    // Exporteer álle leden (niet enkel de geladen pagina's): haalt op aanvraag de
    // volledige lijst op, met dezelfde groep/actief-filter als de weergave.
    let bron;
    try {
      const snap = await getDocs(query(collection(db, 'members'), orderBy('naam')));
      bron = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch (err) {
      console.error('Error exporting members:', err);
      toast({ bericht: 'Fout bij exporteren', type: 'error' });
      return;
    }
    const teExporteren = bron.filter((m) => {
      const matchGroup =
        groupFilter === 'Alle' ||
        (Array.isArray(m.groepen) && m.groepen.includes(groupFilter));
      const isActive = m.actief !== false;
      const matchActive =
        activeFilter === 'alle' ||
        (activeFilter === 'actief' && isActive) ||
        (activeFilter === 'inactief' && !isActive);
      return matchGroup && matchActive;
    });
    const rows = teExporteren.map((m) => ({
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

  const activeCount = counts.totaal - counts.inactief;
  const inactiveCount = counts.inactief;

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
          placeholder="Zoek op naam..."
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
          onImported={() => { laadEerstePagina(search); laadCounts(); setShowImport(false); }}
        />
      )}

      {/* Stats */}
      {!loading && (
        <div style={styles.statsBar}>
          <span style={styles.statChip}>
            Totaal: <span style={styles.statCount}>{counts.totaal}</span>
          </span>
          <span style={styles.statChip}>
            Actief: <span style={styles.statCount}>{activeCount}</span>
          </span>
          <span style={styles.statChip}>
            Inactief: <span style={styles.statCount}>{inactiveCount}</span>
          </span>
          <span style={styles.statChip}>
            Geladen: <span style={styles.statCount}>{filtered.length}</span>
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
            const belt = BELT_CONFIG[member.gordel] || BELT_CONFIG.wit;
            const isActive = member.actief !== false;
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

      {/* Meer laden — alleen tonen als er nog een volgende pagina is */}
      {!loading && hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
          <button
            style={styles.btnSecondary}
            onClick={laadMeer}
            disabled={loadingMore}
          >
            {loadingMore ? 'Laden…' : 'Meer laden'}
          </button>
        </div>
      )}
    </div>
  );
}
