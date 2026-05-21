// Toont laatste 3 clubberichten uit de communications-collectie
import React, { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../../firebase';

export default function Berichten({ onBerichtKlik, max = 3 }) {
  const [berichten, setBerichten] = useState([]);
  const [laden, setLaden] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'communications'), orderBy('createdAt', 'desc'), limit(max));
    const unsub = onSnapshot(q, snap => {
      setBerichten(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLaden(false);
    }, () => setLaden(false));
    return unsub;
  }, [max]);

  if (laden) return <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Laden...</div>;
  if (berichten.length === 0) return (
    <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-md)', textAlign: 'center', padding: 'var(--space-3) 0' }}>
      Geen berichten
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {berichten.map(b => (
        <button
          key={b.id}
          onClick={() => onBerichtKlik && onBerichtKlik({ title: b.title, body: b.body })}
          style={{
            display: 'block', width: '100%', textAlign: 'left',
            background: 'transparent', border: 'none',
            borderLeft: '3px solid var(--accent-red)',
            paddingLeft: 'var(--space-3)', paddingTop: 0, paddingBottom: 0, paddingRight: 0,
            cursor: 'pointer', color: 'inherit', fontFamily: 'inherit',
          }}
        >
          <div style={{ fontWeight: '600', fontSize: 'var(--font-size-md)', marginBottom: '2px' }}>{b.title}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {b.body}
          </div>
        </button>
      ))}
    </div>
  );
}
