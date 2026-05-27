// src/pages/Technieken.jsx
// Tegel-navigatie: Alle technieken | Per kyu (6 tegels) | Val | Houdgrepen | Worpen |
//                  Klemmen | Verwurgingen | Verplaatsing | Transitie | Beheer (admin)
//
// Firestore-strategie: één onSnapshot op de volledige 'technieken' collectie,
// opgeslagen in state. Alle filtering/groepering gebeurt client-side — geen
// extra reads per tegel.

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, setDoc, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';
import * as XLSX from 'xlsx';
import { C, cardStyle, buttonStyle } from '../styles/tokens';

// ─── Kyu-kleur helpers ────────────────────────────────────────────────────────
const KYU_COLORS_FALLBACK = {
  '6': { label: 'Wit (6e)',    bg: '#ffffff', color: '#333', border: '1px solid #aaa' },
  '5': { label: 'Geel (5e)',   bg: '#f1c40f', color: '#333' },
  '4': { label: 'Oranje (4e)', bg: '#e67e22', color: '#fff' },
  '3': { label: 'Groen (3e)',  bg: '#27ae60', color: '#fff' },
  '2': { label: 'Blauw (2e)',  bg: '#3498db', color: '#fff' },
  '1': { label: 'Bruin (1e)',  bg: '#8B4513', color: '#fff' },
};

function useKyuKleuren() {
  const { configCache } = useAuth();
  const gordels = configCache?.gordels || [];
  if (gordels.length === 0) return KYU_COLORS_FALLBACK;
  const map = {};
  for (const g of gordels) {
    if (g.kyu === undefined || g.kyu === null) continue;
    const key = String(g.kyu);
    const bg = g.kleur || '#888';
    const isWit = bg.toLowerCase() === '#ffffff' || bg.toLowerCase() === '#fff';
    map[key] = {
      label: g.label || `Kyu ${g.kyu}`,
      bg,
      color: isWit ? '#333' : '#fff',
      ...(isWit ? { border: '1px solid #aaa' } : {}),
    };
  }
  return Object.keys(map).length > 0 ? map : KYU_COLORS_FALLBACK;
}

// KYU_TILES: vaste volgorde 6e kyu → 1e kyu
const KYU_VOLGORDE = ['6', '5', '4', '3', '2', '1'];

// Accentkleuren per kyu voor tegel-glow
const KYU_ACCENT_DIM = {
  '6': 'rgba(255,255,255,0.10)',
  '5': 'rgba(241,196,15,0.18)',
  '4': 'rgba(230,126,34,0.18)',
  '3': 'rgba(39,174,96,0.18)',
  '2': 'rgba(52,152,219,0.18)',
  '1': 'rgba(139,69,19,0.20)',
};

// ─── Kleine herbruikbare componenten ─────────────────────────────────────────
function KyuDot({ kyu, kleuren }) {
  const cfg = kleuren[kyu];
  if (!cfg) return null;
  return (
    <div title={cfg.label} style={{
      width: 13, height: 13, borderRadius: '50%',
      background: cfg.bg, border: cfg.border || `1px solid ${cfg.bg}`,
      flexShrink: 0,
    }} />
  );
}

function KyuBadge({ kyu, kleuren }) {
  const cfg = kleuren[kyu];
  if (!cfg) return null;
  return (
    <span style={{
      background: cfg.bg, color: cfg.color, border: cfg.border || 'none',
      padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
    }}>
      {kyu}e kyu
    </span>
  );
}

function SectieLabel({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: C.textMuted, marginBottom: 5 }}>
      {children}
    </div>
  );
}

