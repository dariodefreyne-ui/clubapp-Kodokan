// ExamenWizard — meertraps component voor het afnemen van een examen
// Stap 1: Sectie configuratie (hoeveel technieken per sectie)
// Stap 2: Techniek selectie (willekeurig of manueel)
// Stap 3: Scoren per techniek (0–10 + notitie)
// Stap 4: Afronding (eindresultaat, conclusie, opslaan)
import React, { useState, useEffect } from 'react';
import { updateRegistration, updateMember } from '../../services/firestoreService';
import { stuurPushTrigger, PUSH_TYPES } from '../../services/pushService';
import { C, buttonStyle, inputStyle } from '../../styles/tokens';
import {
  BELT_COLORS, BELT_KYU_LABELS, DEFAULT_EXAM_CONFIG,
  CONCLUSIE_COLORS, CONCLUSIE_LABELS, RESULT_COLORS, RESULT_LABELS,
} from './examenConstants';
import {
  bouwInitieleSecties, selecteerWillekeurig, herstelSecties,
  berekenGemiddelde, classifeerScore, getResultTekst,
  alleGescored, bouwFirestoreSecties,
} from './examenHelpers';

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

export default function ExamenWizard({ kandidaat, eventId, examConfig, allTechnieken, onClose, isReadOnly }) {
  const [stap, setStap] = useState(1);
  const [secties, setSecties] = useState([]);
  const [selectieModus, setSelectieModus] = useState('random');
  const [manueelGes, setManueelGes] = useState({});
  const [huidigIndex, setHuidigIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [ladend, setLadend] = useState(true);

  const config = { ...DEFAULT_EXAM_CONFIG, ...(examConfig || {}) };

  useEffect(() => {
    if (!kandidaat || !allTechnieken.length) return;
    setLadend(true);
    if (kandidaat.examSecties?.length > 0) {
      const hersteld = herstelSecties(kandidaat.examSecties, allTechnieken, kandidaat.targetBelt, kandidaat.isStreepje);
      setSecties(hersteld);
      if (alleGescored(hersteld) || isReadOnly) {
        setStap(4);
      } else {
        const flat = hersteld.flatMap(s => s.technieken || []);
        const firstIdx = flat.findIndex(t => t.score === null || t.score === undefined);
        setHuidigIndex(Math.max(0, firstIdx));
        setStap(3);
      }
    } else {
      const init = bouwInitieleSecties(allTechnieken, kandidaat.targetBelt, kandidaat.isStreepje);
      setSecties(init);
      setStap(1);
    }
    setLadend(false);
  }, [kandidaat?.id, allTechnieken.length]);

  const allTechs = secties.flatMap(s => (s.technieken || []).map(t => ({ ...t, sectieLabel: s.categorieLabel })));
  const currentTech = allTechs[huidigIndex];
  const hasSecties = secties.some(s => s.aantalTeBevragen > 0);
  const gem = berekenGemiddelde(secties);
  const conclusie = classifeerScore(gem, config);

  function updateScore(score) {
    let n = 0;
    setSecties(prev => prev.map(s => ({
      ...s,
      technieken: s.technieken.map(t => { const match = n++ === huidigIndex; return match ? { ...t, score } : t; }),
    })));
  }

  function updateNotitie(notitie) {
    let n = 0;
    setSecties(prev => prev.map(s => ({
      ...s,
      technieken: s.technieken.map(t => { const match = n++ === huidigIndex; return match ? { ...t, notitie } : t; }),
    })));
  }

  async function slaScoresOp(updatedSecties) {
    await updateRegistration(eventId, kandidaat.id, {
      examSecties: bouwFirestoreSecties(updatedSecties),
      examFase: 'scorend',
      updatedAt: new Date().toISOString(),
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
    const hersteld = herstelSecties(fireSecties, allTechnieken, kandidaat.targetBelt, kandidaat.isStreepje);
    setSecties(hersteld);
    setHuidigIndex(0);
    setSaving(false);
    setStap(3);
  }

  async function slaResultaatOp(result) {
    setSaving(true);
    const eindTekst = result === 'afwezig' ? null : getResultTekst(conclusie, config);
    await updateRegistration(eventId, kandidaat.id, {
      result,
      eindScore: result === 'afwezig' ? null : gem,
      eindConclusie: result === 'afwezig' ? null : conclusie,
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

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.borderSoft}`, padding: '12px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.textPrimary, marginBottom: 3 }}>
              {kandidaat.memberName}
              {kandidaat.isStreepje && (
                <span style={{ marginLeft: 8, fontSize: 10, color: C.orange, fontWeight: 700, background: C.orangeDim, borderRadius: 6, padding: '2px 6px' }}>STREEPJE</span>
              )}
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
                {[1, 2, 3, 4].map(s => (
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
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, marginBottom: 4 }}>Technieken per sectie</div>
                  <div style={{ fontSize: 13, color: C.textSec }}>
                    Stel in hoeveel technieken je per sectie wil bevragen.
                    {kandidaat.isStreepje
                      ? ' Enkel nieuwe technieken voor dit niveau worden getoond.'
                      : ' Zowel nieuwe als reeds gekende technieken zijn beschikbaar.'}
                  </div>
                </div>

                {secties.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 32, color: C.textMuted, background: C.surface, borderRadius: 12 }}>
                    Geen technieken gevonden voor deze gordel. Controleer of de techniekdatabank gevuld is in Beheer.
                  </div>
                ) : secties.map((s, i) => (
                  <div key={s.categorie} style={{ background: C.surface, border: `1px solid ${C.borderSoft}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: C.textPrimary }}>{s.categorieLabel}</div>
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                          {s.beschikbaar.length} beschikbaar
                          {s.aantalNieuw > 0 && <span style={{ marginLeft: 6, color: C.green, fontWeight: 600 }}>({s.aantalNieuw} nieuw)</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          onClick={() => setSecties(prev => prev.map((x, j) => j !== i ? x : { ...x, aantalTeBevragen: Math.max(0, x.aantalTeBevragen - 1) }))}
                          style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.borderSoft}`, background: C.card, color: C.textPrimary, cursor: 'pointer', fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−
                        </button>
                        <span style={{ fontSize: 20, fontWeight: 800, minWidth: 26, textAlign: 'center', color: s.aantalTeBevragen > 0 ? C.textPrimary : C.textMuted }}>
                          {s.aantalTeBevragen}
                        </span>
                        <button
                          onClick={() => setSecties(prev => prev.map((x, j) => j !== i ? x : { ...x, aantalTeBevragen: Math.min(x.beschikbaar.length, x.aantalTeBevragen + 1) }))}
                          style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${C.borderSoft}`, background: C.card, color: C.textPrimary, cursor: 'pointer', fontSize: 20, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── STAP 2: Techniek selectie ── */}
            {stap === 2 && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, marginBottom: 4 }}>Technieken selecteren</div>
                  <div style={{ fontSize: 13, color: C.textSec }}>Hoe wil je de technieken selecteren?</div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  {[['random', '🎲 Willekeurig'], ['manueel', '✋ Zelf kiezen']].map(([val, lbl]) => (
                    <button key={val} onClick={() => setSelectieModus(val)}
                      style={{ flex: 1, padding: '12px 8px', borderRadius: 10, border: `1px solid ${selectieModus === val ? C.red : C.borderSoft}`, background: selectieModus === val ? C.redDim : C.surface, color: selectieModus === val ? C.red : C.textSec, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                      {lbl}
                    </button>
                  ))}
                </div>

                {selectieModus === 'random' && (
                  <div>
                    <div style={{ background: C.surface, borderRadius: 12, padding: '12px 16px', marginBottom: 12, border: `1px solid ${C.borderSoft}` }}>
                      <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.6 }}>
                        Technieken worden willekeurig geselecteerd. Per sectie met nieuwe technieken wordt minstens 1 nieuwe techniek gekozen.
                      </div>
                    </div>
                    {secties.filter(s => s.aantalTeBevragen > 0).map(s => (
                      <div key={s.categorie} style={{ background: C.surface, border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{s.categorieLabel}</span>
                        <span style={{ fontSize: 12, color: C.textSec }}>
                          {s.aantalTeBevragen} van {s.beschikbaar.length}
                          {s.aantalNieuw > 0 && <span style={{ color: C.green, marginLeft: 4 }}>· min. 1 nieuw</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {selectieModus === 'manueel' && secties.filter(s => s.aantalTeBevragen > 0).map(s => {
                  const ges = manueelGes[s.categorie] || new Set();
                  return (
                    <div key={s.categorie} style={{ marginBottom: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{s.categorieLabel}</span>
                        <span style={{ fontSize: 12, color: ges.size === s.aantalTeBevragen ? C.green : C.orange, fontWeight: 600 }}>
                          {ges.size}/{s.aantalTeBevragen}
                        </span>
                      </div>
                      {s.beschikbaar.map(t => {
                        const isGes = ges.has(t.id);
                        const isDisabled = !isGes && ges.size >= s.aantalTeBevragen;
                        return (
                          <button key={t.id} disabled={isDisabled}
                            onClick={() => setManueelGes(prev => {
                              const set = new Set(prev[s.categorie] || []);
                              if (set.has(t.id)) set.delete(t.id); else if (set.size < s.aantalTeBevragen) set.add(t.id);
                              return { ...prev, [s.categorie]: set };
                            })}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${isGes ? C.red : C.borderSoft}`, background: isGes ? C.redDim : C.surface, color: isDisabled ? C.textMuted : C.textPrimary, cursor: isDisabled ? 'default' : 'pointer', marginBottom: 6, textAlign: 'left', opacity: isDisabled ? 0.5 : 1 }}>
                            <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${isGes ? C.red : C.borderSoft}`, background: isGes ? C.red : 'transparent', flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 13 }}>{t.techniek || t.naam}</span>
                            {t.isNieuw && <span style={{ fontSize: 10, fontWeight: 700, color: C.green, background: C.greenDim, borderRadius: 4, padding: '1px 5px' }}>NIEUW</span>}
                          </button>
                        );
                      })}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <span style={{ fontSize: 12, color: C.textMuted, background: C.surface, borderRadius: 6, padding: '3px 10px', border: `1px solid ${C.borderSoft}` }}>{currentTech?.sectieLabel}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {allTechs.map((t, idx) => (
                        <div key={idx} style={{ width: idx === huidigIndex ? 16 : 6, height: 6, borderRadius: 3, background: (t.score !== null && t.score !== undefined) ? C.green : idx === huidigIndex ? C.red : C.borderSoft, transition: 'all 0.15s' }} />
                      ))}
                    </div>
                  </div>

                  <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: C.textPrimary, marginBottom: 6 }}>{currentTech?.naam}</div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                      {currentTech?.isNieuw && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: C.green, background: C.greenDim, border: `1px solid ${C.green}44`, borderRadius: 20, padding: '2px 8px' }}>NIEUW</span>
                      )}
                      {currentTech?.kyu && (
                        <span style={{ fontSize: 11, color: C.textMuted, background: C.surface, borderRadius: 20, padding: '2px 8px', border: `1px solid ${C.borderSoft}` }}>{currentTech.kyu}e kyu</span>
                      )}
                    </div>
                  </div>

                  {/* Score selector */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ textAlign: 'center', marginBottom: 16 }}>
                      {currentTech?.score !== null && currentTech?.score !== undefined ? (
                        <div style={{ fontSize: 64, fontWeight: 900, color: currentTech.score >= 8 ? C.green : currentTech.score >= 5 ? C.orange : C.red, lineHeight: 1 }}>
                          {currentTech.score}
                        </div>
                      ) : (
                        <div style={{ fontSize: 48, fontWeight: 700, color: C.textMuted, lineHeight: 1 }}>—</div>
                      )}
                      <div style={{ fontSize: 11, color: C.textMuted, marginTop: 4 }}>score / 10</div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                        <button key={s} onClick={() => updateScore(s)}
                          style={{
                            padding: '16px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 16,
                            background: currentTech?.score === s ? (s >= 8 ? C.green : s >= 5 ? C.orange : C.red) : C.surface,
                            color: currentTech?.score === s ? '#fff' : C.textSec,
                            gridColumn: s === 10 ? 'span 4' : 'span 1',
                            boxShadow: currentTech?.score === s ? `0 4px 12px ${(s >= 8 ? C.green : s >= 5 ? C.orange : C.red)}44` : 'none',
                          }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, color: C.textSec, fontWeight: 600, marginBottom: 6 }}>Notitie voor trainer (optioneel)</label>
                    <textarea
                      value={currentTech?.notitie || ''}
                      onChange={e => updateNotitie(e.target.value)}
                      placeholder="Aandachtspunten, opmerkingen..."
                      style={{ ...inputStyle, minHeight: 72, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                    />
                  </div>
                </div>
              )
            )}

            {/* ── STAP 4: Afronding ── */}
            {stap === 4 && (
              <div>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: C.textPrimary, marginBottom: 2 }}>
                    {isReadOnly ? 'Examenresultaat' : 'Afronding'}
                  </div>
                  {!isReadOnly && <div style={{ fontSize: 13, color: C.textSec }}>Controleer de scores en sla het eindresultaat op.</div>}
                </div>

                {/* Score overzicht per sectie */}
                {secties.map(s => s.technieken?.length > 0 ? (
                  <div key={s.categorie} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: C.textMuted, marginBottom: 8 }}>
                      {s.categorieLabel}
                    </div>
                    {s.technieken.map((t, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: `1px solid ${C.borderSoft}` }}>
                        <div style={{ flex: 1, paddingRight: 8 }}>
                          <div style={{ fontSize: 13, color: C.textPrimary, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {t.naam}
                            {t.isNieuw && <span style={{ fontSize: 10, fontWeight: 700, color: C.green, background: C.greenDim, borderRadius: 4, padding: '1px 5px' }}>NIEUW</span>}
                          </div>
                          {t.notitie && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, fontStyle: 'italic' }}>{t.notitie}</div>}
                        </div>
                        <ScoreBadge score={t.score} />
                      </div>
                    ))}
                  </div>
                ) : null)}

                {/* Eindresultaat blok */}
                {gem !== null && (
                  <div style={{ background: C.surface, borderRadius: 14, padding: 16, marginTop: 4, border: `1px solid ${C.borderSoft}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 13, color: C.textSec, fontWeight: 600 }}>Gemiddelde score</span>
                      <span style={{ fontSize: 26, fontWeight: 900, color: CONCLUSIE_COLORS[conclusie] || C.textPrimary }}>{gem}/10</span>
                    </div>
                    {conclusie && (
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
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

                {/* Afgerond resultaat badge (read-only) */}
                {(kandidaat.result === 'geslaagd' || kandidaat.result === 'niet_geslaagd' || kandidaat.result === 'afwezig') && (
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
                    disabled={saving || (selectieModus === 'manueel' && secties.filter(s => s.aantalTeBevragen > 0).some(s => (manueelGes[s.categorie]?.size || 0) !== s.aantalTeBevragen))}
                    onClick={async () => {
                      let selectedSecties;
                      if (selectieModus === 'random') {
                        selectedSecties = selecteerWillekeurig(secties);
                      } else {
                        selectedSecties = secties.map(s => {
                          if (!s.aantalTeBevragen) return { ...s, technieken: [] };
                          const ids = manueelGes[s.categorie] || new Set();
                          return { ...s, technieken: s.beschikbaar.filter(t => ids.has(t.id)).map(t => ({ ...t, score: null, notitie: '' })) };
                        });
                      }
                      await bevestigSelectie(selectedSecties);
                    }}
                    style={{ ...buttonStyle('primary'), flex: 1 }}>
                    {saving ? 'Opslaan...' : 'Starten →'}
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
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <button disabled={saving} onClick={() => slaResultaatOp('geslaagd')}
                      style={{ padding: 14, borderRadius: 10, border: 'none', background: C.green, color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>
                      🏆 Geslaagd
                    </button>
                    <button disabled={saving} onClick={() => slaResultaatOp('niet_geslaagd')}
                      style={{ padding: 14, borderRadius: 10, border: 'none', background: C.red, color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>
                      ✗ Niet geslaagd
                    </button>
                  </div>
                  <button disabled={saving} onClick={() => slaResultaatOp('afwezig')}
                    style={{ width: '100%', padding: 12, borderRadius: 10, border: `1px solid ${C.borderSoft}`, background: C.surface, color: C.textSec, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                    — Afwezig
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
