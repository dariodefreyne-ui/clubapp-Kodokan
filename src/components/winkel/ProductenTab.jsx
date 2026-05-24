import React, { useState } from 'react';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { CATS, CAT_LABELS, fmtBedrag } from './winkelData';
import { CATEGORIE_NAAM, MAAT_SUGGESTIES, formVelden, bouwVariantTekst } from './productFacets';
import { useConfirm } from '../../contexts/ConfirmContext';

// ─── PRODUCTEN TAB ────────────────────────────────────────────────────────────

const EMPTY_NEW = {
  category: 'judogi', type: '', maat: '', geslacht: '',
  price: '', costPrice: '', stock: '0',
  tweedehands: false, active: true,
};

// Bouw het op te slaan product op uit de structurele velden van het formulier.
function bouwProductUitForm(f) {
  const category = f.category;
  const facet = { type: f.type || null, maat: f.maat?.trim() || null, geslacht: f.geslacht || null };
  return {
    name: CATEGORIE_NAAM[category] || category,
    category,
    variant: bouwVariantTekst(category, facet),
    type: facet.type,
    maat: facet.maat,
    geslacht: facet.geslacht,
  };
}

const thStyle = {
  textAlign: 'left', padding: '10px 8px', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)',
  borderBottom: '1px solid var(--bg-secondary)', fontWeight: '600', whiteSpace: 'nowrap',
};
const tdStyle = {
  padding: '10px 8px', borderBottom: '1px solid var(--bg-primary)',
  fontSize: 'var(--font-size-sm)', verticalAlign: 'middle',
};

