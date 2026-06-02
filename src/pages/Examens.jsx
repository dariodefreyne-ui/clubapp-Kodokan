// src/pages/Examens.jsx
// Volledig examenbeheer: examen aanmaken, kandidaten toevoegen, technieken configureren,
// scoren per techniek, eindconclusie en gordel-promotie.
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  subscribeEvents, addEvent,
  subscribeEventRegistrations, addRegistration, updateRegistration, deleteRegistration,
  getMembers, updateMember, getAllTechnieken,
  subscribeEventDocuments, addEventDocument,
  getExamenConfig,
} from '../services/firestoreService';
import { storage } from '../firebase';
import { stuurPushTrigger, PUSH_TYPES } from '../services/pushService';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useAuth } from '../contexts/AuthContext';
import { C, buttonStyle, cardStyle, inputStyle, tabBarStyle, tabButtonStyle } from '../styles/tokens';
import ExamenDetailPanel from '../components/details/ExamenDetailPanel';

// ─── Constants ────────────────────────────────────────────────────────────────
const GORDEL_KYU = { wit: '6', geel: '5', oranje: '4', groen: '3', blauw: '2', bruin: '1', zwart: '0' };
const BELTS = ['wit', 'geel', 'oranje', 'groen', 'blauw', 'bruin', 'zwart'];
const BELT_NEXT = { wit: 'geel', geel: 'oranje', oranje: 'groen', groen: 'blauw', blauw: 'bruin', bruin: 'zwart', zwart: 'zwart' };
const BELT_COLORS = {
  wit:    { bg: '#fff', color: '#333', border: '1px solid #ccc' },
  geel:   { bg: '#f1c40f', color: '#333' },
  oranje: { bg: '#e67e22', color: '#fff' },
  groen:  { bg: '#27ae60', color: '#fff' },
  blauw:  { bg: '#3498db', color: '#fff' },
  bruin:  { bg: '#8B4513', color: '#fff' },
  zwart:  { bg: '#1a1a1a', color: '#fff', border: '1px solid #555' },
};
const BELT_LABELS = {
  wit: 'Wit (6e kyu)', geel: 'Geel (5e kyu)', oranje: 'Oranje (4e kyu)',
  groen: 'Groen (3e kyu)', blauw: 'Blauw (2e kyu)', bruin: 'Bruin (1e kyu)', zwart: 'Zwart (1e dan+)',
};
const TYPE_LABELS = {
  'Val': 'Vallen', 'houdgreep': 'Houdgrepen', 'Worpen': 'Worpen',
  'Verplaatsing': 'Verplaatsing', 'Transitie': 'Transitie',
  'klemmen': 'Klemmen', 'verwurgingen': 'Verwurgingen',
};
const TYPE_VOLGORDE = ['Val', 'Worpen', 'houdgreep', 'Verplaatsing', 'Transitie', 'klemmen', 'verwurgingen'];

