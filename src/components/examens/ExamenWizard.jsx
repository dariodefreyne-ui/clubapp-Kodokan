// ExamenWizard — meertraps component voor het afnemen/voorbereiden van een examen
// modus='prep'  → stap 1-2 (configureren + technieken kiezen), sluiten na stap 2
// modus='examen' → stap 1-4 (volledig: configureren, kiezen, scoren, afsluiten)
import React, { useState, useEffect, useMemo } from 'react';
import { updateRegistration, updateMember } from '../../services/firestoreService';
import { stuurPushTrigger, PUSH_TYPES } from '../../services/pushService';
import { C, buttonStyle, inputStyle } from '../../styles/tokens';
import {
  BELT_COLORS, BELT_KYU_LABELS, DEFAULT_EXAM_CONFIG, GORDEL_KYU,
  CONCLUSIE_COLORS, CONCLUSIE_LABELS, RESULT_COLORS, RESULT_LABELS,
} from './examenConstants';
import {
  bouwInitieleSecties, selecteerWillekeurig, herstelSecties,
  berekenGemiddelde, classifeerScore, getResultTekst,
  alleGescored, bouwFirestoreSecties, getTechniekFase,
} from './examenHelpers';

// ─── Mini components ──────────────────────────────────────────────────────────

function BeltPil({ belt, small }) {
  const cfg = BELT_COLORS[belt] || {};
  return (
    <span style={{ ...cfg, padding: small ? '2px 8px' : '4px 12px', borderRadius: 20, fontSize: small ? 11 : 13, fontWeight: 700, display: 'inline-block', whiteSpace: 'nowrap' }}>
      {BELT_KYU_LABELS[belt] || belt}
    </span>
  );
}