function Sectie({ titel, items }) {
  return (
    <div>
      <SectieLabel>{titel}</SectieLabel>
      {!items || items.length === 0
        ? <div style={{ color: C.textMuted, fontSize: 13 }}>—</div>
        : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {items.map((item, i) => (
              <li key={i} style={{ display: 'flex', gap: 6, fontSize: 13, color: C.textSec, lineHeight: 1.5, marginBottom: 3 }}>
                <span style={{ color: C.red, flexShrink: 0, marginTop: 1 }}>•</span>
                {item}
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

// ─── OefenvormenEditor ────────────────────────────────────────────────────────
function OefenvormenEditor({ items = [], techniekId, isBeheerder, updatedBy }) {
  const confirm = useConfirm();
  const [editingIdx, setEditingIdx] = useState(null);
  const [editVal, setEditVal]       = useState('');
  const [addingNew, setAddingNew]   = useState(false);
  const [newVal, setNewVal]         = useState('');
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const newInputRef                 = useRef(null);

  async function saveField(index, value) {
    const trimmed = value.trim();
    if (!trimmed) { setEditingIdx(null); return; }
    const updated = items.map((it, i) => i === index ? trimmed : it);
    await updateDoc(doc(db, 'technieken', techniekId), {
      oefenvormen: updated, updatedAt: serverTimestamp(), updatedBy,
    });
    setEditingIdx(null);
  }

  async function deleteItem(index) {
    const ok = await confirm({
      titel: 'Oefenvorm verwijderen?',
      beschrijving: items[index] ? `"${items[index]}" wordt verwijderd.` : 'Deze oefenvorm wordt verwijderd.',
      bevestigLabel: 'Ja, verwijderen', variant: 'danger',
    });
    if (!ok) return;
    await updateDoc(doc(db, 'technieken', techniekId), {
      oefenvormen: items.filter((_, i) => i !== index),
      updatedAt: serverTimestamp(), updatedBy,
    });
  }

  async function addItem(value) {
    const trimmed = value.trim();
    setAddingNew(false); setNewVal('');
    if (!trimmed) return;
    await updateDoc(doc(db, 'technieken', techniekId), {
      oefenvormen: [...items, trimmed], updatedAt: serverTimestamp(), updatedBy,
    });
  }

  useEffect(() => { if (addingNew && newInputRef.current) newInputRef.current.focus(); }, [addingNew]);

  const inputSt = {
    flex: 1, background: C.bg, border: `1px solid ${C.red}`,
    borderRadius: 6, color: C.text, padding: '4px 8px',
    fontSize: 13, fontFamily: 'inherit', outline: 'none',
  };

  return (
    <div>
      <SectieLabel>Oefenvormen</SectieLabel>
      {items.length === 0 && !isBeheerder && <div style={{ color: C.textMuted, fontSize: 13 }}>—</div>}
      <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {items.map((item, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}
            onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}>
            {editingIdx === i ? (
              <input autoFocus value={editVal} onChange={e => setEditVal(e.target.value)}
                onBlur={() => saveField(i, editVal)}
                onKeyDown={e => { if (e.key === 'Enter') saveField(i, editVal); if (e.key === 'Escape') setEditingIdx(null); }}
                style={inputSt} />
            ) : (
              <span onClick={isBeheerder ? () => { setEditingIdx(i); setEditVal(item); } : undefined}
                style={{
                  flex: 1, fontSize: 13, color: C.textSec, lineHeight: 1.5,
                  cursor: isBeheerder ? 'text' : 'default', padding: '2px 4px', borderRadius: 4,
                  background: isBeheerder && hoveredIdx === i ? 'rgba(255,255,255,0.05)' : 'transparent',
                }}>
                <span style={{ color: C.red, marginRight: 6 }}>•</span>{item}
              </span>
            )}
            {isBeheerder && editingIdx !== i && (
              <button onClick={() => deleteItem(i)} title="Verwijder"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: hoveredIdx === i ? C.red : C.textMuted, fontSize: 16, padding: '2px 4px',
                  opacity: hoveredIdx === i ? 1 : 0, transition: 'opacity 0.15s', fontFamily: 'inherit',
                }}>🗑️</button>
            )}
          </li>
        ))}
      </ul>
      {isBeheerder && (addingNew ? (
        <input ref={newInputRef} value={newVal} placeholder="Nieuwe oefenvorm..."
          onChange={e => setNewVal(e.target.value)}
          onBlur={() => addItem(newVal)}
          onKeyDown={e => { if (e.key === 'Enter') addItem(newVal); if (e.key === 'Escape') { setAddingNew(false); setNewVal(''); } }}
          style={{ ...inputSt, width: '100%', boxSizing: 'border-box', marginTop: 4 }} />
      ) : (
        <button onClick={() => setAddingNew(true)}
          style={{
            background: 'none', border: `1px dashed ${C.border}`, borderRadius: 6,
            color: C.textMuted, cursor: 'pointer', fontSize: 13, padding: '4px 10px', marginTop: 4, fontFamily: 'inherit',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = C.red; e.currentTarget.style.color = C.red; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.textMuted; }}>
          + Voeg oefenvorm toe
        </button>
      ))}
    </div>
  );
}

// ─── TechniekCard (lijst-weergave) ────────────────────────────────────────────
function TechniekCard({ techniek, isOpen, onToggle, cardRef, isBeheerder, updatedBy, kyuKleuren }) {
  const kyuGraden = techniek.kyu_graden || [];
  return (
    <div ref={cardRef} style={{
      background: C.card, border: `1px solid ${isOpen ? C.red : C.borderSoft}`,
      borderRadius: 12, overflow: 'hidden', transition: 'border-color 0.15s', marginBottom: 6,
    }}>
      <button onClick={onToggle} style={{
        width: '100%', background: 'none', border: 'none', padding: '12px 14px',
        cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
        color: C.text, fontFamily: 'inherit',
      }}>
        <span style={{
          fontSize: 11, color: C.textMuted, flexShrink: 0,
          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s', display: 'inline-block',
        }}>▶</span>
        <span style={{ fontWeight: 700, fontSize: 14, flex: 1, textAlign: 'left' }}>{techniek.techniek}</span>
        <span style={{
          background: C.bg, border: `1px solid ${C.borderSoft}`, color: C.textMuted,
          padding: '2px 8px', borderRadius: 6, fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0,
        }}>{techniek.type}</span>
        <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
          {kyuGraden.map(k => <KyuDot key={k} kyu={k} kleuren={kyuKleuren} />)}
        </div>
      </button>

      {(techniek.basis_vanaf_kyu || techniek.verdieping_vanaf_kyu) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: 38, paddingRight: 14, paddingBottom: 10, marginTop: -4 }}>
          {techniek.basis_vanaf_kyu && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, color: C.textMuted }}>BASIS vanaf</span>
              <KyuBadge kyu={techniek.basis_vanaf_kyu} kleuren={kyuKleuren} />
            </div>
          )}
          {techniek.verdieping_vanaf_kyu && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, color: C.textMuted }}>VERDIEPING vanaf</span>
              <KyuBadge kyu={techniek.verdieping_vanaf_kyu} kleuren={kyuKleuren} />
            </div>
          )}
        </div>
      )}

      {isOpen && (
        <div style={{
          borderTop: `1px solid ${C.borderSoft}`, padding: 16,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14,
        }}>
          <Sectie titel="Basisvoorwaarden" items={techniek.basisvoorwaarden} />
          <Sectie titel="Basisfase"        items={techniek.basisfase} />
          <Sectie titel="Verdieping"       items={techniek.verdieping} />
          <Sectie titel="Aandachtspunten"  items={techniek.aandachtspunten} />
          <Sectie titel="Remediering"      items={techniek.remediering} />
          <OefenvormenEditor items={techniek.oefenvormen} techniekId={techniek.id}
            isBeheerder={isBeheerder} updatedBy={updatedBy} />
        </div>
      )}
    </div>
  );
}

