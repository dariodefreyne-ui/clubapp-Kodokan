import React, { useState } from 'react';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { CATS, CAT_LABELS, fmtBedrag } from './winkelData';

// ─── PRODUCTEN TAB ────────────────────────────────────────────────────────────

const EMPTY_NEW = {
  name: '', category: 'judogi', variant: '',
  price: '', costPrice: '', stock: '0',
  tweedehands: false, active: true,
};

const thStyle = {
  textAlign: 'left', padding: '10px 8px', color: '#aaa', fontSize: '12px',
  borderBottom: '1px solid #2a2a2a', fontWeight: '600', whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '10px 8px', borderBottom: '1px solid #1e1e1e',
  fontSize: '13px', verticalAlign: 'middle',
};

export default function ProductenTab({ products }) {
  const [filter,           setFilter]           = useState('alle');
  const [editCell,         setEditCell]         = useState(null); // { id, field }
  const [editVal,          setEditVal]          = useState('');
  const [confirmId,        setConfirmId]        = useState(null);
  const [showNewForm,      setShowNewForm]      = useState(false);
  const [newForm,          setNewForm]          = useState(EMPTY_NEW);
  const [saving,           setSaving]           = useState(false);
  const [bulkPrijsMode,    setBulkPrijsMode]    = useState(false);
  const [bulkPrijsVals,    setBulkPrijsVals]    = useState({});
  const [savingBulkPrijs,  setSavingBulkPrijs]  = useState(false);

  const filtered = products.filter(p => filter === 'alle' || p.category === filter);

  // ── Inline celbewerking ───────────────────────────────────────────────────
  function startEdit(id, field, currentVal) {
    setEditCell({ id, field });
    setEditVal(String(currentVal ?? ''));
  }

  async function commitEdit(p, field) {
    if (!editCell || editCell.id !== p.id || editCell.field !== field) return;
    const val = parseFloat(editVal);
    if (!isNaN(val) && val >= 0) {
      await updateDoc(doc(db, 'products', p.id), { [field]: val });
    }
    setEditCell(null);
  }

  const editing = (id, field) => editCell?.id === id && editCell?.field === field;

  // ── Actief toggle ─────────────────────────────────────────────────────────
  async function toggleActief(p) {
    await updateDoc(doc(db, 'products', p.id), { active: p.active !== false ? false : true });
  }

  // ── Verwijder ─────────────────────────────────────────────────────────────
  async function verwijder(id) {
    await deleteDoc(doc(db, 'products', id));
    setConfirmId(null);
  }

  // ── Nieuw product opslaan ─────────────────────────────────────────────────
  async function saveNew() {
    if (!newForm.name.trim() || !newForm.variant.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'products'), {
        name:       newForm.name.trim(),
        category:   newForm.category,
        variant:    newForm.variant.trim(),
        price:      parseFloat(newForm.price) || 0,
        costPrice:  parseFloat(newForm.costPrice) || 0,
        stock:      parseInt(newForm.stock) || 0,
        soldCount:  0,
        tweedehands: newForm.tweedehands,
        active:     newForm.active,
        createdAt:  serverTimestamp(),
      });
      setNewForm(EMPTY_NEW);
      setShowNewForm(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  }

  // ── Bulk prijzen ──────────────────────────────────────────────────────────
  function startBulkPrijs() {
    const vals = {};
    products.forEach(p => {
      vals[p.id] = { price: String(p.price || 0), costPrice: String(p.costPrice || 0) };
    });
    setBulkPrijsVals(vals);
    setBulkPrijsMode(true);
  }

  function cancelBulkPrijs() { setBulkPrijsMode(false); setBulkPrijsVals({}); }

  async function saveBulkPrijs() {
    setSavingBulkPrijs(true);
    try {
      const batch = writeBatch(db);
      let heeftUpdates = false;
      for (const p of products) {
        const newPrice = parseFloat(bulkPrijsVals[p.id]?.price);
        const newCost  = parseFloat(bulkPrijsVals[p.id]?.costPrice);
        const updates  = {};
        if (!isNaN(newPrice) && newPrice >= 0 && newPrice !== (p.price || 0))     updates.price     = newPrice;
        if (!isNaN(newCost)  && newCost  >= 0 && newCost  !== (p.costPrice || 0)) updates.costPrice = newCost;
        if (Object.keys(updates).length > 0) {
          batch.update(doc(db, 'products', p.id), updates);
          heeftUpdates = true;
        }
      }
      if (heeftUpdates) await batch.commit();
    } catch (e) { console.error(e); }
    setSavingBulkPrijs(false);
    setBulkPrijsMode(false);
    setBulkPrijsVals({});
  }

  // ── Stijlen ───────────────────────────────────────────────────────────────
  const inputStyle = {
    background: '#1a1a1a', border: '1px solid #c0392b', borderRadius: '6px',
    color: '#fff', padding: '4px 8px', fontSize: '13px', width: '72px',
    outline: 'none', textAlign: 'right',
  };
  const bulkInput = {
    background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '6px',
    color: '#fff', padding: '4px 6px', fontSize: '13px', width: '65px',
    outline: 'none', textAlign: 'right',
  };

  return (
    <div>
      {/* Actiebalk */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
        <button
          onClick={() => { setShowNewForm(v => !v); setNewForm(EMPTY_NEW); }}
          style={{ background:'#c0392b', border:'none', color:'#fff', padding:'9px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'600' }}>
          {showNewForm ? '✕ Annuleren' : '+ Nieuw product'}
        </button>
        {bulkPrijsMode ? (
          <>
            <button onClick={saveBulkPrijs} disabled={savingBulkPrijs}
              style={{ background:'#27ae60', border:'none', color:'#fff', padding:'9px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:'600' }}>
              {savingBulkPrijs ? 'Opslaan...' : 'Opslaan'}
            </button>
            <button onClick={cancelBulkPrijs}
              style={{ background:'#3a3a3a', border:'none', color:'#fff', padding:'9px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'14px' }}>
              Annuleren
            </button>
          </>
        ) : (
          <button onClick={startBulkPrijs}
            style={{ background:'#2d2d2d', border:'1px solid #3a3a3a', color:'#ccc', padding:'9px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'14px' }}>
            Bulk prijzen
          </button>
        )}
      </div>

      {/* Inline nieuw-product formulier */}
      {showNewForm && (
        <div style={{ background:'#2d2d2d', borderRadius:'12px', padding:'16px', marginBottom:'16px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
            {[
              ['Naam *',               'name',      'text',   'bv. Judogi'],
              ['Categorie',            'category',  'select', ''],
              ['Variant *',            'variant',   'text',   'bv. Maat 110 / Blauw / L'],
              ['Prijs (€)',            'price',     'number', ''],
              ['Aankoopprijs (€)',      'costPrice', 'number', ''],
              ['Beginstock',           'stock',     'number', ''],
            ].map(([label, field, type, placeholder]) => (
              <div key={field}>
                <div style={{ fontSize:'11px', color:'#aaa', marginBottom:'4px' }}>{label}</div>
                {type === 'select' ? (
                  <select value={newForm[field]}
                    onChange={e => setNewForm(f => ({ ...f, [field]: e.target.value }))}
                    style={{ width:'100%', background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'6px', color:'#fff', padding:'8px 10px', fontSize:'14px', boxSizing:'border-box', outline:'none' }}>
                    {CATS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                  </select>
                ) : (
                  <input
                    type={type}
                    min={type === 'number' ? '0' : undefined}
                    step={field === 'price' || field === 'costPrice' ? '0.01' : undefined}
                    value={newForm[field]}
                    placeholder={placeholder}
                    onChange={e => setNewForm(f => ({ ...f, [field]: e.target.value }))}
                    style={{ width:'100%', background:'#1a1a1a', border:'1px solid #3a3a3a', borderRadius:'6px', color:'#fff', padding:'8px 10px', fontSize:'14px', boxSizing:'border-box', outline:'none' }}
                  />
                )}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:'16px', marginBottom:'14px' }}>
            <label style={{ display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', fontSize:'14px' }}>
              <input type="checkbox" checked={newForm.tweedehands}
                onChange={e => setNewForm(f => ({ ...f, tweedehands: e.target.checked }))} />
              Tweedehands
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', fontSize:'14px' }}>
              <input type="checkbox" checked={newForm.active}
                onChange={e => setNewForm(f => ({ ...f, active: e.target.checked }))} />
              Actief
            </label>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={saveNew}
              disabled={saving || !newForm.name.trim() || !newForm.variant.trim()}
              style={{ background: (!newForm.name.trim() || !newForm.variant.trim()) ? '#555' : '#c0392b', border:'none', color:'#fff', padding:'10px 20px', borderRadius:'8px', cursor: (!newForm.name.trim() || !newForm.variant.trim()) ? 'not-allowed' : 'pointer', fontSize:'14px', fontWeight:'600' }}>
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
            <button onClick={() => setShowNewForm(false)}
              style={{ background:'#3a3a3a', border:'none', color:'#fff', padding:'10px 20px', borderRadius:'8px', cursor:'pointer', fontSize:'14px' }}>
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* Categoriefilter */}
      <div style={{ display:'flex', gap:'6px', overflowX:'auto', marginBottom:'16px', WebkitOverflowScrolling:'touch' }}>
        {[['alle', 'Alle'], ...CATS.map(c => [c, CAT_LABELS[c]])].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            style={{ flexShrink:0, background: filter === v ? '#c0392b' : '#2d2d2d', border:'none', color:'#fff', padding:'7px 13px', borderRadius:'20px', cursor:'pointer', fontSize:'13px', fontWeight: filter === v ? '600' : '400' }}>
            {l}
          </button>
        ))}
      </div>

      {/* Tabel */}
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth:'600px' }}>
          <thead>
            <tr>
              <th style={thStyle}>Naam</th>
              <th style={thStyle}>Variant</th>
              <th style={thStyle}>2e hands</th>
              <th style={{ ...thStyle, textAlign:'right' }}>Prijs</th>
              <th style={{ ...thStyle, textAlign:'right' }}>Aankoop</th>
              <th style={{ ...thStyle, textAlign:'center' }}>Actief</th>
              <th style={thStyle}>Acties</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id}>
                <td style={{ ...tdStyle, fontWeight:'600' }}>{p.name}</td>
                <td style={{ ...tdStyle, color:'#aaa', fontSize:'12px' }}>{p.variant}</td>
                <td style={tdStyle}>
                  {p.tweedehands && (
                    <span style={{ background:'#444', borderRadius:'4px', padding:'2px 7px', fontSize:'11px', color:'#ccc' }}>2e hands</span>
                  )}
                </td>

                {/* Prijs */}
                <td style={{ ...tdStyle, textAlign:'right' }}
                  onClick={() => !bulkPrijsMode && !editing(p.id, 'price') && startEdit(p.id, 'price', p.price || 0)}>
                  {bulkPrijsMode ? (
                    <input type="number" min="0" step="0.01"
                      value={bulkPrijsVals[p.id]?.price ?? String(p.price || 0)}
                      onChange={e => setBulkPrijsVals(prev => ({ ...prev, [p.id]: { ...prev[p.id], price: e.target.value } }))}
                      style={bulkInput}
                    />
                  ) : editing(p.id, 'price') ? (
                    <input autoFocus type="number" min="0" step="0.01" value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onBlur={() => commitEdit(p, 'price')}
                      onKeyDown={e => e.key === 'Enter' && commitEdit(p, 'price')}
                      style={inputStyle}
                    />
                  ) : (
                    <span style={{ cursor:'text', color: (p.price || 0) === 0 ? '#555' : '#fff' }}>
                      {fmtBedrag(p.price || 0)}
                    </span>
                  )}
                </td>

                {/* Aankoopprijs */}
                <td style={{ ...tdStyle, textAlign:'right' }}
                  onClick={() => !bulkPrijsMode && !editing(p.id, 'costPrice') && startEdit(p.id, 'costPrice', p.costPrice || 0)}>
                  {bulkPrijsMode ? (
                    <input type="number" min="0" step="0.01"
                      value={bulkPrijsVals[p.id]?.costPrice ?? String(p.costPrice || 0)}
                      onChange={e => setBulkPrijsVals(prev => ({ ...prev, [p.id]: { ...prev[p.id], costPrice: e.target.value } }))}
                      style={bulkInput}
                    />
                  ) : editing(p.id, 'costPrice') ? (
                    <input autoFocus type="number" min="0" step="0.01" value={editVal}
                      onChange={e => setEditVal(e.target.value)}
                      onBlur={() => commitEdit(p, 'costPrice')}
                      onKeyDown={e => e.key === 'Enter' && commitEdit(p, 'costPrice')}
                      style={inputStyle}
                    />
                  ) : (
                    <span style={{ cursor:'text', color:'#666', fontSize:'12px' }}>
                      {fmtBedrag(p.costPrice || 0)}
                    </span>
                  )}
                </td>

                {/* Actief toggle */}
                <td style={{ ...tdStyle, textAlign:'center' }}>
                  <button onClick={() => toggleActief(p)}
                    style={{ background: p.active !== false ? '#27ae60' : '#555', border:'none', color:'#fff', padding:'4px 10px', borderRadius:'12px', cursor:'pointer', fontSize:'12px', fontWeight:'600' }}>
                    {p.active !== false ? 'Ja' : 'Nee'}
                  </button>
                </td>

                {/* Acties */}
                <td style={tdStyle}>
                  {confirmId === p.id ? (
                    <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'13px' }}>
                      <span style={{ color:'#f39c12' }}>Zeker?</span>
                      <button onClick={() => verwijder(p.id)}
                        style={{ background:'#e74c3c', border:'none', color:'#fff', padding:'4px 10px', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>Ja</button>
                      <button onClick={() => setConfirmId(null)}
                        style={{ background:'#3a3a3a', border:'none', color:'#fff', padding:'4px 10px', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>Nee</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmId(p.id)}
                      style={{ background:'none', border:'1px solid #3a3a3a', color:'#aaa', padding:'4px 10px', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>
                      Verwijder
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ color:'#555', textAlign:'center', padding:'30px', fontSize:'14px' }}>
            {products.length === 0
              ? 'Geen producten. Ga naar Stock-tab om standaardproducten te laden.'
              : 'Geen producten gevonden'}
          </div>
        )}
      </div>
    </div>
  );
}
