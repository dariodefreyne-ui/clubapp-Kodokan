// src/pages/Technieken.jsx
// Stap 2: filterbar + uitklapbare TechniekCards
// Leesbaar voor beheerder én trainer — bewerken komt in stap 3 (beheerder only)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg:          '#1a1a1a',
  card:        '#2d2d2d',
  cardHover:   '#333333',
  border:      '#3a3a3a',
  red:         '#c0392b',
  redDim:      'rgba(192,57,43,0.15)',
  textPrimary: '#ffffff',
  textSec:     '#aaaaaa',
  textMuted:   '#666666',
  green:       '#27ae60',
  greenDim:    'rgba(39,174,96,0.15)',
};

// ─── Kyu gordel kleuren ───────────────────────────────────────────────────────
const KYU_COLORS = {
  '6': { label: 'Wit (6e)',    bg: '#ffffff', color: '#333', border: '1px solid #aaa' },
  '5': { label: 'Geel (5e)',   bg: '#f1c40f', color: '#333' },
  '4': { label: 'Oranje (4e)', bg: '#e67e22', color: '#fff' },
  '3': { label: 'Groen (3e)',  bg: '#27ae60', color: '#fff' },
  '2': { label: 'Blauw (2e)', bg: '#3498db', color: '#fff' },
  '1': { label: 'Bruin (1e)', bg: '#8B4513', color: '#fff' },
};

const TYPE_OPTIONS = ['Alle', 'Val', 'houdgreep', 'Verplaatsing', 'Worpen', 'Transitie'];

// ─── KyuDot ──────────────────────────────────────────────────────────────────
function KyuDot({ kyu }) {
  const cfg = KYU_COLORS[kyu];
  if (!cfg) return null;
  return (
    <div
      title={cfg.label}
      style={{
        width: '14px', height: '14px', borderRadius: '50%',
        background: cfg.bg,
        border: cfg.border || `1px solid ${cfg.bg}`,
        flexShrink: 0,
      }}
    />
  );
}

// ─── KyuBadge ────────────────────────────────────────────────────────────────
function KyuBadge({ kyu }) {
  const cfg = KYU_COLORS[kyu];
  if (!cfg) return null;
  return (
    <span style={{
      background: cfg.bg,
      color: cfg.color,
      border: cfg.border || 'none',
      padding: '2px 8px',
      borderRadius: '10px',
      fontSize: '11px',
      fontWeight: '700',
      whiteSpace: 'nowrap',
    }}>
      {kyu}e kyu
    </span>
  );
}

