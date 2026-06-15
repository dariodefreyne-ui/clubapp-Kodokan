import React, { useEffect, useMemo, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { C } from '../../styles/tokens';

const CAT_KLEUR = {
  training:  C.blue,
  wedstrijd: C.orange,
  examen:    C.green,
  evenement: C.purple,
  overige:   C.red,
};

function catKleur(categorie) {
  return CAT_KLEUR[categorie] || CAT_KLEUR.overige;
}

function formatBerichtDatum(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
  const nu = new Date();
  const vandaag = new Date(nu.getFullYear(), nu.getMonth(), nu.getDate());
  const gisteren = new Date(vandaag); gisteren.setDate(vandaag.getDate() - 1);
  const dag = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dag.getTime() === vandaag.getTime()) return `Vandaag · ${d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}`;
  if (dag.getTime() === gisteren.getTime()) return 'Gisteren';
  const diff = Math.round((vandaag - dag) / 86400000);
  if (diff < 7) return `${diff} dagen geleden`;
  return d.toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Berichten({ onBerichtKlik, onUnreadChange, gelezen, onMarkeerGelezen, max = 3 }) {
  const { isLid } = useAuth();
  const [berichten, setBerichten] = useState([]);
  const [laden, setLaden] = useState(true);
  const gelezenSet = gelezen || new Set();

  useEffect(() => {
    const q = isLid
      ? query(collection(db, 'communications'), where('sendToAll', '==', true), orderBy('createdAt', 'desc'), limit(max))
      : query(collection(db, 'communications'), orderBy('createdAt', 'desc'), limit(max));
    const unsub = onSnapshot(q, snap => {
      setBerichten(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLaden(false);
    }, () => setLaden(false));
    return unsub;
  }, [max, isLid]);

  const ongelezen = useMemo(
    () => berichten.filter(b => !gelezenSet.has(b.id)),
    [berichten, gelezenSet],
  );

  // Rapporteer ongelezen-status omhoog (voor de dashboard-banner)
  useEffect(() => {
    if (!onUnreadChange) return;
    onUnreadChange({ aantal: ongelezen.length, eerste: ongelezen[0] || null, lijst: ongelezen });
  }, [ongelezen, onUnreadChange]);

  const openBericht = (b) => {
    onMarkeerGelezen && onMarkeerGelezen(b.id);
    onBerichtKlik && onBerichtKlik({ title: b.title, body: b.body });
  };

  if (laden) return <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Laden...</div>;
  if (berichten.length === 0) return (
    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-md)', textAlign: 'center', padding: 'var(--space-3) 0' }}>
      Geen berichten
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {ongelezen.length > 0 && (
        <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: '700', color: 'var(--accent-red)' }}>
          ● {ongelezen.length} ongelezen
        </div>
      )}
      {berichten.map(b => {
        const isOngelezen = !gelezenSet.has(b.id);
        return (
          <button
            key={b.id}
            onClick={() => openBericht(b)}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: '8px', width: '100%', textAlign: 'left',
              background: 'transparent', border: 'none',
              borderLeft: `3px solid ${catKleur(b.categorie)}`,
              paddingLeft: 'var(--space-3)', paddingTop: '4px', paddingBottom: '4px', paddingRight: 0,
              cursor: 'pointer', color: 'inherit', fontFamily: 'inherit',
              minHeight: '60px',
            }}
          >
            {isOngelezen && (
              <span style={{ flexShrink: 0, width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-red)', marginTop: '6px' }} />
            )}
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: isOngelezen ? '800' : '600', fontSize: 'var(--font-size-md)', marginBottom: '4px' }}>{b.title}</span>
              <span style={{ display: '-webkit-box', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', overflow: 'hidden', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', lineHeight: '1.5' }}>
                {b.body}
              </span>
              {b.createdAt && (
                <span style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)', marginTop: '6px', opacity: 0.8 }}>
                  {formatBerichtDatum(b.createdAt)}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
