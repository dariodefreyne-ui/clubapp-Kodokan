// src/components/wedstrijden/ResultaatEditor.jsx
// Snelle invoer van wedstrijdresultaten op de dag zelf — bedoeld om aan tafel/op de
// mat op een telefoon ingevuld te worden, dus grote tapbare knoppen en weinig scrollen.
//
// Twee systemen, afhankelijk van categorie (zie reglement Judo Vlaanderen):
// - Poule (U9/U11/U13): poulenummer, aantal deelnemers, eigen positie (geheugensteun
//   voor welke wedstrijdsgordel — rood/wit — nodig is), gewicht op de dag, en per
//   partij winst/verlies. Er is officieel geen podium bij U9-U13, enkel een optionele
//   manuele eindplaats in de poule.
// - Boom/stamboom (U15+): gewichtscategorie (officiële lijst per leeftijd/geslacht),
//   per partij winst/verlies, en een manueel ingevulde podiumplaats. De volledige boom
//   nabouwen is niet haalbaar met de beperkte info die er op de dag zelf is.
import React, { useState } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast';
import { C } from './tokens';
import { Field, btnStyle } from './SharedUI';
import { isPouleSysteem, gewichtsklassenVoor } from './gewichtscategorieen';

const inputStyle = {
  width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px',
  color: C.text, padding: '9px 12px', fontSize: '14px', boxSizing: 'border-box',
  fontFamily: 'inherit', outline: 'none',
};

function chipBtn(actief, kleur, bg) {
  return {
    cursor: 'pointer', borderRadius: '8px', padding: '6px 12px', fontSize: '13px', fontWeight: '700',
    background: actief ? bg : C.surface, border: `1px solid ${actief ? kleur : C.border}`,
    color: actief ? kleur : C.textSec, transition: 'all 0.12s', fontFamily: 'inherit',
  };
}

const WIN_KLEUR = C.green, WIN_BG = 'rgba(34,197,94,0.18)';
const LOSS_KLEUR = C.red, LOSS_BG = 'rgba(230,51,70,0.15)';