// ─── Sectie ───────────────────────────────────────────────────────────────────
function Sectie({ titel, items }) {
  const leeg = !items || items.length === 0;
  return (
    <div>
      <div style={{
        fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
        letterSpacing: '0.8px', color: C.textMuted, marginBottom: '6px',
      }}>
        {titel}
      </div>
      {leeg ? (
        <div style={{ color: C.textMuted, fontSize: '13px' }}>—</div>
      ) : (
        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {items.map((item, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: '6px',
              fontSize: '13px', color: C.textSec, lineHeight: '1.5', marginBottom: '3px',
            }}>
              <span style={{ color: C.red, flexShrink: 0, marginTop: '1px' }}>•</span>
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── FilterPill ───────────────────────────────────────────────────────────────
function FilterPill({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? C.red : '#1a1a1a',
        border: `1px solid ${active ? C.red : C.border}`,
        color: active ? '#fff' : C.textSec,
        padding: '6px 14px', borderRadius: '20px',
        cursor: 'pointer', fontSize: '13px', fontWeight: active ? '600' : '400',
        whiteSpace: 'nowrap', flexShrink: 0,
        transition: 'background 0.15s, border-color 0.15s, color 0.15s',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}

// ─── OefenvormenEditor ────────────────────────────────────────────────────────
function OefenvormenEditor({ items = [], techniekId, isBeheerder, updatedBy }) {
  const [editingIdx, setEditingIdx]   = useState(null);
  const [editVal, setEditVal]         = useState('');
  const [addingNew, setAddingNew]     = useState(false);
  const [newVal, setNewVal]           = useState('');
  const [hoveredIdx, setHoveredIdx]   = useState(null);
  const newInputRef                   = useRef(null);

  async function saveField(index, value) {
    const trimmed = value.trim();
    if (!trimmed) { setEditingIdx(null); return; }
    const updated = items.map((it, i) => i === index ? trimmed : it);
    await updateDoc(doc(db, 'technieken', techniekId), {
      oefenvormen: updated,
      updatedAt: serverTimestamp(),
      updatedBy,
    });
    setEditingIdx(null);
  }

  async function deleteItem(index) {
    const updated = items.filter((_, i) => i !== index);
    await updateDoc(doc(db, 'technieken', techniekId), {
      oefenvormen: updated,
      updatedAt: serverTimestamp(),
      updatedBy,
    });
  }

  async function addItem(value) {
    const trimmed = value.trim();
    setAddingNew(false);
    setNewVal('');
    if (!trimmed) return;
    await updateDoc(doc(db, 'technieken', techniekId), {
      oefenvormen: [...items, trimmed],
      updatedAt: serverTimestamp(),
      updatedBy,
    });
  }

  useEffect(() => {
    if (addingNew && newInputRef.current) newInputRef.current.focus();
  }, [addingNew]);

  return (
    <div>
      <div style={{
        fontSize: '10px', fontWeight: '700', textTransform: 'uppercase',
        letterSpacing: '0.8px', color: C.textMuted, marginBottom: '6px',
      }}>
        Oefenvormen
      </div>

      {items.length === 0 && !isBeheerder && (
        <div style={{ color: C.textMuted, fontSize: '13px' }}>—</div>
      )}

      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {items.map((item, i) => (
          <li
            key={i}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {editingIdx === i ? (
              <input
                autoFocus
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                onBlur={() => saveField(i, editVal)}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveField(i, editVal);
                  if (e.key === 'Escape') setEditingIdx(null);
                }}
                style={{
                  flex: 1, background: '#1a1a1a', border: `1px solid ${C.red}`,
                  borderRadius: '6px', color: C.textPrimary, padding: '4px 8px',
                  fontSize: '13px', fontFamily: 'inherit', outline: 'none',
                }}
              />
            ) : (
              <span
                onClick={isBeheerder ? () => { setEditingIdx(i); setEditVal(item); } : undefined}
                style={{
                  flex: 1, fontSize: '13px', color: C.textSec, lineHeight: '1.5',
                  cursor: isBeheerder ? 'text' : 'default',
                  padding: '2px 4px', borderRadius: '4px',
                  background: isBeheerder && hoveredIdx === i ? 'rgba(255,255,255,0.05)' : 'transparent',
                }}
              >
                <span style={{ color: C.red, marginRight: '6px' }}>•</span>
                {item}
              </span>
            )}
            {isBeheerder && editingIdx !== i && (
              <button
                onClick={() => deleteItem(i)}
                title="Verwijder"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: hoveredIdx === i ? '#e74c3c' : C.textMuted,
                  fontSize: '14px', padding: '2px 4px', lineHeight: 1,
                  opacity: hoveredIdx === i ? 1 : 0,
                  transition: 'opacity 0.15s, color 0.15s',
                  fontFamily: 'inherit',
                }}
              >
                🗑️
              </button>
            )}
          </li>
        ))}
      </ul>

      {isBeheerder && (
        addingNew ? (
          <input
            ref={newInputRef}
            value={newVal}
            placeholder="Nieuwe oefenvorm..."
            onChange={e => setNewVal(e.target.value)}
            onBlur={() => addItem(newVal)}
            onKeyDown={e => {
              if (e.key === 'Enter') addItem(newVal);
              if (e.key === 'Escape') { setAddingNew(false); setNewVal(''); }
            }}
            style={{
              width: '100%', boxSizing: 'border-box', marginTop: '4px',
              background: '#1a1a1a', border: `1px solid ${C.red}`,
              borderRadius: '6px', color: C.textPrimary, padding: '5px 8px',
              fontSize: '13px', fontFamily: 'inherit', outline: 'none',
            }}
          />
        ) : (
          <button
            onClick={() => setAddingNew(true)}
            style={{
              background: 'none', border: `1px dashed ${C.border}`, borderRadius: '6px',
              color: C.textMuted, cursor: 'pointer', fontSize: '12px',
              padding: '4px 10px', marginTop: '4px', fontFamily: 'inherit',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted; }}
          >
            + Voeg oefenvorm toe
          </button>
        )
      )}
    </div>
  );
}

// ─── ImportModal ──────────────────────────────────────────────────────────────
function ImportModal({ preview, bestaandeTechnieken, onBevestig, onAnnuleer, busy }) {
  const nieuw    = preview.filter(t => !bestaandeTechnieken.find(b => b.id === t._id));
  const updaten  = preview.filter(t =>  bestaandeTechnieken.find(b => b.id === t._id));

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '16px',
    }}>
      <div style={{
        background: '#2d2d2d', borderRadius: '16px', padding: '24px',
        width: '100%', maxWidth: '560px', maxHeight: '80vh',
        display: 'flex', flexDirection: 'column', gap: '16px',
        border: '1px solid #3a3a3a',
      }}>
        <div style={{ fontWeight: '700', fontSize: '17px' }}>📥 Excel import preview</div>

        <div style={{ fontSize: '14px', color: '#aaa' }}>
          <strong style={{ color: '#fff' }}>{preview.length}</strong> technieken gevonden in het bestand
          &nbsp;·&nbsp;
          <span style={{ color: '#27ae60' }}>{nieuw.length} nieuw</span>
          &nbsp;·&nbsp;
          <span style={{ color: '#3498db' }}>{updaten.length} bijwerken</span>
        </div>

        <div style={{
          background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)',
          borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#e74c3c',
        }}>
          ⚠️ Oefenvormen worden <strong>NIET</strong> overschreven bij bestaande technieken.
          Kyu-graden en graaddrempels worden ook niet aangepast vanuit Excel.
        </div>

        <div style={{ overflowY: 'auto', flex: 1, borderRadius: '8px', border: '1px solid #3a3a3a' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#1a1a1a', position: 'sticky', top: 0 }}>
                {['Techniek', 'Type', 'Status'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#aaa', fontWeight: '600', borderBottom: '1px solid #3a3a3a' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((t, i) => {
                const isNieuw = !bestaandeTechnieken.find(b => b.id === t._id);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #333' }}>
                    <td style={{ padding: '7px 12px', color: '#fff' }}>{t.techniek}</td>
                    <td style={{ padding: '7px 12px', color: '#aaa' }}>{t.type}</td>
                    <td style={{ padding: '7px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '700',
                        background: isNieuw ? 'rgba(39,174,96,0.2)' : 'rgba(52,152,219,0.2)',
                        color: isNieuw ? '#27ae60' : '#3498db',
                      }}>
                        {isNieuw ? 'Nieuw' : 'Updaten'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onAnnuleer}
            disabled={busy}
            style={{
              background: '#1a1a1a', border: '1px solid #3a3a3a', color: '#aaa',
              padding: '10px 20px', borderRadius: '8px', cursor: 'pointer',
              fontSize: '14px', fontFamily: 'inherit',
            }}
          >
            Annuleren
          </button>
          <button
            onClick={onBevestig}
            disabled={busy}
            style={{
              background: '#c0392b', border: 'none', color: '#fff',
              padding: '10px 20px', borderRadius: '8px', cursor: busy ? 'not-allowed' : 'pointer',
              fontSize: '14px', fontWeight: '600', fontFamily: 'inherit',
              opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Bezig...' : `Bevestig import (${preview.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── parseExcel ───────────────────────────────────────────────────────────────
function parseExcel(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

      let currentType = null;
      const parsed = [];
      let current = null;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row[0]) currentType = row[0];
        const techniekNaam = row[2];
        if (techniekNaam) {
          if (current) parsed.push(current);
          current = {
            type: currentType,
            techniek: techniekNaam,
            basisvoorwaarden: row[3] ? [String(row[3])] : [],
            basisfase:        row[4] ? [String(row[4])] : [],
            verdieping:       row[5] ? [String(row[5])] : [],
            aandachtspunten:  row[6] ? [String(row[6])] : [],
            remediering:      row[7] ? [String(row[7])] : [],
            oefenvormen:      row[8] ? [String(row[8])] : [],
          };
        } else if (current) {
          if (row[3]) current.basisvoorwaarden.push(String(row[3]));
          if (row[4]) current.basisfase.push(String(row[4]));
          if (row[5]) current.verdieping.push(String(row[5]));
          if (row[6]) current.aandachtspunten.push(String(row[6]));
          if (row[7]) current.remediering.push(String(row[7]));
          if (row[8]) current.oefenvormen.push(String(row[8]));
        }
      }
      if (current) parsed.push(current);

      // Bereken document-ID per techniek (zelfde logica als seeder)
      resolve(parsed.map(t => ({
        ...t,
        _id: t.techniek.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      })));
    };
    reader.readAsArrayBuffer(file);
  });
}

// ─── TechniekCard ─────────────────────────────────────────────────────────────
function TechniekCard({ techniek, isOpen, onToggle, cardRef, isBeheerder, updatedBy }) {
  const [hovered, setHovered] = useState(false);
  const kyuGraden = techniek.kyu_graden || [];

  return (
    <div
      ref={cardRef}
      style={{
        background: isOpen || hovered ? C.cardHover : C.card,
        border: `1px solid ${isOpen ? C.red : hovered ? '#555' : C.border}`,
        borderRadius: '12px',
        overflow: 'hidden',
        transition: 'border-color 0.15s, background 0.15s',
        marginBottom: '8px',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header — altijd zichtbaar */}
      <button
        onClick={onToggle}
        style={{
          width: '100%', background: 'none', border: 'none',
          padding: '14px 16px', cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: '12px',
          color: C.textPrimary, fontFamily: 'inherit',
        }}
      >
        <span style={{
          fontSize: '12px', color: C.textMuted, flexShrink: 0,
          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s', display: 'inline-block',
        }}>
          ▶
        </span>
        <span style={{ fontWeight: '700', fontSize: '15px', flex: 1, textAlign: 'left' }}>
          {techniek.techniek}
        </span>
        <span style={{
          background: '#1a1a1a', border: `1px solid ${C.border}`,
          color: C.textSec, padding: '2px 8px', borderRadius: '8px',
          fontSize: '11px', whiteSpace: 'nowrap', flexShrink: 0,
        }}>
          {techniek.type}
        </span>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
          {kyuGraden.map(k => <KyuDot key={k} kyu={k} />)}
        </div>
      </button>

      {/* BASIS / VERDIEPING labels */}
      {(techniek.basis_vanaf_kyu || techniek.verdieping_vanaf_kyu) && (
        <div style={{
          display: 'flex', gap: '8px', flexWrap: 'wrap',
          paddingLeft: '44px', paddingRight: '16px', paddingBottom: '12px',
          marginTop: '-4px',
        }}>
          {techniek.basis_vanaf_kyu && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '11px', color: C.textMuted }}>BASIS vanaf</span>
              <KyuBadge kyu={techniek.basis_vanaf_kyu} />
            </div>
          )}
          {techniek.verdieping_vanaf_kyu && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '11px', color: C.textMuted }}>VERDIEPING vanaf</span>
              <KyuBadge kyu={techniek.verdieping_vanaf_kyu} />
            </div>
          )}
        </div>
      )}

      {/* Uitgeklapt */}
      {isOpen && (
        <div style={{
          borderTop: `1px solid ${C.border}`,
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '16px',
        }}>
          <Sectie titel="Basisvoorwaarden" items={techniek.basisvoorwaarden} />
          <Sectie titel="Basisfase"        items={techniek.basisfase} />
          <Sectie titel="Verdieping"       items={techniek.verdieping} />
          <Sectie titel="Aandachtspunten"  items={techniek.aandachtspunten} />
          <Sectie titel="Remediering"      items={techniek.remediering} />
          <OefenvormenEditor
            items={techniek.oefenvormen}
            techniekId={techniek.id}
            isBeheerder={isBeheerder}
            updatedBy={updatedBy}
          />
        </div>
      )}
    </div>
  );
}

