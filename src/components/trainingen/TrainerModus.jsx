// src/components/trainingen/TrainerModus.jsx
// Mobiel-eerst aanwezigheidsscherm voor trainers.
// Toont de eerstvolgende training van de gekozen groep + deelnemerslijst met
// één-tik aanwezigheid, QR-scan, notitieveld, lesgever-bevestiging en historiek.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDocs, query, where, orderBy, arrayUnion } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  getMembers, registreerAanwezigheid, verwijderAanwezigheid,
  getAanwezigeLeden, updateMetAudit,
} from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast.jsx';
import { vandaagISO, formatDatum } from './seizoenHelpers';
import { C } from './tokens';

const S = {
  wrap: { maxWidth: '560px', margin: '0 auto' },
  kop: {
    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: '14px', padding: '16px', marginBottom: '14px',
  },
  groepKnoppen: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' },
  groepPil: (actief) => ({
    padding: '8px 16px', borderRadius: '999px', cursor: 'pointer', fontFamily: 'inherit',
    border: `1px solid ${actief ? 'var(--accent-red)' : 'var(--border-color)'}`,
    background: actief ? 'var(--accent-red)' : 'var(--bg-card)',
    color: actief ? '#fff' : 'var(--text-primary)',
    fontSize: '14px', fontWeight: actief ? '700' : '500',
  }),
  trainingTitel: { fontSize: '18px', fontWeight: '800', marginBottom: '2px' },
  trainingSub: { fontSize: '13px', color: 'var(--text-secondary)' },
  teller: { fontSize: '13px', fontWeight: '700', color: 'var(--accent-red)' },
  lidRij: (aanwezig) => ({
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '14px 16px', borderRadius: '12px', marginBottom: '8px', cursor: 'pointer',
    border: `1px solid ${aanwezig ? 'var(--success)' : 'var(--border-color)'}`,
    background: aanwezig ? 'rgba(39,174,96,0.10)' : 'var(--bg-card)',
    transition: 'background 0.15s, border-color 0.15s',
    minHeight: '56px', boxSizing: 'border-box',
  }),
  check: (aanwezig) => ({
    width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
    border: `2px solid ${aanwezig ? 'var(--success)' : 'var(--border-color)'}`,
    background: aanwezig ? 'var(--success)' : 'transparent',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '16px', fontWeight: '700',
  }),
  lidNaam: { flex: 1, fontSize: '15px', fontWeight: '600' },
  knop: {
    padding: '12px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
    fontSize: '14px', fontWeight: '700', fontFamily: 'inherit',
    background: 'var(--accent-red)', color: '#fff',
  },
  knopSec: {
    padding: '12px 18px', borderRadius: '10px', cursor: 'pointer',
    fontSize: '14px', fontWeight: '600', fontFamily: 'inherit',
    background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)',
  },
  textarea: {
    width: '100%', boxSizing: 'border-box', padding: '12px', minHeight: '70px',
    background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px',
    fontFamily: 'inherit', resize: 'vertical',
  },
  sectieTitel: { fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', margin: '0 0 10px' },
  histRij: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)', fontSize: '13px' },
  leeg: { padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' },
};

function eerstvolgendeTraining(trainingen) {
  const vandaag = vandaagISO();
  const toekomst = trainingen
    .filter(t => t.datum >= vandaag && !t.geannuleerd)
    .sort((a, b) => a.datum.localeCompare(b.datum));
  if (toekomst.length > 0) return toekomst[0];
  // anders meest recente verleden
  const verleden = trainingen
    .filter(t => !t.geannuleerd)
    .sort((a, b) => b.datum.localeCompare(a.datum));
  return verleden[0] || null;
}

