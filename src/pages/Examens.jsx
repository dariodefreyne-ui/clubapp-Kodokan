// src/pages/Examens.jsx
// Examenbeheer: overzicht, detail, kandidaten, scoren — lean orchestrator.
// Technieken worden lazy geladen (enkel bij wizard-open), niet bij paginastart.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  subscribeEvents,
  subscribeEventRegistrations, addRegistration, updateRegistration, deleteRegistration,
  subscribeEventDocuments, addEventDocument,
  getAllTechnieken,
  getExamenConfig,
} from '../services/firestoreService';
import { storage } from '../firebase';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { stuurPushTrigger, PUSH_TYPES } from '../services/pushService';
import { useAuth } from '../contexts/AuthContext';
import { useGroepen } from '../contexts/GroepenContext';
import { useGordelOpties } from '../hooks/useGordelOpties';
import { C, buttonStyle, cardStyle, inputStyle, tabBarStyle, tabButtonStyle } from '../styles/tokens';
import ExamenWizard from '../components/examens/ExamenWizard';
import NieuwExamenModal from '../components/examens/NieuwExamenModal';
import KandidaatToevoegenModal from '../components/examens/KandidaatToevoegenModal';
import {
  getExamenStatus, formatDatumNL, formatDatumKort,
} from '../components/examens/examenHelpers';
import {
  RESULT_COLORS, RESULT_LABELS,
  CONCLUSIE_COLORS, CONCLUSIE_LABELS,
} from '../components/examens/examenConstants';
import { usePaginaTitelOverride } from '../contexts/PaginaTitelContext';

// ─── Mini components ──────────────────────────────────────────────────────────

function BeltBadge({ belt, small, colors, labels }) {
  const cfg = colors[belt] || { bg: C.bg, color: C.textMuted };
  return (
    <span style={{
      ...cfg,
      padding: small ? '1px 7px' : '3px 10px',
      borderRadius: 20,
      fontSize: small ? 10 : 12,
      fontWeight: 700,
      display: 'inline-block',
      whiteSpace: 'nowrap',
    }}>
      {labels[belt] || belt || '—'}
    </span>
  );
}

function StatusChip({ status }) {
  const labels = { gepland: 'Gepland', vandaag: 'Vandaag', voorbij: 'Voorbij' };
  const colors = {
    gepland: { bg: '#38BDF822', color: '#38BDF8', border: '#38BDF844' },
    vandaag: { bg: '#22C55E22', color: '#22C55E', border: '#22C55E44' },
    voorbij: { bg: '#64748B22', color: '#64748B', border: '#64748B44' },
  };
  const c = colors[status] || colors.gepland;
  return (
    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: c.bg, color: c.color, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>
      {labels[status] || status}
    </span>
  );
}

function ResultChip({ result }) {
  const color = RESULT_COLORS[result] || C.textMuted;
  const label = RESULT_LABELS[result] || result || '—';
  return (
    <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: color + '22', color, border: `1px solid ${color}44`, whiteSpace: 'nowrap' }}>
      {label}
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

