// ─── AanwezigheidCorrectieModal ────────────────────────────────────────────────
// Pop-up voor het corrigeren van aanwezigheid over een langere periode (vb. de
// 2-maandelijkse uitbetalingsperiode). Vervangt de inline uitklap-rij in de
// matrix: die bleef bij horizontaal scrollen met position:sticky vastgepind aan
// de linkerkant van de tabel, wat bij veel datums lelijk overlapte. Hergebruikt
// het projectbrede DetailModal (bottom-sheet, Escape/focus-trap/ARIA) i.p.v.
// een eigen overlay, zodat dit consistent blijft met de rest van de app.
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { setMetAudit, getClubSettings, markersUitSettings, markersProvinciaalUitSettings } from '../../services/firestoreService';
import { bepaalTrainingStatus, TRAINING_STATUS } from '../trainingen/trainingStatus';
import { C } from '../trainingen/tokens';
import { useToast } from '../ui/Toast';
import DetailModal from '../details/DetailModal';
import { minutenNaarUren, formatUren, formatBedrag, formatDatumLeesbaar, vindLesgever } from './uitbetalingHelpers';

const S = {
  subtitle: { fontSize: '13px', color: C.textMuted, margin: '-8px 0 16px' },
  label: { fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '8px', display: 'block' },
  select: { width: '100%', padding: '10px 12px', background: C.bg, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textPrimary, fontSize: '14px', fontWeight: '600', cursor: 'pointer', boxSizing: 'border-box' },
  list: { display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: 'min(48vh,420px)', overflowY: 'auto', margin: '16px 0' },
  row: (aanwezig) => ({ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', background: aanwezig ? 'rgba(34,197,94,0.08)' : C.bg, border: `1px solid ${aanwezig ? 'rgba(34,197,94,0.25)' : C.border}`, borderRadius: '8px', cursor: 'pointer', transition: 'background 120ms ease-out, border-color 120ms ease-out' }),
  listToolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' },
  toggleAllBtn: { background: 'none', border: 'none', color: C.blue, fontSize: '12px', fontWeight: '700', cursor: 'pointer', padding: '4px 0' },
  groepDot: (kleur) => ({ display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: kleur, marginRight: '5px', flexShrink: 0 }),
  footer: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px', flexWrap: 'wrap' },
  btnPrimary: { minHeight: '44px', padding: '10px 20px', background: C.red, border: 'none', borderRadius: '8px', color: C.btnPrimaryText, fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  btnGhost: { minHeight: '44px', padding: '10px 16px', background: 'transparent', border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textMuted, fontSize: '13px', cursor: 'pointer' },
};

// Eigen categorisch palet voor groep-stippen — bewust losstaand van de
// status-kleuren (green/blue/orange/purple/red) die elders in de app altijd
// data-betekenis dragen (actief/info/waarschuwing/speciaal). Hergebruik van
// die kleuren hier zou een groep per ongeluk als "status" laten lezen.
const GROEP_KLEUREN = ['#22D3EE', '#F59E0B', '#E879F9', '#A3E635', '#818CF8'];

export default function AanwezigheidCorrectieModal({ open = true, lesgever, periode, groepenLijst, tarieven, onClose, onOpgeslagen }) {
  const toast = useToast();
  const [favorieteGroepId, setFavorieteGroepId] = useState(null);
  const [geselecteerdeGroepId, setGeselecteerdeGroepId] = useState('alle');
  const [trainingen, setTrainingen] = useState(null); // null = nog aan het laden
  const [localAanwezig, setLocalAanwezig] = useState({});
  const [origineel, setOrigineel]         = useState({});
  const [fout, setFout]     = useState('');
  const [opslaan, setOpslaan] = useState(false);

  const tarief = tarieven[lesgever.type || '']?.bedragPerUur || 0;

  const groepKleurMap = useMemo(() => {
    const m = new Map();
    groepenLijst.forEach((g, i) => m.set(g.id, GROEP_KLEUREN[i % GROEP_KLEUREN.length]));
    return m;
  }, [groepenLijst]);

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

  const alleZichtbaarAanwezig = gefilterd.length > 0 && gefilterd.every(t => !!localAanwezig[t.id]);
  function toggleAlle() {
    setLocalAanwezig(prev => {
      const next = { ...prev };
      gefilterd.forEach(t => { next[t.id] = !alleZichtbaarAanwezig; });
      return next;
    });
  }

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
      onOpgeslagen?.(gewijzigd.length);
      onClose();
    } catch (e) {
      toast({ bericht: `Opslaan mislukt: ${e.message}`, type: 'error' });
    } finally { setOpslaan(false); }
  }

  const aantalAanwezig = gefilterd.filter(t => localAanwezig[t.id]).length;
  const urenAanwezig   = gefilterd.reduce((s, t) => s + (localAanwezig[t.id] ? t._uren : 0), 0);

  return (
    <DetailModal open={open} onClose={onClose} title={`🥋 ${lesgever.naam}`} accentKleur={C.red}>
      <p style={S.subtitle}>{periode.naam} · aanwezigheid corrigeren</p>

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
          <div style={{ color: C.textMuted, fontSize: '13px', padding: '16px 0', fontStyle: 'italic', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', marginBottom: '6px' }}>🥋</div>
            Geen trainingen voor deze groep<br/>in deze periode.
          </div>
        ) : (
          <>
            <div style={S.listToolbar}>
              <span style={{ fontSize: '12px', color: C.textMuted }}>{gefilterd.length} training{gefilterd.length !== 1 ? 'en' : ''}</span>
              <button type="button" style={S.toggleAllBtn} onClick={toggleAlle}>
                {alleZichtbaarAanwezig ? 'Alles uitvinken' : 'Alles aanvinken'}
              </button>
            </div>
            <div style={S.list}>
              {gefilterd.map(t => (
                <label key={t.id} style={S.row(!!localAanwezig[t.id])}>
                  <input type="checkbox" checked={!!localAanwezig[t.id]} onChange={() => toggle(t.id)}
                    style={{ accentColor: C.green, width: '17px', height: '17px', cursor: 'pointer', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: localAanwezig[t.id] ? '600' : '400', color: C.textPrimary }}>{formatDatumLeesbaar(t.datum)}</div>
                    {geselecteerdeGroepId === 'alle' && t._groepNaam && (
                      <div style={{ fontSize: '11px', color: C.textMuted, display: 'flex', alignItems: 'center' }}>
                        <span style={S.groepDot(groepKleurMap.get(t.groepId) || C.textMuted)} />
                        {t._groepNaam}
                      </div>
                    )}
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
    </DetailModal>
  );
}
