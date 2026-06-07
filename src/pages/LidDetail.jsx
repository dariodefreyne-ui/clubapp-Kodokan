import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc, getDoc, deleteDoc,
  collection, getDocs, query, orderBy, where, addDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { useConfirm } from '../contexts/ConfirmContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast.jsx';
import { useGordelOpties } from '../hooks/useGordelOpties';
import { updateMetAudit, setMetAudit, koppelLidEnUserViaEmail, koppelBeheerderAanLid, ontkoppelBeheerderVanLid } from '../services/firestoreService';
import { bouwZoekPrefixes } from '../utils/ledenKoppeling';
import { formatDatum } from '../utils/datumUtils';
import { QR_LID_SCHEME } from '../config/appConfig';



const S = {
  page: { minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '16px', paddingBottom: '40px' },
  header: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
    fontSize: 'var(--font-size-md)', padding: '4px 0',
  },
  name: { fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '0', overflowX: 'auto' },
  tab: (active) => ({
    background: 'none', border: 'none',
    color: active ? 'var(--accent-red)' : 'var(--text-secondary)',
    padding: '10px 16px', cursor: 'pointer',
    fontSize: 'var(--font-size-md)', fontWeight: active ? '700' : '400',
    borderBottom: active ? '2px solid var(--accent-red)' : '2px solid transparent',
    whiteSpace: 'nowrap',
  }),
  card: {
    background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '20px',
    border: '1px solid var(--border-color)', marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--accent-red)',
    textTransform: 'uppercase', letterSpacing: '0.8px',
    margin: '0 0 16px 0', paddingBottom: '8px',
    borderBottom: '1px solid var(--border-color)',
  },
  fieldGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: '500' },
  readValue: { fontSize: 'var(--font-size-md)', color: 'var(--text-primary)', minHeight: '20px' },
  input: {
    padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-size-md)', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  },
  select: {
    padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-size-md)', outline: 'none',
    width: '100%', boxSizing: 'border-box', cursor: 'pointer',
  },
  textarea: {
    padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-size-md)', outline: 'none',
    width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: '80px',
  },
  checkboxGroup: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '4px' },
  checkboxLabel: {
    display: 'flex', alignItems: 'center', gap: '7px',
    cursor: 'pointer', fontSize: 'var(--font-size-md)', color: 'var(--text-primary)',
    padding: '6px 12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)', userSelect: 'none',
  },
  checkboxLabelActive: {
    display: 'flex', alignItems: 'center', gap: '7px',
    cursor: 'pointer', fontSize: 'var(--font-size-md)', color: 'var(--text-primary)',
    padding: '6px 12px', background: 'rgba(192,57,43,0.2)', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--accent-red)', userSelect: 'none',
  },
  inlineCheck: {
    display: 'flex', alignItems: 'center', gap: '10px',
    cursor: 'pointer', fontSize: 'var(--font-size-md)', color: 'var(--text-primary)',
  },
  actionBar: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px', justifyContent: 'flex-end' },
  btnPrimary: {
    padding: '12px 28px', background: 'var(--accent-red)', border: 'none',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-size-md)', fontWeight: '600',
    cursor: 'pointer', minHeight: '44px',
  },
  btnCancel: {
    padding: '12px 24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-size-md)', fontWeight: '500',
    cursor: 'pointer', minHeight: '44px',
  },
  btnDanger: {
    padding: '12px 24px', background: 'rgba(192,57,43,0.15)', border: '1px solid var(--accent-red)',
    borderRadius: 'var(--radius-md)', color: 'var(--accent-red)', fontSize: 'var(--font-size-md)', fontWeight: '600',
    cursor: 'pointer', minHeight: '44px',
  },
  beltBadge: () => ({ padding: '3px 10px', borderRadius: 'var(--radius-lg)', fontSize: 'var(--font-size-sm)', fontWeight: '700', display: 'inline-block' }),
  statusBadge: (actief) => ({
    display: 'inline-block', padding: '4px 10px', borderRadius: '999px',
    fontSize: 'var(--font-size-sm)', fontWeight: '700',
    background: actief ? 'rgba(34,197,94,0.18)' : 'rgba(192,57,43,0.15)',
    color: actief ? 'var(--success)' : 'var(--danger)',
    border: `1px solid ${actief ? 'var(--success)' : 'var(--danger)'}`,
  }),
  attendanceRow: { display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border-color)' },
  qrContainer: { textAlign: 'center', padding: '24px' },
};

