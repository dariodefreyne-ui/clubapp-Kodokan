// src/pages/TrainerDashboard.jsx
// ─── TRAINER DASHBOARD v1.0 ───────────────────────────────────────────────────
// Persoonlijk overzicht voor elke trainer:
//  • Volgende training met technieken + materialen
//  • Mijn trainingen dit seizoen (historiek)
//  • Statistieken: totaal gegeven, technieken gebruikt
//  • Snel zichzelf toevoegen aan aankomende training

import React, { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy, onSnapshot, getDocs,
  doc, updateDoc, serverTimestamp, arrayUnion,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { C } from '../components/trainingen/tokens';
import { vandaagISO, formatDatum, huidigSeizoen, bepaalSeizoen } from '../components/trainingen/seizoenHelpers';

// ─── VolgendTrainingKaart ──────────────────────────────────────────────────────
function VolgendTrainingKaart({ training, groep, techniekDatabank, profiel, lesgeversLijst }) {
  const [technieken, setTechnieken] = useState([]);
  const [bezig, setBezig]           = useState(false);
  const isZelfAanwezig = profiel?.lesgeverId
    ? (training.lesgevers || []).includes(profiel.lesgeverId)
    : false;

  useEffect(() => {
    if (!training?.id) return;
    const ref = collection(db, 'trainingen', training.id, 'technieken');
    const unsub = onSnapshot(query(ref, orderBy('volgorde')), snap => {
      setTechnieken(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [training?.id]);

  const voegZelfToe = async () => {
    if (!profiel?.lesgeverId || isZelfAanwezig || bezig) return;
    setBezig(true);
    try {
      await updateDoc(doc(db, 'trainingen', training.id), {
        lesgevers: arrayUnion(profiel.lesgeverId),
        bijgewerkt: serverTimestamp(),
      });
    } finally { setBezig(false); }
  };

  // Hulpfunctie: id -> naam voor display
  const naamVanId = (id) => lesgeversLijst.find(l => l.id === id)?.naam ?? id;

  const duurLabel = training.duurMinuten
    ? (training.duurMinuten >= 60
        ? `${Math.floor(training.duurMinuten / 60)}u${training.duurMinuten % 60 ? (training.duurMinuten % 60) + 'min' : ''}`
        : `${training.duurMinuten}min`)
    : null;

  const isVandaag = training.datum === vandaagISO();
  const dagEnDatum = formatDatum(training.datum);

  return (
    <div style={{ background: C.card, border: `2px solid ${isVandaag ? C.green : C.orange}`, borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
      {/* Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
        <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '999px', background: isVandaag ? C.greenDim : C.orangeDim, border: `1px solid ${isVandaag ? C.green : C.orange}`, color: isVandaag ? C.green : C.orange }}>
          {isVandaag ? '🥋 Vandaag' : '⏭ Volgende training'}
        </span>
        {duurLabel && (
          <span style={{ fontSize: '11px', color: C.textMuted, background: C.bg, border: `1px solid ${C.border}`, borderRadius: '999px', padding: '4px 10px' }}>
            {duurLabel}
          </span>
        )}
        {groep && (
          <span style={{ fontSize: '11px', color: C.blue, background: C.blueDim, border: `1px solid ${C.blue}`, borderRadius: '999px', padding: '4px 10px', fontWeight: '600' }}>
            {groep.naam}
          </span>
        )}
      </div>

      <div style={{ fontSize: '20px', fontWeight: '800', marginBottom: '4px' }}>{dagEnDatum}</div>
      {groep && <div style={{ fontSize: '13px', color: C.textMuted, marginBottom: '14px' }}>{groep.dag}</div>}

      {/* Lesgevers */}
      <div style={{ marginBottom: '14px' }}>
        {(training.lesgevers || []).length > 0 ? (
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {training.lesgevers.map(id => {
              const isZelf = id === profiel?.lesgeverId;
              return (
                <span key={id} style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '999px', background: isZelf ? C.purpleDim : C.bg, border: `1px solid ${isZelf ? C.purple : C.border}`, color: isZelf ? C.purple : C.textSec, fontWeight: isZelf ? '700' : '400' }}>
                  {naamVanId(id)} {isZelf && '(jij)'}
                </span>
              );
            })}
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: C.textMuted, fontStyle: 'italic' }}>Nog geen lesgever aangeduid</div>
        )}
      </div>

      {/* Zelf toevoegen knop */}
      {!isZelfAanwezig && profiel?.lesgeverId && (
        <button onClick={voegZelfToe} disabled={bezig}
          style={{ padding: '8px 16px', background: C.purpleDim, border: `1px solid ${C.purple}`, borderRadius: '8px', color: C.purple, cursor: 'pointer', fontSize: '13px', fontWeight: '600', marginBottom: '16px', opacity: bezig ? 0.6 : 1 }}>
          + Ik geef deze training
        </button>
      )}

      {/* Technieken */}
      {technieken.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
            Programma
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {technieken.map(t => {
              const detail = techniekDatabank?.find(tk => tk.id === t.techniekId);
              const faseKleur = t.fase === 'basis' ? C.blue : t.fase === 'verdieping' ? C.red : C.textMuted;
              const faseBg    = t.fase === 'basis' ? C.blueDim : t.fase === 'verdieping' ? C.redDim : '#2a2a2a';

              return (
                <div key={t.id} style={{ background: C.bg, borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', background: faseBg, color: faseKleur, border: `1px solid ${faseKleur}`, flexShrink: 0 }}>
                      {t.fase}
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: C.textPrimary }}>{t.techniekNaam}</span>
                  </div>
                  {t.basisvaardigheid && (
                    <div style={{ fontSize: '12px', color: C.textMuted }}>Basisvaardigheid: {t.basisvaardigheid}</div>
                  )}
                  {/* Hulpmiddelen uit databank */}
                  {detail?.oefenvormen?.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: C.green, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Oefenvormen</div>
                      {detail.oefenvormen.map((ov, i) => (
                        <div key={i} style={{ fontSize: '12px', color: C.textSec, padding: '3px 8px', background: C.card, borderRadius: '4px', borderLeft: `2px solid ${C.green}`, marginBottom: '3px' }}>
                          {ov}
                        </div>
                      ))}
                    </div>
                  )}
                  {detail?.aandachtspunten?.length > 0 && (
                    <div style={{ marginTop: '4px' }}>
                      <div style={{ fontSize: '10px', fontWeight: '700', color: C.orange, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Aandachtspunten</div>
                      {detail.aandachtspunten.map((ap, i) => (
                        <div key={i} style={{ fontSize: '12px', color: C.textSec, padding: '3px 8px', background: C.card, borderRadius: '4px', borderLeft: `2px solid ${C.orange}`, marginBottom: '3px' }}>
                          {ap}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {technieken.length === 0 && !training.opmerking && (
        <div style={{ fontSize: '13px', color: C.textMuted, fontStyle: 'italic' }}>Nog geen programma ingepland voor deze training.</div>
      )}
      {training.opmerking && (
        <div style={{ fontSize: '13px', color: C.orange, marginTop: '8px' }}>ℹ️ {training.opmerking}</div>
      )}
    </div>
  );
}

// ─── MijnStatistieken ──────────────────────────────────────────────────────────
function MijnStatistieken({ mijnTrainingen, techniekDatabank }) {
  const totaalUren = mijnTrainingen.reduce((sum, t) => sum + (t.duurMinuten || 0), 0) / 60;

  // Technieken tellen
  const techniekTelling = {};
  mijnTrainingen.forEach(t => {
    (t.techniekBadges || []).forEach(b => {
      techniekTelling[b.naam] = (techniekTelling[b.naam] || 0) + 1;
    });
  });
  const topTechnieken = Object.entries(techniekTelling)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '24px' }}>
      {/* Trainingen dit seizoen */}
      <div style={{ background: C.card, borderRadius: '12px', padding: '16px', border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Trainingen dit seizoen</div>
        <div style={{ fontSize: '32px', fontWeight: '800', color: C.textPrimary }}>{mijnTrainingen.length}</div>
      </div>
      {/* Uren gegeven */}
      <div style={{ background: C.card, borderRadius: '12px', padding: '16px', border: `1px solid ${C.border}` }}>
        <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Uren gegeven</div>
        <div style={{ fontSize: '32px', fontWeight: '800', color: C.blue }}>{totaalUren.toFixed(1)}u</div>
      </div>
      {/* Top technieken */}
      {topTechnieken.length > 0 && (
        <div style={{ background: C.card, borderRadius: '12px', padding: '16px', border: `1px solid ${C.border}`, gridColumn: 'span 2' }}>
          <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>Vaakst gegeven technieken</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {topTechnieken.map(([naam, count]) => (
              <div key={naam} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: `1px solid ${C.border}` }}>
                <span style={{ color: C.textSec }}>{naam}</span>
                <span style={{ color: C.textMuted, fontWeight: '600' }}>{count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Hoofd component TrainerDashboard ──────────────────────────────────────────
export default function TrainerDashboard() {
  const { profiel } = useAuth();
  const [groepen, setGroepen]             = useState([]);
  const [techniekDatabank, setTechniekDatabank] = useState([]);
  const [alleTrainingen, setAlleTrainingen] = useState([]);
  const [actieveSeizoen, setActieveSeizoen] = useState(huidigSeizoen());
  const [beschikbareSeizoenens, setBeschikbareSeizoenens] = useState([huidigSeizoen()]);
  const [lesgeversLijst, setLesgeversLijst] = useState([]);

  // Laad groepen
  useEffect(() => {
    getDocs(collection(db, 'groepen')).then(snap => {
      setGroepen(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Laad lesgevers eenmalig -- nodig voor id->naam lookup in display
  useEffect(() => {
    getDocs(collection(db, 'lesgevers')).then(snap => {
      setLesgeversLijst(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Laad technieken
  useEffect(() => {
    getDocs(collection(db, 'technieken')).then(snap => {
      setTechniekDatabank(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Laad alle trainingen van het seizoen (realtime)
  useEffect(() => {
    const q = query(
      collection(db, 'trainingen'),
      where('seizoen', '==', actieveSeizoen),
      orderBy('datum', 'asc'),
    );
    const unsub = onSnapshot(q, snap => {
      setAlleTrainingen(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [actieveSeizoen]);

  // Laad beschikbare seizoenen -- query op lesgeverId
  useEffect(() => {
    if (!profiel?.lesgeverId) return;
    getDocs(query(collection(db, 'trainingen'), where('lesgevers', 'array-contains', profiel.lesgeverId))).then(snap => {
      const seizoenen = new Set([huidigSeizoen()]);
      snap.docs.forEach(d => { const s = d.data().seizoen; if (s) seizoenen.add(s); });
      setBeschikbareSeizoenens([...seizoenen].sort().reverse());
    });
  }, [profiel?.lesgeverId]);

  const vandaag = vandaagISO();

  // Volgende training (voor alle groepen, zodat trainer weet wat er aankomt)
  const volgendTraining = alleTrainingen.find(t => t.datum >= vandaag) || null;
  const volgendGroep = volgendTraining ? groepen.find(g => g.id === volgendTraining.groepId) : null;

  // Mijn trainingen = waar mijn lesgeverId in staat
  const mijnTrainingen = profiel?.lesgeverId
    ? alleTrainingen.filter(t => (t.lesgevers || []).includes(profiel.lesgeverId) && t.datum < vandaag)
    : [];

  // Aankomende trainingen zonder lesgever (kans om je te registreren)
  const openTrainingen = alleTrainingen.filter(t =>
    t.datum >= vandaag &&
    (!t.lesgevers || t.lesgevers.length === 0) &&
    !t.opmerking
  );

  return (
    <div style={{ color: C.textPrimary, paddingBottom: '40px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${C.border}` }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(20px,5vw,26px)', fontWeight: '800' }}>
          👤 Mijn dashboard
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: C.textSec }}>
          {profiel?.naam || profiel?.email || 'Trainer'}
        </p>
      </div>

      {/* Seizoensselector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: C.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Seizoen:</span>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {beschikbareSeizoenens.map(s => (
            <button key={s} onClick={() => setActieveSeizoen(s)}
              style={{ padding: '5px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', background: actieveSeizoen === s ? C.red : C.card, border: `1px solid ${actieveSeizoen === s ? C.red : C.border}`, color: actieveSeizoen === s ? '#fff' : C.textSec }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Volgende training */}
      {volgendTraining ? (
        <VolgendTrainingKaart
          training={volgendTraining}
          groep={volgendGroep}
          techniekDatabank={techniekDatabank}
          profiel={profiel}
          lesgeversLijst={lesgeversLijst}
        />
      ) : (
        <div style={{ background: C.card, borderRadius: '12px', padding: '20px', textAlign: 'center', color: C.textMuted, marginBottom: '20px' }}>
          Geen aankomende trainingen gepland.
        </div>
      )}

      {/* Statistieken */}
      {mijnTrainingen.length > 0 && (
        <>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}>📈 Mijn seizoen</h2>
          <MijnStatistieken mijnTrainingen={mijnTrainingen} techniekDatabank={techniekDatabank} />
        </>
      )}

      {/* Open trainingen zonder lesgever */}
      {openTrainingen.length > 0 && (
        <>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}>📋 Aankomend — nog geen lesgever</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            {openTrainingen.map(t => {
              const groep = groepen.find(g => g.id === t.groepId);
              const isZelf = profiel?.lesgeverId
                ? (t.lesgevers || []).includes(profiel.lesgeverId)
                : false;
              return (
                <div key={t.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: '600' }}>{formatDatum(t.datum)}</div>
                    {groep && <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>{groep.naam} — {groep.dag}</div>}
                  </div>
                  {!isZelf && profiel?.lesgeverId && (
                    <button
                      onClick={async () => {
                        await updateDoc(doc(db, 'trainingen', t.id), {
                          lesgevers: arrayUnion(profiel.lesgeverId),
                          bijgewerkt: serverTimestamp(),
                        });
                      }}
                      style={{ padding: '6px 12px', background: C.purpleDim, border: `1px solid ${C.purple}`, borderRadius: '6px', color: C.purple, cursor: 'pointer', fontSize: '12px', fontWeight: '600', whiteSpace: 'nowrap' }}>
                      Ik doe het
                    </button>
                  )}
                  {isZelf && (
                    <span style={{ fontSize: '12px', color: C.purple, fontWeight: '600' }}>✓ Jij</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Mijn historiek */}
      {mijnTrainingen.length > 0 && (
        <>
          <h2 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '12px' }}>🗓 Mijn trainingen</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {[...mijnTrainingen].reverse().map(t => {
              const groep = groepen.find(g => g.id === t.groepId);
              const badges = t.techniekBadges || [];
              const duurLabel = t.duurMinuten
                ? (t.duurMinuten >= 60 ? `${Math.floor(t.duurMinuten/60)}u${t.duurMinuten%60 ? (t.duurMinuten%60)+'min' : ''}` : `${t.duurMinuten}min`)
                : null;
              return (
                <div key={t.id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: badges.length > 0 ? '6px' : 0 }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: C.textPrimary }}>{formatDatum(t.datum)}</span>
                    {groep && <span style={{ fontSize: '11px', color: C.textMuted }}>{groep.naam}</span>}
                    {duurLabel && <span style={{ fontSize: '11px', color: C.textMuted, marginLeft: 'auto' }}>{duurLabel}</span>}
                  </div>
                  {badges.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {badges.map((b, i) => (
                        <span key={i} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '999px', background: b.fase === 'basis' ? C.blueDim : C.redDim, border: `1px solid ${b.fase === 'basis' ? C.blue : C.red}`, color: b.fase === 'basis' ? C.blue : C.red, fontWeight: '600' }}>
                          {b.naam}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