// ─── TypeSectie ───────────────────────────────────────────────────────────────
function TypeSectie({ type, items, openId, onToggle, cardRefs, isBeheerder, role, kyuKleuren }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.2px', color: C.red }}>{type}</span>
        <div style={{ flex: 1, height: 1, background: C.borderSoft }} />
        <span style={{ fontSize: 10, color: C.textMuted }}>{items.length}</span>
      </div>
      {items.map(t => (
        <TechniekCard key={t.id} techniek={t} isOpen={openId === t.id}
          onToggle={() => onToggle(t.id)}
          cardRef={el => { cardRefs.current[t.id] = el; }}
          isBeheerder={isBeheerder} updatedBy={role} kyuKleuren={kyuKleuren} />
      ))}
    </div>
  );
}

// ─── parseExcel ───────────────────────────────────────────────────────────────
function parseExcel(file) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
      let currentType = null; const parsed = []; let current = null;
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row[0]) currentType = row[0];
        const naam = row[2];
        if (naam) {
          if (current) parsed.push(current);
          current = {
            type: currentType, techniek: naam,
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
      resolve(parsed.map(t => ({
        ...t,
        _id: t.techniek.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
      })));
    };
    reader.readAsArrayBuffer(file);
  });
}

// ─── exportExcel ──────────────────────────────────────────────────────────────
function exportExcel(technieken) {
  const rijen = [['Type', '', 'Techniek', 'Basisvoorwaarden', 'Basisfase', 'Verdieping', 'Aandachtspunten', 'Remediering', 'Oefenvormen']];
  const groepen = {};
  technieken.forEach(t => { if (!groepen[t.type]) groepen[t.type] = []; groepen[t.type].push(t); });
  Object.entries(groepen).forEach(([type, items]) => {
    items.forEach(t => {
      const maxLen = Math.max(1,
        (t.basisvoorwaarden || []).length, (t.basisfase || []).length,
        (t.verdieping || []).length, (t.aandachtspunten || []).length,
        (t.remediering || []).length, (t.oefenvormen || []).length,
      );
      for (let i = 0; i < maxLen; i++) {
        rijen.push([
          i === 0 ? type : '', '',
          i === 0 ? t.techniek : '',
          (t.basisvoorwaarden || [])[i] || '',
          (t.basisfase || [])[i] || '',
          (t.verdieping || [])[i] || '',
          (t.aandachtspunten || [])[i] || '',
          (t.remediering || [])[i] || '',
          (t.oefenvormen || [])[i] || '',
        ]);
      }
    });
  });
  const ws = XLSX.utils.aoa_to_sheet(rijen);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Technieken');
  XLSX.writeFile(wb, `technieken_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── ImportModal ──────────────────────────────────────────────────────────────
function ImportModal({ preview, bestaandeTechnieken, onBevestig, onAnnuleer, busy }) {
  const nieuw   = preview.filter(t => !bestaandeTechnieken.find(b => b.id === t._id));
  const updaten = preview.filter(t =>  bestaandeTechnieken.find(b => b.id === t._id));
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: C.card, borderRadius: 20, padding: 24, width: '100%', maxWidth: 560, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 16, border: `1px solid ${C.borderSoft}` }}>
        <div style={{ fontWeight: 700, fontSize: 17 }}>📥 Excel import preview</div>
        <div style={{ fontSize: 13, color: C.textSec }}>
          <strong style={{ color: C.text }}>{preview.length}</strong> technieken &nbsp;·&nbsp;
          <span style={{ color: C.green }}>{nieuw.length} nieuw</span> &nbsp;·&nbsp;
          <span style={{ color: C.blue }}>{updaten.length} bijwerken</span>
        </div>
        <div style={{ background: 'rgba(192,57,43,0.1)', border: '1px solid rgba(192,57,43,0.3)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: C.red }}>
          ⚠️ Oefenvormen worden <strong>NIET</strong> overschreven bij bestaande technieken.
        </div>
        <div style={{ overflowY: 'auto', flex: 1, borderRadius: 8, border: `1px solid ${C.borderSoft}` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: C.bg, position: 'sticky', top: 0 }}>
                {['Techniek', 'Type', 'Status'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: C.textMuted, fontWeight: 600, borderBottom: `1px solid ${C.borderSoft}` }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((t, i) => {
                const isNieuw = !bestaandeTechnieken.find(b => b.id === t._id);
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${C.bg}` }}>
                    <td style={{ padding: '7px 12px', color: C.text }}>{t.techniek}</td>
                    <td style={{ padding: '7px 12px', color: C.textSec }}>{t.type}</td>
                    <td style={{ padding: '7px 12px' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                        background: isNieuw ? 'rgba(39,174,96,0.2)' : 'rgba(52,152,219,0.2)',
                        color: isNieuw ? C.green : C.blue,
                      }}>{isNieuw ? 'Nieuw' : 'Updaten'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onAnnuleer} disabled={busy} style={{ ...buttonStyle('subtle'), opacity: busy ? 0.6 : 1 }}>Annuleren</button>
          <button onClick={onBevestig} disabled={busy} style={{ ...buttonStyle('primary'), opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Bezig...' : `Bevestig import (${preview.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Hulpcomponenten ──────────────────────────────────────────────────────────
function LegeStaat({ label }) {
  return (
    <div style={{ textAlign: 'center', padding: '50px 20px', color: C.textMuted }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🥋</div>
      <div style={{ fontSize: 14, fontWeight: 600 }}>{label}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
      <style>{`@keyframes kd-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 32, height: 32, border: `3px solid ${C.borderSoft}`, borderTop: `3px solid ${C.red}`, borderRadius: '50%', animation: 'kd-spin 0.8s linear infinite' }} />
    </div>
  );
}

// ─── TechniekLijstView ────────────────────────────────────────────────────────
// Gedeelde lijstweergave (met optionele kyu-splitsing).
// Alle data is al in memory — zero extra Firestore reads.
function TechniekLijstView({ technieken, filterKyu, isBeheerder, role, kyuKleuren, openId, setOpenId, cardRefs, zoekterm, setZoekterm }) {
  const gefilterd = useMemo(() => {
    if (!zoekterm) return technieken;
    return technieken.filter(t => t.techniek.toLowerCase().includes(zoekterm.toLowerCase()));
  }, [technieken, zoekterm]);

  function groepeerPerType(items) {
    const g = {};
    items.forEach(t => { if (!g[t.type]) g[t.type] = []; g[t.type].push(t); });
    Object.values(g).forEach(arr => arr.sort((a, b) => a.techniek.localeCompare(b.techniek, 'nl')));
    return g;
  }

  const kyuActief    = !!filterKyu;
  const nieuwVoorKyu = kyuActief ? gefilterd.filter(t => t.basis_vanaf_kyu === filterKyu) : [];
  const reedsGekend  = kyuActief ? gefilterd.filter(t => t.basis_vanaf_kyu !== filterKyu) : [];
  const groepen      = kyuActief ? {} : groepeerPerType(gefilterd);

  return (
    <div>
      <input type="search" placeholder="🔍  Zoek op naam..."
        value={zoekterm} onChange={e => setZoekterm(e.target.value)}
        style={{
          width: '100%', boxSizing: 'border-box', marginBottom: 14,
          background: C.card, border: `1px solid ${C.borderSoft}`,
          borderRadius: 10, color: C.text, padding: '10px 14px',
          fontSize: 14, outline: 'none', fontFamily: 'inherit',
        }} />

      <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>{gefilterd.length} {gefilterd.length === 1 ? 'techniek' : 'technieken'}</span>
        {zoekterm && (
          <button onClick={() => setZoekterm('')}
            style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: 12, padding: 0, fontFamily: 'inherit' }}>
            ✕ Wis zoekterm
          </button>
        )}
      </div>

      {gefilterd.length === 0 && <LegeStaat label="Geen resultaten voor deze filters." />}

      {!kyuActief && Object.entries(groepen).map(([type, items]) => (
        <TypeSectie key={type} type={type} items={items} openId={openId}
          onToggle={id => setOpenId(prev => prev === id ? null : id)}
          cardRefs={cardRefs} isBeheerder={isBeheerder} role={role} kyuKleuren={kyuKleuren} />
      ))}

      {kyuActief && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
            padding: '10px 14px', background: 'rgba(230,51,70,0.08)',
            border: '1px solid rgba(230,51,70,0.25)', borderRadius: 8,
          }}>
            <span style={{ fontSize: 15 }}>🆕</span>
            <span style={{ fontWeight: 700, fontSize: 14, color: C.text }}>Nieuw voor</span>
            <KyuBadge kyu={filterKyu} kleuren={kyuKleuren} />
            <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted }}>{nieuwVoorKyu.length} technieken</span>
          </div>
          {nieuwVoorKyu.length === 0
            ? <div style={{ color: C.textMuted, fontSize: 13, marginBottom: 16 }}>Geen nieuwe technieken voor dit niveau.</div>
            : Object.entries(groepeerPerType(nieuwVoorKyu)).map(([type, items]) => (
              <TypeSectie key={type} type={type} items={items} openId={openId}
                onToggle={id => setOpenId(prev => prev === id ? null : id)}
                cardRefs={cardRefs} isBeheerder={isBeheerder} role={role} kyuKleuren={kyuKleuren} />
            ))}

          {reedsGekend.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
                padding: '10px 14px', background: 'rgba(148,163,184,0.06)',
                border: `1px solid ${C.borderSoft}`, borderRadius: 8,
              }}>
                <span style={{ fontSize: 15 }}>📚</span>
                <span style={{ fontWeight: 700, fontSize: 14, color: C.textSec }}>Reeds gekend</span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted }}>{reedsGekend.length} technieken</span>
              </div>
              <div style={{ opacity: 0.75 }}>
                {Object.entries(groepeerPerType(reedsGekend)).map(([type, items]) => (
                  <TypeSectie key={type} type={type} items={items} openId={openId}
                    onToggle={id => setOpenId(prev => prev === id ? null : id)}
                    cardRefs={cardRefs} isBeheerder={isBeheerder} role={role} kyuKleuren={kyuKleuren} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── BeheerView ───────────────────────────────────────────────────────────────
function BeheerView({ technieken, importPreview, setImportPreview, importBusy, voerImportUit, importSucces, fileInputRef }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...cardStyle() }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 4 }}>📥 Import</div>
        <div style={{ fontSize: 12, color: C.textSec, marginBottom: 14 }}>
          Laad een Excel-bestand op om technieken toe te voegen of bij te werken.
          Oefenvormen en kyu-drempels worden niet overschreven bij bestaande technieken.
        </div>
        <button onClick={() => fileInputRef.current?.click()} style={buttonStyle('subtle')}>
          📥 Excel importeren
        </button>
        {importSucces && (
          <div style={{ marginTop: 12, background: 'rgba(34,197,94,0.12)', border: `1px solid ${C.green}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.green, fontWeight: 600 }}>
            ✓ {importSucces}
          </div>
        )}
      </div>

      <div style={{ ...cardStyle() }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 4 }}>📤 Export</div>
        <div style={{ fontSize: 12, color: C.textSec, marginBottom: 14 }}>
          Exporteer alle {technieken.length} technieken naar Excel. Handig als back-up of voor bulkwijzigingen.
        </div>
        <button onClick={() => exportExcel(technieken)} style={buttonStyle('subtle')}>
          📤 Exporteren naar Excel ({technieken.length})
        </button>
      </div>

      {importPreview && (
        <ImportModal
          preview={importPreview}
          bestaandeTechnieken={technieken}
          onBevestig={voerImportUit}
          onAnnuleer={() => setImportPreview(null)}
          busy={importBusy}
        />
      )}
    </div>
  );
}

