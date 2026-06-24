// ─── AanwezigheidCorrectieModal ────────────────────────────────────────────────
// Pop-up voor het corrigeren van aanwezigheid over een langere periode (vb. de
// 2-maandelijkse uitbetalingsperiode). Vervangt de inline uitklap-rij in de
// matrix: die bleef bij horizontaal scrollen met position:sticky vastgepind aan
// de linkerkant van de tabel, wat bij veel datums lelijk overlapte. Een los
// overlay-venster heeft geen scroll-container om in vast te lopen.
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { setMetAudit, getClubSettings, markersUitSettings, markersProvinciaalUitSettings } from '../../services/firestoreService';
import { bepaalTrainingStatus, TRAINING_STATUS } from '../trainingen/trainingStatus';
import { C } from '../trainingen/tokens';
import { useToast } from '../ui/Toast';
import { minutenNaarUren, formatUren, formatBedrag, formatDatumLeesbaar, vindLesgever } from './uitbetalingHelpers';

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' },
  modal: { background: C.card, borderRadius: '14px', border: `1px solid ${C.border}`, width: '100%', maxWidth: '560px', padding: '24px', position: 'relative', boxSizing: 'border-box' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', gap: '12px' },
  title: { fontSize: '17px', fontWeight: '800', color: C.textPrimary, margin: 0 },
  subtitle: { fontSize: '13px', color: C.textMuted, margin: '4px 0 0' },
  closeBtn: { background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '22px', padding: '4px', lineHeight: 1, flexShrink: 0 },
  label: { fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px', display: 'block' },
  select: { width: '100%', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textPrimary, fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxSizing: 'border-box' },
  list: { display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: 'min(48vh,420px)', overflowY: 'auto', margin: '16px 0' },
  row: (aanwezig) => ({ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: aanwezig ? 'rgba(34,197,94,0.08)' : C.bg, border: `1px solid ${aanwezig ? 'rgba(34,197,94,0.25)' : C.border}`, borderRadius: '8px', cursor: 'pointer' }),
  footer: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px', flexWrap: 'wrap' },
  btnPrimary: { padding: '10px 20px', background: C.red, border: 'none', borderRadius: '8px', color: C.btnPrimaryText, fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  btnGhost: { padding: '10px 16px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textMuted, fontSize: '13px', cursor: 'pointer' },
};

export default function AanwezigheidCorrectieModal({ lesgever, periode, groepenLijst, tarieven, onClose, onOpgeslagen }) {
  const toast = useToast();
  const [favorieteGroepId, setFavorieteGroepId] = useState(null);
  const [geselecteerdeGroepId, setGeselecteerdeGroepId] = useState('alle');
  const [trainingen, setTrainingen] = useState(null); // null = nog aan het laden
  const [localAanwezig, setLocalAanwezig] = useState({});
  const [origineel, setOrigineel]         = useState({});
  const [fout, setFout]     = useState('');
  const [opslaan, setOpslaan] = useState(false);

  const tarief = tarieven[lesgever.type || '']?.bedragPerUur || 0;

  // Favoriete/standaardgroep van deze lesgever (uit zijn profiel) — gebruiken als
  // voorgeselecteerde groep zodat hij niet eerst manueel moet zoeken.
  useEffect(() => {
    if (!lesgever.uid) return;
    let actief = true;
    getDoc(doc(db, 'users', lesgever.uid)).then(snap => {
      if (!actief) return;
      const g = snap.exists() ? snap.data()?.groepen?.[0] : null;
      if (g) { setFavorieteGroepId(g); setGeselecteerdeGroepId(g); }
    }).catch(() => {});
    return () => { actief = false; };
  }, [lesgever.uid]);

  useEffect(() => {
    let actief = true;
    (async () => {
      setFout('');
      try {
        const snap = await getDocs(query(collection(db, 'trainingen'), where('datum', '>=', periode.van), where('datum', '<=', periode.tot), orderBy('datum', 'asc')));
        const settings = await getClubSettings();
        const geenMarkers = markersUitSettings(settings);
        const provincialeMarkers = markersProvinciaalUitSettings(settings);
        const groepenMap = {};
        groepenLijst.forEach(g => { groepenMap[g.id] = g; });
        const lijst = snap.docs.map(d => ({
          id: d.id, ...d.data(),
          _uren: minutenNaarUren(d.data().duurMinuten || groepenMap[d.data().groepId]?.duurMinuten || 60),
          _groepNaam: groepenMap[d.data().groepId]?.naam || '',
        })).filter(t => bepaalTrainingStatus(t, { geenMarkers, provincialeMarkers, volgtProvincialeKalender: !!groepenMap[t.groepId]?.volgtProvincialeKalender }) === TRAINING_STATUS.NORMAAL);
        if (!actief) return;
        setTrainingen(lijst);
        const aanw = {};
        lijst.forEach(t => { aanw[t.id] = (t.lesgevers || []).some(k => vindLesgever(k, [lesgever])?.id === lesgever.id); });
        setLocalAanwezig(aanw);
        setOrigineel(aanw);
      } catch (e) { if (actief) setFout('Laden mislukt: ' + e.message); }
    })();
    return () => { actief = false; };
  }, [periode.van, periode.tot, groepenLijst, lesgever.id]);

  const gefilterd = useMemo(() => {
    if (!trainingen) return [];
    return geselecteerdeGroepId === 'alle' ? trainingen : trainingen.filter(t => t.groepId === geselecteerdeGroepId);
  }, [trainingen, geselecteerdeGroepId]);

  const gewijzigd = useMemo(() => {
    if (!trainingen) return [];
    return trainingen.filter(t => !!localAanwezig[t.id] !== !!origineel[t.id]);
  }, [trainingen, localAanwezig, origineel]);

  function toggle(id) { setLocalAanwezig(prev => ({ ...prev, [id]: !prev[id] })); }

  async function opslaanWijzigingen() {
    if (!gewijzigd.length) { onClose(); return; }
    setOpslaan(true);
    try {
      await Promise.all(gewijzigd.map(t => {
        const zonderMij = (t.lesgevers || []).filter(k => vindLesgever(k, [lesgever])?.id !== lesgever.id);
        const nieuw = localAanwezig[t.id] ? [...zonderMij, lesgever.id] : zonderMij;
        return setMetAudit(doc(db, 'trainingen', t.id), { lesgevers: nieuw }, { merge: true });
      }));
      toast({ bericht: `${gewijzigd.length} training${gewijzigd.length !== 1 ? 'en' : ''} bijgewerkt.`, type: 'success' });
      onOpgeslagen?.();
      onClose();
    } catch (e) {
      toast({ bericht: `Opslaan mislukt: ${e.message}`, type: 'error' });
    } finally { setOpslaan(false); }
  }

  const aantalAanwezig = gefilterd.filter(t => localAanwezig[t.id]).length;
  const urenAanwezig   = gefilterd.reduce((s, t) => s + (localAanwezig[t.id] ? t._uren : 0), 0);

  return (
    <div style={S.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modal}>
        <div style={S.header}>
          <div>
            <h2 style={S.title}>🥋 {lesgever.naam}</h2>
            <p style={S.subtitle}>{periode.naam} · aanwezigheid corrigeren</p>
          </div>
          <button style={S.closeBtn} onClick={onClose} aria-label="Sluiten">✕</button>
        </div>

        <label style={S.label} htmlFor="correctie-groep">Groep</label>
        <select id="correctie-groep" value={geselecteerdeGroepId} onChange={e => setGeselecteerdeGroepId(e.target.value)} style={S.select}>
          <option value="alle">Alle groepen</option>
          {groepenLijst.map(g => (
            <option key={g.id} value={g.id}>{g.naam}{g.id === favorieteGroepId ? ' ★ (standaard)' : ''}</option>
          ))}
        </select>

        {fout && <div style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '12px' }}>{fout}</div>}

        {!fout && trainingen === null && <div style={{ color: C.textMuted, padding: '24px 0', textAlign: 'center' }}>Trainingen laden…</div>}

        {!fout && trainingen !== null && (
          gefilterd.length === 0 ? (
            <div style={{ color: C.textMuted, fontSize: '13px', padding: '16px 0', fontStyle: 'italic' }}>Geen trainingen voor deze groep in deze periode.</div>
          ) : (
            <>
              <div style={S.list}>
                {gefilterd.map(t => (
                  <label key={t.id} style={S.row(!!localAanwezig[t.id])}>
                    <input type="checkbox" checked={!!localAanwezig[t.id]} onChange={() => toggle(t.id)}
                      style={{ accentColor: C.green, width: '17px', height: '17px', cursor: 'pointer', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '13px', fontWeight: localAanwezig[t.id] ? '600' : '400', color: C.textPrimary }}>{formatDatumLeesbaar(t.datum)}</div>
                      {geselecteerdeGroepId === 'alle' && t._groepNaam && <div style={{ fontSize: '11px', color: C.textMuted }}>{t._groepNaam}</div>}
                    </div>
                    <span style={{ fontSize: '12px', color: C.textSec, flexShrink: 0 }}>{formatUren(t._uren)}</span>
                  </label>
                ))}
              </div>
              <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '8px' }}>
                {aantalAanwezig} van {gefilterd.length} aanwezig · {formatUren(urenAanwezig)}{tarief > 0 && ` · ${formatBedrag(urenAanwezig * tarief)}`}
              </div>
            </>
          )
        )}

        <div style={S.footer}>
          <button style={S.btnGhost} onClick={onClose}>Annuleren</button>
          <button style={S.btnPrimary} onClick={opslaanWijzigingen} disabled={opslaan}>
            {opslaan ? 'Opslaan…' : gewijzigd.length > 0 ? `Opslaan (${gewijzigd.length})` : 'Sluiten'}
          </button>
        </div>
      </div>
    </div>
  );
}
