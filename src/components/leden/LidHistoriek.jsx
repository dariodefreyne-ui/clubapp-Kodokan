import React, { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getLidHistoriek } from '../../services/auditService';
import { lidWijzigingen, formatWaarde } from '../../utils/auditDiff';
import { formatDatumTijd } from '../../utils/datumUtils';

const S = {
  kaart: { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '14px 16px' },
  rij: { padding: '10px 0', borderBottom: '1px solid var(--border-color)' },
  kop: { display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'baseline', fontSize: '13px', color: 'var(--text-secondary)' },
  wijz: { fontSize: '14px', color: 'var(--text-primary)', marginTop: '4px', wordBreak: 'break-word' },
  oud: { color: 'var(--text-secondary)', textDecoration: 'line-through' },
  info: { fontSize: '12px', color: 'var(--text-secondary)', marginTop: '12px' },
  btn: { padding: '8px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', cursor: 'pointer', minHeight: '40px', marginTop: '12px' },
};
const TYPE_LABEL = { aanmaken: 'Aangemaakt', bijwerken: 'Gewijzigd', verwijderen: 'Verwijderd' };
const MAX_WIJZ = 8;

export default function LidHistoriek({ memberId }) {
  const [items, setItems] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [meer, setMeer] = useState(false);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');
  const [namen, setNamen] = useState({});

  async function laad(na) {
    setLaden(true); setFout('');
    try {
      const r = await getLidHistoriek(memberId, { na });
      setItems(prev => (na ? [...prev, ...r.items] : r.items));
      setCursor(r.laatste); setMeer(r.meer);
      const nieuw = [...new Set(r.items.map(l => l.door).filter(Boolean))].filter(u => !(u in namen));
      if (nieuw.length) {
        const res = await Promise.all(nieuw.map(u => getDoc(doc(db, 'users', u)).then(s => [u, s.exists() ? (s.data().naam || s.data().email || u) : u]).catch(() => [u, u])));
        setNamen(prev => ({ ...prev, ...Object.fromEntries(res) }));
      }
    } catch (e) {
      setFout(e?.code === 'failed-precondition'
        ? 'De index voor de historiek wordt nog opgebouwd (of is niet gedeployd). Probeer het over enkele minuten opnieuw.'
        : 'Historiek laden mislukt.');
    } finally { setLaden(false); }
  }

  useEffect(() => { laad(null); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [memberId]);

  return (
    <div style={S.kaart}>
      {fout && <div style={{ color: 'var(--accent-red)', fontSize: '14px' }}>{fout}</div>}
      {!fout && !laden && items.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Nog geen wijzigingen vastgelegd.</div>
      )}
      {items.map(l => {
        const wijz = lidWijzigingen(l);
        return (
          <div key={l.id} style={S.rij}>
            <div style={S.kop}>
              <strong style={{ color: 'var(--text-primary)' }}>{TYPE_LABEL[l.type] || l.type}</strong>
              <span>{formatDatumTijd(l.tijdstip)}</span>
              <span>door {l.door ? (namen[l.door] || '…') : 'systeem'}</span>
            </div>
            {l.type === 'bijwerken' && wijz.length === 0 && <div style={{ ...S.wijz, color: 'var(--text-secondary)' }}>Technische wijziging</div>}
            {wijz.slice(0, MAX_WIJZ).map(w => (
              <div key={w.veld} style={S.wijz}>
                <span style={{ color: 'var(--text-secondary)' }}>{w.label}: </span>
                <span style={S.oud}>{formatWaarde(w.oud)}</span> → <strong>{formatWaarde(w.nieuw)}</strong>
              </div>
            ))}
            {wijz.length > MAX_WIJZ && <div style={S.wijz}>… en {wijz.length - MAX_WIJZ} andere velden</div>}
          </div>
        );
      })}
      {laden && <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Laden…</div>}
      {meer && !laden && <button style={S.btn} onClick={() => laad(cursor)}>Oudere wijzigingen laden</button>}
      <div style={S.info}>Medische en financiële velden (o.a. bijdrage) worden bewust niet in het logboek bewaard. Logs ouder dan 2 jaar worden automatisch verwijderd.</div>
    </div>
  );
}
