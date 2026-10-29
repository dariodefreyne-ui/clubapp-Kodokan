import React, { useEffect, useMemo, useState } from 'react';
import { getMembers, bulkZetNaamVelden } from '../../services/firestoreService';
import { splitsNaam, detecteerVolgorde } from '../../utils/ledenKoppeling';
import { useToast } from '../ui/Toast.jsx';

// Eenmalige migratie: zet voornaam + achternaam op bestaande leden. Het bestaande
// `naam`-veld wordt NIET aangepast, dus koppelingen (wedstrijden, aanwezigheden,
// gezinslinks) blijven intact. Kost eenmalig 1 read per lid + 1 write per opgeslagen lid.

const ANDERE = { 'voornaam-eerst': 'achternaam-eerst', 'achternaam-eerst': 'voornaam-eerst' };

function bouwRijen(alle) {
  const bekend = new Set();
  alle.forEach(m => {
    if (m.voornaam && m.achternaam) bekend.add(String(m.voornaam).trim().split(/\s+/)[0].toLowerCase());
  });
  const open = alle.filter(m => !(m.voornaam && m.achternaam) && String(m.naam || '').trim());
  const eersteFreq = new Map();
  const laatsteFreq = new Map();
  open.forEach(m => {
    const t = String(m.naam).trim().toLowerCase().split(/\s+/);
    if (t.length < 2) return;
    eersteFreq.set(t[0], (eersteFreq.get(t[0]) || 0) + 1);
    laatsteFreq.set(t[t.length - 1], (laatsteFreq.get(t[t.length - 1]) || 0) + 1);
  });
  const detect = open.map(m => detecteerVolgorde(m.naam, bekend, eersteFreq, laatsteFreq));
  const a = detect.filter(d => d === 'voornaam-eerst').length;
  const b = detect.filter(d => d === 'achternaam-eerst').length;
  const standaard = b > a ? 'achternaam-eerst' : 'voornaam-eerst';
  return open.map((m, i) => {
    const volgorde = detect[i] || standaard;
    const { voornaam, achternaam } = splitsNaam(m.naam, volgorde);
    return { id: m.id, naam: m.naam, volgorde, voornaam, achternaam, zeker: !!detect[i] && String(m.naam).trim().split(/\s+/).length === 2 };
  }).sort((x, y) => Number(x.zeker) - Number(y.zeker) || x.naam.localeCompare(y.naam, 'nl'));
}

const st = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 12px', overflowY: 'auto' },
  modal: { background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', width: '100%', maxWidth: '860px', padding: '20px' },
  info: { background: 'rgba(41,128,185,0.1)', border: '1px solid rgba(41,128,185,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '13px', color: '#2980b9', marginBottom: '12px' },
  rij: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', padding: '8px 0', borderBottom: '1px solid var(--border-color)' },
  input: { flex: '1 1 130px', minWidth: 0, padding: '8px 10px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-size-md)' },
  btn: { padding: '8px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', cursor: 'pointer', minHeight: '40px' },
  btnPrimary: { padding: '8px 18px', background: 'var(--accent-red)', border: 'none', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', minHeight: '40px' },
};

export default function NaamSplitsModal({ onClose, onKlaar }) {
  const toast = useToast();
  const [rijen, setRijen] = useState(null);
  const [fout, setFout] = useState('');
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    let weg = false;
    getMembers()
      .then(alle => { if (!weg) setRijen(bouwRijen(alle).map(r => ({ ...r, aan: true }))); })
      .catch(() => { if (!weg) setFout('Leden laden mislukt.'); });
    return () => { weg = true; };
  }, []);

  const update = (id, patch) => setRijen(rs => rs.map(r => (r.id === id ? { ...r, ...patch } : r)));
  const keer = (r) => {
    const volgorde = ANDERE[r.volgorde];
    update(r.id, { volgorde, ...splitsNaam(r.naam, volgorde), zeker: true });
  };
  const zetOnzekere = (volgorde) => setRijen(rs => rs.map(r => (r.zeker ? r : { ...r, volgorde, ...splitsNaam(r.naam, volgorde) })));

  const teBewaren = useMemo(() => (rijen || []).filter(r => r.aan && r.voornaam.trim() && r.achternaam.trim()), [rijen]);
  const onzeker = (rijen || []).filter(r => !r.zeker).length;

  async function opslaan() {
    setBezig(true);
    try {
      const n = await bulkZetNaamVelden(teBewaren);
      toast({ bericht: `${n} ${n === 1 ? 'lid' : 'leden'} gesplitst in voor- en achternaam`, type: 'success' });
      onKlaar?.();
      onClose();
    } catch (e) {
      console.error(e);
      setFout('Opslaan mislukt. Probeer opnieuw.');
      setBezig(false);
    }
  }

  return (
    <div style={st.overlay} onClick={e => e.target === e.currentTarget && !bezig && onClose()}>
      <div style={st.modal}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: 'var(--font-size-lg)', color: 'var(--text-primary)' }}>Namen splitsen</h2>
          <button style={{ ...st.btn, border: 'none', background: 'none' }} onClick={onClose} disabled={bezig}>✕</button>
        </div>
        {fout && <div style={{ ...st.info, color: 'var(--danger)', borderColor: 'var(--danger)' }}>{fout}</div>}
        {!rijen && !fout && <p style={{ color: 'var(--text-secondary)' }}>Leden laden…</p>}
        {rijen && rijen.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>Alle leden hebben al een voor- en achternaam. 🎉</p>}
        {rijen && rijen.length > 0 && (
          <>
            <div style={st.info}>
              Het bestaande veld <strong>naam</strong> blijft ongewijzigd; enkel voornaam en achternaam worden toegevoegd.
              Controleer vooral de rijen met ⚠ (volgorde onzeker) en corrigeer samengestelde voornamen manueel.
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{rijen.length} leden · {onzeker} onzeker · Onzekere:</span>
              <button style={st.btn} onClick={() => zetOnzekere('achternaam-eerst')}>achternaam eerst</button>
              <button style={st.btn} onClick={() => zetOnzekere('voornaam-eerst')}>voornaam eerst</button>
            </div>
            {rijen.map(r => (
              <div key={r.id} style={{ ...st.rij, opacity: r.aan ? 1 : 0.45 }}>
                <input type="checkbox" checked={r.aan} onChange={e => update(r.id, { aan: e.target.checked })} aria-label={`Selecteer ${r.naam}`} />
                <div style={{ flex: '1 1 150px', fontSize: '13px', color: 'var(--text-secondary)' }}>{r.zeker ? '' : '⚠ '}{r.naam}</div>
                <input style={st.input} value={r.voornaam} placeholder="Voornaam" onChange={e => update(r.id, { voornaam: e.target.value, zeker: true })} />
                <input style={st.input} value={r.achternaam} placeholder="Achternaam" onChange={e => update(r.id, { achternaam: e.target.value, zeker: true })} />
                <button style={st.btn} onClick={() => keer(r)} title="Voor- en achternaam omwisselen">⇄</button>
              </div>
            ))}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button style={st.btn} onClick={onClose} disabled={bezig}>Annuleren</button>
              <button style={{ ...st.btnPrimary, opacity: bezig || !teBewaren.length ? 0.6 : 1 }} onClick={opslaan} disabled={bezig || !teBewaren.length}>
                {bezig ? 'Bezig…' : `Opslaan (${teBewaren.length})`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