export default function TrainerModus({ groepen, lesgeversLijst, actieveGroep, onKiesGroep }) {
  const { profiel, lesgeverId } = useAuth();
  const toast = useToast();
  const [leden, setLeden] = useState([]);
  const [trainingen, setTrainingen] = useState([]);
  const [aanwezig, setAanwezig] = useState(new Set());
  const [laden, setLaden] = useState(true);
  const [notitie, setNotitie] = useState('');
  const [notitieBezig, setNotitieBezig] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [bezigLid, setBezigLid] = useState(null);

  const groep = groepen.find(g => g.id === actieveGroep);
  const groepNaam = groep?.naam || '';

  const training = useMemo(() => eerstvolgendeTraining(trainingen), [trainingen]);
  const trainingHeeftMij = training && lesgeverId && (training.lesgevers || []).includes(lesgeverId);

  // Laad trainingen voor de actieve groep (huidig seizoen-onafhankelijk: laatste 90 dagen vooruit/achteruit volstaat)
  useEffect(() => {
    if (!actieveGroep) return;
    setLaden(true);
    const q = query(collection(db, 'trainingen'), where('groepId', '==', actieveGroep), orderBy('datum', 'desc'));
    getDocs(q).then(snap => {
      setTrainingen(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(() => setTrainingen([])).finally(() => setLaden(false));
  }, [actieveGroep]);

  // Laad leden van de groep
  useEffect(() => {
    if (!groepNaam) { setLeden([]); return; }
    getMembers().then(alle => {
      const inGroep = alle
        .filter(m => m.actief !== false && Array.isArray(m.groepen) && m.groepen.includes(groepNaam))
        .sort((a, b) => (a.naam || '').localeCompare(b.naam || ''));
      setLeden(inGroep);
    }).catch(() => setLeden([]));
  }, [groepNaam]);

  // Laad aanwezigheid + notitie voor de gekozen training
  useEffect(() => {
    if (!training || leden.length === 0) { setAanwezig(new Set()); return; }
    setNotitie(training.opmerking || '');
    getAanwezigeLeden(leden.map(l => l.id), training.id)
      .then(setAanwezig)
      .catch(() => setAanwezig(new Set()));
  }, [training?.id, leden]);

  async function toggleLid(lid) {
    if (!training || bezigLid) return;
    setBezigLid(lid.id);
    const isAanwezig = aanwezig.has(lid.id);
    try {
      if (isAanwezig) {
        await verwijderAanwezigheid(lid.id, training.id);
        setAanwezig(prev => { const n = new Set(prev); n.delete(lid.id); return n; });
      } else {
        await registreerAanwezigheid(lid.id, { ...training, groepNaam });
        setAanwezig(prev => new Set(prev).add(lid.id));
      }
    } catch (e) {
      toast({ bericht: `Fout: ${e.message}`, type: 'error' });
    }
    setBezigLid(null);
  }

  async function markeerViaId(lidId) {
    const lid = leden.find(l => l.id === lidId);
    if (!lid) {
      toast({ bericht: 'Lid niet in deze groep gevonden', type: 'error' });
      return;
    }
    if (aanwezig.has(lidId)) {
      toast({ bericht: `${lid.naam} was al aanwezig`, type: 'info' });
      return;
    }
    try {
      await registreerAanwezigheid(lidId, { ...training, groepNaam });
      setAanwezig(prev => new Set(prev).add(lidId));
      toast({ bericht: `${lid.naam} aanwezig gemeld`, type: 'success' });
    } catch (e) {
      toast({ bericht: `Fout: ${e.message}`, type: 'error' });
    }
  }

  async function slaNotitieOp() {
    if (!training) return;
    setNotitieBezig(true);
    try {
      await updateMetAudit(doc(db, 'trainingen', training.id), { opmerking: notitie });
      toast({ bericht: 'Notitie opgeslagen', type: 'success' });
    } catch (e) {
      toast({ bericht: `Fout: ${e.message}`, type: 'error' });
    }
    setNotitieBezig(false);
  }

  async function bevestigLesgever() {
    if (!training || !lesgeverId) return;
    try {
      await updateMetAudit(doc(db, 'trainingen', training.id), { lesgevers: arrayUnion(lesgeverId) });
      setTrainingen(prev => prev.map(t => t.id === training.id
        ? { ...t, lesgevers: [...(t.lesgevers || []), lesgeverId] }
        : t));
      toast({ bericht: 'Je staat genoteerd als lesgever', type: 'success' });
    } catch (e) {
      toast({ bericht: `Fout: ${e.message}`, type: 'error' });
    }
  }

  const historiek = useMemo(() => {
    const vandaag = vandaagISO();
    return trainingen
      .filter(t => t.datum < vandaag && !t.geannuleerd)
      .sort((a, b) => b.datum.localeCompare(a.datum))
      .slice(0, 8);
  }, [trainingen]);

  if (!actieveGroep) {
    return <div style={S.leeg}>Kies een groep om aanwezigheid te registreren.</div>;
  }

  return (
    <div style={S.wrap}>
      {/* Groepskeuze */}
      <div style={S.groepKnoppen}>
        {groepen.map(g => (
          <button key={g.id} style={S.groepPil(g.id === actieveGroep)} onClick={() => onKiesGroep(g.id)}>
            {g.naam}
          </button>
        ))}
      </div>

      {laden ? (
        <div style={S.leeg}>Laden...</div>
      ) : !training ? (
        <div style={S.leeg}>Geen trainingen gevonden voor {groepNaam}.</div>
      ) : (
        <>
          {/* Training-kop */}
          <div style={S.kop}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div>
                <div style={S.trainingTitel}>{groepNaam}</div>
                <div style={S.trainingSub}>{formatDatum(training.datum)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={S.teller}>{aanwezig.size}/{leden.length}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>aanwezig</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
              <button style={S.knopSec} onClick={() => setScanOpen(s => !s)}>
                {scanOpen ? '✕ Sluit scanner' : '📷 QR scannen'}
              </button>
              {lesgeverId && !trainingHeeftMij && (
                <button style={S.knopSec} onClick={bevestigLesgever}>🥋 Ik geef deze les</button>
              )}
              {trainingHeeftMij && (
                <span style={{ ...S.knopSec, borderColor: 'var(--success)', color: 'var(--success)', cursor: 'default' }}>✓ Jij geeft les</span>
              )}
            </div>
          </div>

          {/* QR-scanner */}
          {scanOpen && (
            <QrScanner
              onResultaat={(tekst) => {
                const match = /kodokan-lid:(.+)/.exec(tekst);
                if (match) markeerViaId(match[1].trim());
                else toast({ bericht: 'Onbekende QR-code', type: 'error' });
              }}
              onSluit={() => setScanOpen(false)}
            />
          )}

          {/* Deelnemerslijst */}
          <div style={S.kop}>
            <p style={S.sectieTitel}>Deelnemers ({leden.length})</p>
            {leden.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Geen actieve leden in deze groep.</div>
            ) : (
              leden.map(lid => {
                const isAanw = aanwezig.has(lid.id);
                return (
                  <div key={lid.id} style={S.lidRij(isAanw)} onClick={() => toggleLid(lid)}>
                    <div style={S.check(isAanw)}>{isAanw ? '✓' : ''}</div>
                    <span style={S.lidNaam}>{lid.naam || '(naamloos)'}</span>
                    {bezigLid === lid.id && <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>...</span>}
                  </div>
                );
              })
            )}
          </div>

          {/* Notitie */}
          <div style={S.kop}>
            <p style={S.sectieTitel}>Notitie</p>
            <textarea
              style={S.textarea}
              value={notitie}
              onChange={e => setNotitie(e.target.value)}
              placeholder="Bv. gewerkt aan o-goshi; 2 blessures..."
            />
            <button style={{ ...S.knop, marginTop: '10px' }} onClick={slaNotitieOp} disabled={notitieBezig}>
              {notitieBezig ? 'Opslaan...' : 'Notitie opslaan'}
            </button>
          </div>

          {/* Historiek */}
          {historiek.length > 0 && (
            <div style={S.kop}>
              <p style={S.sectieTitel}>Recente trainingen</p>
              {historiek.map(t => (
                <div key={t.id} style={S.histRij}>
                  <span>{formatDatum(t.datum)}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {(t.lesgevers || []).length > 0
                      ? (t.lesgevers || []).map(id => lesgeversLijst.find(l => l.id === id)?.naam || id).join(', ')
                      : 'geen lesgever'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── QR Scanner (lazy html5-qrcode) ───────────────────────────────────────────
function QrScanner({ onResultaat, onSluit }) {
  const containerRef = useRef(null);
  const scannerRef = useRef(null);
  const [fout, setFout] = useState('');

  useEffect(() => {
    let actief = true;
    let html5Qr = null;
    const elementId = 'qr-reader-container';

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (!actief) return;
      html5Qr = new Html5Qrcode(elementId);
      scannerRef.current = html5Qr;
      html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (decodedText) => {
          onResultaat(decodedText);
        },
        () => { /* scan-miss, negeer */ }
      ).catch(err => {
        if (actief) setFout('Camera kon niet starten: ' + (err?.message || err));
      });
    }).catch(() => setFout('QR-scanner kon niet laden.'));

    return () => {
      actief = false;
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => scannerRef.current?.clear()).catch(() => {});
      }
    };
  }, [onResultaat]);

  return (
    <div style={{ ...S.kop, textAlign: 'center' }}>
      {fout ? (
        <div style={{ color: 'var(--danger)', fontSize: '13px', marginBottom: '10px' }}>{fout}</div>
      ) : (
        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
          Richt op de QR-code van het lid
        </div>
      )}
      <div id="qr-reader-container" ref={containerRef} style={{ width: '100%', maxWidth: '300px', margin: '0 auto' }} />
      <button style={{ ...S.knopSec, marginTop: '10px' }} onClick={onSluit}>Sluiten</button>
    </div>
  );
}
