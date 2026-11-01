// src/components/trainingen/TrainerModus.jsx
// Mobiel-eerst aanwezigheidsscherm voor trainers.
// Toont de gekozen training van de groep (datum vrij te kiezen voor correcties),
// de ingeplande technieken (zoals in beheer), meerdere lesgevers en een notitie.
// De deelnemerslijst met één-tik aanwezigheid + QR-scan opent in een pop-up.
// Trainers kunnen hier zelf een training aanmaken, bewerken (TrainingFormulier) en annuleren.
import React, { useEffect, useRef, useState } from 'react';
import { collection, doc, getDocs, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';
import {
  registreerAanwezigheid, verwijderAanwezigheid,
  getAanwezigeLeden, updateMetAudit, formatDuur,
} from '../../services/firestoreService';
import { COLLECTIONS } from '../../config/appConfig';
import { TRAINING_STATUS, STATUS_LABELS, STATUS_EMOJI, bepaalTrainingStatus } from './trainingStatus';
import { wedstrijdInfoVoorTraining } from './wedstrijdInfo';
import { useAuth } from '../../contexts/AuthContext';
import { useConfirm } from '../../contexts/ConfirmContext';
import { annuleerTraining } from './trainingAnnuleren';
import { useToast } from '../ui/Toast.jsx';
import { vandaagISO, formatDatum } from './seizoenHelpers';
import { lidWeergaveNaam, vergelijkLeden } from '../../utils/ledenKoppeling';
import LesgeversPanel from './LesgeversPanel';
import { TechniekAccordeonLijst } from './TechniekAccordeon';
import TechniekBeheerBlok from './TechniekBeheerBlok';
import GroepKiezer from './GroepKiezer';
import TrainingFormulier from './TrainingFormulier';
import DetailModal from '../details/DetailModal';
import { QR_LID_SCHEME } from '../../config/appConfig';

const normalizeGroepen = (v) => !v ? [] : Array.isArray(v) ? v : [v];

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
  tegelGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '4px' },
  tegel: (aanwezig) => ({
    padding: '12px 10px', borderRadius: '12px', cursor: 'pointer',
    border: `2px solid ${aanwezig ? 'var(--success)' : 'var(--border-color)'}`,
    background: aanwezig ? 'rgba(39,174,96,0.12)' : 'var(--bg-card)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
    minHeight: '64px', justifyContent: 'center', gap: '4px',
    transition: 'background 0.15s, border-color 0.15s',
    position: 'relative',
  }),
  tegelNaam: (aanwezig) => ({
    fontSize: '14px', fontWeight: '700', lineHeight: 1.2,
    color: aanwezig ? 'var(--success)' : 'var(--text-primary)',
  }),
  tegelGroep: {
    fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: '0.3px',
  },
  tegelCheck: {
    position: 'absolute', top: '6px', right: '8px',
    fontSize: '13px', color: 'var(--success)',
  },
  knop: {
    padding: '12px 18px', borderRadius: '10px', border: 'none', cursor: 'pointer',
    fontSize: '14px', fontWeight: '700', fontFamily: 'inherit',
    background: 'var(--accent-red)', color: 'var(--btn-primary-text)',
  },
  knopSec: {
    padding: '12px 18px', borderRadius: '10px', cursor: 'pointer',
    fontSize: '14px', fontWeight: '600', fontFamily: 'inherit',
    background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)',
  },
  deelnemersKnop: {
    width: '100%', padding: '14px', borderRadius: '12px', cursor: 'pointer',
    fontSize: '15px', fontWeight: '700', fontFamily: 'inherit',
    background: 'var(--accent-red)', color: 'var(--btn-primary-text)', border: 'none',
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

export default function TrainerModus({ groepen, lesgeversLijst, lesgeverTrainingen = [], profielGroepen = [], actieveGroep, onKiesGroep, techniekDatabank = [], wedstrijdEvents = [], geenTrainingMarkers, provincialeMarkers }) {
  const { profiel, isBeheerder, isTrainer } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [leden, setLeden] = useState([]);
  const [trainingen, setTrainingen] = useState([]);
  const [geselecteerdeId, setGeselecteerdeId] = useState(null);
  const [technieken, setTechnieken] = useState([]);
  const [aanwezig, setAanwezig] = useState(new Set());
  const [laden, setLaden] = useState(true);
  const [notitie, setNotitie] = useState('');
  const [notitieBezig, setNotitieBezig] = useState(false);
  const [notitieEdit, setNotitieEdit] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [bezigLid, setBezigLid] = useState(null);
  const [allesToebezig, setAllesToebezig] = useState(false);
  const [deelnemersOpen, setDeelnemersOpen] = useState(false);
  const [openSecties, setOpenSecties] = useState({ technieken: true });
  const [formulier, setFormulier] = useState({ open: false, training: null });
  const [annuleerBezig, setAnnuleerBezig] = useState(false);

  const groep = groepen.find(g => g.id === actieveGroep);
  const groepNaam = groep?.naam || '';
  const training = trainingen.find(t => t.id === geselecteerdeId) || null;
  const kanBewerken = isTrainer || isBeheerder;

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

  // Leden van de groep + eventuele samengevoegde groepen.
  // Gerichte query (array-contains-any) i.p.v. de hele ledencollectie, en enkel
  // herladen wanneer de groepsnamen wijzigen (niet bij elke datumwissel).
  const extraNamen = normalizeGroepen(training?.samengevoegdMet).map(id => groepen.find(g => g.id === id)?.naam).filter(Boolean);
  const alleNamen = [groepNaam, ...extraNamen].filter(Boolean);
  const ledenSleutel = alleNamen.join('||');
  useEffect(() => {
    if (!ledenSleutel) { setLeden([]); return; }
    let actief = true;
    getDocs(query(collection(db, COLLECTIONS.MEMBERS), where('groepen', 'array-contains-any', ledenSleutel.split('||'))))
      .then(snap => {
        if (!actief) return;
        setLeden(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(m => m.actief !== false).sort(vergelijkLeden));
      })
      .catch(() => { if (actief) setLeden([]); });
    return () => { actief = false; };
  }, [ledenSleutel]);

  // Technieken van de gekozen training — live (onSnapshot), zodat toevoegen/
  // aanpassen/verwijderen door de trainer zelf meteen zichtbaar is.
  useEffect(() => {
    if (!training) { setTechnieken([]); return; }
    const q = query(collection(db, 'trainingen', training.id, 'technieken'), orderBy('volgorde'));
    const unsub = onSnapshot(q, snap => {
      setTechnieken(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => setTechnieken([]));
    return unsub;
  }, [training?.id]);

  // Aanwezigheid voor de gekozen training
  useEffect(() => {
    if (!training || leden.length === 0) { setAanwezig(new Set()); return; }
    let actief = true;
    getAanwezigeLeden(leden.map(l => l.id), training.id)
      .then(r => { if (actief) setAanwezig(r); })
      .catch(() => { if (actief) setAanwezig(new Set()); });
    return () => { actief = false; };
  }, [training?.id, leden]);

  // Bewerken van de notitie stopt bij een andere training
  useEffect(() => { setNotitieEdit(false); }, [training?.id]);

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
      toast({ bericht: `${lidWeergaveNaam(lid)} was al aanwezig`, type: 'info' });
      return;
    }
    try {
      await registreerAanwezigheid(lidId, { ...training, groepNaam });
      setAanwezig(prev => new Set(prev).add(lidId));
      toast({ bericht: `${lidWeergaveNaam(lid)} aanwezig gemeld`, type: 'success' });
    } catch (e) {
      toast({ bericht: `Fout: ${e.message}`, type: 'error' });
    }
  }

  async function markeerAlles() {
    if (!training || allesToebezig) return;
    const nog = leden.filter(l => !aanwezig.has(l.id));
    if (nog.length === 0) return;
    setAllesToebezig(true);
    try {
      await Promise.all(nog.map(l => registreerAanwezigheid(l.id, { ...training, groepNaam })));
      setAanwezig(new Set(leden.map(l => l.id)));
      toast({
        bericht: `${nog.length} lid/leden aanwezig gemeld`,
        type: 'success',
        onUndo: async () => {
          try {
            await Promise.all(nog.map(l => verwijderAanwezigheid(l.id, training.id)));
            setAanwezig(prev => { const n = new Set(prev); nog.forEach(l => n.delete(l.id)); return n; });
          } catch (e) {
            toast({ bericht: `Ongedaan maken mislukt: ${e.message}`, type: 'error' });
          }
        },
      });
    } catch (e) {
      toast({ bericht: `Fout: ${e.message}`, type: 'error' });
    }
    setAllesToebezig(false);
  }

  function openNieuweTraining() {
    setFormulier({ open: true, training: null });
  }

  function openBewerken() {
    if (!training) return;
    setFormulier({ open: true, training });
  }

  // Na opslaan: spring naar de (nieuwe) training. De lokale write heeft de
  // onSnapshot al getriggerd vóór deze callback, dus het id bestaat in de lijst.
  function naOpslaan(trainingId) {
    if (trainingId) setGeselecteerdeId(trainingId);
    toast({ bericht: 'Training opgeslagen', type: 'success' });
  }

  // Gedeelde logica (status + push naar leden) staat in trainingAnnuleren.js.
  async function handleAnnuleerTraining() {
    if (!training || annuleerBezig) return;
    const ok = await confirm({
      titel: 'Training annuleren?',
      beschrijving: `De training van ${formatDatum(training.datum)} wordt als geannuleerd gemarkeerd en alle leden krijgen een melding. Gebruik dit niet voor "sporthal gesloten" of "geen training" — kies dan die status via Bewerken.`,
      bevestigLabel: 'Ja, annuleer training',
      variant: 'danger',
    });
    if (!ok) return;
    setAnnuleerBezig(true);
    try {
      const res = await annuleerTraining(training, { groepNaam });
      toast(res.gewijzigd
        ? { bericht: 'Training geannuleerd', type: 'success' }
        : { bericht: 'Training was al geannuleerd', type: 'info' });
    } catch (e) {
      toast({ bericht: `Annuleren mislukt: ${e.message}`, type: 'error' });
    }
    setAnnuleerBezig(false);
  }

  async function slaNotitieOp() {
    if (!training) return;
    setNotitieBezig(true);
    try {
      await updateMetAudit(doc(db, 'trainingen', training.id), { trainerNotitie: notitie.trim() });
      toast({ bericht: 'Notitie opgeslagen', type: 'success' });
      setNotitieEdit(false);
    } catch (e) {
      toast({ bericht: `Fout: ${e.message}`, type: 'error' });
    }
    setNotitieBezig(false);
  }

  const status = training
    ? bepaalTrainingStatus(training, { geenMarkers: geenTrainingMarkers, provincialeMarkers, volgtProvincialeKalender: groep?.volgtProvincialeKalender })
    : TRAINING_STATUS.NORMAAL;
  const statusKleur = status === TRAINING_STATUS.GEANNULEERD ? 'var(--accent-red)' : status === TRAINING_STATUS.GEEN ? 'var(--text-secondary)' : '#A78BFA';
  const samenNamen = extraNamen.join(', ');
  // Niet annuleren als al geannuleerd/geen training, of als de datum voorbij is (geen zinloze push).
  const kanAnnuleren = !!training && (status === TRAINING_STATUS.NORMAAL || status === TRAINING_STATUS.SAMENGEVOEGD) && training.datum >= vandaagISO();
  const duurStr = training ? formatDuur(training.duurMinuten) : '';
  const tijdLabel = training
    ? [training.startTijd && training.eindTijd ? `${training.startTijd} – ${training.eindTijd}` : '', duurStr].filter(Boolean).join(' · ')
    : '';
  const wedstrijden = training ? wedstrijdInfoVoorTraining(training, groep, wedstrijdEvents) : [];
  const aantalCommentaar = technieken.filter(t => t.commentaar).length;
  const bewaardeNotitie = (training?.trainerNotitie || '').trim();
  const planningOpmerking = (training?.opmerking || '').trim();

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
        {kanBewerken && (
          <button style={{ ...S.knopSec, width: '100%', minHeight: '44px', marginTop: '8px' }} onClick={openNieuweTraining}>
            + Nieuwe training
          </button>
        )}
      </div>

      {laden ? (
        <div style={S.leeg}>Laden...</div>
      ) : !training ? (
        <div style={S.leeg}>Geen trainingen gevonden voor {groepNaam}.</div>
      ) : (
        <>
          {/* Training-kop met datumkeuze */}
          <div style={S.kop}>
            {training.datum === vandaagISO() && (
              <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.7px', color: 'var(--success)', marginBottom: '4px' }}>
                ● Vandaag
              </div>
            )}
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
            {(tijdLabel || status !== TRAINING_STATUS.NORMAAL || wedstrijden.length > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                {tijdLabel && <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', padding: '3px 10px', border: '1px solid var(--border-color)', borderRadius: '999px' }}>🕒 {tijdLabel}</span>}
                {status !== TRAINING_STATUS.NORMAAL && (
                  <span style={{ fontSize: '12px', fontWeight: '700', color: statusKleur, padding: '3px 10px', border: `1px solid ${statusKleur}`, borderRadius: '999px' }}>
                    {STATUS_EMOJI[status]} {STATUS_LABELS[status]}{status === TRAINING_STATUS.SAMENGEVOEGD && samenNamen ? ` met ${samenNamen}` : ''}
                  </span>
                )}
                {wedstrijden.map((w, i) => (
                  <span key={i} style={{ fontSize: '12px', fontWeight: '600', color: '#FB923C', padding: '3px 10px', border: '1px solid rgba(251,146,60,0.45)', borderRadius: '999px' }}>
                    🏆 {w.naam}{w.dag === 'zondag' ? ' · zondag' : ''}
                  </span>
                ))}
              </div>
            )}
            {kanBewerken && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button style={{ ...S.knopSec, flex: 1, minHeight: '44px' }} onClick={openBewerken}>✏️ Bewerken</button>
                {kanAnnuleren && (
                  <button
                    style={{ ...S.knopSec, flex: 1, minHeight: '44px', color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
                    onClick={handleAnnuleerTraining}
                    disabled={annuleerBezig}
                  >
                    {annuleerBezig ? 'Bezig...' : 'Annuleer training'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Notitie: altijd zichtbaar wanneer ingevuld */}
          <div style={{ ...S.kop, borderLeft: `4px solid ${bewaardeNotitie ? '#FB923C' : 'var(--border-color)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span style={{ ...S.sectieTitel, margin: 0 }}>📝 Notitie</span>
              {!notitieEdit && (
                <button style={{ ...S.knopSec, padding: '8px 14px', minHeight: '40px' }} onClick={() => { setNotitie(training.trainerNotitie || ''); setNotitieEdit(true); }}>
                  {bewaardeNotitie ? '✏️ Bewerken' : '+ Toevoegen'}
                </button>
              )}
            </div>
            {planningOpmerking && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>📌 Planning (Beheer): {planningOpmerking}</div>
            )}
            {!notitieEdit && bewaardeNotitie && (
              <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{bewaardeNotitie}</div>
            )}
            {!notitieEdit && !bewaardeNotitie && (
              <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--text-secondary)' }}>Nog geen notitie voor deze training.</div>
            )}
            {notitieEdit && (
              <div style={{ marginTop: '10px' }}>
                <textarea
                  style={S.textarea}
                  value={notitie}
                  maxLength={1000}
                  onChange={e => setNotitie(e.target.value)}
                  placeholder="Bv. gewerkt aan o-goshi; 2 blessures..."
                  autoFocus
                />
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px' }}>Deze notitie is ook zichtbaar in Beheer.</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button style={S.knopSec} onClick={() => setNotitieEdit(false)}>Annuleren</button>
                  <button style={{ ...S.knop, flex: 1 }} onClick={slaNotitieOp} disabled={notitieBezig}>
                    {notitieBezig ? 'Opslaan...' : 'Notitie opslaan'}
                  </button>
                </div>
              </div>
            )}
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
              <span style={{ ...S.sectieTitel, margin: 0 }}>Technieken ({technieken.length}){aantalCommentaar > 0 ? ` · 💬 ${aantalCommentaar}` : ''}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{openSecties.technieken ? '▲' : '▼'}</span>
            </button>
            {openSecties.technieken && (
              <div style={{ marginTop: '10px' }}>
                {isTrainer ? (
                  <TechniekBeheerBlok
                    trainingId={training.id}
                    technieken={technieken}
                    techniekDatabank={techniekDatabank}
                  />
                ) : (
                  <TechniekAccordeonLijst technieksLijst={technieken} techniekDatabank={techniekDatabank} />
                )}
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

          {/* Deelnemers-pop-up */}
          {(() => {
            const meerdereGroepen = alleNamen.length > 1;
            return (
              <DetailModal
                open={deelnemersOpen}
                onClose={() => { setDeelnemersOpen(false); setScanOpen(false); }}
                title={`Deelnemers · ${aanwezig.size}/${leden.length}`}
                accentKleur="var(--accent-red)"
              >
                <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                  <button style={S.knopSec} onClick={() => setScanOpen(s => !s)}>
                    {scanOpen ? '✕ Sluit scanner' : '📷 QR scannen'}
                  </button>
                  {aanwezig.size < leden.length && (
                    <button style={S.knop} onClick={markeerAlles} disabled={allesToebezig}>
                      {allesToebezig ? 'Bezig...' : `Iedereen aanwezig (${leden.length - aanwezig.size})`}
                    </button>
                  )}
                </div>

                {scanOpen && (
                  <QrScanner
                    onResultaat={(tekst) => {
                      const match = new RegExp(`${QR_LID_SCHEME}:(.+)`).exec(tekst);
                      if (match) markeerViaId(match[1].trim());
                      else toast({ bericht: 'Onbekende QR-code', type: 'error' });
                    }}
                    onSluit={() => setScanOpen(false)}
                  />
                )}

                {leden.length === 0 ? (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Geen actieve leden in deze groep.</div>
                ) : (
                  <div style={S.tegelGrid}>
                    {leden.map(lid => {
                      const isAanw = aanwezig.has(lid.id);
                      const groepLabel = meerdereGroepen
                        ? alleNamen.find(naam => (lid.groepen || []).includes(naam)) || null
                        : null;
                      return (
                        <div key={lid.id} style={S.tegel(isAanw)} onClick={() => toggleLid(lid)}>
                          {isAanw && <span style={S.tegelCheck}>✓</span>}
                          <span style={S.tegelNaam(isAanw)}>{lidWeergaveNaam(lid) || '(naamloos)'}</span>
                          {groepLabel && <span style={S.tegelGroep}>{groepLabel}</span>}
                          {bezigLid === lid.id && (
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', position: 'absolute', bottom: '4px', right: '8px' }}>...</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </DetailModal>
            );
          })()}
        </>
      )}

      {/* Formulier (nieuw/bewerken) — hergebruikt het formulier uit Beheer */}
      {formulier.open && (
        <TrainingFormulier
          groepId={actieveGroep}
          datum={formulier.training?.datum || vandaagISO()}
          trainingsData={formulier.training}
          technieken={techniekDatabank}
          lesgeversLijst={lesgeversLijst || []}
          groepen={groepen}
          geenTrainingMarkers={geenTrainingMarkers}
          provincialeMarkers={provincialeMarkers}
          bestaandeDatums={trainingen.map(t => t.datum)}
          onClose={() => setFormulier({ open: false, training: null })}
          onSaved={naOpslaan}
        />
      )}
    </div>
  );
}

// ─── QR Scanner (lazy html5-qrcode) ───────────────────────────────────────────
function QrScanner({ onResultaat, onSluit }) {
  const containerRef = useRef(null);
  const scannerRef = useRef(null);
  const [fout, setFout] = useState('');
  // Callback via ref: anders herstart de camera bij elke render van de ouder.
  const cbRef = useRef(onResultaat);
  cbRef.current = onResultaat;
  const laatsteScan = useRef({ tekst: '', tijd: 0 });

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
          const nu = Date.now();
          if (decodedText === laatsteScan.current.tekst && nu - laatsteScan.current.tijd < 3000) return;
          laatsteScan.current = { tekst: decodedText, tijd: nu };
          cbRef.current(decodedText);
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
  }, []);

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