export default function LidDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const { isBeheerder, isAdmin, configCache } = useAuth();
  const alleGroepen = configCache?.groepen || [];
  const { opties: BELTS, labels: BELT_LABELS, gordels: gordelLijst } = useGordelOpties();
  const gordelKleuren = React.useMemo(() => {
    const map = {};
    gordelLijst.forEach(g => {
      const kleur = g.kleur || '#cccccc';
      const isDonker = kleur.toLowerCase() === '#ffffff' || kleur.toLowerCase() === '#fff';
      map[g.code] = {
        bg:     kleur,
        color:  isDonker ? '#333' : '#fff',
        border: isDonker ? '1px solid #ccc' : 'none',
      };
    });
    if (!map['wit']) map['wit'] = { bg: '#ffffff', color: '#333', border: '1px solid #ccc' };
    return map;
  }, [gordelLijst]);
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('profiel');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [attendance, setAttendance] = useState([]);
  const [attendLoading, setAttendLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [aankopen, setAankopen] = useState([]);
  const [aankopenLaden, setAankopenLaden] = useState(false);
  const [gekoppeldeUser, setGekoppeldeUser] = useState(null);
  const [koppelZoek, setKoppelZoek] = useState('');
  const [koppelResultaten, setKoppelResultaten] = useState([]);
  const [koppelBezig, setKoppelBezig] = useState(false);
  const [beheerders, setBeheerders] = useState([]);
  const [beheerderZoek, setBeheerderZoek] = useState('');
  const [beheerderResultaten, setBeheerderResultaten] = useState([]);
  const [beheerderBezig, setBeheerderBezig] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    fetchMember();
  }, [id]);

  useEffect(() => {
    if (member?.linkedUserId) {
      getDoc(doc(db, 'users', member.linkedUserId)).then(snap => {
        setGekoppeldeUser(snap.exists() ? { uid: snap.id, ...snap.data() } : null);
      }).catch(() => {});
    } else {
      getDocs(query(collection(db, 'users'), where('linkedMemberId', '==', id))).then(snap => {
        if (!snap.empty) setGekoppeldeUser({ uid: snap.docs[0].id, ...snap.docs[0].data() });
        else setGekoppeldeUser(null);
      }).catch(() => {});
    }
  }, [id, member]);

  useEffect(() => {
    if (tab === 'activiteit') { fetchAttendance(); fetchAankopen(); }
    if (tab === 'lidmaatschap') generateQr();
  }, [tab]);

  useEffect(() => {
    const uids = member?.beheerderUids;
    if (!Array.isArray(uids) || uids.length === 0) { setBeheerders([]); return; }
    Promise.all(uids.map(uid =>
      getDoc(doc(db, 'users', uid)).then(s => s.exists() ? { uid: s.id, ...s.data() } : null)
    )).then(results => setBeheerders(results.filter(Boolean)));
  }, [member?.beheerderUids]);

  async function fetchMember() {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'members', id));
      if (snap.exists()) {
        const data = { id: snap.id, ...snap.data() };
        setMember(data);
        setForm(data);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function fetchAttendance() {
    setAttendLoading(true);
    try {
      const q = query(collection(db, 'members', id, 'attendance'), orderBy('date', 'desc'));
      const snap = await getDocs(q);
      setAttendance(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
      toast({ bericht: 'Fout bij laden aanwezigheid', type: 'error' });
    }
    setAttendLoading(false);
  }

  async function fetchAankopen() {
    setAankopenLaden(true);
    try {
      const q = query(collection(db, 'sales'), where('koperId', '==', id));
      const snap = await getDocs(q);
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      items.sort((a, b) => {
        const ta = (a.aangemaaktOp || a.createdAt)?.toMillis?.() || 0;
        const tb = (b.aangemaaktOp || b.createdAt)?.toMillis?.() || 0;
        return tb - ta;
      });
      setAankopen(items);
    } catch (e) {
      console.error(e);
      toast({ bericht: 'Fout bij laden aankopen', type: 'error' });
    }
    setAankopenLaden(false);
  }

  async function generateQr() {
    try {
      const QRCode = (await import('qrcode')).default;
      const url = await QRCode.toDataURL(`${QR_LID_SCHEME}:${id}`, { width: 250, margin: 2, color: { dark: '#000', light: '#fff' } });
      setQrDataUrl(url);
    } catch (e) { console.error('QR error', e); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        naam: form.naam?.trim() || '',
        naamLower: (form.naam?.trim() || '').toLowerCase(),
        zoekPrefixes: bouwZoekPrefixes(form.naam),
        geboortedatum: form.geboortedatum || null,
        email: form.email?.trim() || null,
        telefoon: form.telefoon?.trim() || null,
        gordel: form.gordel || 'wit',
        lidnummer: form.lidnummer?.trim() || null,
        vergunningsnummer: form.vergunningsnummer?.trim() || null,
        ingeschrevenJaar: form.ingeschrevenJaar ? Number(form.ingeschrevenJaar) : null,
        groepen: form.groepen || [],
        medischeInfo: form.medischeInfo?.trim() || null,
        noodcontactNaam: form.noodcontactNaam?.trim() || null,
        noodcontactTelefoon: form.noodcontactTelefoon?.trim() || null,
        bijdrageBetaald: form.bijdrageBetaald || false,
        bijdrageVervaldatum: form.bijdrageVervaldatum || null,
        actief: form.actief !== false,
      };
      await updateMetAudit(doc(db, 'members', id), payload);
      // Koppel automatisch aan een bestaand account met dit e-mailadres, tenzij
      // er al een koppeling is (manuele koppeling niet overschrijven).
      let linkedUserId = member?.linkedUserId || null;
      if (payload.email && !linkedUserId) {
        try { linkedUserId = await koppelLidEnUserViaEmail(id, payload.email); } catch { /* niet kritisch */ }
      }
      setMember(m => ({ ...m, id, ...payload, ...(linkedUserId ? { linkedUserId } : {}) }));
      setEditing(false);
      toast({ bericht: 'Lid opgeslagen', type: 'success' });
    } catch (e) {
      console.error(e);
      toast({ bericht: 'Fout bij opslaan', type: 'error' });
    }
    setSaving(false);
  }

  async function handleDeactiveer() {
    const ok = await confirm({
      titel: 'Lid deactiveren?',
      beschrijving: `${member?.naam || 'Dit lid'} wordt op inactief gezet. Het lid blijft bewaard en kan later opnieuw geactiveerd worden via de Lidmaatschap-tab.`,
      bevestigLabel: 'Deactiveren',
      variant: 'danger',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await updateMetAudit(doc(db, 'members', id), {
        actief: false,
        gedeactiveerdOp: serverTimestamp(),
      });
      toast({ bericht: 'Lid gedeactiveerd', type: 'success' });
      navigate('/leden');
    } catch (e) {
      console.error(e);
      toast({ bericht: 'Fout bij deactiveren', type: 'error' });
      setDeleting(false);
    }
  }

  async function handleHardDelete() {
    const ok = await confirm({
      titel: 'Lid definitief verwijderen?',
      beschrijving: `${member?.naam || 'Dit lid'} wordt PERMANENT verwijderd uit het ledenbestand. Deze actie kan niet ongedaan gemaakt worden — overweeg eerst deactiveren.`,
      bevestigLabel: 'Definitief verwijderen',
      variant: 'danger',
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'members', id));
      toast({ bericht: 'Lid verwijderd', type: 'success' });
      navigate('/leden');
    } catch (e) {
      console.error(e);
      toast({ bericht: 'Fout bij verwijderen', type: 'error' });
      setDeleting(false);
    }
  }

  function toggleGroep(g) {
    const groepen = form.groepen || [];
    setForm(f => ({
      ...f,
      groepen: groepen.includes(g) ? groepen.filter(x => x !== g) : [...groepen, g]
    }));
  }

  if (loading) return <div style={S.page}><div style={{ padding:'40px', textAlign:'center', color:'var(--text-secondary)' }}>Laden...</div></div>;
  if (!member) return <div style={S.page}><div style={{ padding:'40px', textAlign:'center', color:'var(--text-secondary)' }}>Lid niet gevonden.</div></div>;

  return (
    <div style={S.page}>
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => navigate('/leden')}>← Terug naar ledenlijst</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <div style={S.name}>{member.naam || '—'}</div>
        {member.gordel && <span style={{ ...S.beltBadge(), ...(gordelKleuren[member.gordel] || gordelKleuren['wit']) }}>{member.gordel}</span>}
      </div>

      <div style={S.tabs}>
        {[
          { id: 'profiel',      label: '👤 Profiel' },
          { id: 'lidmaatschap', label: '🏅 Lidmaatschap' },
          { id: 'activiteit',   label: '📊 Activiteit' },
        ].map(t => (
          <button key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: PROFIEL ── */}
      {tab === 'profiel' && (
        <div>
          {!editing ? (
            <div>
              <div style={S.card}>
                <p style={S.sectionTitle}>Persoonlijke gegevens</p>
                <div style={S.fieldGrid}>
                  <ReadField label="Naam" value={member.naam} />
                  <ReadField label="Geboortedatum" value={formatDatum(member.geboortedatum)} />
                  <ReadField label="Email" value={member.email} />
                  <ReadField label="Telefoon" value={member.telefoon} />
                </div>
              </div>

              <div style={S.card}>
                <p style={S.sectionTitle}>Medisch & noodcontact</p>
                <div style={{ marginBottom: '14px' }}>
                  <div style={S.label}>Medische informatie</div>
                  <div style={{ ...S.readValue, marginTop: '6px', whiteSpace: 'pre-wrap' }}>
                    {member.medischeInfo || '—'}
                  </div>
                </div>
                <div style={S.fieldGrid}>
                  <ReadField label="Noodcontact naam" value={member.noodcontactNaam} />
                  <ReadField label="Noodcontact telefoon" value={member.noodcontactTelefoon} />
                </div>
              </div>

              {isBeheerder && (
                <div style={S.card}>
                  <p style={S.sectionTitle}>Gekoppeld account</p>
                  {gekoppeldeUser ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{gekoppeldeUser.naam || '(Geen naam)'}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>{gekoppeldeUser.email}</div>
                      </div>
                      <button style={S.btnCancel} onClick={async () => {
                        await setMetAudit(doc(db, 'users', gekoppeldeUser.uid), { linkedMemberId: null });
                        setGekoppeldeUser(null);
                      }}>Ontkoppelen</button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                        <input type="text" style={{ ...S.input, flex: 1 }} value={koppelZoek}
                          onChange={e => setKoppelZoek(e.target.value)} placeholder="Zoek op e-mailadres..." />
                        <button style={S.btnCancel} disabled={koppelBezig} onClick={async () => {
                          if (!koppelZoek.trim()) return;
                          setKoppelBezig(true);
                          const snap = await getDocs(query(collection(db, 'users'), where('email', '==', koppelZoek.trim().toLowerCase())));
                          setKoppelResultaten(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
                          setKoppelBezig(false);
                        }}>Zoeken</button>
                      </div>
                      {koppelResultaten.length === 0 && koppelZoek && !koppelBezig && (
                        <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Geen account gevonden.</div>
                      )}
                      {koppelResultaten.map(u => (
                        <div key={u.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '6px' }}>
                          <div>
                            <div style={{ fontWeight: '600' }}>{u.naam || '(Geen naam)'}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>{u.email}</div>
                          </div>
                          <button style={S.btnPrimary} onClick={async () => {
                            await setMetAudit(doc(db, 'users', u.uid), { linkedMemberId: id });
                            setGekoppeldeUser(u); setKoppelResultaten([]); setKoppelZoek('');
                          }}>Koppelen</button>
                        </div>
                      ))}
                      <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
                        Koppelen via e-mailadres zodat dit lid zijn profiel kan bekijken.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {isBeheerder && (
                <div style={S.card}>
                  <p style={S.sectionTitle}>Ouders / beheerders</p>
                  {beheerders.length > 0 && (
                    <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {beheerders.map(u => (
                        <div key={u.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                          <div>
                            <div style={{ fontWeight: '600' }}>{u.naam || '(Geen naam)'}</div>
                            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>{u.email}</div>
                          </div>
                          <button style={S.btnCancel} onClick={async () => {
                            try {
                              await ontkoppelBeheerderVanLid(u.uid, id);
                              setMember(m => ({ ...m, beheerderUids: (m.beheerderUids || []).filter(x => x !== u.uid) }));
                              toast({ bericht: 'Beheerder ontkoppeld', type: 'success' });
                            } catch { toast({ bericht: 'Fout bij ontkoppelen', type: 'error' }); }
                          }}>Ontkoppelen</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                    <input type="text" style={{ ...S.input, flex: 1 }} value={beheerderZoek}
                      onChange={e => setBeheerderZoek(e.target.value)}
                      placeholder="Zoek ouder op e-mailadres..." />
                    <button style={S.btnCancel} disabled={beheerderBezig} onClick={async () => {
                      if (!beheerderZoek.trim()) return;
                      setBeheerderBezig(true);
                      const snap = await getDocs(query(collection(db, 'users'), where('email', '==', beheerderZoek.trim().toLowerCase())));
                      setBeheerderResultaten(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
                      setBeheerderBezig(false);
                    }}>Zoeken</button>
                  </div>
                  {beheerderResultaten.length === 0 && beheerderZoek && !beheerderBezig && (
                    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '6px' }}>Geen account gevonden.</div>
                  )}
                  {beheerderResultaten.map(u => (
                    <div key={u.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '6px' }}>
                      <div>
                        <div style={{ fontWeight: '600' }}>{u.naam || '(Geen naam)'}</div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>{u.email}</div>
                      </div>
                      <button style={S.btnPrimary} disabled={(member.beheerderUids || []).includes(u.uid)} onClick={async () => {
                        try {
                          await koppelBeheerderAanLid(u.uid, id);
                          setMember(m => ({ ...m, beheerderUids: [...(m.beheerderUids || []), u.uid] }));
                          setBeheerderResultaten([]); setBeheerderZoek('');
                          toast({ bericht: `${u.naam || u.email} gekoppeld als beheerder`, type: 'success' });
                        } catch { toast({ bericht: 'Fout bij koppelen', type: 'error' }); }
                      }}>{(member.beheerderUids || []).includes(u.uid) ? 'Al gekoppeld' : 'Koppelen'}</button>
                    </div>
                  ))}
                  <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>
                    Beheerders kunnen inschrijvingen uitvoeren namens dit lid.
                  </div>
                </div>
              )}

              <div style={S.actionBar}>
                {isAdmin && (
                  <button style={S.btnDanger} onClick={handleHardDelete} disabled={deleting} title="Alleen voor admins — permanent">
                    {deleting ? 'Bezig...' : 'Definitief verwijderen'}
                  </button>
                )}
                {member.actief !== false && (
                  <button style={S.btnDanger} onClick={handleDeactiveer} disabled={deleting}>
                    {deleting ? 'Bezig...' : 'Deactiveren'}
                  </button>
                )}
                <button style={S.btnPrimary} onClick={() => setEditing(true)}>Bewerken</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={S.card}>
                <p style={S.sectionTitle}>Persoonlijke gegevens</p>
                <div style={S.fieldGrid}>
                  <div style={S.fieldWrap}>
                    <label style={S.label}>Naam</label>
                    <input type="text" style={S.input} value={form.naam || ''} onChange={e => setForm(f => ({ ...f, naam: e.target.value }))} />
                  </div>
                  <div style={S.fieldWrap}>
                    <label style={S.label}>Geboortedatum</label>
                    <input type="date" style={S.input} value={form.geboortedatum || ''} onChange={e => setForm(f => ({ ...f, geboortedatum: e.target.value }))} />
                  </div>
                  <div style={S.fieldWrap}>
                    <label style={S.label}>E-mail</label>
                    <input type="email" style={S.input} value={form.email || ''} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div style={S.fieldWrap}>
                    <label style={S.label}>Telefoon</label>
                    <input type="tel" style={S.input} value={form.telefoon || ''} onChange={e => setForm(f => ({ ...f, telefoon: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div style={S.card}>
                <p style={S.sectionTitle}>Medisch & noodcontact</p>
                <div style={{ marginBottom: '14px' }}>
                  <label style={S.label}>Medische informatie</label>
                  <textarea style={{ ...S.textarea, marginTop: '6px' }} value={form.medischeInfo || ''}
                    onChange={e => setForm(f => ({ ...f, medischeInfo: e.target.value }))}
                    placeholder="Allergieën, medicatie, beperkingen..." />
                </div>
                <div style={S.fieldGrid}>
                  <div style={S.fieldWrap}>
                    <label style={S.label}>Noodcontact naam</label>
                    <input type="text" style={S.input} value={form.noodcontactNaam || ''} onChange={e => setForm(f => ({ ...f, noodcontactNaam: e.target.value }))} />
                  </div>
                  <div style={S.fieldWrap}>
                    <label style={S.label}>Noodcontact telefoon</label>
                    <input type="tel" style={S.input} value={form.noodcontactTelefoon || ''} onChange={e => setForm(f => ({ ...f, noodcontactTelefoon: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div style={S.actionBar}>
                <button style={S.btnCancel} onClick={() => { setEditing(false); setForm(member); }}>Annuleren</button>
                <button style={S.btnPrimary} onClick={handleSave} disabled={saving}>
                  {saving ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: LIDMAATSCHAP ── */}
      {tab === 'lidmaatschap' && (
        <div>
          {!editing ? (
            <div>
              <div style={S.card}>
                <p style={S.sectionTitle}>Club gegevens</p>
                <div style={S.fieldGrid}>
                  <ReadField label="Gordel" value={member.gordel ? <span style={{ ...S.beltBadge(), ...(gordelKleuren[member.gordel] || gordelKleuren['wit']) }}>{member.gordel}</span> : '—'} />
                  <ReadField label="Lidnummer" value={member.lidnummer} />
                  <ReadField label="Vergunningsnummer" value={member.vergunningsnummer} />
                  <ReadField label="Ingeschreven jaar" value={member.ingeschrevenJaar} />
                </div>
                <div style={{ marginTop: '14px' }}>
                  <div style={S.label}>Groepen</div>
                  <div style={{ ...S.readValue, marginTop: '6px' }}>
                    {(member.groepen || []).length ? (member.groepen || []).join(', ') : '—'}
                  </div>
                </div>
              </div>

              <div style={S.card}>
                <p style={S.sectionTitle}>Bijdrage & status</p>
                <div style={S.fieldGrid}>
                  <ReadField label="Bijdrage betaald" value={member.bijdrageBetaald ? 'Ja' : 'Nee'} />
                  <ReadField label="Vervaldatum bijdrage" value={formatDatum(member.bijdrageVervaldatum)} />
                  <ReadField label="Status" value={<span style={S.statusBadge(!!member.actief)}>{member.actief ? 'Actief' : 'Inactief'}</span>} />
                </div>
              </div>

              <div style={S.card}>
                <p style={S.sectionTitle}>QR Check-in code</p>
                <div style={S.qrContainer}>
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="QR Code" style={{ borderRadius: 'var(--radius-lg)', border: '4px solid #fff' }} />
                  ) : (
                    <div style={{ color: 'var(--text-secondary)', padding: '20px' }}>QR genereren...</div>
                  )}
                  <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '8px' }}>Scan om aanwezigheid te registreren · Lid ID: {id}</p>
                </div>
              </div>

              <div style={S.actionBar}>
                <button style={S.btnPrimary} onClick={() => setEditing(true)}>Bewerken</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={S.card}>
                <p style={S.sectionTitle}>Club gegevens</p>
                <div style={S.fieldGrid}>
                  <div style={S.fieldWrap}>
                    <label style={S.label}>Gordel</label>
                    <select style={S.select} value={form.gordel || 'wit'} onChange={e => setForm(f => ({ ...f, gordel: e.target.value }))}>
                      {BELTS.map(b => <option key={b} value={b}>{BELT_LABELS[b] || b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
                    </select>
                  </div>
                  <div style={S.fieldWrap}>
                    <label style={S.label}>Lidnummer</label>
                    <input type="text" style={S.input} value={form.lidnummer || ''} onChange={e => setForm(f => ({ ...f, lidnummer: e.target.value }))} />
                  </div>
                  <div style={S.fieldWrap}>
                    <label style={S.label}>Vergunningsnummer</label>
                    <input type="text" style={S.input} value={form.vergunningsnummer || ''} onChange={e => setForm(f => ({ ...f, vergunningsnummer: e.target.value }))} />
                  </div>
                  <div style={S.fieldWrap}>
                    <label style={S.label}>Ingeschreven jaar</label>
                    <input type="number" style={S.input} value={form.ingeschrevenJaar || ''} onChange={e => setForm(f => ({ ...f, ingeschrevenJaar: e.target.value }))} min="1900" />
                  </div>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <label style={S.label}>Groepen</label>
                  <div style={S.checkboxGroup}>
                    {alleGroepen.map(g => {
                      const active = (form.groepen || []).includes(g.naam);
                      return (
                        <label key={g.id} style={active ? S.checkboxLabelActive : S.checkboxLabel}>
                          <input type="checkbox" checked={active} onChange={() => toggleGroep(g.naam)} style={{ display: 'none' }} />
                          {active ? '✓ ' : ''}{g.naam}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div style={S.card}>
                <p style={S.sectionTitle}>Bijdrage & status</p>
                <div style={S.fieldGrid}>
                  <div style={S.fieldWrap}>
                    <label style={S.label}>Vervaldatum bijdrage</label>
                    <input type="date" style={S.input} value={form.bijdrageVervaldatum || ''} onChange={e => setForm(f => ({ ...f, bijdrageVervaldatum: e.target.value }))} />
                  </div>
                </div>
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <label style={S.inlineCheck}>
                    <input type="checkbox" checked={!!form.bijdrageBetaald} onChange={e => setForm(f => ({ ...f, bijdrageBetaald: e.target.checked }))}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--accent-red)', cursor: 'pointer' }} />
                    <span>Bijdrage betaald</span>
                  </label>
                  <label style={S.inlineCheck}>
                    <input type="checkbox" checked={form.actief !== false} onChange={e => setForm(f => ({ ...f, actief: e.target.checked }))}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--accent-red)', cursor: 'pointer' }} />
                    <span>Lid is actief</span>
                  </label>
                </div>
              </div>

              <div style={S.actionBar}>
                <button style={S.btnCancel} onClick={() => { setEditing(false); setForm(member); }}>Annuleren</button>
                <button style={S.btnPrimary} onClick={handleSave} disabled={saving}>
                  {saving ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: ACTIVITEIT (aanwezigheid + aankopen) ── */}
      {tab === 'activiteit' && (
        <div>
          <div style={S.card}>
            <p style={S.sectionTitle}>Aanwezigheidsgeschiedenis</p>
            {attendLoading ? (
              <div style={{ color: 'var(--text-secondary)' }}>Laden...</div>
            ) : attendance.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)' }}>Nog geen aanwezigheden.</div>
            ) : (
              attendance.map(a => (
                <div key={a.id} style={S.attendanceRow}>
                  <span>{formatDatum(a.date) || a.date}</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>{a.trainingGroup || a.trainingId || '—'}</span>
                  <span style={{ color: 'var(--success)', fontSize: 'var(--font-size-sm)' }}>✓ Aanwezig</span>
                </div>
              ))
            )}
            <div style={{ marginTop: '12px', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
              {attendance.length} trainingen bijgewoond
            </div>
          </div>

          <div style={S.card}>
            <p style={S.sectionTitle}>Aankopen</p>
            {aankopenLaden ? (
              <div style={{ color: 'var(--text-secondary)' }}>Laden...</div>
            ) : aankopen.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)' }}>Geen aankopen geregistreerd.</div>
            ) : (
              aankopen.map(s => {
                const ts = s.aangemaaktOp || s.createdAt;
                const datum = formatDatum(ts?.toDate ? ts.toDate() : ts);
                const bedrag = Number(s.totaal ?? s.total ?? 0);
                const samenvatting = (s.items || []).map(i => `${i.name} ${i.variant} x${i.qty}`).join(', ');
                return (
                  <div key={s.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{datum || '—'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {s.betaald === false && (
                          <span style={{ background: 'var(--danger)', color: 'var(--text-primary)', fontSize: 'var(--font-size-xs)', fontWeight: '700', padding: '2px 7px', borderRadius: '10px' }}>Openstaand</span>
                        )}
                        <span style={{ fontWeight: '700', fontSize: '15px' }}>
                          €{bedrag % 1 === 0 ? Math.round(bedrag) : bedrag.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div style={{ fontSize: '13px' }}>{samenvatting || '—'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {(() => {
                        const m = s.betaalmethode || s.paymentMethod;
                        if (!m) return null;
                        const isOvs = m.toLowerCase().includes('overschrijving');
                        return <span style={{ background: isOvs ? '#3498db' : 'var(--success)', color: 'var(--text-primary)', fontSize: 'var(--font-size-xs)', fontWeight: '700', padding: '2px 7px', borderRadius: '10px', textTransform: 'capitalize' }}>{m}</span>;
                      })()}
                      {s.betaald !== false && (
                        <span style={{ background: 'var(--success)', color: 'var(--text-primary)', fontSize: 'var(--font-size-xs)', fontWeight: '700', padding: '2px 7px', borderRadius: '10px' }}>Betaald</span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

    </div>
  );
}

function ReadField({ label, value }) {
  const isEmpty = value === null || value === undefined || value === '' || (typeof value === 'number' && isNaN(value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: '500' }}>{label}</div>
      <div style={{ fontSize: 'var(--font-size-md)', color: 'var(--text-primary)', minHeight: '20px' }}>
        {isEmpty ? '—' : value}
      </div>
    </div>
  );
}