// ─── Tegel-definities ─────────────────────────────────────────────────────────
function buildTegels(isBeheerder) {
  const tegels = [
    { id: 'alle',          icon: '📖', label: 'Alle technieken', desc: 'Volledig overzicht met zoekfunctie',   accentColor: C.red,    accentDim: C.redDim },
    { id: 'per_kyu',       icon: '🥋', label: 'Per kyu',         desc: 'Technieken per gordelniveau',          accentColor: '#8B4513', accentDim: 'rgba(139,69,19,0.18)' },
    { id: 'Val',           icon: '🤸', label: 'Val',          desc: 'Ukemi – valtechnieken',           accentColor: C.blue,   accentDim: C.blueDim },
    { id: 'houdgreep',     icon: '🤼', label: 'Houdgrepen',   desc: 'Osaekomi-waza',                   accentColor: C.green,  accentDim: C.greenDim },
    { id: 'Worpen',        icon: '↗️', label: 'Worpen',       desc: 'Nage-waza',                       accentColor: C.orange, accentDim: C.orangeDim },
    { id: 'Klemmen',       icon: '🔒', label: 'Klemmen',      desc: 'Kansetsu-waza – binnenkort',      accentColor: C.purple, accentDim: C.purpleDim, leeg: true },
    { id: 'Verwurgingen',  icon: '🌀', label: 'Verwurgingen', desc: 'Shime-waza – binnenkort',         accentColor: C.purple, accentDim: C.purpleDim, leeg: true },
    { id: 'Verplaatsing',  icon: '👣', label: 'Verplaatsing', desc: 'Tai sabaki & verplaatsing',       accentColor: '#0EA5E9', accentDim: 'rgba(14,165,233,0.16)' },
    { id: 'Transitie',     icon: '🔄', label: 'Transitie',    desc: 'Overgangen staand → grond',       accentColor: '#F59E0B', accentDim: 'rgba(245,158,11,0.16)' },
  ];
  if (isBeheerder) {
    tegels.push({
      id: 'beheer', icon: '⚙️', label: 'Beheer',
      desc: 'Import & export Excel', accentColor: C.textMuted, accentDim: 'rgba(100,116,139,0.16)',
    });
  }
  return tegels;
}