function ScoreBadge({ score }) {
  if (score === null || score === undefined) return <span style={{ color: C.textMuted, fontSize: 12 }}>—</span>;
  const kleur = score >= 8 ? C.green : score >= 5 ? C.orange : C.red;
  return (
    <span style={{ background: kleur + '22', color: kleur, border: `1px solid ${kleur}44`, padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
      {score}/10
    </span>
  );
}

function FaseBadge({ fase }) {
  if (!fase) return null;
  const isBasis = fase === 'basis';
  const kleur = isBasis ? C.blue : C.purple;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color: kleur, background: kleur + '22', border: `1px solid ${kleur}44`, borderRadius: 4, padding: '1px 5px', whiteSpace: 'nowrap' }}>
      {isBasis ? 'BASIS' : 'VERDIEPING'}
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ExamenWizard({ kandidaat, eventId, examConfig, allTechnieken, onClose, isReadOnly, modus = 'examen' }) {
  const [stap, setStap] = useState(1);
  const [secties, setSecties] = useState([]);
  const [sectieModi, setSectieModi] = useState({});
  const [manueelGes, setManueelGes] = useState({});
  const [huidigIndex, setHuidigIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [ladend, setLadend] = useState(true);
  const [openAccordion, setOpenAccordion] = useState({}); // step 1: sectie accordion
  const [showTechDetail, setShowTechDetail] = useState(false); // step 3: detail panel

  const config = { ...DEFAULT_EXAM_CONFIG, ...(examConfig || {}) };
  const targetKyu = GORDEL_KYU[kandidaat?.targetBelt] || null;

  // Lookup map: techniekId → volledige techniek (inclusief basisfase/verdieping velden)
  const techById = useMemo(
    () => Object.fromEntries((allTechnieken || []).map(t => [t.id, t])),
    [allTechnieken]
  );

  useEffect(() => {
    if (!kandidaat || !allTechnieken.length) return;
    setLadend(true);
    setShowTechDetail(false);
    if (kandidaat.examSecties?.length > 0) {
      const hersteld = herstelSecties(kandidaat.examSecties, allTechnieken, kandidaat.targetBelt, kandidaat.isStreepje);
      setSecties(hersteld);
      if (modus === 'prep') {
        setStap(1); // voorbereiden: altijd terug naar stap 1
      } else if (alleGescored(hersteld) || isReadOnly) {
        setStap(4);
      } else {
        const flat = hersteld.flatMap(s => s.technieken || []);
        const firstIdx = flat.findIndex(t => t.score === null || t.score === undefined);
        setHuidigIndex(Math.max(0, firstIdx >= 0 ? firstIdx : 0));
        setStap(3);
      }
    } else {
      const init = bouwInitieleSecties(allTechnieken, kandidaat.targetBelt, kandidaat.isStreepje);
      setSecties(init);
      setStap(1);
    }
    setLadend(false);
  }, [kandidaat?.id, allTechnieken.length]);

  // Reset tech detail panel when technique changes
  useEffect(() => { setShowTechDetail(false); }, [huidigIndex]);

  const allTechs = secties.flatMap(s => (s.technieken || []).map(t => ({ ...t, sectieLabel: s.categorieLabel })));
  const currentTech = allTechs[huidigIndex];
  const currentTechFull = techById[currentTech?.id] || currentTech;
  const currentFase = getTechniekFase(currentTechFull, targetKyu);
  const hasSecties = secties.some(s => s.aantalTeBevragen > 0);
  const gem = berekenGemiddelde(secties);
  const conclusie = classifeerScore(gem, config);

  // Per-fase gemiddelde voor stap 4
  const fazeGem = useMemo(() => {
    const scored = secties.flatMap(s => s.technieken || []).filter(t => t.score !== null && t.score !== undefined);
    const avg = arr => arr.length
      ? Math.round(arr.reduce((a, t) => a + t.score, 0) / arr.length * 10) / 10
      : null;
    const b = scored.filter(t => getTechniekFase(techById[t.id] || {}, targetKyu) === 'basis');
    const v = scored.filter(t => getTechniekFase(techById[t.id] || {}, targetKyu) === 'verdieping');
    return { basis: avg(b), verdieping: avg(v) };
  }, [secties, techById, targetKyu]);

  // ── State update helpers ──────────────────────────────────────────────────

  function updateScore(score) {
    let n = 0;
    setSecties(prev => prev.map(s => ({
      ...s, technieken: s.technieken.map(t => { const match = n++ === huidigIndex; return match ? { ...t, score } : t; }),
    })));
  }

  function updateNotitie(notitie) {
    let n = 0;
    setSecties(prev => prev.map(s => ({
      ...s, technieken: s.technieken.map(t => { const match = n++ === huidigIndex; return match ? { ...t, notitie } : t; }),
    })));
  }

  function getSectModus(cat) { return sectieModi[cat] || 'random'; }
  function setSectModus(cat, m) { setSectieModi(prev => ({ ...prev, [cat]: m })); }
  function setAlleModi(m) {
    const n = {}; secties.forEach(s => { n[s.categorie] = m; }); setSectieModi(n);
  }

  // ── Firestore ops ─────────────────────────────────────────────────────────

  async function slaScoresOp(updatedSecties) {
    await updateRegistration(eventId, kandidaat.id, {
      examSecties: bouwFirestoreSecties(updatedSecties), examFase: 'scorend', updatedAt: new Date().toISOString(),
    });
  }

  async function volgendeTech() {
    if (currentTech?.score === null || currentTech?.score === undefined) return;
    if (huidigIndex === allTechs.length - 1) {
      await slaScoresOp(secties);
      setStap(4);
    } else {
      setHuidigIndex(i => i + 1);
      if ((huidigIndex + 1) % 3 === 0) await slaScoresOp(secties);
    }
  }

  async function bevestigSelectie(selectedSecties) {
    setSaving(true);
    const fireSecties = bouwFirestoreSecties(selectedSecties);
    await updateRegistration(eventId, kandidaat.id, {
      examSecties: fireSecties, examFase: 'geconfigureerd', updatedAt: new Date().toISOString(),
    });
    if (modus === 'prep') {
      setSaving(false);
      onClose();
      return;
    }
    const hersteld = herstelSecties(fireSecties, allTechnieken, kandidaat.targetBelt, kandidaat.isStreepje);
    setSecties(hersteld);
    setHuidigIndex(0);
    setSaving(false);
    setStap(3);
  }

  async function slaResultaatOp(result) {
    setSaving(true);
    const eindTekst = getResultTekst(conclusie, config);
    await updateRegistration(eventId, kandidaat.id, {
      result,
      eindScore: gem,
      eindConclusie: conclusie,
      eindTekst,
      examSecties: bouwFirestoreSecties(secties),
      examFase: 'afgerond',
      updatedAt: new Date().toISOString(),
    });
    if (result === 'geslaagd' && !kandidaat.isStreepje && kandidaat.memberId) {
      await updateMember(kandidaat.memberId, { gordel: kandidaat.targetBelt });
      stuurPushTrigger(PUSH_TYPES.GRAAD_TOEGEKEND, {
        uid: kandidaat.uid || '', memberId: kandidaat.memberId || '',
        judokaNaam: kandidaat.memberName || '', gordel: kandidaat.targetBelt || '',
      });
    }
    setSaving(false);
    onClose();
  }

  // ── Progress pills ────────────────────────────────────────────────────────

  const aantalStappen = modus === 'prep' ? 2 : 4;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.borderSoft}`, padding: '12px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.textPrimary, marginBottom: 3 }}>
              {kandidaat.memberName}
              {modus === 'prep' && <span style={{ marginLeft: 8, fontSize: 10, color: C.blue, fontWeight: 700, background: C.blueDim, borderRadius: 6, padding: '2px 6px' }}>VOORBEREIDEN</span>}
              {kandidaat.isStreepje && <span style={{ marginLeft: 8, fontSize: 10, color: C.orange, fontWeight: 700, background: C.orangeDim, borderRadius: 6, padding: '2px 6px' }}>STREEPJE</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <BeltPil belt={kandidaat.currentBelt} small />
              <span style={{ color: C.textMuted, fontSize: 12 }}>→</span>
              <BeltPil belt={kandidaat.targetBelt} small />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!isReadOnly && (
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {Array.from({ length: aantalStappen }, (_, i) => i + 1).map(s => (
                  <div key={s} style={{ width: s === stap ? 20 : 8, height: 8, borderRadius: 4, background: s <= stap ? C.red : C.borderSoft, transition: 'all 0.2s' }} />
                ))}
              </div>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 22, padding: '2px 6px', lineHeight: 1 }}>✕</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {ladend ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.textSec }}>Laden...</div>
        ) : (
          <>
            {/* ── STAP 1: Sectie configuratie ── */}
            {stap === 1 && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, marginBottom: 2 }}>Technieken per sectie</div>
                  <div style={{ fontSize: 13, color: C.textSec }}>
                    Stel in hoeveel technieken je per sectie wil bevragen.
                    {kandidaat.isStreepje ? ' Enkel nieuwe technieken.' : ' Nieuwe en reeds gekende technieken beschikbaar.'}
                  </div>
                </div>

                {secties.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 32, color: C.textMuted, background: C.surface, borderRadius: 12 }}>
                    Geen technieken gevonden voor deze gordel.
                  </div>
                ) : secties.map((s, i) => {
                  const isOpen = !!openAccordion[s.categorie];
                  return (
                    <div key={s.categorie} style={{ background: C.surface, border: `1px solid ${C.borderSoft}`, borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
                      <div style={{ padding: '12px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14, color: C.textPrimary }}>{s.categorieLabel}</div>
                            <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                              {s.beschikbaar.length} beschikbaar
                              {s.aantalNieuw > 0 && <span style={{ marginLeft: 6, color: C.green, fontWeight: 600 }}>({s.aantalNieuw} nieuw)</span>}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button onClick={() => setSecties(prev => prev.map((x, j) => j !== i ? x : { ...x, aantalTeBevragen: Math.max(0, x.aantalTeBevragen - 1) }))}
                              style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.borderSoft}`, background: C.card, color: C.textPrimary, cursor: 'pointer', fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                            <span style={{ fontSize: 20, fontWeight: 800, minWidth: 24, textAlign: 'center', color: s.aantalTeBevragen > 0 ? C.textPrimary : C.textMuted }}>{s.aantalTeBevragen}</span>
                            <button onClick={() => setSecties(prev => prev.map((x, j) => j !== i ? x : { ...x, aantalTeBevragen: Math.min(x.beschikbaar.length, x.aantalTeBevragen + 1) }))}
                              style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.borderSoft}`, background: C.card, color: C.textPrimary, cursor: 'pointer', fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                          </div>
                        </div>
                        {/* Accordion toggle */}
                        <button onClick={() => setOpenAccordion(prev => ({ ...prev, [s.categorie]: !isOpen }))}
                          style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 12, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isOpen ? '▲ Verberg' : '▼ Bekijk technieken'} ({s.beschikbaar.length})
                        </button>
                      </div>
                      {/* Accordion content */}
                      {isOpen && (
                        <div style={{ borderTop: `1px solid ${C.borderSoft}`, padding: '6px 14px 10px' }}>
                          {s.beschikbaar.map(t => {
                            const fase = getTechniekFase(t, targetKyu);
                            return (
                              <div key={t.id} style={{ padding: '6px 0', borderBottom: `1px solid ${C.borderSoft}22`, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ flex: 1, fontSize: 12, color: C.textPrimary }}>{t.techniek || t.naam}</span>
                                {t.isNieuw && <span style={{ fontSize: 10, fontWeight: 700, color: C.green, background: C.greenDim, borderRadius: 4, padding: '1px 5px' }}>NIEUW</span>}
                                <FaseBadge fase={fase} />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── STAP 2: Techniek selectie ── */}
            {stap === 2 && (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, marginBottom: 2 }}>Technieken selecteren</div>
                  <div style={{ fontSize: 13, color: C.textSec }}>Kies per sectie willekeurig of manueel.</div>
                </div>

                {/* Quick-actions */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {[['random', '🎲 Alles willekeurig'], ['manueel', '✋ Alles manueel']].map(([val, lbl]) => (
                    <button key={val} onClick={() => setAlleModi(val)}
                      style={{ flex: 1, padding: '9px 8px', borderRadius: 8, border: `1px solid ${C.borderSoft}`, background: C.surface, color: C.textSec, cursor: 'pointer', fontWeight: 600, fontSize: 12 }}>
                      {lbl}
                    </button>
                  ))}
                </div>

                {secties.filter(s => s.aantalTeBevragen > 0).map(s => {
                  const mod = getSectModus(s.categorie);
                  const ges = manueelGes[s.categorie] || new Set();
                  return (
                    <div key={s.categorie} style={{ marginBottom: 10, background: C.surface, borderRadius: 12, border: `1px solid ${C.borderSoft}`, overflow: 'hidden' }}>
                      {/* Sectie header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: mod === 'manueel' ? `1px solid ${C.borderSoft}` : 'none' }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: C.textPrimary }}>{s.categorieLabel}</div>
                          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
                            {mod === 'manueel'
                              ? <span style={{ color: ges.size === s.aantalTeBevragen ? C.green : C.orange }}>{ges.size}/{s.aantalTeBevragen} gekozen</span>
                              : <span>{s.aantalTeBevragen} van {s.beschikbaar.length}{s.aantalNieuw > 0 && <span style={{ color: C.green, marginLeft: 4 }}>· min. 1 nieuw</span>}</span>
                            }
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {[['random', '🎲'], ['manueel', '✋']].map(([val, lbl]) => (
                            <button key={val} onClick={() => setSectModus(s.categorie, val)}
                              style={{ padding: '5px 10px', borderRadius: 6, border: `1px solid ${mod === val ? C.red : C.borderSoft}`, background: mod === val ? C.redDim : 'transparent', color: mod === val ? C.red : C.textSec, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                              {lbl}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Manuele selectie */}
                      {mod === 'manueel' && (
                        <div style={{ padding: '8px 14px 10px' }}>
                          {s.beschikbaar.map(t => {
                            const isGes = ges.has(t.id);
                            const isDisabled = !isGes && ges.size >= s.aantalTeBevragen;
                            const fase = getTechniekFase(t, targetKyu);
                            return (
                              <button key={t.id} disabled={isDisabled}
                                onClick={() => setManueelGes(prev => {
                                  const set = new Set(prev[s.categorie] || []);
                                  if (set.has(t.id)) set.delete(t.id); else if (set.size < s.aantalTeBevragen) set.add(t.id);
                                  return { ...prev, [s.categorie]: set };
                                })}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 10px', borderRadius: 8, border: `1px solid ${isGes ? C.red : C.borderSoft}`, background: isGes ? C.redDim : 'transparent', color: isDisabled ? C.textMuted : C.textPrimary, cursor: isDisabled ? 'default' : 'pointer', marginBottom: 5, textAlign: 'left', opacity: isDisabled ? 0.5 : 1 }}>
                                <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${isGes ? C.red : C.borderSoft}`, background: isGes ? C.red : 'transparent', flexShrink: 0 }} />
                                <span style={{ flex: 1, fontSize: 13 }}>{t.techniek || t.naam}</span>
                                {t.isNieuw && <span style={{ fontSize: 10, fontWeight: 700, color: C.green, background: C.greenDim, borderRadius: 4, padding: '1px 5px' }}>NIEUW</span>}
                                <FaseBadge fase={fase} />
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── STAP 3: Scoren ── */}
            {stap === 3 && (
              allTechs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>Geen technieken geconfigureerd.</div>
              ) : (
                <div>
                  {/* Sectie + voortgang */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <span style={{ fontSize: 12, color: C.textMuted, background: C.surface, borderRadius: 6, padding: '3px 10px', border: `1px solid ${C.borderSoft}` }}>{currentTech?.sectieLabel}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {allTechs.map((t, idx) => (
                        <div key={idx} style={{ width: idx === huidigIndex ? 16 : 6, height: 6, borderRadius: 3, background: (t.score !== null && t.score !== undefined) ? C.green : idx === huidigIndex ? C.red : C.borderSoft, transition: 'all 0.15s' }} />
                      ))}
                    </div>
                  </div>

                  {/* Techniek naam + badges */}
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, marginBottom: 8 }}>{currentTech?.naam}</div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
                      {currentTech?.isNieuw && <span style={{ fontSize: 11, fontWeight: 700, color: C.green, background: C.greenDim, border: `1px solid ${C.green}44`, borderRadius: 20, padding: '2px 8px' }}>NIEUW</span>}
                      <FaseBadge fase={currentFase} />
                      {currentTech?.kyu && <span style={{ fontSize: 11, color: C.textMuted, background: C.surface, borderRadius: 20, padding: '2px 8px', border: `1px solid ${C.borderSoft}` }}>{currentTech.kyu}e kyu</span>}
                    </div>
                  </div>

                  {/* Techniekdetails (collapsible) */}
                  {(currentTechFull?.basisfase?.length > 0 || currentTechFull?.verdieping?.length > 0 || currentTechFull?.aandachtspunten?.length > 0) && (
                    <div style={{ marginBottom: 16 }}>
                      <button onClick={() => setShowTechDetail(v => !v)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.borderSoft}`, background: C.surface, color: C.textSec, cursor: 'pointer', fontSize: 12, fontWeight: 600, textAlign: 'left', display: 'flex', justifyContent: 'space-between' }}>
                        <span>📋 Techniekdetails</span>
                        <span>{showTechDetail ? '▲' : '▼'}</span>
                      </button>
                      {showTechDetail && (
                        <div style={{ background: C.surface, borderRadius: '0 0 8px 8px', padding: '10px 14px', border: `1px solid ${C.borderSoft}`, borderTop: 'none' }}>
                          {currentTechFull?.basisfase?.length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.blue, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Basisfase</div>
                              {currentTechFull.basisfase.map((item, i) => (
                                <div key={i} style={{ fontSize: 12, color: C.textSec, paddingLeft: 8, marginBottom: 2 }}>• {item}</div>
                              ))}
                            </div>
                          )}
                          {currentTechFull?.verdieping?.length > 0 && (
                            <div style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Verdieping</div>
                              {currentTechFull.verdieping.map((item, i) => (
                                <div key={i} style={{ fontSize: 12, color: C.textSec, paddingLeft: 8, marginBottom: 2 }}>• {item}</div>
                              ))}
                            </div>
                          )}
                          {currentTechFull?.aandachtspunten?.length > 0 && (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.orange, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>Aandachtspunten</div>
                              {currentTechFull.aandachtspunten.map((item, i) => (
                                <div key={i} style={{ fontSize: 12, color: C.textSec, paddingLeft: 8, marginBottom: 2 }}>• {item}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Score selector */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ textAlign: 'center', marginBottom: 14 }}>
                      {currentTech?.score !== null && currentTech?.score !== undefined ? (
                        <div style={{ fontSize: 60, fontWeight: 900, color: currentTech.score >= 8 ? C.green : currentTech.score >= 5 ? C.orange : C.red, lineHeight: 1 }}>{currentTech.score}</div>
                      ) : (
                        <div style={{ fontSize: 48, fontWeight: 700, color: C.textMuted, lineHeight: 1 }}>—</div>
                      )}
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>score / 10</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                        <button key={s} onClick={() => updateScore(s)}
                          style={{ padding: '14px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 16, gridColumn: s === 10 ? 'span 4' : 'span 1', transition: 'all 0.1s',
                            background: currentTech?.score === s ? (s >= 8 ? C.green : s >= 5 ? C.orange : C.red) : C.surface,
                            color: currentTech?.score === s ? '#fff' : C.textSec,
                            boxShadow: currentTech?.score === s ? `0 4px 12px ${(s >= 8 ? C.green : s >= 5 ? C.orange : C.red)}44` : 'none',
                            transform: currentTech?.score === s ? 'scale(1.05)' : 'scale(1)',
                          }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Notitie */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: C.textSec, fontWeight: 600, marginBottom: 6 }}>Notitie voor trainer (optioneel)</label>
                    <textarea
                      value={currentTech?.notitie || ''}
                      onChange={e => updateNotitie(e.target.value)}
                      placeholder="Aandachtspunten, opmerkingen..."
                      style={{ ...inputStyle, minHeight: 64, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                    />
                  </div>
                </div>
              )
            )}

            {/* ── STAP 4: Afronding ── */}
            {stap === 4 && (
              <div>
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, marginBottom: 2 }}>
                    {isReadOnly ? 'Examenresultaat' : 'Afronding'}
                  </div>
                  {!isReadOnly && <div style={{ fontSize: 13, color: C.textSec }}>Controleer de scores en sla het eindresultaat op.</div>}
                </div>

                {/* Per-fase gemiddelden */}
                {(fazeGem.basis !== null || fazeGem.verdieping !== null) && (
                  <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                    {fazeGem.basis !== null && (
                      <div style={{ flex: 1, background: C.card, borderRadius: 10, padding: '10px 12px', border: `1px solid ${C.blue}44` }}>
                        <div style={{ fontSize: 10, color: C.blue, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Basisfase</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: C.blue }}>{fazeGem.basis}<span style={{ fontSize: 12, fontWeight: 400, color: C.textMuted }}>/10</span></div>
                      </div>
                    )}
                    {fazeGem.verdieping !== null && (
                      <div style={{ flex: 1, background: C.card, borderRadius: 10, padding: '10px 12px', border: `1px solid ${C.purple}44` }}>
                        <div style={{ fontSize: 10, color: C.purple, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Verdieping</div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: C.purple }}>{fazeGem.verdieping}<span style={{ fontSize: 12, fontWeight: 400, color: C.textMuted }}>/10</span></div>
                      </div>
                    )}
                  </div>
                )}

                {/* Score overzicht per sectie */}
                {secties.map(s => s.technieken?.length > 0 ? (
                  <div key={s.categorie} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: C.textMuted, marginBottom: 6 }}>{s.categorieLabel}</div>
                    {s.technieken.map((t, i) => {
                      const fase = getTechniekFase(techById[t.id] || {}, targetKyu);
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: `1px solid ${C.borderSoft}` }}>
                          <div style={{ flex: 1, paddingRight: 8 }}>
                            <div style={{ fontSize: 13, color: C.textPrimary, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                              {t.naam}
                              {t.isNieuw && <span style={{ fontSize: 10, fontWeight: 700, color: C.green, background: C.greenDim, borderRadius: 4, padding: '1px 5px' }}>NIEUW</span>}
                              <FaseBadge fase={fase} />
                            </div>
                            {t.notitie && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, fontStyle: 'italic' }}>{t.notitie}</div>}
                          </div>
                          <ScoreBadge score={t.score} />
                        </div>
                      );
                    })}
                  </div>
                ) : null)}

                {/* Eindresultaat blok */}
                {gem !== null && (
                  <div style={{ background: C.surface, borderRadius: 14, padding: 16, marginTop: 4, border: `1px solid ${C.borderSoft}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 13, color: C.textSec, fontWeight: 600 }}>Totaal gemiddelde</span>
                      <span style={{ fontSize: 26, fontWeight: 900, color: CONCLUSIE_COLORS[conclusie] || C.textPrimary }}>{gem}/10</span>
                    </div>
                    {conclusie && (
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                        <span style={{ background: (CONCLUSIE_COLORS[conclusie] || C.textPrimary) + '22', color: CONCLUSIE_COLORS[conclusie] || C.textPrimary, border: `1px solid ${(CONCLUSIE_COLORS[conclusie] || C.textPrimary)}44`, padding: '6px 20px', borderRadius: 20, fontWeight: 800, fontSize: 14 }}>
                          {CONCLUSIE_LABELS[conclusie]}
                        </span>
                      </div>
                    )}
                    <div style={{ background: C.card, borderRadius: 10, padding: '12px 14px', fontSize: 13, color: C.textSec, lineHeight: 1.6, fontStyle: 'italic' }}>
                      {getResultTekst(conclusie, config)}
                    </div>
                  </div>
                )}

                {/* Afgerond badge (read-only) */}
                {['geslaagd', 'niet_geslaagd', 'afwezig'].includes(kandidaat.result) && (
                  <div style={{ marginTop: 12, padding: '12px 16px', background: (RESULT_COLORS[kandidaat.result] + '22'), border: `1px solid ${RESULT_COLORS[kandidaat.result] + '44'}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 22 }}>{kandidaat.result === 'geslaagd' ? '🏆' : kandidaat.result === 'afwezig' ? '—' : '✗'}</span>
                    <div>
                      <div style={{ fontWeight: 700, color: RESULT_COLORS[kandidaat.result], fontSize: 14 }}>{RESULT_LABELS[kandidaat.result]}</div>
                      {kandidaat.eindConclusie && <div style={{ fontSize: 12, color: C.textSec }}>{CONCLUSIE_LABELS[kandidaat.eindConclusie]}</div>}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {!ladend && (
        <div style={{ background: C.card, borderTop: `1px solid ${C.borderSoft}`, padding: '12px 16px', flexShrink: 0 }}>
          {isReadOnly ? (
            <button onClick={onClose} style={{ ...buttonStyle('subtle'), width: '100%' }}>Sluiten</button>
          ) : (
            <>
              {stap === 1 && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={onClose} style={{ ...buttonStyle('ghost') }}>Annuleren</button>
                  <button disabled={!hasSecties} onClick={() => setStap(2)}
                    style={{ ...buttonStyle('primary'), flex: 1, opacity: hasSecties ? 1 : 0.4 }}>
                    Volgende →
                  </button>
                </div>
              )}
              {stap === 2 && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setStap(1)} style={{ ...buttonStyle('ghost') }}>← Terug</button>
                  <button
                    disabled={saving || secties.filter(s => s.aantalTeBevragen > 0).some(s =>
                      getSectModus(s.categorie) === 'manueel' && (manueelGes[s.categorie]?.size || 0) !== s.aantalTeBevragen
                    )}
                    onClick={async () => {
                      const sel = secties.map(s => {
                        if (!s.aantalTeBevragen) return { ...s, technieken: [] };
                        if (getSectModus(s.categorie) === 'manueel') {
                          const ids = manueelGes[s.categorie] || new Set();
                          return { ...s, technieken: s.beschikbaar.filter(t => ids.has(t.id)).map(t => ({ ...t, score: null, notitie: '' })) };
                        }
                        return selecteerWillekeurig([s])[0];
                      });
                      await bevestigSelectie(sel);
                    }}
                    style={{ ...buttonStyle('primary'), flex: 1 }}>
                    {saving ? 'Opslaan...' : modus === 'prep' ? 'Opslaan & Sluiten' : 'Starten →'}
                  </button>
                </div>
              )}
              {stap === 3 && (
                <div style={{ display: 'flex', gap: 10 }}>
                  {huidigIndex > 0 && (
                    <button onClick={() => setHuidigIndex(i => i - 1)} style={{ ...buttonStyle('ghost') }}>← Vorige</button>
                  )}
                  <button
                    disabled={currentTech?.score === null || currentTech?.score === undefined}
                    onClick={volgendeTech}
                    style={{ ...buttonStyle('primary'), flex: 1, opacity: (currentTech?.score === null || currentTech?.score === undefined) ? 0.4 : 1 }}>
                    {huidigIndex === allTechs.length - 1 ? 'Voltooien →' : 'Volgende →'}
                  </button>
                </div>
              )}
              {stap === 4 && kandidaat.result === 'pending' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button disabled={saving} onClick={() => slaResultaatOp('geslaagd')}
                    style={{ padding: 14, borderRadius: 10, border: 'none', background: C.green, color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>
                    🏆 Geslaagd
                  </button>
                  <button disabled={saving} onClick={() => slaResultaatOp('niet_geslaagd')}
                    style={{ padding: 14, borderRadius: 10, border: 'none', background: C.red, color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>
                    ✗ Niet geslaagd
                  </button>
                </div>
              )}
              {stap === 4 && kandidaat.result !== 'pending' && (
                <button onClick={onClose} style={{ ...buttonStyle('subtle'), width: '100%' }}>Sluiten</button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
