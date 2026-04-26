/**
 * Wedstrijden.jsx – Wedstrijdmodule voor Kodokan Clubapp
 *
 * Features:
 *  - Excel-import (.xlsx) van de Judo Vlaanderen kalender
 *    Merge-logica: naam+doelgroep = unieke sleutel
 *    → match gevonden: overschrijven
 *    → geen match: toevoegen
 *    → in app maar niet in Excel: ongemoeid laten
 *  - Tornooilijst: gesorteerd op datum, filterbaar op categorie/maand
 *  - Detailpanel per tornooi: alle velden manueel aanpasbaar
 *  - Judoka toevoegen per tornooi: naam + geboortejaar → auto-categorie
 *  - Categorieberekening op basis van tornooi_jaar - geboortejaar
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, query, orderBy, serverTimestamp, getDocs, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import * as XLSX from 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm';

// ─── Categorie-logica ─────────────────────────────────────────────────────────
function berekenCategorie(geboortejaar, tornooidatum) {
  if (!geboortejaar || !tornooidatum) return '—';
  const jaar = new Date(tornooidatum).getFullYear();
  const leeftijd = jaar - parseInt(geboortejaar);
  if (leeftijd <= 9)  return 'U9';
  if (leeftijd <= 11) return 'U11';
  if (leeftijd <= 13) return 'U13';
  if (leeftijd <= 15) return 'U15';
  if (leeftijd <= 18) return 'U18';
  return 'U21+';
}

const CATEGORIE_COLORS = {
  'U9':   { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  'U11':  { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
  'U13':  { bg: '#dbeafe', color: '#1e40af', border: '#93c5fd' },
  'U15':  { bg: '#ede9fe', color: '#5b21b6', border: '#c4b5fd' },
  'U18':  { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  'U21+': { bg: '#f1f5f9', color: '#334155', border: '#cbd5e1' },
};

// ─── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:      '#111111',
  surface: '#1c1c1e',
  card:    '#242428',
  cardHov: '#2a2a2f',
  border:  '#2e2e35',
  red:     '#e63946',
  redDim:  'rgba(230,57,70,0.12)',
  redBord: 'rgba(230,57,70,0.35)',
  text:    '#f8f8f8',
  textSec: '#9999aa',
  textMut: '#555566',
  green:   '#22c55e',
  amber:   '#f59e0b',
  blue:    '#3b82f6',
};

const PROVINCES = ['ANT','LIM','OVL','WVL','VBR','JV','—'];
const DOELGROEPEN = ['U9','U11','U13','U15','U18','U21+','U9-U11-U13','U11-U13','U15-U18','U15-U18-U21+','U15-U21+','U18+','U21+','Alle'];
const MONTHS_NL = ['Jan','Feb','Mrt','Apr','Mei','Jun','Jul','Aug','Sep','Okt','Nov','Dec'];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('nl-BE', { weekday:'short', day:'numeric', month:'short', year:'numeric' });
}
function formatDateShort(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('nl-BE', { day:'numeric', month:'short' });
}
function isUpcoming(d) {
  return d && new Date(d) >= new Date(new Date().setHours(0,0,0,0));
}
function isSoonish(d) {
  if (!d) return false;
  const diff = new Date(d) - new Date();
  return diff > 0 && diff < 1000 * 60 * 60 * 24 * 14;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Badge({ label, style = {} }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 9px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: '700',
      letterSpacing: '0.4px',
      ...style,
    }}>
      {label}
    </span>
  );
}

function DoelgroepBadges({ doelgroep }) {
  if (!doelgroep) return null;
  const parts = doelgroep.split(/[-\/]/).map(s => s.trim()).filter(Boolean);
  const unique = [...new Set(parts)];
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {unique.map(cat => {
        const c = CATEGORIE_COLORS[cat] || { bg: C.card, color: C.textSec, border: C.border };
        return (
          <Badge key={cat} label={cat} style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }} />
        );
      })}
    </div>
  );
}

// ─── TournamentCard ─────────────────────────────────────────────────────────────
function TournamentCard({ event, isSelected, onClick }) {
  const [hov, setHov] = useState(false);
  const soon = isSoonish(event.datum);
  const upcoming = isUpcoming(event.datum);
  const past = !upcoming;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 0,
        width: '100%',
        background: isSelected ? C.cardHov : hov ? C.cardHov : C.card,
        border: `1px solid ${isSelected ? C.red : hov ? C.border : C.border}`,
        borderLeft: `3px solid ${isSelected ? C.red : soon ? C.amber : past ? C.textMut : C.green}`,
        borderRadius: '10px',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
        fontFamily: 'inherit',
        outline: 'none',
        opacity: past ? 0.65 : 1,
        WebkitTapHighlightColor: 'transparent',
        overflow: 'hidden',
      }}
    >
      {/* Date block */}
      <div style={{
        minWidth: '54px',
        padding: '12px 8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        borderRight: `1px solid ${C.border}`,
        background: isSelected ? C.redDim : 'transparent',
      }}>
        <span style={{ fontSize: '18px', fontWeight: '800', color: isSelected ? C.red : C.text, lineHeight: 1 }}>
          {event.datum ? new Date(event.datum).getDate() : '—'}
        </span>
        <span style={{ fontSize: '10px', color: C.textSec, textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
          {event.datum ? MONTHS_NL[new Date(event.datum).getMonth()] : ''}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '10px 12px', minWidth: 0 }}>
        <div style={{ fontWeight: '700', fontSize: '13px', color: C.text, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {event.naam}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <DoelgroepBadges doelgroep={event.doelgroep} />
          {event.provincie && (
            <span style={{ fontSize: '10px', color: C.textMut, background: C.surface, padding: '1px 6px', borderRadius: '4px', border: `1px solid ${C.border}` }}>
              {event.provincie}
            </span>
          )}
        </div>
        {event.locatie && (
          <div style={{ fontSize: '11px', color: C.textMut, marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            📍 {event.locatie}
          </div>
        )}
      </div>

      {/* Judoka count */}
      <div style={{
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: '44px',
      }}>
        <span style={{ fontSize: '16px', fontWeight: '700', color: (event._judokaCount || 0) > 0 ? C.red : C.textMut }}>
          {event._judokaCount || 0}
        </span>
        <span style={{ fontSize: '9px', color: C.textMut, textTransform: 'uppercase' }}>leden</span>
      </div>
    </button>
  );
}

// ─── DetailPanel ───────────────────────────────────────────────────────────────
function DetailPanel({ event, onClose, onUpdate, onDelete }) {
  const [tab, setTab] = useState('info');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [judoka, setJudoka] = useState([]);
  const [judLoading, setJudLoading] = useState(false);
  const [newJudoka, setNewJudoka] = useState({ naam: '', geboortejaar: '' });
  const [saving, setSaving] = useState(false);
  const [addingJudoka, setAddingJudoka] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    setForm({ ...event });
    setEditing(false);
    setTab('info');
  }, [event?.id]);

  useEffect(() => {
    if (!event?.id) return;
    setJudLoading(true);
    const q = query(collection(db, 'events', event.id, 'judoka'), orderBy('naam'));
    const unsub = onSnapshot(q, snap => {
      setJudoka(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setJudLoading(false);
    }, () => setJudLoading(false));
    return unsub;
  }, [event?.id]);

  async function handleSave() {
    setSaving(true);
    try {
      const { id, _judokaCount, ...data } = form;
      await updateDoc(doc(db, 'events', event.id), { ...data, updatedAt: serverTimestamp() });
      onUpdate && onUpdate({ ...event, ...data });
      setEditing(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  async function handleAddJudoka() {
    if (!newJudoka.naam.trim() || !newJudoka.geboortejaar) return;
    setAddingJudoka(true);
    try {
      const cat = berekenCategorie(newJudoka.geboortejaar, event.datum);
      await addDoc(collection(db, 'events', event.id, 'judoka'), {
        naam: newJudoka.naam.trim(),
        geboortejaar: parseInt(newJudoka.geboortejaar),
        categorie: cat,
        addedAt: serverTimestamp(),
      });
      // Update count on parent
      await updateDoc(doc(db, 'events', event.id), {
        _judokaCount: judoka.length + 1,
      });
      setNewJudoka({ naam: '', geboortejaar: '' });
    } catch (e) { console.error(e); }
    setAddingJudoka(false);
  }

  async function handleRemoveJudoka(jid) {
    await deleteDoc(doc(db, 'events', event.id, 'judoka', jid));
    await updateDoc(doc(db, 'events', event.id), {
      _judokaCount: Math.max(0, judoka.length - 1),
    });
  }

  async function handleDelete() {
    await deleteDoc(doc(db, 'events', event.id));
    onDelete && onDelete(event.id);
    onClose();
  }

  const f = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const inputStyle = {
    width: '100%',
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderRadius: '8px',
    color: C.text,
    padding: '9px 12px',
    fontSize: '14px',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    outline: 'none',
  };

  const labelStyle = { fontSize: '11px', color: C.textSec, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '5px', fontWeight: '600' };

  // Group judoka by categorie
  const byCategorie = judoka.reduce((acc, j) => {
    const cat = j.categorie || '—';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(j);
    return acc;
  }, {});

  return (
    <div style={{
      background: C.card,
      border: `1px solid ${C.border}`,
      borderRadius: '14px',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 18px 0',
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: '800', color: C.text, lineHeight: 1.3, marginBottom: '4px' }}>
              {event.naam}
            </div>
            <div style={{ fontSize: '13px', color: C.textSec }}>
              {formatDate(event.datum)}
              {event.startuur && ` · ${event.startuur}${event.einduur ? `–${event.einduur}` : ''}`}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.textSec, fontSize: '16px', cursor: 'pointer', padding: '6px 10px', lineHeight: 1, flexShrink: 0, fontFamily: 'inherit' }}
          >✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0 }}>
          {[['info','ℹ️ Info'], ['judoka',`👥 Judoka (${judoka.length})`]].map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: 'none',
              border: 'none',
              borderBottom: `2px solid ${tab === t ? C.red : 'transparent'}`,
              color: tab === t ? C.red : C.textSec,
              padding: '8px 14px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: tab === t ? '700' : '400',
              fontFamily: 'inherit',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px' }}>

        {/* ── INFO TAB ── */}
        {tab === 'info' && (
          <div>
            {!editing ? (
              <>
                <InfoRow label="Doelgroep" value={<DoelgroepBadges doelgroep={event.doelgroep} />} />
                <InfoRow label="Locatie" value={event.locatie} />
                <InfoRow label="Adres" value={event.adres} />
                <InfoRow label="Organiserende club" value={event.club} />
                <InfoRow label="Provincie" value={event.provincie} />
                <InfoRow label="Start" value={event.startuur} />
                <InfoRow label="Einde" value={event.einduur} />
                <InfoRow label="Max deelnemers" value={event.maxDln} />
                <InfoRow label="# Matten" value={event.aantalMatten} />

                <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap' }}>
                  <button style={btnStyle('primary')} onClick={() => setEditing(true)}>✏️ Bewerken</button>
                  <button style={btnStyle('danger')} onClick={() => setConfirmDel(true)}>🗑 Verwijderen</button>
                </div>
              </>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <Field label="Naam tornooi">
                  <input style={inputStyle} value={form.naam || ''} onChange={e => f('naam', e.target.value)} />
                </Field>
                <Field label="Datum">
                  <input style={inputStyle} type="date" value={form.datum ? form.datum.slice(0, 10) : ''} onChange={e => f('datum', e.target.value)} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <Field label="Startuur">
                    <input style={inputStyle} value={form.startuur || ''} onChange={e => f('startuur', e.target.value)} placeholder="08:00" />
                  </Field>
                  <Field label="Einduur">
                    <input style={inputStyle} value={form.einduur || ''} onChange={e => f('einduur', e.target.value)} placeholder="17:00" />
                  </Field>
                </div>
                <Field label="Doelgroep">
                  <input style={inputStyle} value={form.doelgroep || ''} onChange={e => f('doelgroep', e.target.value)} placeholder="bv. U11-U13" />
                </Field>
                <Field label="Locatie">
                  <input style={inputStyle} value={form.locatie || ''} onChange={e => f('locatie', e.target.value)} />
                </Field>
                <Field label="Adres">
                  <input style={inputStyle} value={form.adres || ''} onChange={e => f('adres', e.target.value)} />
                </Field>
                <Field label="Organiserende club">
                  <input style={inputStyle} value={form.club || ''} onChange={e => f('club', e.target.value)} />
                </Field>
                <Field label="Provincie">
                  <select style={inputStyle} value={form.provincie || ''} onChange={e => f('provincie', e.target.value)}>
                    <option value="">—</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <Field label="Max deelnemers">
                    <input style={inputStyle} value={form.maxDln || ''} onChange={e => f('maxDln', e.target.value)} />
                  </Field>
                  <Field label="# Matten">
                    <input style={inputStyle} value={form.aantalMatten || ''} onChange={e => f('aantalMatten', e.target.value)} />
                  </Field>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={{ ...btnStyle('primary'), flex: 1 }} onClick={handleSave} disabled={saving}>
                    {saving ? 'Opslaan...' : '✓ Opslaan'}
                  </button>
                  <button style={btnStyle('ghost')} onClick={() => { setEditing(false); setForm({ ...event }); }}>
                    Annuleer
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── JUDOKA TAB ── */}
        {tab === 'judoka' && (
          <div>
            {/* Add judoka form */}
            <div style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: '10px',
              padding: '14px',
              marginBottom: '18px',
            }}>
              <div style={{ fontSize: '12px', fontWeight: '700', color: C.textSec, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '10px' }}>
                Judoka toevoegen
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px', marginBottom: '8px' }}>
                <input
                  style={inputStyle}
                  placeholder="Naam judoka"
                  value={newJudoka.naam}
                  onChange={e => setNewJudoka(p => ({ ...p, naam: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && document.getElementById('gbj-input')?.focus()}
                />
                <input
                  id="gbj-input"
                  style={{ ...inputStyle, width: '90px' }}
                  placeholder="Jaar"
                  type="number"
                  min="2000"
                  max="2025"
                  value={newJudoka.geboortejaar}
                  onChange={e => setNewJudoka(p => ({ ...p, geboortejaar: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleAddJudoka()}
                />
              </div>
              {newJudoka.geboortejaar && newJudoka.geboortejaar.length === 4 && (
                <div style={{ fontSize: '12px', color: C.textSec, marginBottom: '8px' }}>
                  Categorie: <strong style={{ color: C.text }}>{berekenCategorie(newJudoka.geboortejaar, event.datum)}</strong>
                </div>
              )}
              <button
                style={{ ...btnStyle('primary'), width: '100%' }}
                onClick={handleAddJudoka}
                disabled={addingJudoka || !newJudoka.naam.trim() || !newJudoka.geboortejaar}
              >
                {addingJudoka ? 'Toevoegen...' : '+ Toevoegen'}
              </button>
            </div>

            {/* Judoka list grouped by categorie */}
            {judLoading ? (
              <div style={{ color: C.textSec, textAlign: 'center', padding: '24px' }}>Laden...</div>
            ) : judoka.length === 0 ? (
              <div style={{ color: C.textMut, textAlign: 'center', padding: '24px', fontSize: '14px' }}>
                Nog geen judoka ingeschreven.
              </div>
            ) : (
              Object.entries(byCategorie)
                .sort(([a], [b]) => {
                  const order = ['U9','U11','U13','U15','U18','U21+','—'];
                  return order.indexOf(a) - order.indexOf(b);
                })
                .map(([cat, list]) => {
                  const cc = CATEGORIE_COLORS[cat] || { bg: C.surface, color: C.textSec, border: C.border };
                  return (
                    <div key={cat} style={{ marginBottom: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ background: cc.bg, color: cc.color, border: `1px solid ${cc.border}`, padding: '2px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700' }}>
                          {cat}
                        </span>
                        <span style={{ fontSize: '12px', color: C.textMut }}>{list.length} judoka</span>
                      </div>
                      {list.map(j => (
                        <div key={j.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '9px 12px',
                          background: C.surface,
                          borderRadius: '8px',
                          marginBottom: '5px',
                          border: `1px solid ${C.border}`,
                        }}>
                          <span style={{
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: C.redDim, border: `1px solid ${C.redBord}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: '700', color: C.red, flexShrink: 0,
                          }}>
                            {(j.naam || '?').charAt(0).toUpperCase()}
                          </span>
                          <span style={{ flex: 1, fontSize: '14px', color: C.text }}>{j.naam}</span>
                          <span style={{ fontSize: '12px', color: C.textMut }}>{j.geboortejaar}</span>
                          <button
                            onClick={() => handleRemoveJudoka(j.id)}
                            style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '16px', padding: '2px 4px', lineHeight: 1 }}
                          >✕</button>
                        </div>
                      ))}
                    </div>
                  );
                })
            )}
          </div>
        )}
      </div>

      {/* Confirm delete */}
      {confirmDel && (
        <div style={{ padding: '16px 18px', borderTop: `1px solid ${C.border}`, background: 'rgba(230,57,70,0.08)', flexShrink: 0 }}>
          <div style={{ fontSize: '14px', color: C.text, marginBottom: '10px', fontWeight: '600' }}>
            Tornooi verwijderen?
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={{ ...btnStyle('danger'), flex: 1 }} onClick={handleDelete}>Ja, verwijderen</button>
            <button style={btnStyle('ghost')} onClick={() => setConfirmDel(false)}>Annuleer</button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '9px 0', borderBottom: `1px solid ${C.border}`, gap: '12px' }}>
      <span style={{ fontSize: '12px', color: C.textSec, flexShrink: 0, paddingTop: '2px' }}>{label}</span>
      <span style={{ fontSize: '14px', color: C.text, textAlign: 'right' }}>{value}</span>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div>
      <label style={{ fontSize: '11px', color: C.textSec, textTransform: 'uppercase', letterSpacing: '0.6px', display: 'block', marginBottom: '5px', fontWeight: '600' }}>{label}</label>
      {children}
    </div>
  );
}
function btnStyle(v = 'primary') {
  const base = { border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600', padding: '10px 16px', fontFamily: 'inherit', transition: 'background 0.15s' };
  if (v === 'primary') return { ...base, background: C.red, color: '#fff' };
  if (v === 'danger')  return { ...base, background: '#e74c3c', color: '#fff' };
  if (v === 'ghost')   return { ...base, background: C.surface, border: `1px solid ${C.border}`, color: C.textSec };
  return base;
}

// ─── ExcelImport ───────────────────────────────────────────────────────────────
function ExcelImport({ onDone }) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState(null); // null | 'importing' | {added,updated,errors}
  const fileRef = useRef();

  async function processFile(file) {
    if (!file) return;
    setStatus('importing');
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

      // Find header row
      const headerRow = rows.findIndex(r => r.some(c => String(c).toLowerCase().includes('datum')));
      if (headerRow === -1) { setStatus({ error: 'Geen geldige header gevonden in Excel.' }); return; }

      const headers = rows[headerRow].map(h => String(h || '').toLowerCase().trim());
      const idx = k => headers.findIndex(h => h.includes(k));

      const colDatum    = idx('datum');
      const colNaam     = idx('naam');
      const colDoel     = idx('doelgroep');
      const colStart    = idx('startuur');
      const colEind     = idx('einduur');
      const colMatten   = idx('matten');
      const colMax      = idx('max');
      const colLocatie  = idx('locatie');
      const colAdres    = idx('adres');
      const colClubNr   = idx('clubnr');
      const colClub     = headers.findIndex((h, i) => h === 'club' && i !== colClubNr);
      const colProv     = idx('provincie');

      const dataRows = rows.slice(headerRow + 1).filter(r => r[colDatum] && r[colNaam]);

      // Load existing events from Firestore
      const snap = await getDocs(collection(db, 'events'));
      const existing = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.type === 'wedstrijd');

      const batch = writeBatch(db);
      let added = 0, updated = 0;

      for (const row of dataRows) {
        const rawDate = row[colDatum];
        let dateStr = '';
        if (rawDate instanceof Date) {
          dateStr = rawDate.toISOString().slice(0, 10);
        } else if (typeof rawDate === 'string') {
          dateStr = rawDate.slice(0, 10);
        } else if (typeof rawDate === 'number') {
          // Excel serial
          const d = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
          dateStr = d.toISOString().slice(0, 10);
        }

        const naam = String(row[colNaam] || '').trim();
        const doelgroep = String(row[colDoel] || '').trim();

        if (!naam) continue;

        const data = {
          type: 'wedstrijd',
          datum: dateStr,
          naam,
          doelgroep,
          startuur: colStart >= 0 ? String(row[colStart] || '') : '',
          einduur:  colEind >= 0  ? String(row[colEind] || '')  : '',
          aantalMatten: colMatten >= 0 ? String(row[colMatten] || '') : '',
          maxDln:   colMax >= 0   ? String(row[colMax] || '')   : '',
          locatie:  colLocatie >= 0 ? String(row[colLocatie] || '')  : '',
          adres:    colAdres >= 0   ? String(row[colAdres] || '')    : '',
          clubnr:   colClubNr >= 0  ? String(row[colClubNr] || '')   : '',
          club:     colClub >= 0    ? String(row[colClub] || '')     : '',
          provincie: colProv >= 0   ? String(row[colProv] || '')     : '',
          _judokaCount: 0,
        };

        // Match: naam + doelgroep
        const match = existing.find(e =>
          e.naam?.trim().toLowerCase() === naam.toLowerCase() &&
          e.doelgroep?.trim().toLowerCase() === doelgroep.toLowerCase()
        );

        if (match) {
          const ref = doc(db, 'events', match.id);
          batch.update(ref, { ...data, updatedAt: serverTimestamp() });
          updated++;
        } else {
          const ref = doc(collection(db, 'events'));
          batch.set(ref, { ...data, createdAt: serverTimestamp() });
          added++;
        }
      }

      await batch.commit();
      setStatus({ added, updated, total: dataRows.length });
      onDone && onDone();
    } catch (e) {
      console.error(e);
      setStatus({ error: e.message || 'Onbekende fout bij import.' });
    }
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]); }}
        onClick={() => fileRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? C.red : C.border}`,
          borderRadius: '10px',
          padding: '18px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? C.redDim : C.surface,
          transition: 'all 0.2s',
        }}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
          onChange={e => processFile(e.target.files[0])} />
        <div style={{ fontSize: '24px', marginBottom: '6px' }}>📊</div>
        <div style={{ fontSize: '13px', color: C.textSec, fontWeight: '600' }}>
          {status === 'importing' ? '⏳ Importeren...' : 'Sleep Excel-bestand hier of klik om te kiezen'}
        </div>
        <div style={{ fontSize: '11px', color: C.textMut, marginTop: '4px' }}>
          Judo Vlaanderen kalender (.xlsx)
        </div>
      </div>

      {status && status !== 'importing' && (
        <div style={{
          marginTop: '10px',
          padding: '12px 14px',
          borderRadius: '8px',
          background: status.error ? 'rgba(230,57,70,0.1)' : 'rgba(34,197,94,0.1)',
          border: `1px solid ${status.error ? C.red : C.green}`,
          fontSize: '13px',
          color: status.error ? '#e74c3c' : C.green,
        }}>
          {status.error ? `❌ ${status.error}` : `✓ Import klaar — ${status.added} nieuw, ${status.updated} bijgewerkt (van ${status.total} rijen)`}
        </div>
      )}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function Wedstrijden() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('alle');
  const [filterMonth, setFilterMonth] = useState('alle');
  const [showImport, setShowImport] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState({ naam: '', datum: '', doelgroep: '', locatie: '', provincie: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('datum'));
    const unsub = onSnapshot(q, snap => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(e => e.type === 'wedstrijd'));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, []);

  // Keep selected in sync
  useEffect(() => {
    if (selected) {
      const updated = events.find(e => e.id === selected.id);
      if (updated) setSelected(updated);
    }
  }, [events]);

  // Categories present in data
  const allCats = [...new Set(
    events.flatMap(e => (e.doelgroep || '').split('-').map(s => s.trim()).filter(Boolean))
  )].sort();

  const allMonths = [...new Set(
    events.filter(e => e.datum).map(e => new Date(e.datum).getMonth())
  )].sort((a, b) => a - b);

  const filtered = events.filter(e => {
    const matchSearch = !search || e.naam?.toLowerCase().includes(search.toLowerCase()) || e.locatie?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'alle' || (e.doelgroep || '').includes(filterCat);
    const matchMonth = filterMonth === 'alle' || (e.datum && new Date(e.datum).getMonth() === parseInt(filterMonth));
    return matchSearch && matchCat && matchMonth;
  });

  // Split upcoming / past
  const upcoming = filtered.filter(e => isUpcoming(e.datum));
  const past = filtered.filter(e => !isUpcoming(e.datum));

  async function handleCreate() {
    if (!newForm.naam.trim() || !newForm.datum) return;
    setCreating(true);
    try {
      const ref = await addDoc(collection(db, 'events'), {
        ...newForm,
        type: 'wedstrijd',
        _judokaCount: 0,
        createdAt: serverTimestamp(),
      });
      setShowNewForm(false);
      setNewForm({ naam: '', datum: '', doelgroep: '', locatie: '', provincie: '' });
      // Select new event
      setSelected({ id: ref.id, ...newForm, type: 'wedstrijd', _judokaCount: 0 });
    } catch (e) { console.error(e); }
    setCreating(false);
  }

  const stats = {
    total: events.length,
    upcoming: events.filter(e => isUpcoming(e.datum)).length,
    judoka: events.reduce((s, e) => s + (e._judokaCount || 0), 0),
  };

  return (
    <div style={{ color: C.text, fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif", paddingBottom: '40px' }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
        input:focus, select:focus { border-color: ${C.red} !important; box-shadow: 0 0 0 3px ${C.redDim} !important; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>🏆 Wedstrijden</h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: C.textSec }}>Seizoenskalender Judo Kodokan Merchtem</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button style={{ ...btnStyle('ghost'), fontSize: '12px' }} onClick={() => setShowImport(s => !s)}>
              📊 {showImport ? 'Verberg import' : 'Excel importeren'}
            </button>
            <button style={{ ...btnStyle('primary'), fontSize: '12px' }} onClick={() => setShowNewForm(s => !s)}>
              + Tornooi
            </button>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
          {[
            ['🏆', stats.total, 'tornooien'],
            ['📅', stats.upcoming, 'komend'],
            ['👥', stats.judoka, 'judoka ingeschreven'],
          ].map(([icon, val, lbl]) => (
            <div key={lbl} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '10px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>{icon}</span>
              <span style={{ fontWeight: '800', fontSize: '18px', color: C.text }}>{val}</span>
              <span style={{ fontSize: '12px', color: C.textSec }}>{lbl}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Excel import ── */}
      {showImport && (
        <div style={{ animation: 'fadeIn 0.2s ease', marginBottom: '8px' }}>
          <ExcelImport onDone={() => setShowImport(false)} />
        </div>
      )}

      {/* ── New tornooi form ── */}
      {showNewForm && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px', padding: '16px', marginBottom: '20px', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '14px', color: C.text }}>Nieuw tornooi</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {[
              ['naam', 'Naam tornooi', 'text', 'bv. Mansio Cup'],
              ['datum', 'Datum', 'date', ''],
              ['doelgroep', 'Doelgroep', 'text', 'bv. U11-U13'],
              ['locatie', 'Locatie', 'text', 'Sporthal...'],
            ].map(([key, lbl, type, ph]) => (
              <Field key={key} label={lbl}>
                <input
                  style={{ width: '100%', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, padding: '9px 12px', fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
                  type={type}
                  placeholder={ph}
                  value={newForm[key] || ''}
                  onChange={e => setNewForm(p => ({ ...p, [key]: e.target.value }))}
                />
              </Field>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button style={{ ...btnStyle('primary') }} onClick={handleCreate} disabled={creating || !newForm.naam || !newForm.datum}>
              {creating ? 'Aanmaken...' : '✓ Aanmaken'}
            </button>
            <button style={btnStyle('ghost')} onClick={() => setShowNewForm(false)}>Annuleer</button>
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          placeholder="🔍 Zoek tornooi of locatie..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: '1 1 200px',
            background: C.card,
            border: `1px solid ${C.border}`,
            borderRadius: '8px',
            color: C.text,
            padding: '9px 13px',
            fontSize: '13px',
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, padding: '9px 12px', fontSize: '13px', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}
        >
          <option value="alle">Alle categorieën</option>
          {allCats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterMonth}
          onChange={e => setFilterMonth(e.target.value)}
          style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '8px', color: C.text, padding: '9px 12px', fontSize: '13px', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}
        >
          <option value="alle">Alle maanden</option>
          {allMonths.map(m => <option key={m} value={m}>{MONTHS_NL[m]}</option>)}
        </select>
      </div>

      {/* ── Layout ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: selected ? 'minmax(0,1fr) minmax(0,420px)' : '1fr',
        gap: '20px',
        alignItems: 'start',
      }}>
        {/* Left: list */}
        <div>
          {loading ? (
            <div style={{ color: C.textSec, textAlign: 'center', padding: '60px' }}>Laden...</div>
          ) : filtered.length === 0 ? (
            <div style={{ color: C.textMut, textAlign: 'center', padding: '60px', fontSize: '14px' }}>
              Geen tornooien gevonden.{events.length === 0 && ' Importeer de Excel-kalender via de knop hierboven.'}
            </div>
          ) : (
            <>
              {upcoming.length > 0 && (
                <Section label={`Komende tornooien (${upcoming.length})`}>
                  {upcoming.map(e => (
                    <TournamentCard key={e.id} event={e} isSelected={selected?.id === e.id} onClick={() => setSelected(selected?.id === e.id ? null : e)} />
                  ))}
                </Section>
              )}
              {past.length > 0 && (
                <Section label={`Voorbije tornooien (${past.length})`} muted>
                  {past.map(e => (
                    <TournamentCard key={e.id} event={e} isSelected={selected?.id === e.id} onClick={() => setSelected(selected?.id === e.id ? null : e)} />
                  ))}
                </Section>
              )}
            </>
          )}
        </div>

        {/* Right: detail */}
        {selected && (
          <div style={{ position: 'sticky', top: '16px', maxHeight: '85vh', display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease' }}>
            <DetailPanel
              event={selected}
              onClose={() => setSelected(null)}
              onUpdate={updated => setSelected(updated)}
              onDelete={() => setSelected(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ label, children, muted = false }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <span style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1.2px', color: muted ? C.textMut : C.red }}>
          {label}
        </span>
        <div style={{ flex: 1, height: '1px', background: C.border }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {children}
      </div>
    </div>
  );
}