function buildKyuTegels(kyuKleuren) {
  return KYU_VOLGORDE.filter(k => kyuKleuren[k]).map(k => ({
    id: `kyu_${k}`,
    icon: '🥋',
    label: kyuKleuren[k]?.label || `${k}e kyu`,
    desc: `Technieken voor ${k}e kyu`,
    accentColor: kyuKleuren[k]?.bg || C.red,
    accentDim: KYU_ACCENT_DIM[k] || C.redDim,
    kyuValue: k,
  }));
}

// ─── NavTegel ─────────────────────────────────────────────────────────────────
function NavTegel({ item, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={item.leeg ? undefined : onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov && !item.leeg ? C.cardHover : C.card,
        border: `1px solid ${hov && !item.leeg ? item.accentColor : C.borderSoft}`,
        borderRadius: 20, padding: '18px 14px', cursor: item.leeg ? 'default' : 'pointer',
        textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
        gap: 10, minHeight: 120, position: 'relative', overflow: 'hidden',
        transition: 'background 0.15s, border-color 0.15s',
        opacity: item.leeg ? 0.6 : 1,
      }}>
      <div style={{
        position: 'absolute', top: 0, right: 0, width: 80, height: 80,
        background: `radial-gradient(circle at top right, ${item.accentDim}, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        width: 44, height: 44, background: item.accentDim, borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
      }}>{item.icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: item.leeg ? C.textMuted : C.text, lineHeight: 1.2, marginBottom: 3 }}>
          {item.label}
        </div>
        <div style={{ fontSize: 11, color: C.textMuted, lineHeight: 1.4 }}>{item.desc}</div>
      </div>
    </button>
  );
}

// ─── TitelBalk ────────────────────────────────────────────────────────────────
function TitelBalk({ onTerug, icon, label, accentDim }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <button onClick={onTerug} style={{
        background: C.card, border: `1px solid ${C.borderSoft}`, borderRadius: 10,
        width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: C.textSec, fontSize: 16, flexShrink: 0, fontFamily: 'inherit',
      }}>←</button>
      <div style={{
        width: 40, height: 40, background: accentDim, borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
      }}>{icon}</div>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.text }}>{label}</h2>
    </div>
  );
}

// ─── Hoofdcomponent ───────────────────────────────────────────────────────────
export default function Technieken() {
  const { role, isBeheerder } = useAuth();
  const kyuKleuren = useKyuKleuren();
  const [searchParams] = useSearchParams();

  // Eén onSnapshot voor alle technieken — client-side filtering, geen extra reads
  const [technieken, setTechnieken] = useState([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'technieken'), orderBy('type'), orderBy('techniek'));
    return onSnapshot(q, snap => {
      setTechnieken(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => { console.error('Fout laden technieken:', err); setLoading(false); });
  }, []);

  const [activeTegel, setActiveTegel]   = useState(null);
  const [openId, setOpenId]             = useState(null);
  const [zoekterm, setZoekterm]         = useState('');
  const cardRefs                        = useRef({});

  const [importPreview, setImportPreview] = useState(null);
  const [importBusy, setImportBusy]       = useState(false);
  const [importSucces, setImportSucces]   = useState('');
  const fileInputRef                      = useRef(null);

  // Reset per view-wissel
  useEffect(() => { setZoekterm(''); setOpenId(null); }, [activeTegel]);

  // URL param ?id= → spring naar "alle" + open die kaart
  useEffect(() => {
    const idParam = searchParams.get('id');
    if (!idParam || technieken.length === 0) return;
    setActiveTegel('alle');
    setOpenId(idParam);
    setTimeout(() => {
      const el = cardRefs.current[idParam];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }, [searchParams, technieken]);

  const handleFileChange = useCallback(async e => {
    const file = e.target.files?.[0]; e.target.value = '';
    if (!file) return;
    try { setImportPreview(await parseExcel(file)); }
    catch (err) { alert('Fout bij lezen van het bestand: ' + err.message); }
  }, []);

  const voerImportUit = useCallback(async () => {
    if (!importPreview) return;
    setImportBusy(true);
    try {
      for (const t of importPreview) {
        const id = t._id;
        const bestaand = technieken.find(x => x.id === id);
        const update = {
          type: t.type, techniek: t.techniek,
          basisvoorwaarden: t.basisvoorwaarden, basisfase: t.basisfase,
          verdieping: t.verdieping, aandachtspunten: t.aandachtspunten,
          remediering: t.remediering, updatedAt: serverTimestamp(), updatedBy: role,
        };
        if (bestaand) { await updateDoc(doc(db, 'technieken', id), update); }
        else {
          await setDoc(doc(db, 'technieken', id), {
            ...update, oefenvormen: t.oefenvormen,
            kyu_graden: [], basis_vanaf_kyu: '', verdieping_vanaf_kyu: '',
          });
        }
      }
      setImportSucces(`Import voltooid: ${importPreview.length} technieken bijgewerkt.`);
      setTimeout(() => setImportSucces(''), 5000);
      setImportPreview(null);
    } catch (err) { alert('Fout tijdens import: ' + err.message); }
    setImportBusy(false);
  }, [importPreview, technieken, role]);

  const tegels    = useMemo(() => buildTegels(isBeheerder), [isBeheerder]);
  const kyuTegels = useMemo(() => buildKyuTegels(kyuKleuren), [kyuKleuren]);

  if (!role) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Geen toegang</div>
          <div style={{ color: C.textSec, fontSize: 14 }}>Log in om technieken te bekijken.</div>
        </div>
      </div>
    );
  }

  // Welke data hoort bij de actieve tegel? (alles in memory)
  function techVoorTegel(id) {
    if (!id || id === 'alle') return technieken;
    if (id.startsWith('kyu_')) {
      const k = id.replace('kyu_', '');
      return technieken.filter(t => t.kyu_graden?.includes(k));
    }
    return technieken.filter(t => t.type === id);
  }

  // Zoek de actieve tegel: eerst in hoofd-tegels, dan in kyu-tegels
  const actieveTile  = tegels.find(t => t.id === activeTegel) || kyuTegels.find(t => t.id === activeTegel);
  const techLijst    = techVoorTegel(activeTegel);
  const kyuWaarde    = actieveTile?.kyuValue || null;

  // ── TEGEL-OVERZICHT ───────────────────────────────────────────────────────
  if (!activeTegel) {
    return (
      <div style={{ color: C.text, fontFamily: 'inherit', paddingBottom: 40 }}>
        <input ref={fileInputRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleFileChange} />

        <div style={{ ...cardStyle({ gradient: true }), marginBottom: 24 }}>
          <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(20px,5vw,26px)', fontWeight: 900, color: C.text }}>
            🥋 Technieken
          </h1>
          <p style={{ margin: 0, color: C.textSec, fontSize: 13 }}>
            {loading ? 'Laden…' : `${technieken.length} technieken in de databank`}
          </p>
        </div>

        {loading
          ? <Spinner />
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {tegels.map(t => (
                <NavTegel key={t.id} item={t} onClick={() => setActiveTegel(t.id)} />
              ))}
            </div>}
      </div>
    );
  }

  // ── PER KYU – TUSSENSCHERM ────────────────────────────────────────────────
  if (activeTegel === 'per_kyu') {
    return (
      <div style={{ color: C.text, fontFamily: 'inherit', paddingBottom: 40 }}>
        <input ref={fileInputRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleFileChange} />

        <TitelBalk
          onTerug={() => setActiveTegel(null)}
          icon="🥋"
          label="Per kyu"
          accentDim="rgba(139,69,19,0.18)"
        />

        {loading
          ? <Spinner />
          : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
              {kyuTegels.map(t => (
                <NavTegel key={t.id} item={t} onClick={() => setActiveTegel(t.id)} />
              ))}
            </div>}
      </div>
    );
  }

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────
  const isKyuDetail = activeTegel?.startsWith('kyu_');
  return (
    <div style={{ color: C.text, fontFamily: 'inherit', paddingBottom: 40 }}>
      <input ref={fileInputRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={handleFileChange} />

      <TitelBalk
        onTerug={() => isKyuDetail ? setActiveTegel('per_kyu') : setActiveTegel(null)}
        icon={actieveTile?.icon}
        label={actieveTile?.label}
        accentDim={actieveTile?.accentDim || C.redDim}
      />

      {activeTegel === 'beheer' && (
        <BeheerView
          technieken={technieken}
          importPreview={importPreview}
          setImportPreview={setImportPreview}
          importBusy={importBusy}
          voerImportUit={voerImportUit}
          importSucces={importSucces}
          fileInputRef={fileInputRef}
        />
      )}

      {actieveTile?.leeg && (
        <div style={{ ...cardStyle(), textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🚧</div>
          <div style={{ fontWeight: 700, fontSize: 15, color: C.text, marginBottom: 6 }}>Binnenkort beschikbaar</div>
          <div style={{ fontSize: 13, color: C.textMuted }}>
            Deze categorie wordt later aangevuld via Excel-import in de Beheer-tegel.
          </div>
        </div>
      )}

      {activeTegel !== 'beheer' && !actieveTile?.leeg && (
        loading
          ? <Spinner />
          : techLijst.length === 0
            ? <LegeStaat label="Geen technieken gevonden voor deze categorie." />
            : <TechniekLijstView
                technieken={techLijst}
                filterKyu={kyuWaarde}
                isBeheerder={isBeheerder}
                role={role}
                kyuKleuren={kyuKleuren}
                openId={openId}
                setOpenId={setOpenId}
                cardRefs={cardRefs}
                zoekterm={zoekterm}
                setZoekterm={setZoekterm}
              />
      )}
    </div>
  );
}
