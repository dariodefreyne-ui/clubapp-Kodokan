/**
 * Trainingen.jsx – Weekly training schedule for Kodokan Clubapp
 *
 * - Hardcoded weekly schedule (woensdag + zaterdag)
 * - Highlights training currently in progress
 * - Click a training card → detail panel with Firestore member list for that group
 * - "Aanwezigheid registreren" navigates to /leden with group pre-filtered
 * - Trainer overview at bottom
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';

// ─── Design tokens ───────────────────────────────────────────────────────────
const C = {
  bg:          '#1a1a1a',
  card:        '#2d2d2d',
  cardHover:   '#333333',
  border:      '#3a3a3a',
  borderRed:   '#c0392b',
  red:         '#c0392b',
  redDim:      'rgba(192,57,43,0.15)',
  textPrimary: '#ffffff',
  textSec:     '#aaaaaa',
  textMuted:   '#666666',
  green:       '#27ae60',
  greenDim:    'rgba(39,174,96,0.15)',
};

// ─── Schedule data ────────────────────────────────────────────────────────────
const SCHEDULE = [
  {
    day: 'Woensdag',
    dayKey: 3, // JS getDay() – 0=Sun
    trainings: [
      { id: 'wo-g1', group: 'Groep 1',    start: '16:30', end: '17:30', trainers: ['Liesbeth'] },
      { id: 'wo-g2', group: 'Groep 2',    start: '17:30', end: '18:30', trainers: ['Stef'] },
      { id: 'wo-g3', group: 'Groep 3',    start: '18:30', end: '20:00', trainers: ['Eddy', 'Luc', 'Dario'] },
      { id: 'wo-g4', group: 'Groep 4',    start: '20:00', end: '21:30', trainers: ['Beurtrol'] },
    ],
  },
  {
    day: 'Zaterdag',
    dayKey: 6,
    trainings: [
      { id: 'za-g1',   group: 'Groep 1',      start: '13:30', end: '14:30', trainers: ['Jo', 'Liesbeth'] },
      { id: 'za-g23',  group: 'Groep 2 & 3',  start: '14:30', end: '16:00', trainers: ['Carl', 'Mathias'] },
      { id: 'za-comp', group: 'Competitie',    start: '16:00', end: '18:00', trainers: ['Sofie'] },
      { id: 'za-kata', group: 'Kata',          start: '16:30', end: '18:00', trainers: ['Dirk'] },
    ],
  },
];

// Collect unique trainers with their groups
function buildTrainerList() {
  const map = {};
  SCHEDULE.forEach(({ day, trainings }) => {
    trainings.forEach(({ group, trainers }) => {
      trainers.forEach((name) => {
        if (name === 'Beurtrol') return;
        if (!map[name]) map[name] = [];
        map[name].push(`${day} ${group}`);
      });
    });
  });
  return Object.entries(map).map(([name, groups]) => ({ name, groups }));
}

const TRAINERS = buildTrainerList();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function isNowActive(training) {
  const now = new Date();
  const currentDay = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Find which day block this training belongs to
  for (const block of SCHEDULE) {
    if (block.trainings.some((t) => t.id === training.id)) {
      if (block.dayKey !== currentDay) return false;
      const start = timeToMinutes(training.start);
      const end = timeToMinutes(training.end);
      return currentMinutes >= start && currentMinutes < end;
    }
  }
  return false;
}

// Map "Groep 2 & 3" → ["Groep 2", "Groep 3"] for Firestore where queries
function groupsForQuery(groupLabel) {
  if (groupLabel.includes('&')) {
    return groupLabel.split('&').map((g) => g.trim());
  }
  return [groupLabel];
}

// ─── TrainingCard ─────────────────────────────────────────────────────────────
function TrainingCard({ training, isActive, isSelected, onClick }) {
  const [hovered, setHovered] = useState(false);

  const borderColor = isActive
    ? C.green
    : isSelected
    ? C.red
    : hovered
    ? C.borderRed
    : C.border;

  const bg = isActive
    ? C.greenDim
    : isSelected
    ? C.redDim
    : hovered
    ? C.cardHover
    : C.card;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'flex-start',
        gap:            '6px',
        width:          '100%',
        padding:        '14px 16px',
        background:     bg,
        border:         `1.5px solid ${borderColor}`,
        borderRadius:   '12px',
        cursor:         'pointer',
        textAlign:      'left',
        transition:     'background 0.18s, border-color 0.18s',
        fontFamily:     'inherit',
        outline:        'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
        <span style={{
          fontSize:   '15px',
          fontWeight: '700',
          color:      C.textPrimary,
          flex:       1,
        }}>
          {training.group}
        </span>
        {isActive && (
          <span style={{
            fontSize:     '11px',
            fontWeight:   '700',
            color:        C.green,
            background:   C.greenDim,
            border:       `1px solid ${C.green}`,
            borderRadius: '999px',
            padding:      '2px 8px',
            textTransform:'uppercase',
            letterSpacing:'0.5px',
          }}>
            Nu bezig
          </span>
        )}
      </div>
      <span style={{ fontSize: '13px', color: C.textSec }}>
        {training.start} – {training.end}
      </span>
      <span style={{ fontSize: '12px', color: C.textMuted }}>
        {training.trainers.join(', ')}
      </span>
    </button>
  );
}

// ─── DetailPanel ──────────────────────────────────────────────────────────────
function DetailPanel({ training, onClose }) {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!training) return;
    setLoading(true);
    const targets = groupsForQuery(training.group);

    (async () => {
      try {
        // Fetch members for each group and merge
        const results = await Promise.all(
          targets.map(async (grp) => {
            const q = query(
              collection(db, 'members'),
              where('groepen', 'array-contains', grp),
              where('actief', '!=', false),
              orderBy('actief'),
              orderBy('naam'),
            );
            const snap = await getDocs(q);
            return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          })
        );
        // Deduplicate by id
        const seen = new Set();
        const merged = results.flat().filter((m) => {
          if (seen.has(m.id)) return false;
          seen.add(m.id);
          return true;
        });
        merged.sort((a, b) => (a.naam || '').localeCompare(b.naam || ''));
        setMembers(merged);
      } catch (err) {
        console.error('Error fetching members for group:', err);
        setMembers([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [training]);

  if (!training) return null;

  const handleAanwezigheid = () => {
    const groups = groupsForQuery(training.group);
    navigate(`/leden?groep=${encodeURIComponent(groups[0])}`);
  };

  return (
    <div style={{
      background:   C.card,
      border:       `1px solid ${C.border}`,
      borderRadius: '14px',
      padding:      '20px',
      display:      'flex',
      flexDirection:'column',
      gap:          '16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: '700', color: C.textPrimary }}>
            {training.group}
          </h2>
          <p style={{ margin: 0, fontSize: '14px', color: C.textSec }}>
            {training.start} – {training.end} &nbsp;·&nbsp; {training.trainers.join(', ')}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background:   'transparent',
            border:       `1px solid ${C.border}`,
            borderRadius: '8px',
            color:        C.textSec,
            fontSize:     '18px',
            cursor:       'pointer',
            padding:      '4px 10px',
            lineHeight:   '1',
            fontFamily:   'inherit',
          }}
        >
          ✕
        </button>
      </div>

      {/* Action button */}
      <button
        onClick={handleAanwezigheid}
        style={{
          padding:      '12px 16px',
          background:   C.red,
          border:       'none',
          borderRadius: '10px',
          color:        '#fff',
          fontSize:     '14px',
          fontWeight:   '700',
          cursor:       'pointer',
          fontFamily:   'inherit',
          width:        '100%',
          textAlign:    'center',
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = '#a93226'; }}
        onMouseOut={(e)  => { e.currentTarget.style.background = C.red; }}
      >
        Aanwezigheid registreren
      </button>

      {/* Member list */}
      <div>
        <p style={{
          margin:        '0 0 10px',
          fontSize:      '11px',
          fontWeight:    '700',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          color:         C.textMuted,
        }}>
          Leden in deze groep
        </p>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 0' }}>
            <div style={{
              width: '28px', height: '28px',
              border: `2px solid ${C.border}`,
              borderTop: `2px solid ${C.red}`,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : members.length === 0 ? (
          <p style={{ color: C.textMuted, fontSize: '14px', margin: 0 }}>
            Geen leden gevonden voor deze groep.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {members.map((m) => (
              <div key={m.id} style={{
                display:      'flex',
                alignItems:   'center',
                gap:          '10px',
                padding:      '10px 12px',
                background:   '#1a1a1a',
                borderRadius: '8px',
                border:       `1px solid ${C.border}`,
              }}>
                <span style={{
                  width:          '30px',
                  height:         '30px',
                  borderRadius:   '50%',
                  background:     C.redDim,
                  border:         `1px solid ${C.red}`,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  fontSize:       '13px',
                  fontWeight:     '700',
                  color:          C.red,
                  flexShrink:     0,
                }}>
                  {(m.naam || '?').charAt(0).toUpperCase()}
                </span>
                <span style={{ fontSize: '14px', color: C.textPrimary, flex: 1 }}>
                  {m.naam || '—'}
                </span>
                {m.gordel && (
                  <span style={{ fontSize: '11px', color: C.textMuted }}>
                    {m.gordel}
                  </span>
                )}
              </div>
            ))}
            <p style={{ fontSize: '12px', color: C.textMuted, margin: '6px 0 0', textAlign: 'right' }}>
              {members.length} {members.length === 1 ? 'lid' : 'leden'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Trainingen() {
  const [selected, setSelected] = useState(null);

  const handleSelect = (training) => {
    setSelected((prev) => (prev?.id === training.id ? null : training));
  };

  return (
    <div style={{
      color:      C.textPrimary,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      paddingBottom: '40px',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* ── Page header ── */}
      <div style={{ marginBottom: '28px', paddingBottom: '20px', borderBottom: `1px solid ${C.border}` }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(20px,5vw,28px)', fontWeight: '800', letterSpacing: '-0.5px' }}>
          Trainingen
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: C.textSec }}>
          Wekelijks trainingsschema Judo Kodokan Merchtem
        </p>
      </div>

      {/* ── Two-column layout on larger screens ── */}
      <div style={{
        display:   'grid',
        gridTemplateColumns: selected ? 'minmax(0,1fr) minmax(0,1fr)' : '1fr',
        gap:       '24px',
        alignItems:'start',
      }}>
        {/* ── Left: schedule ── */}
        <div>
          {SCHEDULE.map((block) => (
            <div key={block.day} style={{ marginBottom: '28px' }}>
              {/* Day header */}
              <div style={{
                display:      'flex',
                alignItems:   'center',
                gap:          '10px',
                marginBottom: '12px',
              }}>
                <span style={{
                  fontSize:      '13px',
                  fontWeight:    '800',
                  textTransform: 'uppercase',
                  letterSpacing: '1.2px',
                  color:         C.red,
                }}>
                  {block.day}
                </span>
                <div style={{ flex: 1, height: '1px', background: C.border }} />
              </div>

              {/* Training cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {block.trainings.map((t) => (
                  <TrainingCard
                    key={t.id}
                    training={t}
                    isActive={isNowActive(t)}
                    isSelected={selected?.id === t.id}
                    onClick={() => handleSelect(t)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Right: detail panel ── */}
        {selected && (
          <div style={{ position: 'sticky', top: '16px' }}>
            <DetailPanel
              training={selected}
              onClose={() => setSelected(null)}
            />
          </div>
        )}
      </div>

      {/* ── Trainer overview ── */}
      <div style={{ marginTop: '32px', paddingTop: '24px', borderTop: `1px solid ${C.border}` }}>
        <p style={{
          fontSize:      '11px',
          fontWeight:    '700',
          textTransform: 'uppercase',
          letterSpacing: '1.2px',
          color:         C.textMuted,
          margin:        '0 0 14px',
        }}>
          Trainers
        </p>

        <div style={{
          display:             'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap:                 '10px',
        }}>
          {TRAINERS.map(({ name, groups }) => (
            <div key={name} style={{
              padding:      '14px 16px',
              background:   C.card,
              border:       `1px solid ${C.border}`,
              borderRadius: '10px',
            }}>
              <p style={{ margin: '0 0 6px', fontWeight: '700', fontSize: '14px', color: C.textPrimary }}>
                {name}
              </p>
              {groups.map((g) => (
                <span key={g} style={{
                  display:      'inline-block',
                  fontSize:     '11px',
                  color:        C.textMuted,
                  background:   '#1a1a1a',
                  border:       `1px solid ${C.border}`,
                  borderRadius: '6px',
                  padding:      '2px 7px',
                  marginRight:  '4px',
                  marginBottom: '4px',
                }}>
                  {g}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
