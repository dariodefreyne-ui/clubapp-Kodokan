// src/components/trainingen/TrainingFormulier.jsx
import React, { useState, useEffect } from 'react';
import {
  collection, doc, getDocs, addDoc, setDoc, deleteDoc,
  query, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { setMetAudit } from '../../services/firestoreService';
import { C } from './tokens';
import { bepaalSeizoen, formatDatum, vandaagISO, trainingsId } from './seizoenHelpers';
import { berekenDuurMinuten } from '../../services/firestoreService';
import {
  TRAINING_STATUS,
  STATUS_VOLGORDE,
  STATUS_LABELS,
  STATUS_EMOJI,
  bepaalTrainingStatus,
} from './trainingStatus';

import { stuurPushTrigger, PUSH_TYPES } from '../../services/pushService';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../ui/Toast';

const normalizeGroepen = (v) => !v ? [] : Array.isArray(v) ? v : [v];

function TrainingFormulier({ groepId, datum, trainingsData, technieken, lesgeversLijst, onClose, onSaved, groepen }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [opmerking, setOpmerking]           = useState(trainingsData?.opmerking || '');
  const [gekozenDatum, setGekozenDatum]     = useState(datum);
  const [technieksLijst, setTechnieksLijst] = useState([]);
  const [bezig, setBezig]                   = useState(false);
  const [fout, setFout]                     = useState('');
  const [lesgevers, setLesgevers]           = useState(trainingsData?.lesgevers || []);
  const [duurMinuten, setDuurMinuten]       = useState(trainingsData?.duurMinuten || '');
  const [startTijd, setStartTijd]           = useState(trainingsData?.startTijd || '');
  const [eindTijd, setEindTijd]             = useState(trainingsData?.eindTijd || '');
  const [status, setStatus]                 = useState(trainingsData ? bepaalTrainingStatus(trainingsData) : TRAINING_STATUS.NORMAAL);
  const [samengevoegdMet, setSamengevoegdMet] = useState(normalizeGroepen(trainingsData?.samengevoegdMet));
  const trainId = trainingsId(groepId, gekozenDatum);

  // Laad standaard duur en klokuren van groep als nieuwe training
  useEffect(() => {
    if (trainingsData || !groepId) return;
    const groep = groepen?.find(g => g.id === groepId);
    if (groep?.duurMinuten) setDuurMinuten(groep.duurMinuten);
    if (groep?.startTijd) setStartTijd(groep.startTijd);
    if (groep?.eindTijd) setEindTijd(groep.eindTijd);
  }, [groepId, groepen, trainingsData]);

  // Auto-bereken duur uit klokuren wanneer geldig
  useEffect(() => {
    const berekend = berekenDuurMinuten(startTijd, eindTijd);
    if (berekend !== null) setDuurMinuten(String(berekend));
  }, [startTijd, eindTijd]);

  useEffect(() => {
    if (!trainingsData) return;
    const ref = collection(db, 'trainingen', trainId, 'technieken');
    getDocs(query(ref, orderBy('volgorde'))).then(snap => {
      setTechnieksLijst(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, [trainId, trainingsData]);

  const voegTechniekToe = () => {
    setTechnieksLijst(prev => [...prev, {
      id: `nieuw_${Date.now()}`, basisvaardigheid: '', techniekId: '', techniekNaam: '',
      fase: 'basis', volgorde: prev.length, isNieuw: true,
    }]);
  };

  const updateTechniek = (idx, veld, waarde) => {
    setTechnieksLijst(prev => prev.map((t, i) => {
      if (i !== idx) return t;
      if (veld === 'techniekId') {
        const gevonden = technieken.find(tk => tk.id === waarde);
        if (gevonden) {
          return { ...t, techniekId: waarde, techniekNaam: gevonden.techniek, basisvaardigheid: t.basisvaardigheid || gevonden.basisvoorwaarden?.[0] || '', _heeftVerdieping: !!(gevonden.verdieping?.length) };
        }
        return { ...t, techniekId: waarde, techniekNaam: '' };
      }
      return { ...t, [veld]: waarde };
    }));
  };

  const verwijderTechniek = async (techniek, idx) => {
    if (!techniek.isNieuw) {
      const ok = await confirm({
        titel: 'Techniek verwijderen?',
        beschrijving: techniek.techniekNaam
          ? `"${techniek.techniekNaam}" wordt definitief uit deze training verwijderd.`
          : 'Deze techniek wordt definitief uit de training verwijderd.',
        bevestigLabel: 'Ja, verwijderen',
        variant: 'danger',
      });
      if (!ok) return;
      try { await deleteDoc(doc(db, 'trainingen', trainId, 'technieken', techniek.id)); }
      catch (e) {
        console.error(e);
        toast({ bericht: `Verwijderen mislukt: ${e.message}`, type: 'error' });
        return;
      }
    }
    setTechnieksLijst(prev => prev.filter((_, i) => i !== idx));
  };

  const opslaan = async () => {
    if (!gekozenDatum) { setFout('Kies een datum.'); return; }
    if (status === TRAINING_STATUS.SAMENGEVOEGD && samengevoegdMet.length === 0) {
      setFout('Kies minstens één groep om mee samen te voegen.');
      return;
    }

    // Validatie klokuren: één van beide ingevuld is niet toegestaan
    if ((startTijd && !eindTijd) || (!startTijd && eindTijd)) {
      setFout('Vul beide klokuren in, of laat ze beide leeg.');
      return;
    }
    if (startTijd && eindTijd && berekenDuurMinuten(startTijd, eindTijd) === null) {
      setFout('Eindtijd moet later zijn dan starttijd.');
      return;
    }

    const datumVroeger = new Date(gekozenDatum) < new Date(new Date().setFullYear(new Date().getFullYear() - 1));
    if (datumVroeger) {
      const ok = await confirm({
        titel: 'Datum ligt ver in het verleden',
        beschrijving: `De datum ${formatDatum(gekozenDatum)} ligt meer dan een jaar in het verleden. Toch opslaan?`,
        bevestigLabel: 'Toch opslaan',
        annuleerLabel: 'Annuleren',
        variant: 'primary',
      });
      if (!ok) return;
    }
    setBezig(true); setFout('');
    try {
      const duurInt = parseInt(duurMinuten) || 60;
      // Bepaal of duur manueel overschreven werd
      const groep = groepen?.find(g => g.id === groepId);
      const duurOverschreven = groep ? duurInt !== (groep.duurMinuten || 60) : true;

      const effectieveSamenvoeging = status === TRAINING_STATUS.SAMENGEVOEGD ? (samengevoegdMet.length ? samengevoegdMet : null) : null;
      const payload = {
        groepId, datum: gekozenDatum, opmerking, lesgevers,
        seizoen: bepaalSeizoen(gekozenDatum),
        duurMinuten: duurInt,
        duurOverschreven,
        status,
        samengevoegdMet: effectieveSamenvoeging,
        // geannuleerd in sync houden voor backward-compat (oude queries/widgets)
        geannuleerd: status === TRAINING_STATUS.GEANNULEERD,
        techniekBadges: technieksLijst.filter(t => t.techniekNaam).map(t => ({ naam: t.techniekNaam, fase: t.fase })),
        aangemaakt: trainingsData ? trainingsData.aangemaakt : serverTimestamp(),
        bijgewerkt: serverTimestamp(),
      };
      if (startTijd) payload.startTijd = startTijd;
      if (eindTijd) payload.eindTijd = eindTijd;

      await setMetAudit(doc(db, 'trainingen', trainId), payload, { merge: true });

      for (let i = 0; i < technieksLijst.length; i++) {
        const t = technieksLijst[i];
        if (!t.techniekNaam && !t.techniekId && !t.basisvaardigheid) continue;
        const data = { basisvaardigheid: t.basisvaardigheid || '', techniekId: t.techniekId || '', techniekNaam: t.techniekNaam || '', fase: t.fase || 'basis', volgorde: i };
        if (t.isNieuw) { await addDoc(collection(db, 'trainingen', trainId, 'technieken'), data); }
        else { await setDoc(doc(db, 'trainingen', trainId, 'technieken', t.id), data); }
      }
      // T2 — training verplaatst: alleen sturen als datum effectief gewijzigd is
      if (trainingsData && trainingsData.datum && trainingsData.datum !== gekozenDatum) {
        const groepNaam = groepen?.find(g => g.id === groepId)?.naam || groepId;
        stuurPushTrigger(PUSH_TYPES.TRAINING_VERPLAATST, {
          groepId,
          groepNaam,
          oudeDatum: trainingsData.datum,
          nieuweDatum: gekozenDatum,
        });
      }
      onSaved(); onClose();
    } catch (e) {
      setFout('Opslaan mislukt: ' + e.message);
    } finally { setBezig(false); }
  };

  const klokurenLeeg = !startTijd && !eindTijd;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
      <div style={{ background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '580px', marginTop: '20px', boxShadow: '0 16px 40px rgba(0,0,0,0.28)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700' }}>
            {trainingsData ? '✏️ Bewerken' : '+ Nieuwe training'}
          </h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textSec, fontSize: '20px', cursor: 'pointer' }}>✕</button>
        </div>

        {fout && (
          <div style={{ background: C.redDim, border: `1px solid ${C.red}`, borderRadius: '8px', padding: '10px', color: C.red, fontSize: '14px', marginBottom: '14px' }}>
            {fout}
          </div>
        )}

        {/* Datum */}
        <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Datum {trainingsData && <span style={{ fontSize: '11px', fontWeight: '400' }}>(niet wijzigbaar)</span>}
        </label>
        <input type="date" value={gekozenDatum}
          onChange={e => !trainingsData && setGekozenDatum(e.target.value)}
          readOnly={!!trainingsData}
          style={{ width: '100%', padding: '10px', background: C.bg, border: `1px solid ${trainingsData ? C.border : C.red}`, borderRadius: '8px', color: C.textPrimary, fontSize: '14px', marginBottom: '14px', boxSizing: 'border-box', opacity: trainingsData ? 0.6 : 1 }}
        />

        {/* Klokuren */}
        <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Klokuren (optioneel)
        </label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '2px' }}>Start</div>
            <input type="time" value={startTijd} onChange={e => setStartTijd(e.target.value)}
              style={{ width: '100%', padding: '10px', background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: '8px', color: C.textPrimary, fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '2px' }}>Einde</div>
            <input type="time" value={eindTijd} onChange={e => setEindTijd(e.target.value)}
              style={{ width: '100%', padding: '10px', background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: '8px', color: C.textPrimary, fontSize: '14px', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        {/* Duur — manueel aanpasbaar, future-proof */}
        <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Duur (minuten)
          <span style={{ fontSize: '11px', fontWeight: '400', marginLeft: '6px' }}>standaard van groep</span>
        </label>
        {klokurenLeeg && (
          <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '6px', fontStyle: 'italic' }}>
            Of stel klokuren in voor automatische berekening
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          {[45, 60, 90, 120].map(min => (
            <button key={min} onClick={() => setDuurMinuten(min)}
              style={{ flex: 1, padding: '8px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: duurMinuten == min ? C.redDim : C.bg, border: `1px solid ${duurMinuten == min ? C.red : C.border}`, color: duurMinuten == min ? C.red : C.textSec }}>
              {min}min
            </button>
          ))}
          <input type="number" value={duurMinuten} onChange={e => setDuurMinuten(e.target.value)}
            placeholder="Ander"
            style={{ width: '80px', padding: '8px', background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: '8px', color: C.textPrimary, fontSize: '13px', textAlign: 'center' }}
          />
        </div>

        {/* Status */}
        <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          {STATUS_VOLGORDE.map(s => (
            <button key={s} onClick={() => setStatus(s)}
              style={{
                flex: '1 1 calc(50% - 4px)', minWidth: '120px', padding: '9px 8px', borderRadius: '8px', cursor: 'pointer',
                fontSize: '13px', fontWeight: '600',
                background: status === s ? C.redDim : C.bg,
                border: `1px solid ${status === s ? C.red : C.border}`,
                color: status === s ? C.red : C.textSec,
              }}>
              {STATUS_EMOJI[s]} {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        {status === TRAINING_STATUS.SAMENGEVOEGD && (
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '8px' }}>Traint samen met</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(groepen || []).filter(g => g.id !== groepId).map(g => {
                const actief = samengevoegdMet.includes(g.id);
                return (
                  <button key={g.id} type="button"
                    onClick={() => setSamengevoegdMet(prev => actief ? prev.filter(x => x !== g.id) : [...prev, g.id])}
                    style={{ padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: actief ? C.redDim : C.bg, border: `1px solid ${actief ? C.red : C.border}`, color: actief ? C.red : C.textSec }}>
                    {g.naam}{g.dag ? ` (${g.dag})` : ''}
                  </button>
                );
              })}
            </div>
            {samengevoegdMet.length === 0 && (
              <div style={{ fontSize: '11px', color: C.red, marginTop: '6px' }}>Kies minstens één groep.</div>
            )}
            <div style={{ fontSize: '11px', color: C.textMuted, marginTop: '6px', lineHeight: 1.4 }}>
              In de agenda blijft deze training zichtbaar voor de leden, met de vermelding dat ze samen met de gekozen groep(en) trainen.
            </div>
          </div>
        )}
        {status !== TRAINING_STATUS.NORMAAL && status !== TRAINING_STATUS.SAMENGEVOEGD && (
          <div style={{ fontSize: '11px', color: C.textMuted, marginBottom: '14px', lineHeight: 1.4 }}>
            {status === TRAINING_STATUS.GEEN
              ? 'Er is geen gewone training. Zet de reden in de opmerking (bv. vakantie, sporthal gesloten).'
              : 'De training valt uit. Gebruik de knop "Annuleer training" op de trainingskaart als je de leden een melding wil sturen.'}
          </div>
        )}

        {/* Opmerking */}
        <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Opmerking (optioneel)</label>
        <input type="text" value={opmerking} onChange={e => setOpmerking(e.target.value)}
          placeholder="Bv. tornooi, sporthal gesloten..."
          style={{ width: '100%', padding: '10px 12px', background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: '8px', color: C.textPrimary, fontSize: '14px', marginBottom: '18px', boxSizing: 'border-box' }}
        />

        {/* Lesgevers */}
        <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Lesgevers</label>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <select value="" onChange={e => { if (e.target.value) setLesgevers(prev => [...new Set([...prev, e.target.value])]); }}
            style={{ flex: 1, padding: '8px 10px', background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: '6px', color: C.textPrimary, fontSize: '13px' }}>
            <option value="">— Voeg lesgever toe —</option>
            {lesgeversLijst.filter(l => !lesgevers.includes(l.id)).map(l => (
              <option key={l.id} value={l.id}>{l.naam}</option>
            ))}
          </select>
        </div>
        {lesgevers.length > 0 && (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {lesgevers.map(id => {
              const naam = lesgeversLijst.find(l => l.id === id)?.naam ?? id;
              return (
                <span key={id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', padding: '3px 10px', borderRadius: '999px', background: C.purpleDim, border: `1px solid ${C.purple}`, color: C.purple, fontWeight: '600' }}>
                  {naam}
                  <button onClick={() => setLesgevers(prev => prev.filter(x => x !== id))}
                    style={{ background: 'transparent', border: 'none', color: C.purple, cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>x</button>
                </span>
              );
            })}
          </div>
        )}

        {/* Technieken */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <span style={{ fontSize: '12px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Technieken</span>
          <button onClick={voegTechniekToe}
            style={{ background: C.redDim, border: `1px solid ${C.red}`, color: C.red, padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>
            + Toevoegen
          </button>
        </div>
        {technieksLijst.length === 0 && (
          <div style={{ color: C.textMuted, fontSize: '14px', padding: '14px', background: '#0D1B2A', border: `1px solid ${C.borderSoft}`, borderRadius: '8px', textAlign: 'center', marginBottom: '14px' }}>
            Nog geen technieken. Klik "+ Toevoegen".
          </div>
        )}
        {technieksLijst.map((t, idx) => (
          <div key={t.id} style={{ background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '12px', color: C.textMuted, fontWeight: '600' }}>Techniek {idx + 1}</span>
              <button onClick={() => verwijderTechniek(t, idx)}
                style={{ background: 'transparent', border: 'none', color: C.red, cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>🗑</button>
            </div>
            <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px' }}>Basisvaardigheid</label>
            <input type="text" value={t.basisvaardigheid} onChange={e => updateTechniek(idx, 'basisvaardigheid', e.target.value)}
              placeholder="Bv. Buig-strek, Yoko-ukemi..."
              style={{ width: '100%', padding: '8px 10px', background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '6px', color: C.textPrimary, fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box' }}
            />
            <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px' }}>Techniek</label>
            <select value={t.techniekId} onChange={e => updateTechniek(idx, 'techniekId', e.target.value)}
              style={{ width: '100%', padding: '8px 10px', background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: '6px', color: t.techniekId ? C.textPrimary : C.textMuted, fontSize: '13px', marginBottom: '8px' }}>
              <option value="">— Kies techniek uit databank —</option>
              {['Val', 'houdgreep', 'Verplaatsing', 'Worpen', 'Transitie'].map(type => (
                <optgroup key={type} label={type}>
                  {technieken.filter(tk => tk.type === type).map(tk => (
                    <option key={tk.id} value={tk.id}>{tk.techniek}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            {/* Vrij invulveld als techniek niet in databank staat */}
            {!t.techniekId && (
              <input type="text" value={t.techniekNaam} onChange={e => updateTechniek(idx, 'techniekNaam', e.target.value)}
                placeholder="Of vrij invullen..."
                style={{ width: '100%', padding: '8px 10px', background: C.card, border: `1px solid ${C.orange}`, borderRadius: '6px', color: C.textPrimary, fontSize: '13px', marginBottom: '8px', boxSizing: 'border-box' }}
              />
            )}
            <label style={{ display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px' }}>Fase</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['basis', 'verdieping'].map(fase => (
                <button key={fase} onClick={() => updateTechniek(idx, 'fase', fase)}
                  style={{ flex: 1, padding: '7px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', background: t.fase === fase ? (fase === 'basis' ? C.blueDim : C.redDim) : C.card, border: `1px solid ${t.fase === fase ? (fase === 'basis' ? C.blue : C.red) : C.border}`, color: t.fase === fase ? (fase === 'basis' ? C.blue : C.red) : C.textMuted }}>
                  {fase}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '12px', background: 'transparent', border: `1px solid ${C.borderSoft}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '14px' }}>
            Annuleren
          </button>
          <button onClick={opslaan} disabled={bezig}
            style={{ flex: 2, padding: '12px', background: C.red, border: 'none', borderRadius: '8px', color: '#fff', cursor: 'pointer', fontSize: '14px', fontWeight: '700', opacity: bezig ? 0.6 : 1 }}>
            {bezig ? 'Opslaan...' : '✓ Opslaan'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default TrainingFormulier;
