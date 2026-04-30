// src/pages/MigratieLesgevers.jsx
// ─── TIJDELIJKE MIGRATIEPAGINA — NA GEBRUIK VERWIJDEREN ───────────────────────
// Stap 3: trainingen.lesgevers[] migreren van namen naar lesgeverId's
// Alleen toegankelijk voor beheerders via /migratie-lesgevers
//
// Na succesvolle migratie:
//   1. Verwijder dit bestand
//   2. Verwijder de import en Route in App.jsx
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from 'react';
import {
  collection, getDocs, writeBatch, doc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export default function MigratieLesgevers() {
  const { isBeheerder } = useAuth();
  const [log, setLog]       = useState([]);
  const [status, setStatus] = useState('idle'); // idle | analyseren | klaar | bezig | gedaan | fout
  const [plan, setPlan]     = useState(null);   // { teMigreren, teSkippen, alGemigreerd }

  const voegLog = (regel) => setLog(prev => [...prev, regel]);

  if (!isBeheerder) {
    return (
      <div style={{ padding: '40px', color: '#e74c3c', fontFamily: 'monospace' }}>
        Geen toegang. Alleen beheerders kunnen deze pagina gebruiken.
      </div>
    );
  }

  const analyseer = async () => {
    setLog([]);
    setPlan(null);
    setStatus('analyseren');
    voegLog('Lesgevers ophalen...');

    try {
      // Bouw naam -> id mapping uit echte Firestore data
      const lesgeversSnap = await getDocs(collection(db, 'lesgevers'));
      const naarId  = new Map(); // naam -> id
      const naarNaam = new Map(); // id -> naam

      lesgeversSnap.docs.forEach(d => {
        const naam = d.data().naam;
        if (naam) {
          naarId.set(naam, d.id);
          naarNaam.set(d.id, naam);
        }
      });

      voegLog(`${naarId.size} lesgevers geladen:`);
      naarId.forEach((id, naam) => voegLog(`  "${naam}" -> "${id}"`));

      voegLog('');
      voegLog('Trainingen ophalen...');
      const trainingSnap = await getDocs(collection(db, 'trainingen'));
      voegLog(`${trainingSnap.docs.length} trainingen geladen`);
      voegLog('');

      const teMigreren   = [];
      const teSkippen    = [];
      const alGemigreerd = [];

      for (const d of trainingSnap.docs) {
        const data = d.data();
        const lesgevers = data.lesgevers || [];
        if (lesgevers.length === 0) continue;

        // Als alle waarden al ids zijn (niet in naarId als naam)
        const looksLikeIds = lesgevers.every(v => !naarId.has(v));
        if (looksLikeIds) {
          alGemigreerd.push({ id: d.id, datum: data.datum });
          continue;
        }

        const nieuw = [];
        for (const waarde of lesgevers) {
          if (naarId.has(waarde)) {
            nieuw.push(naarId.get(waarde));
          } else if (naarNaam.has(waarde)) {
            // Al een id
            nieuw.push(waarde);
          } else {
            // Onbekend
            nieuw.push(waarde);
            teSkippen.push({ id: d.id, datum: data.datum, naam: waarde });
          }
        }

        const veranderd = JSON.stringify(lesgevers) !== JSON.stringify(nieuw);
        if (veranderd) {
          teMigreren.push({ id: d.id, datum: data.datum, oud: lesgevers, nieuw });
        }
      }

      voegLog(`Analyse klaar:`);
      voegLog(`  Al gemigreerd (geen actie): ${alGemigreerd.length}`);
      voegLog(`  Te migreren: ${teMigreren.length}`);
      voegLog(`  Onbekende namen (worden overgeslagen): ${teSkippen.length}`);

      if (teMigreren.length > 0) {
        voegLog('');
        voegLog('Voorbeeldwijzigingen:');
        teMigreren.slice(0, 15).forEach(t => {
          voegLog(`  ${t.datum}: [${t.oud.join(', ')}] -> [${t.nieuw.join(', ')}]`);
        });
        if (teMigreren.length > 15) voegLog(`  ... en ${teMigreren.length - 15} meer`);
      }

      if (teSkippen.length > 0) {
        voegLog('');
        voegLog('Onbekende namen -- controleer manueel na migratie:');
        teSkippen.forEach(s => voegLog(`  Training ${s.datum} (${s.id}): "${s.naam}"`));
      }

      setPlan({ teMigreren, teSkippen, alGemigreerd });
      setStatus('klaar');

    } catch (e) {
      voegLog(`FOUT: ${e.message}`);
      setStatus('fout');
    }
  };

  const voerUit = async () => {
    if (!plan || plan.teMigreren.length === 0) return;
    setStatus('bezig');
    voegLog('');
    voegLog('Migratie starten...');

    const BATCH_GROOTTE = 499;
    let bijgewerkt = 0;
    let batchNr = 1;

    try {
      for (let i = 0; i < plan.teMigreren.length; i += BATCH_GROOTTE) {
        const chunk = plan.teMigreren.slice(i, i + BATCH_GROOTTE);
        const batch = writeBatch(db);

        for (const training of chunk) {
          batch.update(doc(db, 'trainingen', training.id), {
            lesgevers: training.nieuw,
          });
        }

        await batch.commit();
        bijgewerkt += chunk.length;
        voegLog(`  Batch ${batchNr}: ${chunk.length} trainingen gemigreerd (totaal: ${bijgewerkt})`);
        batchNr++;
      }

      voegLog('');
      voegLog(`Migratie voltooid. ${bijgewerkt} trainingen bijgewerkt.`);
      voegLog('Je kan deze pagina nu verwijderen uit de codebase.');
      setStatus('gedaan');

    } catch (e) {
      voegLog(`FOUT tijdens schrijven: ${e.message}`);
      voegLog('Migratie gestopt. Controleer Firestore.');
      setStatus('fout');
    }
  };

  const S = {
    page:    { padding: '32px', maxWidth: '800px', margin: '0 auto', color: '#e0e0e0', fontFamily: 'monospace' },
    title:   { fontSize: '20px', fontWeight: '800', marginBottom: '8px', color: '#fff' },
    warning: { background: 'rgba(231,76,60,0.15)', border: '1px solid #e74c3c', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#e74c3c' },
    log:     { background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '16px', minHeight: '200px', maxHeight: '400px', overflowY: 'auto', fontSize: '12px', lineHeight: '1.6', marginBottom: '16px', whiteSpace: 'pre-wrap' },
    btn:     (color) => ({ padding: '10px 24px', background: color, border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '700', marginRight: '10px' }),
  };

  return (
    <div style={S.page}>
      <div style={S.title}>🔧 Migratie: lesgevers naam -> id</div>
      <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '20px' }}>
        Eenmalig script. Zet trainingen.lesgevers[] om van naam-strings naar lesgeverId's.
      </p>

      <div style={S.warning}>
        <strong>Let op:</strong> Voer eerst de analyse uit en controleer de output voor je bevestigt.
        Na succesvolle migratie: verwijder dit bestand en de route uit App.jsx.
      </div>

      <div style={S.log}>
        {log.length === 0
          ? 'Klik "Analyseer" om te starten...'
          : log.join('\n')}
      </div>

      <div>
        {(status === 'idle' || status === 'fout') && (
          <button style={S.btn('#3498db')} onClick={analyseer}>
            Analyseer (dry run)
          </button>
        )}

        {status === 'analyseren' && (
          <button style={{ ...S.btn('#555'), cursor: 'not-allowed' }} disabled>
            Analyseren...
          </button>
        )}

        {status === 'klaar' && (
          <>
            <button style={S.btn('#3498db')} onClick={analyseer}>
              Opnieuw analyseren
            </button>
            {plan.teMigreren.length > 0 ? (
              <button style={S.btn('#e74c3c')} onClick={voerUit}>
                Bevestig migratie ({plan.teMigreren.length} trainingen)
              </button>
            ) : (
              <span style={{ fontSize: '13px', color: '#27ae60', fontWeight: '600' }}>
                Niets te migreren -- alles is al up-to-date.
              </span>
            )}
          </>
        )}

        {status === 'bezig' && (
          <button style={{ ...S.btn('#555'), cursor: 'not-allowed' }} disabled>
            Bezig met schrijven...
          </button>
        )}

        {status === 'gedaan' && (
          <div style={{ color: '#27ae60', fontWeight: '700', fontSize: '14px' }}>
            Migratie geslaagd. Vergeet dit bestand niet te verwijderen.
          </div>
        )}
      </div>
    </div>
  );
}
