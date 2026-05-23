// src/components/trainingen/TrainerModus.jsx
// Mobiel-eerst aanwezigheidsscherm voor trainers.
// Toont de gekozen training van de groep (datum vrij te kiezen voor correcties),
// de ingeplande technieken (zoals in beheer), meerdere lesgevers en een notitie.
// De deelnemerslijst met één-tik aanwezigheid + QR-scan opent in een pop-up.
import React, { useEffect, useRef, useState } from 'react';
import { collection, doc, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  getMembers, registreerAanwezigheid, verwijderAanwezigheid,
  getAanwezigeLeden, updateMetAudit,
} from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast.jsx';
import { vandaagISO, formatDatum } from './seizoenHelpers';
import LesgeversPanel from './LesgeversPanel';
import { TechniekAccordeonLijst } from './TechniekAccordeon';
import GroepKiezer from './GroepKiezer';
import DetailModal from '../details/DetailModal';

const S = {
  wrap: { maxWidth: '560px', margin: '0 auto' },
  kop: {
    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: '14px', padding: '16px', marginBottom: '14px',
  },
  trainingTitel: { fontSize: '18px', fontWeight: '800', marginBottom: '8px' },
  dateSelect: {
    width: '100%', boxSizing: 'border-box', padding: '10px 12px',
    background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px',
    fontFamily: 'inherit', fontWeight: '600',
  },
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
  deelnemersKnop: {
    width: '100%', padding: '14px', borderRadius: '12px', cursor: 'pointer',
    fontSize: '15px', fontWeight: '700', fontFamily: 'inherit',
    background: 'var(--accent-red)', color: '#fff', border: 'none',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  textarea: {
    width: '100%', boxSizing: 'border-box', padding: '12px', minHeight: '70px',
    background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    borderRadius: '10px', color: 'var(--text-primary)', fontSize: '14px',
    fontFamily: 'inherit', resize: 'vertical',
  },
  sectieTitel: { fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', margin: '0 0 10px' },
  sectieKnop: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
  },
  volgendeLes: (huidig) => ({
    background: 'linear-gradient(135deg, rgba(56,189,248,0.16) 0%, rgba(27,42,61,0.6) 100%)',
    border: `1px solid ${huidig ? 'var(--success)' : '#38BDF8'}`,
    borderRadius: '14px', padding: '14px 16px', marginBottom: '14px',
    cursor: huidig ? 'default' : 'pointer',
    display: 'flex', alignItems: 'center', gap: '12px',
  }),
  leeg: { padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' },
};

function eerstvolgendeTrainingId(trainingen) {
  const vandaag = vandaagISO();
  const toekomst = trainingen
    .filter(t => t.datum >= vandaag && !t.geannuleerd)
    .sort((a, b) => a.datum.localeCompare(b.datum));
  if (toekomst.length > 0) return toekomst[0].id;
  const verleden = trainingen
    .filter(t => !t.geannuleerd)
    .sort((a, b) => b.datum.localeCompare(a.datum));
  return verleden[0]?.id || null;
}

export default function TrainerModus({ groepen, lesgeversLijst, lesgeverTrainingen = [], profielGroepen = [], actieveGroep, onKiesGroep }) {
  const { profiel, isBeheerder, isTrainer } = useAuth();
  const toast = useToast();
  const [leden, setLeden] = useState([]);
  const [trainingen, setTrainingen] = useState([]);
  const [geselecteerdeId, setGeselecteerdeId] = useState(null);
  const [technieken, setTechnieken] = useState([]);
  const [techniekDatabank, setTechniekDatabank] = useState([]);
  const [aanwezig, setAanwezig] = useState(new Set());
  const [laden, setLaden] = useState(true);
  const [notitie, setNotitie] = useState('');
  const [notitieBezig, setNotitieBezig] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [bezigLid, setBezigLid] = useState(null);
  const [deelnemersOpen, setDeelnemersOpen] = useState(false);
  const [openSecties, setOpenSecties] = useState({ technieken: true, notitie: false });

  const groep = groepen.find(g => g.id === actieveGroep);
  const groepNaam = groep?.naam || '';
  const training = trainingen.find(t => t.id === geselecteerdeId) || null;

  const toggleSectie = (key) => setOpenSecties(s => ({ ...s, [key]: !s[key] }));

  // Jouw eerstvolgende les (over alle groepen waar je lesgeeft)
  const volgendeLes = [...lesgeverTrainingen]
    .filter(t => t.datum >= vandaagISO() && !t.geannuleerd)
    .sort((a, b) => a.datum.localeCompare(b.datum))[0] || null;
  const volgendeLesGroep = volgendeLes ? groepen.find(g => g.id === volgendeLes.groepId) : null;
  const volgendeLesIsHuidig = volgendeLes && volgendeLes.groepId === actieveGroep && volgendeLes.id === geselecteerdeId;

  const gaNaarVolgendeLes = () => {
    if (!volgendeLes) return;
    if (volgendeLes.groepId !== actieveGroep) onKiesGroep(volgendeLes.groepId);
    setGeselecteerdeId(volgendeLes.id);
  };

  // Technieken-databank één keer laden (voor detailweergave per techniek)
  useEffect(() => {
    getDocs(collection(db, 'technieken'))
      .then(snap => setTechniekDatabank(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => setTechniekDatabank([]));
  }, []);

  // Trainingen voor de actieve groep live volgen (geen orderBy → enkel de
  // automatische single-field index op groepId; we sorteren client-side).
  // onSnapshot zodat lesgever-wijzigingen via LesgeversPanel meteen zichtbaar zijn.
  useEffect(() => {
    if (!actieveGroep) { setTrainingen([]); setLaden(false); return; }
    setLaden(true);
    const q = query(collection(db, 'trainingen'), where('groepId', '==', actieveGroep));
    const unsub = onSnapshot(q, snap => {
      setTrainingen(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLaden(false);
    }, () => { setTrainingen([]); setLaden(false); });
    return unsub;
  }, [actieveGroep]);

  // Standaardselectie: eerstvolgende training (of behoud huidige als die bestaat)
  useEffect(() => {
    setGeselecteerdeId(prev =>
      prev && trainingen.some(t => t.id === prev) ? prev : eerstvolgendeTrainingId(trainingen));
  }, [trainingen]);

  // Leden van de groep
  useEffect(() => {
    if (!groepNaam) { setLeden([]); return; }
    getMembers().then(alle => {
      const inGroep = alle
        .filter(m => m.actief !== false && Array.isArray(m.groepen) && m.groepen.includes(groepNaam))
        .sort((a, b) => (a.naam || '').localeCompare(b.naam || ''));
      setLeden(inGroep);
    }).catch(() => setLeden([]));
  }, [groepNaam]);

  // Technieken van de gekozen training
  useEffect(() => {
    if (!training) { setTechnieken([]); return; }
    getDocs(query(collection(db, 'trainingen', training.id, 'technieken'), orderBy('volgorde')))
      .then(snap => setTechnieken(snap.docs.map(d => ({ id: d.id, ...d.data() }))))
      .catch(() => setTechnieken([]));
  }, [training?.id]);

  // Aanwezigheid + notitie voor de gekozen training
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

  if (!actieveGroep) {
    return <div style={S.leeg}>Kies een groep om aanwezigheid te registreren.</div>;
  }

  return (
    <div style={S.wrap}>
      {/* Jouw eerstvolgende les (over alle groepen) */}
      {volgendeLes && (
        <div style={S.volgendeLes(volgendeLesIsHuidig)} onClick={volgendeLesIsHuidig ? undefined : gaNaarVolgendeLes} role={volgendeLesIsHuidig ? undefined : 'button'}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px', color: '#38BDF8', marginBottom: '2px' }}>
              {volgendeLesIsHuidig ? 'Je bekijkt je volgende les' : 'Jouw volgende les'}
            </div>
            <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)' }}>
              {volgendeLesGroep?.naam || volgendeLes.groepId}
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{formatDatum(volgendeLes.datum)}</div>
          </div>
          {!volgendeLesIsHuidig && <span style={{ color: '#38BDF8', fontWeight: '800', flexShrink: 0 }}>Ga ›</span>}
        </div>
      )}

      {/* Groepskeuze (pop-up) */}
      <div style={{ marginBottom: '14px' }}>
        <GroepKiezer groepen={groepen} actieveGroep={actieveGroep} onKies={onKiesGroep} profielGroepen={profielGroepen} />
      </div>

      {laden ? (
        <div style={S.leeg}>Laden...</div>
      ) : !training ? (
        <div style={S.leeg}>Geen trainingen gevonden voor {groepNaam}.</div>
      ) : (
        <>
          {/* Training-kop met datumkeuze */}
          <div style={S.kop}>
            <div style={S.trainingTitel}>{groepNaam}</div>
            <select
              style={S.dateSelect}
              value={training.id}
              onChange={e => setGeselecteerdeId(e.target.value)}
              aria-label="Kies trainingsdatum"
            >
              {[...trainingen].sort((a, b) => b.datum.localeCompare(a.datum)).map(t => (
                <option key={t.id} value={t.id}>
                  {formatDatum(t.datum)}{t.geannuleerd ? ' (geannuleerd)' : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Lesgevers (meerdere mogelijk) */}
          <LesgeversPanel
            training={training}
            profiel={profiel}
            isBeheerder={isBeheerder || isTrainer}
            lesgeversLijst={lesgeversLijst}
          />

          {/* Technieken (zoals in beheer, inklapbaar) */}
          <div style={S.kop}>
            <button style={S.sectieKnop} onClick={() => toggleSectie('technieken')}>
              <span style={{ ...S.sectieTitel, margin: 0 }}>Technieken ({technieken.length})</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{openSecties.technieken ? '▲' : '▼'}</span>
            </button>
            {openSecties.technieken && (
              <div style={{ marginTop: '10px' }}>
                <TechniekAccordeonLijst technieksLijst={technieken} techniekDatabank={techniekDatabank} />
              </div>
            )}
          </div>

          {/* Deelnemers-knop → opent pop-up */}
          <div style={S.kop}>
            <button style={S.deelnemersKnop} onClick={() => setDeelnemersOpen(true)}>
              <span>👥 Deelnemers</span>
              <span>{aanwezig.size}/{leden.length} aanwezig ›</span>
            </button>
          </div>

          {/* Notitie (inklapbaar) */}
          <div style={S.kop}>
            <button style={S.sectieKnop} onClick={() => toggleSectie('notitie')}>
              <span style={{ ...S.sectieTitel, margin: 0 }}>Notitie{notitie ? ' •' : ''}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{openSecties.notitie ? '▲' : '▼'}</span>
            </button>
            {openSecties.notitie && (
              <div style={{ marginTop: '10px' }}>
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
            )}
          </div>

          {/* Deelnemers-pop-up */}
          <DetailModal
            open={deelnemersOpen}
            onClose={() => { setDeelnemersOpen(false); setScanOpen(false); }}
            title={`Deelnemers · ${aanwezig.size}/${leden.length}`}
            accentKleur="var(--accent-red)"
          >
            <button style={{ ...S.knopSec, marginBottom: '12px' }} onClick={() => setScanOpen(s => !s)}>
              {scanOpen ? '✕ Sluit scanner' : '📷 QR scannen'}
            </button>

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
          </DetailModal>
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