function FilterChip({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
      background: active ? C.blue : C.bg,
      color: active ? '#fff' : C.textMuted,
      border: `1px solid ${active ? C.blue : C.border}`,
    }}>
      {label}
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Examens() {
  const { isTrainer, isBeheerder } = useAuth();
  const { groepen } = useGroepen();
  const { colors: BELT_COLORS, kyuLabels: BELT_KYU_LABELS } = useGordelOpties();
  const kanBeheren = isTrainer || isBeheerder;
  const woensdagGroepen = groepen.filter(g => !g.dag || g.dag.toLowerCase().includes('woensdag'));

  // Event list
  const [events, setEvents] = useState([]);
  const [statusFilter, setStatusFilter] = useState('alle'); // alle | gepland | vandaag | voorbij
  const [groepFilter, setGroepFilter] = useState('');       // '' = alle groepen

  // Selected event detail
  const [selected, setSelected] = useState(null);
  usePaginaTitelOverride(selected ? 'Examen detail' : null);
  const [candidates, setCandidates] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [kandidaatZoek, setKandidaatZoek] = useState('');
  const [tab, setTab] = useState('kandidaten');
  const [uploading, setUploading] = useState(false);

  // Modals / wizard
  const [showNieuwExamen, setShowNieuwExamen] = useState(false);
  const [bewerkExamen, setBewerkExamen] = useState(null);
  const [showAddKandidaat, setShowAddKandidaat] = useState(false);
  const [wizard, setWizard] = useState(null); // { kandidaat, readOnly }

  // Lazy-loaded & cached
  const techniekCache = useRef(null);
  const [allTechnieken, setAllTechnieken] = useState([]);
  const [examConfig, setExamConfig] = useState(null);
  const configLoaded = useRef(false);

  // Subscribe to events list
  useEffect(() => {
    const unsub = subscribeEvents(all => {
      const examens = all
        .filter(e => e.type === 'examen')
        .sort((a, b) => (a.datum || a.date || '').localeCompare(b.datum || b.date || ''));
      setEvents(examens);
    });
    return unsub;
  }, []);

  // Subscribe to selected event's candidates + docs
  useEffect(() => {
    if (!selected) { setCandidates([]); setDocuments([]); return; }
    const u1 = subscribeEventRegistrations(selected.id, setCandidates);
    const u2 = subscribeEventDocuments(selected.id, setDocuments);
    return () => { u1(); u2(); };
  }, [selected?.id]);

  // Lazy-load technieken + config only on first wizard open
  const ensureTechniekLoaded = useCallback(async () => {
    if (techniekCache.current) {
      setAllTechnieken(techniekCache.current);
      return;
    }
    const [techs, cfg] = await Promise.all([
      getAllTechnieken(),
      configLoaded.current ? Promise.resolve(examConfig) : getExamenConfig(),
    ]);
    techniekCache.current = techs;
    setAllTechnieken(techs);
    if (!configLoaded.current) {
      configLoaded.current = true;
      setExamConfig(cfg);
    }
  }, [examConfig]);

  async function openWizard(kandidaat, readOnly = false, modus = 'examen') {
    await ensureTechniekLoaded();
    setWizard({ kandidaat, readOnly, modus });
  }

  // Event list filters
  const gefilterd = events.filter(ev => {
    const status = getExamenStatus(ev);
    if (statusFilter !== 'alle' && status !== statusFilter) return false;
    if (groepFilter && ev.groepId !== groepFilter) return false;
    return true;
  });

  // Split upcoming (gepland + vandaag) vs past for display
  const aankomend = gefilterd.filter(ev => getExamenStatus(ev) !== 'voorbij');
  const voorbij = gefilterd.filter(ev => getExamenStatus(ev) === 'voorbij');

  // Filtered candidates
  const gefilterdeKandidaten = kandidaatZoek.trim()
    ? candidates.filter(k => (k.memberName || '').toLowerCase().includes(kandidaatZoek.toLowerCase()))
    : candidates;

  // Stats for selected event
  const stats = {
    totaal: candidates.length,
    geslaagd: candidates.filter(c => c.result === 'geslaagd').length,
    niet: candidates.filter(c => c.result === 'niet_geslaagd').length,
    afwezig: candidates.filter(c => c.result === 'afwezig').length,
  };

  // Handlers
  function handleExamenSaved(examen) {
    setShowNieuwExamen(false);
    setBewerkExamen(null);
    if (!bewerkExamen) setSelected(examen);
  }

  async function handleAddKandidaat(data) {
    if (!selected) return;
    await addRegistration(selected.id, {
      ...data,
      result: 'pending',
      createdAt: new Date().toISOString(),
      seizoen: selected.seizoen || '',
    });
    stuurPushTrigger(PUSH_TYPES.UITGENODIGD_EXAMEN, {
      uid: '', memberId: data.memberId || '',
      judokaNaam: data.memberName, examenNaam: selected.naam || '', datum: selected.datum || '',
    });
    setShowAddKandidaat(false);
  }

  async function markeerAfwezig(kandidaat) {
    await updateRegistration(selected.id, kandidaat.id, { result: 'afwezig', examFase: 'afgerond' });
  }

  async function verwijderKandidaat(kandidaat) {
    if (!window.confirm(`${kandidaat.memberName} verwijderen uit dit examen?`)) return;
    await deleteRegistration(selected.id, kandidaat.id);
  }

  async function uploadDoc(e) {
    const file = e.target.files[0];
    if (!file || !selected) return;
    setUploading(true);
    const sRef = storageRef(storage, `events/${selected.id}/docs/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(sRef, file);
    task.on('state_changed', null, () => setUploading(false), async () => {
      const url = await getDownloadURL(task.snapshot.ref);
      await addEventDocument(selected.id, { title: file.name, url, uploadedAt: new Date().toISOString() });
      setUploading(false);
    });
  }

  function getKandidaatStatus(k) {
    if (k.result && k.result !== 'pending') return k.result;
    if (k.examFase === 'geconfigureerd') return 'geconfigureerd';
    if (k.examFase === 'scorend') return 'scorend';
    return 'pending';
  }

  const bestaandeIds = candidates.map(c => c.memberId).filter(Boolean);

  // ─── Event list view ────────────────────────────────────────────────────────
  if (!selected) {
    return (
      <div>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary }}>📘 Examens</div>
          {kanBeheren && (
            <button onClick={() => setShowNieuwExamen(true)} style={{ ...buttonStyle('primary'), padding: '10px 16px' }}>
              + Nieuw examen
            </button>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, alignItems: 'center' }}>
          {['alle', 'gepland', 'vandaag', 'voorbij'].map(s => (
            <FilterChip
              key={s}
              label={s === 'alle' ? 'Alle' : s === 'gepland' ? 'Aankomend' : s === 'vandaag' ? 'Vandaag' : 'Voorbij'}
              active={statusFilter === s}
              onClick={() => setStatusFilter(s)}
            />
          ))}
          {woensdagGroepen.length > 0 && (
            <select
              value={groepFilter}
              onChange={e => setGroepFilter(e.target.value)}
              style={{ ...inputStyle, padding: '5px 10px', fontSize: 12, height: 'auto', minWidth: 130 }}
            >
              <option value="">Alle groepen</option>
              {woensdagGroepen.map(g => <option key={g.id} value={g.id}>{g.naam}</option>)}
            </select>
          )}
        </div>

        {gefilterd.length === 0 ? (
          <div style={{ ...cardStyle(), padding: 40, textAlign: 'center', color: C.textMuted }}>
            {kanBeheren ? 'Geen examens gevonden. Maak een nieuw examen aan.' : 'Geen examens gepland.'}
          </div>
        ) : (
          <>
            {/* Aankomend / vandaag */}
            {aankomend.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                {(statusFilter === 'alle') && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                    Aankomend
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {aankomend.map(ev => <EventCard key={ev.id} ev={ev} groepen={groepen} onClick={() => setSelected(ev)} onEdit={kanBeheren ? () => setBewerkExamen(ev) : null} />)}
                </div>
              </div>
            )}

            {/* Voorbij */}
            {voorbij.length > 0 && (
              <div>
                {(statusFilter === 'alle') && (
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                    Afgelopen
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...voorbij].reverse().map(ev => <EventCard key={ev.id} ev={ev} groepen={groepen} onClick={() => setSelected(ev)} onEdit={kanBeheren ? () => setBewerkExamen(ev) : null} dimmed />)}
                </div>
              </div>
            )}
          </>
        )}

        {showNieuwExamen && (
          <NieuwExamenModal onClose={() => setShowNieuwExamen(false)} onSave={handleExamenSaved} />
        )}
        {bewerkExamen && (
          <NieuwExamenModal bestaand={bewerkExamen} onClose={() => setBewerkExamen(null)} onSave={handleExamenSaved} />
        )}
      </div>
    );
  }

  // ─── Event detail view ──────────────────────────────────────────────────────
  const evStatus = getExamenStatus(selected);
  const groepNaam = groepen.find(g => g.id === selected.groepId)?.naam || '';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: 'var(--space-4)' }}>
      {/* Back */}
      <button
        onClick={() => { setSelected(null); setKandidaatZoek(''); setTab('kandidaten'); }}
        style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', fontSize: 13, padding: '0 0 12px', display: 'flex', alignItems: 'center', gap: 4 }}
      >
        ← Alle examens
      </button>

      {/* Event header */}
      <div style={{ ...cardStyle(), marginBottom: 14, padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
              <span style={{ fontSize: 19, fontWeight: 800, color: C.textPrimary }}>{selected.naam}</span>
              <StatusChip status={evStatus} />
              {selected.isStreepje && <span style={{ fontSize: 11, color: C.orange, fontWeight: 700, background: C.orange + '22', borderRadius: 6, padding: '1px 6px' }}>streepje</span>}
            </div>
            <div style={{ fontSize: 13, color: C.textSec }}>
              {formatDatumNL(selected.datum)}
              {selected.locatie && <span style={{ marginLeft: 8 }}>· {selected.locatie}</span>}
              {groepNaam && <span style={{ marginLeft: 8 }}>· {groepNaam}</span>}
            </div>
          </div>
          {kanBeheren && (
            <button
              onClick={() => setBewerkExamen(selected)}
              style={{ ...buttonStyle('ghost'), padding: '6px 12px', fontSize: 12, minHeight: 'auto' }}
            >
              Bewerken
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          ['Kandidaten', stats.totaal, C.blue],
          ['Geslaagd', stats.geslaagd, C.green],
          ['Niet geslaagd', stats.niet, C.red],
          ['Afwezig', stats.afwezig, C.textMuted],
        ].map(([lbl, val, kleur]) => (
          <div key={lbl} style={{ background: C.card, borderRadius: 10, padding: '10px 8px', borderLeft: `3px solid ${kleur}`, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: kleur }}>{val}</div>
            <div style={{ color: C.textSec, fontSize: 10, marginTop: 2, lineHeight: 1.2 }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={tabBarStyle}>
        {[['kandidaten', '👥 Kandidaten'], ['documenten', '📄 Documenten']].map(([key, lbl]) => (
          <button key={key} onClick={() => setTab(key)} style={tabButtonStyle(tab === key)}>{lbl}</button>
        ))}
      </div>

      {/* Kandidaten tab */}
      {tab === 'kandidaten' && (
        <div>
          {kanBeheren && (
            <button onClick={() => setShowAddKandidaat(true)} style={{ ...buttonStyle('primary'), width: '100%', marginBottom: 10 }}>
              + Kandidaat toevoegen
            </button>
          )}

          {/* Zoekfilter op naam */}
          {candidates.length > 3 && (
            <input
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', marginBottom: 10 }}
              value={kandidaatZoek}
              onChange={e => setKandidaatZoek(e.target.value)}
              placeholder="Zoek kandidaat op naam…"
            />
          )}

          {gefilterdeKandidaten.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: C.textMuted, background: C.card, borderRadius: 12 }}>
              {candidates.length === 0
                ? (kanBeheren ? 'Geen kandidaten. Voeg een kandidaat toe.' : 'Geen kandidaten.')
                : 'Geen resultaten voor deze zoekopdracht.'}
            </div>
          ) : (
            gefilterdeKandidaten.map(k => {
              const statusLabel = getKandidaatStatus(k);
              const isAfgerond = ['geslaagd', 'niet_geslaagd', 'afwezig'].includes(k.result);
              const hasScores = k.examSecties?.some(s => s.technieken?.some(t => t.score !== null && t.score !== undefined));

              return (
                <div key={k.id} style={{ background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: 12, padding: '14px 16px', marginBottom: 8 }}>
                  {/* Naam + status */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: C.textPrimary, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {k.memberName}
                        {k.isStreepje && (
                          <span style={{ fontSize: 10, color: C.orange, fontWeight: 700, background: C.orange + '22', borderRadius: 6, padding: '1px 5px' }}>streepje</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                        {k.currentBelt && <BeltBadge belt={k.currentBelt} small colors={BELT_COLORS} labels={BELT_KYU_LABELS} />}
                        {k.currentBelt && <span style={{ color: C.textMuted, fontSize: 11 }}>→</span>}
                        {k.targetBelt && <BeltBadge belt={k.targetBelt} small colors={BELT_COLORS} labels={BELT_KYU_LABELS} />}
                      </div>
                    </div>
                    <ResultChip result={statusLabel} />
                  </div>

                  {/* Scoreoverzicht (enkel voor trainers, enkel na examen) */}
                  {kanBeheren && isAfgerond && k.eindScore !== null && k.eindScore !== undefined && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, padding: '8px 10px', background: C.surface, borderRadius: 8 }}>
                      <span style={{ fontSize: 12, color: C.textSec }}>Score:</span>
                      <ScoreBadge score={k.eindScore} />
                      {k.eindConclusie && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: CONCLUSIE_COLORS[k.eindConclusie], background: (CONCLUSIE_COLORS[k.eindConclusie] || '#888') + '22', borderRadius: 6, padding: '1px 7px' }}>
                          {CONCLUSIE_LABELS[k.eindConclusie]}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Acties */}
                  {kanBeheren && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {!isAfgerond && (
                        <>
                          {(!k.examFase || k.examFase === 'nieuw') && (
                            <button
                              onClick={() => openWizard(k, false, 'prep')}
                              style={{ ...buttonStyle('ghost'), padding: '7px 12px', fontSize: 12, minHeight: 'auto' }}
                            >
                              Voorbereiden
                            </button>
                          )}
                          <button
                            onClick={() => openWizard(k, false, 'examen')}
                            style={{ ...buttonStyle('primary'), padding: '7px 12px', fontSize: 12, minHeight: 'auto' }}
                          >
                            ▶ Starten/Opmaken
                          </button>
                          <button
                            onClick={() => markeerAfwezig(k)}
                            style={{ ...buttonStyle('ghost'), padding: '7px 12px', fontSize: 12, minHeight: 'auto' }}
                          >
                            Afwezig
                          </button>
                        </>
                      )}
                      {(isAfgerond || hasScores) && (
                        <button
                          onClick={() => openWizard(k, true)}
                          style={{ ...buttonStyle('ghost'), padding: '7px 12px', fontSize: 12, minHeight: 'auto' }}
                        >
                          Scores bekijken
                        </button>
                      )}
                      {k.result === 'pending' && (
                        <button
                          onClick={() => verwijderKandidaat(k)}
                          style={{ ...buttonStyle('danger'), padding: '7px 12px', fontSize: 12, minHeight: 'auto' }}
                        >
                          Verwijder
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Documenten tab */}
      {tab === 'documenten' && (
        <div>
          {kanBeheren && (
            <label style={{ display: 'block', ...buttonStyle('primary'), width: '100%', textAlign: 'center', marginBottom: 10, cursor: 'pointer' }}>
              {uploading ? '⏳ Uploaden...' : '📄 Studiedocument uploaden'}
              <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={uploadDoc} disabled={uploading} />
            </label>
          )}
          {documents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 32, color: C.textMuted, background: C.card, borderRadius: 12 }}>Geen documenten.</div>
          ) : (
            documents.map(d => (
              <a key={d.id} href={d.url} target="_blank" rel="noreferrer"
                style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: C.card, borderRadius: 10, marginBottom: 6, color: C.blue, textDecoration: 'none', fontSize: 14, border: `1px solid ${C.borderSoft}` }}>
                📄 {d.title}
              </a>
            ))
          )}
        </div>
      )}

      {/* Modals */}
      {bewerkExamen && (
        <NieuwExamenModal
          bestaand={bewerkExamen}
          onClose={() => setBewerkExamen(null)}
          onSave={saved => { setBewerkExamen(null); setSelected(prev => ({ ...prev, ...saved })); }}
        />
      )}
      {showAddKandidaat && (
        <KandidaatToevoegenModal
          bestaandeIds={bestaandeIds}
          groepId={selected?.groepId}
          onSave={handleAddKandidaat}
          onClose={() => setShowAddKandidaat(false)}
        />
      )}
      {wizard && (
        <ExamenWizard
          kandidaat={wizard.kandidaat}
          eventId={selected?.id}
          examConfig={examConfig}
          allTechnieken={allTechnieken}
          onClose={() => setWizard(null)}
          isReadOnly={wizard.readOnly}
          modus={wizard.modus}
        />
      )}
    </div>
  );
}

// ─── EventCard sub-component ─────────────────────────────────────────────────

function EventCard({ ev, groepen, onClick, onEdit, dimmed }) {
  const status = getExamenStatus(ev);
  const groepNaam = groepen.find(g => g.id === ev.groepId)?.naam || '';

  return (
    <div
      style={{
        ...cardStyle(),
        opacity: dimmed ? 0.65 : 1,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 18px',
        gap: 10,
        border: status === 'vandaag' ? `2px solid ${C.green}` : `1px solid ${C.borderSoft}`,
      }}
      onClick={onClick}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: C.textPrimary }}>{ev.naam}</span>
          <StatusChip status={status} />
          {groepNaam && (
            <span style={{ fontSize: 11, color: C.textMuted, background: C.bg, borderRadius: 6, padding: '1px 6px', border: `1px solid ${C.border}` }}>
              {groepNaam}
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: C.textSec }}>
          {formatDatumKort(ev.datum)}
          {ev.locatie && <span style={{ marginLeft: 8 }}>· {ev.locatie}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {onEdit && (
          <button
            onClick={e => { e.stopPropagation(); onEdit(); }}
            style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '4px 10px', fontSize: 12, color: C.textMuted, cursor: 'pointer' }}
          >
            ✏️
          </button>
        )}
        <span style={{ color: C.textMuted, fontSize: 20 }}>›</span>
      </div>
    </div>
  );
}