export default function ResultaatEditor({ ins, onClose }) {
  const { profiel } = useAuth();
  const toast = useToast();
  const poule = isPouleSysteem(ins.categorie);
  const r = ins.resultaat || {};

  const [gewicht,            setGewicht]            = useState(r.gewicht ?? '');
  const [pouleNummer,        setPouleNummer]         = useState(r.poule?.nummer ?? '');
  const [pouleGrootte,       setPouleGrootte]        = useState(r.poule?.grootte ?? 4);
  const [positie,            setPositie]             = useState(r.poule?.positie ?? '');
  const [geslacht,           setGeslacht]            = useState(r.geslacht ?? '');
  const [gewichtscategorie,  setGewichtscategorie]   = useState(r.gewichtscategorie ?? '');
  const [partijen,           setPartijen]            = useState(r.partijen?.length ? r.partijen : [{ tegenstander: '', resultaat: null }]);
  const [eindplaats,         setEindplaats]          = useState(r.eindplaats ?? '');
  const [notities,           setNotities]            = useState(r.notities ?? '');
  const [saving,             setSaving]              = useState(false);

  function updatePartij(idx, veld, waarde) {
    setPartijen(prev => prev.map((p, i) => i === idx ? { ...p, [veld]: waarde } : p));
  }
  function voegPartijToe() {
    setPartijen(prev => [...prev, { tegenstander: '', resultaat: null }]);
  }
  function verwijderPartij(idx) {
    setPartijen(prev => prev.filter((_, i) => i !== idx));
  }

  async function opslaan() {
    setSaving(true);
    try {
      const schoongepartijen = partijen.filter(p => p.resultaat);
      const resultaat = poule
        ? {
            systeem: 'poule',
            gewicht: gewicht !== '' ? parseFloat(gewicht) : null,
            poule: {
              nummer:  pouleNummer  !== '' ? parseInt(pouleNummer, 10)  : null,
              grootte: pouleGrootte !== '' ? parseInt(pouleGrootte, 10) : null,
              positie: positie      !== '' ? parseInt(positie, 10)      : null,
            },
            partijen: schoongepartijen,
            eindplaats: eindplaats || null,
            notities: notities.trim() || null,
          }
        : {
            systeem: 'boom',
            geslacht: geslacht || null,
            gewichtscategorie: gewichtscategorie || null,
            partijen: schoongepartijen,
            eindplaats: eindplaats || null,
            notities: notities.trim() || null,
          };
      resultaat.bijgewerktOp = serverTimestamp();
      resultaat.bijgewerktDoor = profiel?.uid || null;
      await updateDoc(doc(db, 'inschrijvingen', ins.id), { resultaat });
      toast({ bericht: 'Resultaat opgeslagen', type: 'success' });
      onClose && onClose();
    } catch (e) {
      console.error(e);
      toast({ bericht: `Opslaan mislukt: ${e.message}`, type: 'error' });
    }
    setSaving(false);
  }

  const podiumOpties = [['', '— geen'], ['1', '🥇 1e'], ['2', '🥈 2e'], ['3', '🥉 3e']];
  const pouleplaatsOpties = ['', '1', '2', '3', '4', '5', 'gedeeld'];

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '14px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {poule ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <Field label="Gewicht (kg)">
              <input style={inputStyle} type="number" step="0.1" min="0" placeholder="bv. 21.3"
                value={gewicht} onChange={e => setGewicht(e.target.value)} />
            </Field>
            <Field label="Poulenummer">
              <input style={inputStyle} type="number" min="1" placeholder="bv. 2"
                value={pouleNummer} onChange={e => setPouleNummer(e.target.value)} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <Field label="Aantal deelnemers in poule">
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={pouleGrootte} onChange={e => setPouleGrootte(e.target.value)}>
                {[2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Eigen positie in poule">
              <input style={inputStyle} type="number" min="1" max={pouleGrootte || 5} placeholder="bv. 1"
                value={positie} onChange={e => setPositie(e.target.value)} />
            </Field>
          </div>
        </>
      ) : (
        <>
          <Field label="Geslacht">
            <div style={{ display: 'flex', gap: '8px' }}>
              {[['M', 'Jongens/Heren'], ['V', 'Meisjes/Dames']].map(([code, label]) => (
                <button key={code} type="button" style={{ ...chipBtn(geslacht === code, C.blue, C.blueDim), flex: 1 }}
                  onClick={() => { setGeslacht(code); setGewichtscategorie(''); }}>
                  {label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Gewichtscategorie">
            {!geslacht ? (
              <div style={{ fontSize: '12px', color: C.textMuted }}>Kies eerst geslacht.</div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {gewichtsklassenVoor(ins.categorie, geslacht).map(kl => (
                  <button key={kl} type="button" style={chipBtn(gewichtscategorie === kl, C.purple, C.purpleDim)}
                    onClick={() => setGewichtscategorie(kl)}>
                    {kl}
                  </button>
                ))}
              </div>
            )}
          </Field>
        </>
      )}

      {/* Partijen — winst/verlies per partij, grote tapbare knoppen */}
      <div>
        <div style={{ fontSize: '11px', color: C.textSec, textTransform: 'uppercase', letterSpacing: '0.6px', fontWeight: '600', marginBottom: '6px' }}>
          Partijen
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {partijen.map((p, idx) => (
            <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                style={{ ...inputStyle, flex: '1 1 90px', minWidth: 0 }}
                placeholder={`Tegenstander ${idx + 1} (optioneel)`}
                value={p.tegenstander || ''}
                onChange={e => updatePartij(idx, 'tegenstander', e.target.value)}
              />
              <button type="button" style={{ ...chipBtn(p.resultaat === 'winst', WIN_KLEUR, WIN_BG), minHeight: '40px', minWidth: '52px' }}
                onClick={() => updatePartij(idx, 'resultaat', p.resultaat === 'winst' ? null : 'winst')}>
                W
              </button>
              <button type="button" style={{ ...chipBtn(p.resultaat === 'verlies', LOSS_KLEUR, LOSS_BG), minHeight: '40px', minWidth: '52px' }}
                onClick={() => updatePartij(idx, 'resultaat', p.resultaat === 'verlies' ? null : 'verlies')}>
                V
              </button>
              {partijen.length > 1 && (
                <button type="button" onClick={() => verwijderPartij(idx)}
                  style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: '16px', padding: '2px 4px', lineHeight: 1 }}>
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={voegPartijToe}
          style={{ marginTop: '8px', width: '100%', background: 'none', border: `1px dashed ${C.border}`, borderRadius: '8px', color: C.textMuted, padding: '8px', cursor: 'pointer', fontFamily: 'inherit', fontSize: '12px' }}>
          + Partij toevoegen
        </button>
      </div>

      <Field label={poule ? 'Eindplaats in poule (optioneel, bonus-info)' : 'Podiumplaats (manueel)'}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {(poule ? pouleplaatsOpties.map(p => [p, p || '— geen']) : podiumOpties).map(([val, label]) => (
            <button key={val || 'leeg'} type="button" style={chipBtn(eindplaats === val, C.orange, C.orangeDim)}
              onClick={() => setEindplaats(val)}>
              {label}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Notities (optioneel)">
        <textarea style={{ ...inputStyle, minHeight: '54px', resize: 'vertical' }}
          placeholder="Bijzonderheden, blessure, scheidsrechtersbeslissing…"
          value={notities} onChange={e => setNotities(e.target.value)} />
      </Field>

      <div style={{ display: 'flex', gap: '8px' }}>
        <button style={{ ...btnStyle('primary'), flex: 1 }} onClick={opslaan} disabled={saving}>
          {saving ? 'Opslaan…' : '✓ Resultaat opslaan'}
        </button>
        <button style={btnStyle('ghost')} onClick={onClose}>Sluiten</button>
      </div>
    </div>
  );
}