export default function ProductenTab({ products }) {
  const confirm = useConfirm();
  const [filter,           setFilter]           = useState('alle');
  const [editCell,         setEditCell]         = useState(null); // { id, field }
  const [editVal,          setEditVal]          = useState('');
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
  async function verwijder(product) {
    const ok = await confirm({
      titel: 'Product verwijderen?',
      beschrijving: product?.name
        ? `"${product.name}${product.variant ? ' ' + product.variant : ''}" wordt definitief uit het assortiment verwijderd.`
        : 'Dit product wordt definitief verwijderd.',
      bevestigLabel: 'Ja, verwijderen',
      variant: 'danger',
    });
    if (!ok) return;
    await deleteDoc(doc(db, 'products', product.id));
  }

  // ── Nieuw product opslaan ─────────────────────────────────────────────────
  const formCompleet = formVelden(newForm.category).every(v => String(newForm[v.key] || '').trim() !== '');

  async function saveNew() {
    if (!formCompleet) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'products'), {
        ...bouwProductUitForm(newForm),
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
    background: 'var(--bg-primary)', border: '1px solid var(--accent-red)', borderRadius: '6px',
    color: 'var(--text-primary)', padding: '4px 8px', fontSize: 'var(--font-size-sm)', width: '72px',
    outline: 'none', textAlign: 'right',
  };
  const bulkInput = {
    background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px',
    color: 'var(--text-primary)', padding: '4px 6px', fontSize: 'var(--font-size-sm)', width: '65px',
    outline: 'none', textAlign: 'right',
  };
  const veldLabel = { fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: '4px' };
  const veldInput = { width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', padding: '8px 10px', fontSize: 'var(--font-size-md)', boxSizing: 'border-box', outline: 'none' };

  return (
    <div>
      {/* Actiebalk */}
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px', flexWrap:'wrap', alignItems:'center' }}>
        <button
          onClick={() => { setShowNewForm(v => !v); setNewForm(EMPTY_NEW); }}
          style={{ background:'var(--accent-red)', border:'none', color:'var(--text-primary)', padding:'9px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'var(--font-size-md)', fontWeight:'600' }}>
          {showNewForm ? '✕ Annuleren' : '+ Nieuw product'}
        </button>
        {bulkPrijsMode ? (
          <>
            <button onClick={saveBulkPrijs} disabled={savingBulkPrijs}
              style={{ background:'var(--success)', border:'none', color:'var(--text-primary)', padding:'9px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'var(--font-size-md)', fontWeight:'600' }}>
              {savingBulkPrijs ? 'Opslaan...' : 'Opslaan'}
            </button>
            <button onClick={cancelBulkPrijs}
              style={{ background:'var(--border-color)', border:'none', color:'var(--text-primary)', padding:'9px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'var(--font-size-md)' }}>
              Annuleren
            </button>
          </>
        ) : (
          <button onClick={startBulkPrijs}
            style={{ background:'var(--bg-card)', border:'1px solid var(--border-color)', color:'#ccc', padding:'9px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'var(--font-size-md)' }}>
            Bulk prijzen
          </button>
        )}
      </div>

      {/* Inline nieuw-product formulier */}
      {showNewForm && (
        <div style={{ background:'var(--bg-card)', borderRadius:'12px', padding:'16px', marginBottom:'16px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
            <div style={{ gridColumn:'1 / -1' }}>
              <div style={veldLabel}>Categorie</div>
              <select value={newForm.category}
                onChange={e => setNewForm({ ...EMPTY_NEW, category: e.target.value })}
                style={veldInput}>
                {CATS.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
              </select>
            </div>
            {formVelden(newForm.category).map(veld => (
              <div key={veld.key}>
                <div style={veldLabel}>{veld.label}</div>
                {veld.opties ? (
                  <select value={newForm[veld.key] || ''}
                    onChange={e => setNewForm(f => ({ ...f, [veld.key]: e.target.value }))}
                    style={veldInput}>
                    <option value="">—</option>
                    {veld.opties.map(([w, l]) => <option key={w} value={w}>{l}</option>)}
                  </select>
                ) : (
                  <>
                    <input list={`maat-${newForm.category}`} value={newForm[veld.key] || ''}
                      placeholder="bv. 150 / M"
                      onChange={e => setNewForm(f => ({ ...f, [veld.key]: e.target.value }))}
                      style={veldInput} />
                    <datalist id={`maat-${newForm.category}`}>
                      {(MAAT_SUGGESTIES[newForm.category] || []).map(m => <option key={m} value={m} />)}
                    </datalist>
                  </>
                )}
              </div>
            ))}
            {[['Prijs (€)', 'price'], ['Aankoopprijs (€)', 'costPrice'], ['Beginstock', 'stock']].map(([label, field]) => (
              <div key={field}>
                <div style={veldLabel}>{label}</div>
                <input type="number" min="0" step={field === 'stock' ? '1' : '0.01'}
                  value={newForm[field]}
                  onChange={e => setNewForm(f => ({ ...f, [field]: e.target.value }))}
                  style={veldInput} />
              </div>
            ))}
          </div>
          <div style={{ fontSize:'var(--font-size-xs)', color:'var(--text-secondary)', marginBottom:'10px' }}>
            Wordt opgeslagen als: <strong style={{ color:'var(--text-primary)' }}>{CATEGORIE_NAAM[newForm.category]} {bouwVariantTekst(newForm.category, { type: newForm.type, maat: newForm.maat, geslacht: newForm.geslacht })}</strong>
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
              disabled={saving || !formCompleet}
              style={{ background: !formCompleet ? 'var(--border-color)' : 'var(--accent-red)', border:'none', color:'var(--text-primary)', padding:'10px 20px', borderRadius:'8px', cursor: !formCompleet ? 'not-allowed' : 'pointer', fontSize:'var(--font-size-md)', fontWeight:'600' }}>
              {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
            <button onClick={() => setShowNewForm(false)}
              style={{ background:'var(--border-color)', border:'none', color:'var(--text-primary)', padding:'10px 20px', borderRadius:'8px', cursor:'pointer', fontSize:'var(--font-size-md)' }}>
              Annuleren
            </button>
          </div>
        </div>
      )}

      {/* Categoriefilter */}
      <div style={{ display:'flex', gap:'6px', overflowX:'auto', marginBottom:'16px', WebkitOverflowScrolling:'touch' }}>
        {[['alle', 'Alle'], ...CATS.map(c => [c, CAT_LABELS[c]])].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)}
            style={{ flexShrink:0, background: filter === v ? 'var(--accent-red)' : 'var(--bg-card)', border:'none', color:'var(--text-primary)', padding:'7px 13px', borderRadius:'20px', cursor:'pointer', fontSize:'var(--font-size-sm)', fontWeight: filter === v ? '600' : '400' }}>
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
                <td style={{ ...tdStyle, color:'var(--text-secondary)', fontSize:'var(--font-size-sm)' }}>{p.variant}</td>
                <td style={tdStyle}>
                  {p.tweedehands && (
                    <span style={{ background:'var(--border-color)', borderRadius:'4px', padding:'2px 7px', fontSize:'var(--font-size-xs)', color:'#ccc' }}>2e hands</span>
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
                    <span style={{ cursor:'text', color: (p.price || 0) === 0 ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
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
                    <span style={{ cursor:'text', color:'var(--text-secondary)', fontSize:'var(--font-size-sm)' }}>
                      {fmtBedrag(p.costPrice || 0)}
                    </span>
                  )}
                </td>

                {/* Actief toggle */}
                <td style={{ ...tdStyle, textAlign:'center' }}>
                  <button onClick={() => toggleActief(p)}
                    style={{ background: p.active !== false ? 'var(--success)' : 'var(--border-color)', border:'none', color:'var(--text-primary)', padding:'4px 10px', borderRadius:'12px', cursor:'pointer', fontSize:'var(--font-size-sm)', fontWeight:'600' }}>
                    {p.active !== false ? 'Ja' : 'Nee'}
                  </button>
                </td>

                {/* Acties */}
                <td style={tdStyle}>
                  <button onClick={() => verwijder(p)}
                    style={{ background:'none', border:'1px solid var(--border-color)', color:'var(--text-secondary)', padding:'4px 10px', borderRadius:'6px', cursor:'pointer', fontSize:'var(--font-size-sm)' }}>
                    Verwijder
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ color:'var(--text-secondary)', textAlign:'center', padding:'30px', fontSize:'var(--font-size-md)' }}>
            {products.length === 0
              ? 'Geen producten. Ga naar Stock-tab om standaardproducten te laden.'
              : 'Geen producten gevonden'}
          </div>
        )}
      </div>
    </div>
  );
}