const DEFAULT_EXAM_CONFIG = {
  drempelGoed: 5, drempelUitstekend: 8,
  tekstOnvoldoende: 'Het examen werd niet behaald. Er zijn nog onvoldoende technieken die voldoende worden beheerst. We raden aan om verder te oefenen en op een later tijdstip opnieuw deel te nemen.',
  tekstGoed: 'Gefeliciteerd! Het examen werd succesvol afgelegd. De technieken worden goed beheerst en de graad kan worden toegekend.',
  tekstUitstekend: 'Uitstekend resultaat! De technieken worden op een hoog niveau beheerst. Proficiat met dit schitterend examenresultaat!',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDoelKyu(belt) { return GORDEL_KYU[belt] || null; }

function isTechniekNieuw(t, targetKyu) {
  if (!t?.kyu_graden?.length || !targetKyu) return false;
  return Math.max(...t.kyu_graden.map(Number)) === parseInt(targetKyu);
}

function getRelevanteTechnieken(allTechnieken, targetBelt, isStreepje) {
  const targetKyu = getDoelKyu(targetBelt);
  if (!targetKyu) return [];
  if (isStreepje) {
    return allTechnieken.filter(t => t.kyu_graden?.includes(targetKyu));
  }
  return allTechnieken.filter(t => t.kyu_graden?.some(k => parseInt(k) >= parseInt(targetKyu)));
}

function groepeerPerType(technieken) {
  const g = {};
  technieken.forEach(t => { const k = t.type || 'overig'; if (!g[k]) g[k] = []; g[k].push(t); });
  return g;
}

function bouwInitieleSecties(allTechnieken, targetBelt, isStreepje) {
  const doelKyu = getDoelKyu(targetBelt);
  const relevante = getRelevanteTechnieken(allTechnieken, targetBelt, !!isStreepje)
    .map(t => ({ ...t, isNieuw: isTechniekNieuw(t, doelKyu) }));
  const perType = groepeerPerType(relevante);
  return TYPE_VOLGORDE
    .filter(type => perType[type]?.length > 0)
    .concat(Object.keys(perType).filter(k => !TYPE_VOLGORDE.includes(k) && perType[k]?.length > 0))
    .map(type => ({
      categorie: type,
      categorieLabel: TYPE_LABELS[type] || type,
      aantalTeBevragen: Math.min(3, perType[type].length),
      beschikbaar: perType[type],
      aantalNieuw: perType[type].filter(t => t.isNieuw).length,
      technieken: [],
    }));
}

function selecteerWillekeurig(secties) {
  return secties.map(s => {
    if (s.aantalTeBevragen === 0 || !s.beschikbaar?.length) return { ...s, technieken: [] };
    const nieuws = s.beschikbaar.filter(t => t.isNieuw);
    const oud = s.beschikbaar.filter(t => !t.isNieuw);
    const shuffle = arr => [...arr].sort(() => Math.random() - 0.5);
    let sel = [];
    if (nieuws.length > 0 && s.aantalTeBevragen >= 1) {
      sel.push({ ...shuffle(nieuws)[0], score: null, notitie: '' });
      if (s.aantalTeBevragen > 1) {
        const overige = shuffle([...nieuws.slice(1), ...oud]);
        overige.slice(0, s.aantalTeBevragen - 1).forEach(t => sel.push({ ...t, score: null, notitie: '' }));
      }
    } else {
      shuffle(s.beschikbaar).slice(0, s.aantalTeBevragen).forEach(t => sel.push({ ...t, score: null, notitie: '' }));
    }
    return { ...s, technieken: sel.slice(0, s.aantalTeBevragen) };
  });
}

function berekenGemiddelde(secties) {
  const scores = (secties || []).flatMap(s => s.technieken || []).map(t => t.score).filter(s => s !== null && s !== undefined);
  if (!scores.length) return null;
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
}

function classifeerScore(gem, config) {
  if (gem === null || gem === undefined) return null;
  const c = { ...DEFAULT_EXAM_CONFIG, ...config };
  if (gem >= c.drempelUitstekend) return 'uitstekend';
  if (gem >= c.drempelGoed) return 'goed';
  return 'onvoldoende';
}

function getResultTekst(conclusie, config) {
  const c = { ...DEFAULT_EXAM_CONFIG, ...config };
  if (conclusie === 'uitstekend') return c.tekstUitstekend;
  if (conclusie === 'goed') return c.tekstGoed;
  return c.tekstOnvoldoende;
}

function alleGescored(secties) {
  if (!secties?.length) return false;
  const techs = secties.flatMap(s => s.technieken || []);
  return techs.length > 0 && techs.every(t => t.score !== null && t.score !== undefined);
}

function bouwFirestoreSecties(secties) {
  return secties
    .filter(s => s.aantalTeBevragen > 0 && s.technieken?.length > 0)
    .map(s => ({
      categorie: s.categorie,
      categorieLabel: s.categorieLabel,
      aantalTeBevragen: s.aantalTeBevragen,
      technieken: s.technieken.map(t => ({
        id: t.id || '',
        naam: t.techniek || t.naam || '',
        kyu: String(t.kyu_graden?.[0] || ''),
        isNieuw: !!t.isNieuw,
        score: t.score ?? null,
        notitie: t.notitie || '',
      })),
    }));
}

function herstelSecties(examSecties, allTechnieken, targetBelt, isStreepje) {
  const doelKyu = getDoelKyu(targetBelt);
  const relevante = getRelevanteTechnieken(allTechnieken, targetBelt, !!isStreepje)
    .map(t => ({ ...t, isNieuw: isTechniekNieuw(t, doelKyu) }));
  const perType = groepeerPerType(relevante);
  return examSecties.map(s => ({
    ...s,
    beschikbaar: (perType[s.categorie] || []),
    aantalNieuw: (perType[s.categorie] || []).filter(t => t.isNieuw).length,
  }));
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function BeltBadge({ belt, small }) {
  const cfg = BELT_COLORS[belt] || {};
  return (
    <span style={{ ...cfg, padding: small ? '2px 8px' : '4px 12px', borderRadius: 20, fontSize: small ? 11 : 13, fontWeight: 700, display: 'inline-block', whiteSpace: 'nowrap' }}>
      {BELT_LABELS[belt] || belt}
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

const RESULT_COLORS = { geslaagd: C.green, niet_geslaagd: C.red, afwezig: C.textMuted, pending: C.orange, geconfigureerd: C.blue, scorend: C.blue };
const RESULT_LABELS = { geslaagd: 'Geslaagd', niet_geslaagd: 'Niet geslaagd', afwezig: 'Afwezig', pending: 'Wacht op examen', geconfigureerd: 'Klaar om te starten', scorend: 'Bezig' };

function ResultChip({ result }) {
  const key = result || 'pending';
  const kleur = RESULT_COLORS[key] || C.textMuted;
  return (
    <span style={{ color: kleur, fontSize: 11, fontWeight: 700, background: kleur + '22', border: `1px solid ${kleur}44`, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' }}>
      {RESULT_LABELS[key] || key}
    </span>
  );
}

const CONCLUSIE_COLORS = { onvoldoende: C.red, goed: C.orange, uitstekend: C.green };
const CONCLUSIE_LABELS = { onvoldoende: 'Onvoldoende', goed: 'Goed', uitstekend: 'Uitstekend' };

// ─── Modals ───────────────────────────────────────────────────────────────────
function Modal({ onClose, children, maxWidth = 420 }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 16 }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: C.card, borderRadius: 20, padding: 24, width: '100%', maxWidth, maxHeight: '90vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, onClose }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
      <h3 style={{ margin: 0, fontSize: 17, color: C.textPrimary }}>{title}</h3>
      <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 20, padding: '2px 6px', lineHeight: 1 }}>✕</button>
    </div>
  );
}

function Lbl({ children }) {
  return <label style={{ display: 'block', color: C.textSec, fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{children}</label>;
}

function Inp(props) {
  return <input {...props} style={{ ...inputStyle, marginBottom: 12, ...props.style }} />;
}

function Sel({ children, ...props }) {
  return (
    <select {...props} style={{ ...inputStyle, marginBottom: 12, ...props.style }}>
      {children}
    </select>
  );
}

function NieuwExamenModal({ onClose, onSave }) {
  const [form, setForm] = useState({ naam: '', datum: '', locatie: '', examType: 'club' });
  const [saving, setSaving] = useState(false);

  async function opslaan() {
    if (!form.naam || !form.datum) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Nieuw examen" onClose={onClose} />
      <Lbl>Naam</Lbl>
      <Inp value={form.naam} onChange={e => setForm(f => ({ ...f, naam: e.target.value }))} placeholder="bv. Clubexamen april 2025" />
      <Lbl>Datum</Lbl>
      <Inp type="date" value={form.datum} onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} />
      <Lbl>Locatie (optioneel)</Lbl>
      <Inp value={form.locatie} onChange={e => setForm(f => ({ ...f, locatie: e.target.value }))} placeholder="bv. Sportzaal Kodokan" />
      <Lbl>Type</Lbl>
      <Sel value={form.examType} onChange={e => setForm(f => ({ ...f, examType: e.target.value }))}>
        <option value="club">Clubexamen</option>
        <option value="provinciaal">Provinciaal</option>
        <option value="nationaal">Nationaal</option>
      </Sel>
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button onClick={opslaan} disabled={saving || !form.naam || !form.datum} style={{ ...buttonStyle('primary'), flex: 1, opacity: (!form.naam || !form.datum) ? 0.5 : 1 }}>
          {saving ? 'Opslaan...' : '✓ Aanmaken'}
        </button>
        <button onClick={onClose} style={buttonStyle('ghost')}>Annuleren</button>
      </div>
    </Modal>
  );
}

function KandidaatToevoegenModal({ onClose, onSave, members, bestaandeLeden }) {
  const [zoek, setZoek] = useState('');
  const [memberId, setMemberId] = useState('');
  const [currentBelt, setCurrentBelt] = useState('wit');
  const [targetBelt, setTargetBelt] = useState('geel');
  const [doelType, setDoelType] = useState('gordel'); // 'gordel' | 'streepje'
  const [saving, setSaving] = useState(false);

  const filtered = members.filter(m => {
    if (!zoek) return true;
    return (m.naam || m.name || '').toLowerCase().includes(zoek.toLowerCase());
  });

  function selecteerLid(m) {
    setMemberId(m.id);
    const belt = m.gordel || m.belt || 'wit';
    setCurrentBelt(belt);
    setTargetBelt(BELT_NEXT[belt] || 'geel');
    setZoek(m.naam || m.name || '');
  }

  async function opslaan() {
    if (!memberId) return;
    setSaving(true);
    const m = members.find(x => x.id === memberId);
    await onSave({
      memberId,
      memberName: m?.naam || m?.name || '—',
      currentBelt,
      targetBelt,
      isStreepje: doelType === 'streepje',
      result: 'pending',
      examFase: 'nieuw',
      examSecties: [],
      createdAt: new Date().toISOString(),
    });
    setSaving(false);
  }

  const geselecteerdLid = members.find(m => m.id === memberId);

  return (
    <Modal onClose={onClose}>
      <ModalHeader title="Kandidaat toevoegen" onClose={onClose} />

      <Lbl>Zoek lid</Lbl>
      <Inp
        value={zoek}
        onChange={e => { setZoek(e.target.value); if (memberId && (geselecteerdLid?.naam || geselecteerdLid?.name) !== e.target.value) setMemberId(''); }}
        placeholder="Naam..."
      />

      {zoek && !memberId && filtered.length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.borderSoft}`, borderRadius: 10, marginBottom: 12, maxHeight: 200, overflowY: 'auto' }}>
          {filtered.slice(0, 20).map(m => (
            <button key={m.id} onClick={() => selecteerLid(m)}
              style={{ width: '100%', background: 'none', border: 'none', color: C.textPrimary, padding: '10px 14px', textAlign: 'left', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${C.borderSoft}` }}>
              <span style={{ fontSize: 14 }}>{m.naam || m.name}</span>
              <BeltBadge belt={m.gordel || m.belt || 'wit'} small />
            </button>
          ))}
        </div>
      )}

      {memberId && (
        <>
          <div style={{ background: C.surface, borderRadius: 10, padding: '10px 14px', marginBottom: 12, border: `1px solid ${C.green}44` }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.green, marginBottom: 4 }}>✓ Geselecteerd: {geselecteerdLid?.naam || geselecteerdLid?.name}</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <BeltBadge belt={currentBelt} small />
              <span style={{ color: C.textMuted }}>→</span>
              <BeltBadge belt={targetBelt} small />
            </div>
          </div>

          <Lbl>Doeltype</Lbl>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {[['gordel', '🥋 Volledige gordel'], ['streepje', '〰️ Streepje (tussenstap)']].map(([val, lbl]) => (
              <button key={val} onClick={() => setDoelType(val)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: `1px solid ${doelType === val ? C.red : C.borderSoft}`, background: doelType === val ? C.redDim : C.surface, color: doelType === val ? C.red : C.textSec, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                {lbl}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <Lbl>Huidige gordel</Lbl>
              <Sel value={currentBelt} onChange={e => { setCurrentBelt(e.target.value); setTargetBelt(BELT_NEXT[e.target.value] || 'geel'); }}>
                {BELTS.map(b => <option key={b} value={b}>{b}</option>)}
              </Sel>
            </div>
            <div>
              <Lbl>Doelgordel</Lbl>
              <Sel value={targetBelt} onChange={e => setTargetBelt(e.target.value)}>
                {BELTS.filter(b => b !== 'wit').map(b => <option key={b} value={b}>{b}</option>)}
              </Sel>
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button onClick={opslaan} disabled={saving || !memberId} style={{ ...buttonStyle('primary'), flex: 1, opacity: !memberId ? 0.5 : 1 }}>
          {saving ? 'Opslaan...' : '✓ Toevoegen'}
        </button>
        <button onClick={onClose} style={buttonStyle('ghost')}>Annuleren</button>
      </div>
    </Modal>
  );
}

// ─── Examen Wizard ────────────────────────────────────────────────────────────
function ExamenWizard({ kandidaat, eventId, examConfig, allTechnieken, onClose, isReadOnly }) {
  const [stap, setStap] = useState(1);
  const [secties, setSecties] = useState([]);
  const [selectieModus, setSelectieModus] = useState('random');
  const [manueelGeselecteerd, setManueelGeselecteerd] = useState({});
  const [huidigIndex, setHuidigIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [ladend, setLadend] = useState(true);

  const config = { ...DEFAULT_EXAM_CONFIG, ...(examConfig || {}) };

  // Initialize wizard state from kandidaat + allTechnieken
  useEffect(() => {
    if (!kandidaat || !allTechnieken.length) return;
    setLadend(true);

    if (kandidaat.examSecties?.length > 0) {
      const hersteld = herstelSecties(kandidaat.examSecties, allTechnieken, kandidaat.targetBelt, kandidaat.isStreepje);
      setSecties(hersteld);
      if (alleGescored(hersteld) || isReadOnly) {
        setStap(4);
      } else {
        const allTechs = hersteld.flatMap(s => s.technieken || []);
        const firstIdx = allTechs.findIndex(t => t.score === null || t.score === undefined);
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

  // Flat list for step 3
  const allTechs = secties.flatMap(s => (s.technieken || []).map(t => ({ ...t, sectieLabel: s.categorieLabel })));
  const currentTech = allTechs[huidigIndex];

  function setCurrentScore(score) {
    const techInSectie = (idx) => {
      let n = 0;
      for (const s of secties) {
        for (let j = 0; j < s.technieken.length; j++) {
          if (n === idx) return [s.categorie, j];
          n++;
        }
      }
      return null;
    };
    const pos = techInSectie(huidigIndex);
    if (!pos) return;
    setSecties(prev => prev.map(s => s.categorie !== pos[0] ? s : {
      ...s,
      technieken: s.technieken.map((t, i) => i !== pos[1] ? t : { ...t, score }),
    }));
  }

  function setCurrentNotitie(notitie) {
    let n = 0;
    const newSecties = secties.map(s => ({
      ...s,
      technieken: s.technieken.map(t => {
        if (n === huidigIndex) { n++; return { ...t, notitie }; }
        n++; return t;
      }),
    }));
    setSecties(newSecties);
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
    const updated = secties;
    if (huidigIndex === allTechs.length - 1) {
      await slaScoresOp(updated);
      setStap(4);
    } else {
      setHuidigIndex(i => i + 1);
      if ((huidigIndex + 1) % 3 === 0) await slaScoresOp(updated); // save every 3
    }
  }

  async function bevestigSelectie(selectedSecties) {
    setSaving(true);
    const fireSecties = bouwFirestoreSecties(selectedSecties);
    await updateRegistration(eventId, kandidaat.id, {
      examSecties: fireSecties,
      examFase: 'geconfigureerd',
      updatedAt: new Date().toISOString(),
    });
    const hersteld = herstelSecties(fireSecties, allTechnieken, kandidaat.targetBelt, kandidaat.isStreepje);
    setSecties(hersteld);
    setHuidigIndex(0);
    setSaving(false);
    setStap(3);
  }

  async function slaResultaatOp(result) {
    setSaving(true);
    const gem = berekenGemiddelde(secties);
    const conclusie = classifeerScore(gem, config);
    const tekst = getResultTekst(conclusie, config);
    const fireSecties = bouwFirestoreSecties(secties);

    await updateRegistration(eventId, kandidaat.id, {
      result,
      eindScore: gem,
      eindConclusie: result === 'afwezig' ? null : conclusie,
      eindTekst: result === 'afwezig' ? null : tekst,
      examSecties: fireSecties,
      examFase: 'afgerond',
      updatedAt: new Date().toISOString(),
    });

    if (result === 'geslaagd' && !kandidaat.isStreepje && kandidaat.memberId) {
      await updateMember(kandidaat.memberId, { gordel: kandidaat.targetBelt });
      stuurPushTrigger(PUSH_TYPES.GRAAD_TOEGEKEND, {
        uid: kandidaat.uid || '',
        memberId: kandidaat.memberId || '',
        judokaNaam: kandidaat.memberName || '',
        gordel: kandidaat.targetBelt || '',
      });
    }
    setSaving(false);
    onClose();
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const hasSecties = secties.filter(s => s.aantalTeBevragen > 0).length > 0;
  const gem = berekenGemiddelde(secties);
  const conclusie = classifeerScore(gem, config);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', zIndex: 300, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.borderSoft}`, padding: '12px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.textPrimary }}>
              {kandidaat.memberName}
              {kandidaat.isStreepje && <span style={{ marginLeft: 8, fontSize: 11, color: C.orange, fontWeight: 700, background: C.orangeDim, borderRadius: 6, padding: '2px 6px' }}>STREEPJE</span>}
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 }}>
              <BeltBadge belt={kandidaat.currentBelt} small />
              <span style={{ color: C.textMuted, fontSize: 12 }}>→</span>
              <BeltBadge belt={kandidaat.targetBelt} small />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!isReadOnly && (
              <div style={{ display: 'flex', gap: 4 }}>
                {[1, 2, 3, 4].map(s => (
                  <div key={s} style={{ width: 8, height: 8, borderRadius: '50%', background: s <= stap ? C.red : C.borderSoft }} />
                ))}
              </div>
            )}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 22, padding: '2px 4px', lineHeight: 1 }}>✕</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {ladend ? (
          <div style={{ textAlign: 'center', padding: 40, color: C.textSec }}>Laden...</div>
        ) : (
          <>
            {/* STAP 1: Sectie configuratie */}
            {stap === 1 && (
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: 16, color: C.textPrimary }}>Stap 1 — Technieken per sectie</h3>
                <p style={{ margin: '0 0 20px', color: C.textSec, fontSize: 13 }}>
                  Hoeveel technieken wil je per sectie bevragen?
                  {kandidaat.isStreepje
                    ? ' Enkel nieuwe technieken voor dit niveau worden getoond.'
                    : ' Zowel nieuwe als reeds gekende technieken zijn beschikbaar.'}
                </p>

                {secties.length === 0 && (
                  <div style={{ textAlign: 'center', padding: 32, color: C.textMuted, background: C.surface, borderRadius: 12 }}>
                    Geen technieken gevonden voor deze gordel. Controleer of de techniekdatabank gevuld is.
                  </div>
                )}

                {secties.map((s, i) => (
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
                        <button onClick={() => setSecties(prev => prev.map((x, j) => j !== i ? x : { ...x, aantalTeBevragen: Math.max(0, x.aantalTeBevragen - 1) }))}
                          style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.borderSoft}`, background: C.card, color: C.textPrimary, cursor: 'pointer', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                        <span style={{ fontSize: 18, fontWeight: 800, minWidth: 24, textAlign: 'center', color: s.aantalTeBevragen > 0 ? C.textPrimary : C.textMuted }}>
                          {s.aantalTeBevragen}
                        </span>
                        <button onClick={() => setSecties(prev => prev.map((x, j) => j !== i ? x : { ...x, aantalTeBevragen: Math.min(x.beschikbaar.length, x.aantalTeBevragen + 1) }))}
                          style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${C.borderSoft}`, background: C.card, color: C.textPrimary, cursor: 'pointer', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* STAP 2: Techniek selectie */}
            {stap === 2 && (
              <div>
                <h3 style={{ margin: '0 0 6px', fontSize: 16, color: C.textPrimary }}>Stap 2 — Technieken selecteren</h3>
                <p style={{ margin: '0 0 16px', color: C.textSec, fontSize: 13 }}>
                  Kies hoe de technieken worden geselecteerd.
                </p>

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
                    <div style={{ background: C.surface, borderRadius: 12, padding: '12px 16px', marginBottom: 12 }}>
                      <div style={{ fontSize: 13, color: C.textSec, lineHeight: 1.5 }}>
                        Technieken worden willekeurig gekozen op basis van jouw configuratie.
                        Per sectie met nieuwe technieken wordt minstens 1 nieuwe techniek geselecteerd.
                      </div>
                    </div>
                    {secties.filter(s => s.aantalTeBevragen > 0).map(s => (
                      <div key={s.categorie} style={{ background: C.surface, border: `1px solid ${C.borderSoft}`, borderRadius: 10, padding: '10px 14px', marginBottom: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>{s.categorieLabel}</div>
                        <div style={{ fontSize: 12, color: C.textMuted }}>
                          {s.aantalTeBevragen} van {s.beschikbaar.length} techniek{s.aantalTeBevragen !== 1 ? 'en' : ''} geselecteerd
                          {s.aantalNieuw > 0 && <span style={{ color: C.green }}> · min. 1 nieuwe</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {selectieModus === 'manueel' && (
                  <div>
                    {secties.filter(s => s.aantalTeBevragen > 0).map(s => {
                      const ges = manueelGeselecteerd[s.categorie] || new Set();
                      const volledig = ges.size === s.aantalTeBevragen;
                      return (
                        <div key={s.categorie} style={{ marginBottom: 16 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 14 }}>{s.categorieLabel}</span>
                            <span style={{ fontSize: 12, color: volledig ? C.green : C.orange, fontWeight: 600 }}>
                              {ges.size}/{s.aantalTeBevragen} geselecteerd
                            </span>
                          </div>
                          {s.beschikbaar.map(t => {
                            const isGes = ges.has(t.id);
                            const isDisabled = !isGes && ges.size >= s.aantalTeBevragen;
                            return (
                              <button key={t.id}
                                disabled={isDisabled}
                                onClick={() => {
                                  setManueelGeselecteerd(prev => {
                                    const set = new Set(prev[s.categorie] || []);
                                    if (set.has(t.id)) set.delete(t.id); else if (set.size < s.aantalTeBevragen) set.add(t.id);
                                    return { ...prev, [s.categorie]: set };
                                  });
                                }}
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
              </div>
            )}

            {/* STAP 3: Scoren */}
            {stap === 3 && (
              <div>
                {allTechs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 40, color: C.textMuted }}>Geen technieken geconfigureerd.</div>
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <span style={{ fontSize: 13, color: C.textMuted }}>{currentTech?.sectieLabel}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.textSec }}>{huidigIndex + 1}/{allTechs.length}</span>
                    </div>

                    <div style={{ textAlign: 'center', marginBottom: 20 }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: C.textPrimary, marginBottom: 8 }}>
                        {currentTech?.naam}
                      </div>
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
                      <div style={{ textAlign: 'center', marginBottom: 12 }}>
                        {currentTech?.score !== null && currentTech?.score !== undefined ? (
                          <div style={{ fontSize: 56, fontWeight: 900, color: currentTech.score >= 8 ? C.green : currentTech.score >= 5 ? C.orange : C.red, lineHeight: 1 }}>
                            {currentTech.score}
                          </div>
                        ) : (
                          <div style={{ fontSize: 40, fontWeight: 700, color: C.textMuted, lineHeight: 1 }}>—</div>
                        )}
                        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>score op 10</div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                          <button key={s} onClick={() => setCurrentScore(s)}
                            style={{ padding: '14px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 16,
                              background: currentTech?.score === s ? (s >= 8 ? C.green : s >= 5 ? C.orange : C.red) : C.surface,
                              color: currentTech?.score === s ? '#fff' : C.textSec,
                              gridColumn: s === 10 ? 'span 4' : 'span 1',
                            }}>
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Notitie */}
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ display: 'block', fontSize: 12, color: C.textSec, fontWeight: 600, marginBottom: 6 }}>Notitie (optioneel)</label>
                      <textarea
                        value={currentTech?.notitie || ''}
                        onChange={e => setCurrentNotitie(e.target.value)}
                        placeholder="Opmerkingen voor de trainer..."
                        style={{ ...inputStyle, minHeight: 70, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* STAP 4: Afronding */}
            {stap === 4 && (
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: 16, color: C.textPrimary }}>
                  {isReadOnly ? 'Examenresultaat' : 'Stap 4 — Afronding'}
                </h3>
                {!isReadOnly && <p style={{ margin: '0 0 20px', color: C.textSec, fontSize: 13 }}>Controleer de scores en sla het resultaat op.</p>}

                {/* Score overzicht */}
                {secties.map(s => (s.technieken?.length > 0 ? (
                  <div key={s.categorie} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: C.textMuted, marginBottom: 8 }}>{s.categorieLabel}</div>
                    {s.technieken.map((t, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${C.borderSoft}` }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 13, color: C.textPrimary }}>{t.naam}</span>
                          {t.isNieuw && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: C.green, background: C.greenDim, borderRadius: 4, padding: '1px 5px' }}>NIEUW</span>}
                          {t.notitie && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2, fontStyle: 'italic' }}>{t.notitie}</div>}
                        </div>
                        <ScoreBadge score={t.score} />
                      </div>
                    ))}
                  </div>
                ) : null))}

                {/* Eindresultaat */}
                {gem !== null && (
                  <div style={{ background: C.surface, borderRadius: 14, padding: '16px', marginTop: 12, marginBottom: 12, border: `1px solid ${C.borderSoft}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 14, color: C.textSec, fontWeight: 600 }}>Gemiddelde score</span>
                      <span style={{ fontSize: 22, fontWeight: 900, color: CONCLUSIE_COLORS[conclusie] || C.textPrimary }}>{gem}/10</span>
                    </div>
                    {conclusie && (
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                        <span style={{ background: (CONCLUSIE_COLORS[conclusie] || C.textPrimary) + '22', color: CONCLUSIE_COLORS[conclusie] || C.textPrimary, border: `1px solid ${(CONCLUSIE_COLORS[conclusie] || C.textPrimary) + '44'}`, padding: '6px 18px', borderRadius: 20, fontWeight: 800, fontSize: 14 }}>
                          {CONCLUSIE_LABELS[conclusie]}
                        </span>
                      </div>
                    )}
                    <div style={{ background: C.card, borderRadius: 10, padding: '12px 14px', fontSize: 13, color: C.textSec, lineHeight: 1.6, fontStyle: 'italic' }}>
                      {getResultTekst(conclusie, config)}
                    </div>
                  </div>
                )}

                {/* Resultaat afgerond (read-only) */}
                {(kandidaat.result === 'geslaagd' || kandidaat.result === 'niet_geslaagd' || kandidaat.result === 'afwezig') && (
                  <div style={{ marginTop: 8, padding: '12px 16px', background: (RESULT_COLORS[kandidaat.result] + '22'), border: `1px solid ${RESULT_COLORS[kandidaat.result] + '44'}`, borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{kandidaat.result === 'geslaagd' ? '🏆' : kandidaat.result === 'afwezig' ? '—' : '✗'}</span>
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

      {/* Footer buttons */}
      {!ladend && !isReadOnly && (
        <div style={{ background: C.card, borderTop: `1px solid ${C.borderSoft}`, padding: '12px 16px', flexShrink: 0 }}>
          {stap === 1 && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{ ...buttonStyle('ghost'), flex: 0 }}>Annuleren</button>
              <button
                disabled={!hasSecties}
                onClick={() => setStap(2)}
                style={{ ...buttonStyle('primary'), flex: 1, opacity: hasSecties ? 1 : 0.4 }}>
                Volgende →
              </button>
            </div>
          )}

          {stap === 2 && (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStap(1)} style={{ ...buttonStyle('ghost'), flex: 0 }}>← Terug</button>
              <button
                disabled={saving || (selectieModus === 'manueel' && secties.filter(s => s.aantalTeBevragen > 0).some(s => (manueelGeselecteerd[s.categorie]?.size || 0) !== s.aantalTeBevragen))}
                onClick={async () => {
                  setSaving(true);
                  let selectedSecties;
                  if (selectieModus === 'random') {
                    selectedSecties = selecteerWillekeurig(secties);
                  } else {
                    selectedSecties = secties.map(s => {
                      if (s.aantalTeBevragen === 0) return { ...s, technieken: [] };
                      const ids = manueelGeselecteerd[s.categorie] || new Set();
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
                <button onClick={() => setHuidigIndex(i => i - 1)} style={{ ...buttonStyle('ghost'), flex: 0 }}>← Vorige</button>
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
                  style={{ padding: '13px', borderRadius: 10, border: 'none', background: C.green, color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>
                  🏆 Geslaagd
                </button>
                <button disabled={saving} onClick={() => slaResultaatOp('niet_geslaagd')}
                  style={{ padding: '13px', borderRadius: 10, border: 'none', background: C.red, color: '#fff', cursor: 'pointer', fontWeight: 800, fontSize: 13 }}>
                  ✗ Niet geslaagd
                </button>
              </div>
              <button disabled={saving} onClick={() => slaResultaatOp('afwezig')}
                style={{ width: '100%', padding: '11px', borderRadius: 10, border: `1px solid ${C.borderSoft}`, background: C.surface, color: C.textSec, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                — Afwezig
              </button>
            </div>
          )}

          {stap === 4 && kandidaat.result !== 'pending' && (
            <button onClick={onClose} style={{ ...buttonStyle('subtle'), width: '100%' }}>Sluiten</button>
          )}
        </div>
      )}

      {!ladend && isReadOnly && (
        <div style={{ background: C.card, borderTop: `1px solid ${C.borderSoft}`, padding: '12px 16px', flexShrink: 0 }}>
          <button onClick={onClose} style={{ ...buttonStyle('subtle'), width: '100%' }}>Sluiten</button>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function Examens() {
  const navigate = useNavigate();
  const { id: detailId } = useParams();
  const { isTrainer, isBeheerder, role } = useAuth();
  const kanBeheren = isTrainer || isBeheerder;

  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [members, setMembers] = useState([]);
  const [allTechnieken, setAllTechnieken] = useState([]);
  const [examConfig, setExamConfig] = useState(null);
  const [tab, setTab] = useState('kandidaten');
  const [showNieuwExamen, setShowNieuwExamen] = useState(false);
  const [showAddKandidaat, setShowAddKandidaat] = useState(false);
  const [wizard, setWizard] = useState(null); // {kandidaat, readOnly}
  const [uploading, setUploading] = useState(false);

  // Load events + members + technieken + config
  useEffect(() => {
    const unsub = subscribeEvents(all => {
      const examens = all.filter(e => e.type === 'examen').sort((a, b) => (b.datum || b.date || '').localeCompare(a.datum || a.date || ''));
      setEvents(examens);
    });
    getMembers().then(setMembers);
    getAllTechnieken().then(setAllTechnieken);
    getExamenConfig().then(cfg => setExamConfig(cfg));
    return unsub;
  }, []);

  // Load candidates/docs for selected event
  useEffect(() => {
    if (!selected) { setCandidates([]); setDocuments([]); return; }
    const u1 = subscribeEventRegistrations(selected.id, setCandidates);
    const u2 = subscribeEventDocuments(selected.id, setDocuments);
    return () => { u1(); u2(); };
  }, [selected?.id]);

  async function handleNieuwExamen(form) {
    const r = await addEvent({
      naam: form.naam, datum: form.datum, locatie: form.locatie, examType: form.examType, type: 'examen',
    });
    const nieuw = { id: r.id, naam: form.naam, datum: form.datum, locatie: form.locatie, examType: form.examType, type: 'examen' };
    setSelected(nieuw);
    setShowNieuwExamen(false);
    stuurPushTrigger(PUSH_TYPES.EXAMEN_GEPLAND, { naam: form.naam, datum: form.datum, locatie: form.locatie || '' });
  }

  async function handleAddKandidaat(data) {
    await addRegistration(selected.id, data);
    stuurPushTrigger(PUSH_TYPES.UITGENODIGD_EXAMEN, {
      uid: '', memberId: data.memberId,
      judokaNaam: data.memberName, examenNaam: selected.naam || '', datum: selected.datum || '',
    });
    setShowAddKandidaat(false);
  }

  async function markeerAfwezig(kandidaat) {
    await updateRegistration(selected.id, kandidaat.id, { result: 'afwezig', examFase: 'afgerond', updatedAt: new Date().toISOString() });
  }

  async function verwijderKandidaat(kandidaat) {
    if (!window.confirm(`Wil je ${kandidaat.memberName} verwijderen uit dit examen?`)) return;
    await deleteRegistration(selected.id, kandidaat.id);
  }

  async function uploadDoc(e) {
    const file = e.target.files[0];
    if (!file || !selected) return;
    setUploading(true);
    const storageRef = ref(storage, `events/${selected.id}/docs/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);
    task.on('state_changed', null, console.error, async () => {
      const url = await getDownloadURL(task.snapshot.ref);
      await addEventDocument(selected.id, { title: file.name, url, uploadedAt: new Date().toISOString() });
      setUploading(false);
    });
  }

  // Stats
  const stats = {
    totaal: candidates.length,
    geslaagd: candidates.filter(c => c.result === 'geslaagd').length,
    niet: candidates.filter(c => c.result === 'niet_geslaagd').length,
    afwezig: candidates.filter(c => c.result === 'afwezig').length,
    bezig: candidates.filter(c => ['geconfigureerd', 'scorend'].includes(c.examFase) && c.result === 'pending').length,
  };

  function getExamFaseLabel(kandidaat) {
    if (kandidaat.result !== 'pending') return kandidaat.result;
    if (kandidaat.examFase === 'geconfigureerd' || kandidaat.examFase === 'scorend') return kandidaat.examFase;
    return 'pending';
  }

  const bestaandeLeden = candidates.map(c => c.memberId).filter(Boolean);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: 'var(--space-4)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>📘 Examens</div>
        {kanBeheren && (
          <button onClick={() => setShowNieuwExamen(true)} style={{ ...buttonStyle('primary'), padding: '10px 16px' }}>
            + Nieuw examen
          </button>
        )}
      </div>

      {/* Event selector / list */}
      {!selected ? (
        <>
          {events.length === 0 ? (
            <div style={{ ...cardStyle(), padding: 40, textAlign: 'center', color: C.textMuted }}>
              {kanBeheren ? 'Nog geen examens. Maak een nieuw examen aan.' : 'Geen examens gepland.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {events.map(ev => {
                const datum = ev.datum || ev.date || '';
                return (
                  <button key={ev.id} onClick={() => setSelected(ev)}
                    style={{ ...cardStyle(), width: '100%', textAlign: 'left', cursor: 'pointer', border: `1px solid ${C.borderSoft}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: C.textPrimary, marginBottom: 4 }}>{ev.naam || ev.name}</div>
                      <div style={{ fontSize: 13, color: C.textSec }}>
                        {datum && new Date(datum).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' })}
                        {ev.locatie && <span style={{ marginLeft: 8 }}>· {ev.locatie}</span>}
                        {ev.examType && <span style={{ marginLeft: 8, fontSize: 11, color: C.textMuted, background: C.surface, borderRadius: 6, padding: '1px 6px', border: `1px solid ${C.borderSoft}` }}>{ev.examType}</span>}
                      </div>
                    </div>
                    <div style={{ color: C.textMuted, fontSize: 20 }}>›</div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Event detail */}
          <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: C.textSec, cursor: 'pointer', fontSize: 13, padding: '0 0 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
            ← Alle examens
          </button>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: C.textPrimary }}>{selected.naam || selected.name}</div>
            <div style={{ fontSize: 13, color: C.textSec, marginTop: 4 }}>
              {(selected.datum || selected.date) && new Date(selected.datum || selected.date).toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              {selected.locatie && <span style={{ marginLeft: 8 }}>· {selected.locatie}</span>}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
            {[
              ['Kandidaten', stats.totaal, C.blue],
              ['Geslaagd', stats.geslaagd, C.green],
              ['Niet geslaagd', stats.niet, C.red],
              ['Afwezig', stats.afwezig, C.textMuted],
            ].map(([l, v, c]) => (
              <div key={l} style={{ background: C.card, borderRadius: 10, padding: '10px 8px', borderLeft: `3px solid ${c}`, textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: c }}>{v}</div>
                <div style={{ color: C.textSec, fontSize: 10, marginTop: 2, lineHeight: 1.2 }}>{l}</div>
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
                <button onClick={() => setShowAddKandidaat(true)} style={{ ...buttonStyle('primary'), width: '100%', marginBottom: 12 }}>
                  + Kandidaat toevoegen
                </button>
              )}

              {candidates.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 32, color: C.textMuted, background: C.card, borderRadius: 12 }}>
                  Geen kandidaten. {kanBeheren ? 'Voeg een kandidaat toe.' : ''}
                </div>
              ) : (
                candidates.map(k => {
                  const faseStatus = getExamFaseLabel(k);
                  const isAfgerond = ['geslaagd', 'niet_geslaagd', 'afwezig'].includes(k.result);
                  const hasScores = k.examSecties?.some(s => s.technieken?.some(t => t.score !== null && t.score !== undefined));

                  return (
                    <div key={k.id} style={{ background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: 12, padding: '14px 16px', marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 15, color: C.textPrimary, marginBottom: 4 }}>
                            {k.memberName}
                            {k.isStreepje && <span style={{ marginLeft: 6, fontSize: 10, color: C.orange, fontWeight: 700, background: C.orangeDim, borderRadius: 6, padding: '1px 5px' }}>streepje</span>}
                          </div>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                            <BeltBadge belt={k.currentBelt} small />
                            <span style={{ color: C.textMuted, fontSize: 12 }}>→</span>
                            <BeltBadge belt={k.targetBelt} small />
                          </div>
                        </div>
                        <ResultChip result={faseStatus} />
                      </div>

                      {/* Scores summary (alleen voor trainers) */}
                      {kanBeheren && isAfgerond && k.eindScore !== null && k.eindScore !== undefined && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, padding: '8px 10px', background: C.surface, borderRadius: 8 }}>
                          <span style={{ fontSize: 12, color: C.textSec }}>Score:</span>
                          <ScoreBadge score={k.eindScore} />
                          {k.eindConclusie && (
                            <span style={{ fontSize: 11, fontWeight: 700, color: CONCLUSIE_COLORS[k.eindConclusie], background: (CONCLUSIE_COLORS[k.eindConclusie] + '22'), borderRadius: 6, padding: '1px 7px' }}>
                              {CONCLUSIE_LABELS[k.eindConclusie]}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actieknoppen */}
                      {kanBeheren && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {!isAfgerond && (
                            <>
                              <button onClick={() => setWizard({ kandidaat: k, readOnly: false })}
                                style={{ ...buttonStyle('primary'), padding: '7px 12px', fontSize: 12, minHeight: 'auto' }}>
                                {k.examFase === 'nieuw' || !k.examFase ? '▶ Examen starten' : '▶ Verdergaan'}
                              </button>
                              <button onClick={() => markeerAfwezig(k)}
                                style={{ ...buttonStyle('ghost'), padding: '7px 12px', fontSize: 12, minHeight: 'auto' }}>
                                — Afwezig
                              </button>
                            </>
                          )}
                          {(isAfgerond || hasScores) && (
                            <button onClick={() => setWizard({ kandidaat: k, readOnly: true })}
                              style={{ ...buttonStyle('accent'), padding: '7px 12px', fontSize: 12, minHeight: 'auto' }}>
                              Scores bekijken
                            </button>
                          )}
                          {k.result === 'pending' && (
                            <button onClick={() => verwijderKandidaat(k)}
                              style={{ ...buttonStyle('danger'), padding: '7px 12px', fontSize: 12, minHeight: 'auto' }}>
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
                <label style={{ display: 'block', ...buttonStyle('primary'), width: '100%', textAlign: 'center', marginBottom: 12, cursor: 'pointer' }}>
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
        </>
      )}

      {/* Modals */}
      {showNieuwExamen && (
        <NieuwExamenModal onClose={() => setShowNieuwExamen(false)} onSave={handleNieuwExamen} />
      )}
      {showAddKandidaat && selected && (
        <KandidaatToevoegenModal
          onClose={() => setShowAddKandidaat(false)}
          onSave={handleAddKandidaat}
          members={members}
          bestaandeLeden={bestaandeLeden}
        />
      )}

      {/* Examen Wizard */}
      {wizard && (
        <ExamenWizard
          kandidaat={wizard.kandidaat}
          eventId={selected?.id}
          examConfig={examConfig}
          allTechnieken={allTechnieken}
          onClose={() => setWizard(null)}
          isReadOnly={wizard.readOnly}
        />
      )}

      {/* Legacy detail panel for /examens/:id routes */}
      {detailId && (
        <ExamenDetailPanel eventId={detailId} onClose={() => navigate('/examens')} />
      )}
    </div>
  );
}
