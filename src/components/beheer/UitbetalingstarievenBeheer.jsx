// src/components/beheer/UitbetalingstarievenBeheer.jsx
// Uurloon per lesgever-type + kilometervergoeding.
// Vervangt het 'Tarieven'-tabblad uit de Uitbetalingen-pagina zodat alle
// configureerbare data op één plek (Beheer > Clubdata) staat.
import React, { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast.jsx';

const S = {
  wrap: { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', marginBottom: '16px' },
  sectie: { fontSize: '13px', fontWeight: '700', color: 'var(--accent-red)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 12px' },
  rij: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0' },
  label: { flex: 1, fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600' },
  input: {
    width: '100px', padding: '8px 10px', background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)', borderRadius: '6px',
    color: 'var(--text-primary)', fontSize: '14px', textAlign: 'right',
  },
  hint: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' },
};

export default function UitbetalingstarievenBeheer() {
  const { configCache } = useAuth();
  const toast = useToast();
  const [tarieven, setTarieven] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tarieven'), snap => {
      const data = {};
      snap.docs.forEach(d => { data[d.id] = d.data(); });
      setTarieven(data);
    });
    return unsub;
  }, []);

  async function slaUurloonOp(typeId, value) {
    const bedrag = parseFloat(value);
    if (isNaN(bedrag)) return;
    try {
      await setDoc(doc(db, 'tarieven', typeId), {
        type: typeId, bedragPerUur: bedrag, bijgewerkt: serverTimestamp(),
      }, { merge: true });
      toast({ bericht: 'Tarief opgeslagen', type: 'success' });
    } catch (e) {
      toast({ bericht: `Fout: ${e.message}`, type: 'error' });
    }
  }

  async function slaKmOp(value) {
    const bedrag = parseFloat(value);
    if (isNaN(bedrag)) return;
    try {
      await setDoc(doc(db, 'tarieven', 'kilometer'), {
        type: 'kilometer', bedragPerKm: bedrag, bijgewerkt: serverTimestamp(),
      }, { merge: true });
      toast({ bericht: 'Km-vergoeding opgeslagen', type: 'success' });
    } catch (e) {
      toast({ bericht: `Fout: ${e.message}`, type: 'error' });
    }
  }

  // Gebruik tarieftypes uit configCache; lege lijst → toon waarschuwing.
  const lesgevertypes = configCache?.lesgeverTypes || [];

  return (
    <>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 16px' }}>
        Stel hier de uurlonen per lesgever-type in en de kilometervergoeding voor wedstrijdbegeleiding.
        Deze waarden worden gebruikt in het Uitbetalingen-overzicht.
      </p>

      <div style={S.wrap}>
        <div style={S.sectie}>💶 Uurloon per lesgever-type</div>
        {lesgevertypes.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Geen lesgever-types geconfigureerd — voeg ze eerst toe via "Lesgever-types".
          </div>
        ) : lesgevertypes.map(type => {
          const huidig = tarieven[type.code]?.bedragPerUur ?? '';
          return (
            <div key={type.id} style={S.rij}>
              <span style={S.label}>{type.label}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>€</span>
              <input
                type="number" step="0.01" min="0"
                defaultValue={huidig} key={huidig}
                onBlur={e => slaUurloonOp(type.code, e.target.value)}
                onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                placeholder="0.00" style={S.input}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>/uur</span>
            </div>
          );
        })}
      </div>

      <div style={S.wrap}>
        <div style={S.sectie}>🚗 Kilometervergoeding</div>
        {(() => {
          const huidig = tarieven['kilometer']?.bedragPerKm ?? '';
          return (
            <div style={S.rij}>
              <span style={S.label}>Per km</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>€</span>
              <input
                type="number" step="0.01" min="0"
                defaultValue={huidig} key={`km-${huidig}`}
                onBlur={e => slaKmOp(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && e.target.blur()}
                placeholder="0.00" style={S.input}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>/km</span>
            </div>
          );
        })()}
        <div style={S.hint}>Gebruikt voor terugbetaling bij wedstrijdbegeleiding.</div>
      </div>
    </>
  );
}