// ─── Hoofdcomponent ───────────────────────────────────────────────────────────
export default function Technieken() {
  const { role, isBeheerder } = useAuth();
  const [searchParams]        = useSearchParams();

  // ── State ──
  const [technieken, setTechnieken]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [zoekterm, setZoekterm]         = useState('');
  const [filterType, setFilterType]     = useState('Alle');
  const [filterKyu, setFilterKyu]       = useState('Alle');
  const [openId, setOpenId]             = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importBusy, setImportBusy]     = useState(false);
  const [importSucces, setImportSucces] = useState('');
  const cardRefs                        = useRef({});
  const fileInputRef                    = useRef(null);

  // ── Firestore live data ───────────────────────────────────────────────────
  useEffect(() => {
    const q = query(
      collection(db, 'technieken'),
      orderBy('type'),
      orderBy('techniek'),
    );
    const unsub = onSnapshot(q, snap => {
      setTechnieken(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => {
      console.error('Fout bij laden technieken:', err);
      setLoading(false);
    });
    return unsub;
  }, []);

  // ── Excel import handlers ────────────────────────────────────────────────
  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const parsed = await parseExcel(file);
      setImportPreview(parsed);
    } catch (err) {
      alert('Fout bij lezen van het bestand: ' + err.message);
    }
  }, []);

  const voerImportUit = useCallback(async () => {
    if (!importPreview) return;
    setImportBusy(true);
    try {
      for (const t of importPreview) {
        const id = t._id;
        const bestaand = technieken.find(x => x.id === id);
        const update = {
          type: t.type,
          techniek: t.techniek,
          basisvoorwaarden: t.basisvoorwaarden,
          basisfase:        t.basisfase,
          verdieping:       t.verdieping,
          aandachtspunten:  t.aandachtspunten,
          remediering:      t.remediering,
          updatedAt:        serverTimestamp(),
          updatedBy:        role,
        };
        if (bestaand) {
          await updateDoc(doc(db, 'technieken', id), update);
        } else {
          await setDoc(doc(db, 'technieken', id), {
            ...update,
            oefenvormen:          t.oefenvormen,
            kyu_graden:           [],
            basis_vanaf_kyu:      '',
            verdieping_vanaf_kyu: '',
          });
        }
      }
      setImportSucces(`Import voltooid: ${importPreview.length} technieken bijgewerkt.`);
      setTimeout(() => setImportSucces(''), 5000);
      setImportPreview(null);
    } catch (err) {
      alert('Fout tijdens import: ' + err.message);
    }
    setImportBusy(false);
  }, [importPreview, technieken, role]);

  // ── URL parameter: ?id=<techniekId> → open + scroll ──────────────────────
  useEffect(() => {
    const idParam = searchParams.get('id');
    if (!idParam || technieken.length === 0) return;
    setOpenId(idParam);
    setTimeout(() => {
      const el = cardRefs.current[idParam];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, [searchParams, technieken]);

  // ── Toegangscontrole — NA alle hooks ─────────────────────────────────────
  if (!role) {
    return (
      <div style={{
        minHeight: '100vh', background: C.bg, color: C.textPrimary,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>Geen toegang</div>
          <div style={{ color: C.textSec, fontSize: '14px' }}>Log in om technieken te bekijken.</div>
        </div>
      </div>
    );
  }

  // ── Filterlogica ──────────────────────────────────────────────────────────
  const zichtbaar = technieken.filter(t => {
    if (zoekterm && !t.techniek.toLowerCase().includes(zoekterm.toLowerCase())) return false;
    if (filterType !== 'Alle' && t.type !== filterType) return false;
    if (filterKyu !== 'Alle' && !t.kyu_graden?.includes(filterKyu)) return false;
    return true;
  });

  // Groepeer per type
  const groepen = {};
  zichtbaar.forEach(t => {
    if (!groepen[t.type]) groepen[t.type] = [];
    groepen[t.type].push(t);
  });

  const filtersActief = zoekterm || filterType !== 'Alle' || filterKyu !== 'Alle';

  return (
    <div style={{ color: C.textPrimary, fontFamily: 'inherit', paddingBottom: '40px' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {importPreview && (
        <ImportModal
          preview={importPreview}
          bestaandeTechnieken={technieken}
          onBevestig={voerImportUit}
          onAnnuleer={() => setImportPreview(null)}
          busy={importBusy}
        />
      )}

      {/* Hidden file input voor Excel */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Paginatitel */}
      <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div>
            <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(20px,5vw,26px)', fontWeight: '800', letterSpacing: '-0.5px' }}>
              🥋 Technieken
            </h1>
            <p style={{ margin: 0, fontSize: '14px', color: C.textSec }}>
              Beheer van judotechnieken per kyu-graad
            </p>
          </div>
          {isBeheerder && (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                background: '#2d2d2d', border: `1px solid ${C.border}`,
                color: C.textSec, padding: '8px 14px', borderRadius: '8px',
                cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit',
                whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textSec; }}
            >
              📥 Excel importeren
            </button>
          )}
        </div>
        {importSucces && (
          <div style={{
            marginTop: '10px', background: C.greenDim, border: `1px solid ${C.green}`,
            borderRadius: '8px', padding: '10px 14px', fontSize: '13px',
            color: C.green, fontWeight: '600',
          }}>
            ✓ {importSucces}
          </div>
        )}
      </div>

      {/* Filterbar */}
      <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <input
          type="search"
          placeholder="🔍  Zoek op techniek naam..."
          value={zoekterm}
          onChange={e => setZoekterm(e.target.value)}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: C.card, border: `1px solid ${C.border}`,
            borderRadius: '10px', color: C.textPrimary,
            padding: '10px 14px', fontSize: '14px',
            outline: 'none', fontFamily: 'inherit',
          }}
        />

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: C.textMuted, alignSelf: 'center', flexShrink: 0 }}>TYPE:</span>
          {TYPE_OPTIONS.map(t => (
            <FilterPill key={t} label={t} active={filterType === t} onClick={() => setFilterType(t)} />
          ))}
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '11px', color: C.textMuted, alignSelf: 'center', flexShrink: 0 }}>KYU:</span>
          <FilterPill label="Alle" active={filterKyu === 'Alle'} onClick={() => setFilterKyu('Alle')} />
          {Object.entries(KYU_COLORS).map(([k, cfg]) => (
            <FilterPill key={k} label={cfg.label} active={filterKyu === k} onClick={() => setFilterKyu(k)} />
          ))}
        </div>
      </div>

      {/* Resultaatteller */}
      {!loading && (
        <div style={{ fontSize: '13px', color: C.textMuted, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>{zichtbaar.length} {zichtbaar.length === 1 ? 'techniek' : 'technieken'} gevonden</span>
          {filtersActief && (
            <button
              onClick={() => { setZoekterm(''); setFilterType('Alle'); setFilterKyu('Alle'); }}
              style={{
                background: 'none', border: 'none', color: C.red,
                cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit', padding: 0,
              }}
            >
              ✕ Filters wissen
            </button>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{
            width: '32px', height: '32px',
            border: `3px solid ${C.border}`,
            borderTop: `3px solid ${C.red}`,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      )}

      {/* Leeg */}
      {!loading && zichtbaar.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: C.textSec }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🥋</div>
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '6px' }}>
            {technieken.length === 0
              ? 'Geen technieken in de database.'
              : 'Geen resultaten voor deze filters.'}
          </div>
          {technieken.length === 0 && (
            <div style={{ fontSize: '13px', color: C.textMuted, marginTop: '4px' }}>
              De seed wordt automatisch uitgevoerd bij opstarten van de app.
            </div>
          )}
        </div>
      )}

      {/* Cards per type-groep */}
      {!loading && Object.entries(groepen).map(([type, items]) => (
        <div key={type} style={{ marginBottom: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{
              fontSize: '11px', fontWeight: '800',
              textTransform: 'uppercase', letterSpacing: '1.2px', color: C.red,
            }}>
              {type}
            </span>
            <div style={{ flex: 1, height: '1px', background: C.border }} />
            <span style={{ fontSize: '11px', color: C.textMuted }}>{items.length}</span>
          </div>

          {items.map(t => (
            <TechniekCard
              key={t.id}
              techniek={t}
              isOpen={openId === t.id}
              onToggle={() => setOpenId(prev => prev === t.id ? null : t.id)}
              cardRef={el => { cardRefs.current[t.id] = el; }}
              isBeheerder={isBeheerder}
              updatedBy={role}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
