import React, { useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  runTransaction,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../firebase';
import { getCatsFromConfig, fmtBedrag, DEFAULT_PRODUCTS, maakProductId } from './winkelData';
import { MAAT_SUGGESTIES, formVelden, bouwVariantTekst } from './productFacets';
import { useAuth } from '../../contexts/AuthContext';
import ProductBoom from './ProductBoom';
import ProductIcon, { getProductVisual } from './ProductIcon';
import { useToast } from '../ui/Toast';

const STOCK_FILTERS = [
  ['alle', 'Alle'],
  ['judogi', 'Judogi'],
  ['gordel', 'Gordel'],
  ['sportzak', 'Sportzak'],
  ['hoodie', 'Pull'],
  ['tshirt', 'T-shirt'],
  ['laag', 'Laag'],
  ['leeg', 'Leeg'],
];

const CATEGORY_DEFAULT_NAME = {
  judogi: 'Judogi',
  gordel: 'Gordel',
  sportzak: 'Sportzak',
  hoodie: 'Pull',
  tshirt: 'T-shirt',
};

const EMPTY_TWEEDEHANDS = {
  category: 'judogi',
  type: '', maat: '', geslacht: '',
  qty: '1',
  price: '',
  costPrice: '0',
  herkomst: '',
  staat: 'goed',
  opmerking: '',
};

export default function StockTab({ products, profiel, readOnly = false }) {
  const toast = useToast();
  const { configCache } = useAuth();
  const { cats, catLabels } = getCatsFromConfig(configCache.productCategorieen);
  const [filter, setFilter] = useState('alle');
  const [adjEdit, setAdjEdit] = useState(null);
  const [adjVal, setAdjVal] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkVals, setBulkVals] = useState({});
  const [savingBulk, setSavingBulk] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [showTweedehands, setShowTweedehands] = useState(false);
  const [tweedehandsForm, setTweedehandsForm] = useState(EMPTY_TWEEDEHANDS);
  const [savingTweedehands, setSavingTweedehands] = useState(false);
  const [message, setMessage] = useState('');

  const filtered = products
    .filter(p => {
      if (filter === 'laag') return (p.stock || 0) > 0 && (p.stock || 0) < 3;
      if (filter === 'leeg') return (p.stock || 0) <= 0;
      if (filter !== 'alle') return p.category === filter;
      return true;
    })
    .sort((a, b) => {
      const catOrder = cats;
      const catDiff = catOrder.indexOf(a.category) - catOrder.indexOf(b.category);
      if (catDiff !== 0) return catDiff;
      if (a.tweedehands !== b.tweedehands) return a.tweedehands ? 1 : -1;
      return (a.variant || '').localeCompare(b.variant || '');
    });

  const CAT_ORDER = ['judogi', 'gordel', 'sportzak', 'hoodie', 'tshirt'];
  const stockwaarde = products.reduce((sum, p) => sum + (p.costPrice || 0) * (p.stock || 0), 0);
  const aantalLeeg = products.filter(p => (p.stock || 0) <= 0).length;
  const aantalLaag = products.filter(p => (p.stock || 0) > 0 && (p.stock || 0) < 3).length;

  function updateTweedehands(field, value) {
    setTweedehandsForm(current => {
      if (field === 'category') return { ...current, category: value, type: '', maat: '', geslacht: '' };
      return { ...current, [field]: value };
    });
  }

  function startBulk() {
    const vals = {};
    products.forEach(p => {
      vals[p.id] = String(p.stock || 0);
    });
    setBulkVals(vals);
    setBulkMode(true);
  }

  function cancelBulk() {
    setBulkMode(false);
    setBulkVals({});
  }

  async function saveBulk() {
    setSavingBulk(true);
    try {
      const batch = writeBatch(db);
      let heeftUpdates = false;
      for (const p of products) {
        const newVal = parseInt(bulkVals[p.id], 10);
        if (!isNaN(newVal) && newVal >= 0 && newVal !== (p.stock || 0)) {
          batch.update(doc(db, 'products', p.id), { stock: newVal });
          heeftUpdates = true;
        }
      }
      if (heeftUpdates) await batch.commit();
    } catch (e) {
      console.error(e);
      toast({ bericht: `Opslaan mislukt: ${e.message}`, type: 'error' });
    }
    setSavingBulk(false);
    setBulkMode(false);
    setBulkVals({});
  }

  async function adjustStock(p, delta) {
    await updateDoc(doc(db, 'products', p.id), {
      stock: Math.max(0, (p.stock || 0) + delta),
    });
  }

  async function saveAdjVal(p) {
    const val = parseInt(adjVal, 10);
    if (!isNaN(val) && val >= 0) {
      await updateDoc(doc(db, 'products', p.id), { stock: val });
    }
    setAdjEdit(null);
  }

  async function resetAllStock() {
    try {
      const batch = writeBatch(db);
      products.forEach(p => batch.update(doc(db, 'products', p.id), { stock: 0 }));
      await batch.commit();
    } catch (e) {
      console.error(e);
      toast({ bericht: `Reset mislukt: ${e.message}`, type: 'error' });
    }
    setConfirmReset(false);
  }

  async function seedProducten() {
    setSeeding(true);
    try {
      const batch = writeBatch(db);
      for (const p of DEFAULT_PRODUCTS) {
        const id = maakProductId(p);
        const ref = doc(collection(db, 'products'), id);
        batch.set(ref, { ...p, createdAt: serverTimestamp() }, { merge: false });
      }
      await batch.commit();
    } catch (e) {
      console.error(e);
      toast({ bericht: `Aanmaken producten mislukt: ${e.message}`, type: 'error' });
    }
    setSeeding(false);
  }

  const tweedehandsCompleet = formVelden(tweedehandsForm.category).every(v => String(tweedehandsForm[v.key] || '').trim() !== '');

  async function ontvangTweedehands() {
    if (!tweedehandsCompleet) return;

    const qty = Math.max(1, parseInt(tweedehandsForm.qty, 10) || 1);
    const category = tweedehandsForm.category;
    const facet = { type: tweedehandsForm.type || null, maat: tweedehandsForm.maat?.trim() || null, geslacht: tweedehandsForm.geslacht || null };
    const name = CATEGORY_DEFAULT_NAME[category] || category;
    const variant = bouwVariantTekst(category, facet);
    const price = parseFloat(tweedehandsForm.price) || 0;
    const costPrice = parseFloat(tweedehandsForm.costPrice) || 0;

    setSavingTweedehands(true);
    setMessage('');

    try {
      const bestaand = products.find(p =>
        p.category === category &&
        String(p.name || '').toLowerCase() === name.toLowerCase() &&
        String(p.variant || '').toLowerCase() === variant.toLowerCase() &&
        p.tweedehands === true
      );

      if (bestaand) {
        await runTransaction(db, async (transaction) => {
          const ref = doc(db, 'products', bestaand.id);
          const snap = await transaction.get(ref);
          const data = snap.exists() ? snap.data() : {};
          const updates = {
            stock: Number(data.stock || 0) + qty,
            active: true,
            laatsteOntvangstOp: serverTimestamp(),
            laatsteOntvangstDoor: profiel?.uid || null,
            laatsteOntvangstDoorNaam: profiel?.naam || profiel?.email || null,
            laatsteOntvangstHerkomst: tweedehandsForm.herkomst.trim() || null,
            laatsteOntvangstStaat: tweedehandsForm.staat,
            laatsteOntvangstOpmerking: tweedehandsForm.opmerking.trim() || null,
          };
          if (price > 0) updates.price = price;
          if (costPrice >= 0) updates.costPrice = costPrice;
          transaction.update(ref, updates);
        });
        setMessage('Tweedehands stock verhoogd.');
      } else {
        await addDoc(collection(db, 'products'), {
          name,
          category,
          variant,
          type: facet.type,
          maat: facet.maat,
          geslacht: facet.geslacht,
          price,
          costPrice,
          stock: qty,
          soldCount: 0,
          tweedehands: true,
          active: true,
          createdAt: serverTimestamp(),
          ontvangenOp: serverTimestamp(),
          ontvangenDoor: profiel?.uid || null,
          ontvangenDoorNaam: profiel?.naam || profiel?.email || null,
          herkomst: tweedehandsForm.herkomst.trim() || null,
          staat: tweedehandsForm.staat,
          opmerking: tweedehandsForm.opmerking.trim() || null,
        });
        setMessage('Tweedehands product aangemaakt.');
      }

      setTweedehandsForm(EMPTY_TWEEDEHANDS);
      setShowTweedehands(false);
    } catch (e) {
      console.error(e);
      setMessage('Tweedehands ontvangen mislukt.');
    }

    setSavingTweedehands(false);
  }

  function exportCSV() {
    const datum = new Date().toISOString().slice(0, 10);
    const headers = ['naam', 'variant', 'tweedehands', 'stock', 'prijs', 'aankoopprijs'];
    const rows = filtered.map(p => [
      p.name,
      p.variant,
      p.tweedehands ? 'ja' : 'nee',
      p.stock || 0,
      p.price || 0,
      p.costPrice || 0,
    ]);
    const csv = [headers, ...rows]
      .map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kodokan-stock-${datum}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: '10px', marginBottom: '16px' }}>
        <Stat label="Stockwaarde" value={fmtBedrag(stockwaarde)} color="var(--success)" />
        <Stat label="Uitverkocht" value={aantalLeeg} color="var(--danger)" />
        <Stat label="Laag" value={aantalLaag} color="var(--warning)" />
      </div>

      {message && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginBottom: '12px', fontSize: 'var(--font-size-sm)' }}>
          {message}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
          {STOCK_FILTERS.map(([v, label]) => (
            <button key={v} onClick={() => setFilter(v)} style={filterBtn(filter === v)}>{label}</button>
          ))}
        </div>
        {!readOnly && (
          <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
            <button onClick={() => setShowTweedehands(v => !v)} style={primaryBtn}>+ Tweedehands ontvangen</button>
            {bulkMode ? (
              <>
                <button onClick={saveBulk} disabled={savingBulk} style={successBtn}>{savingBulk ? 'Opslaan' : 'Opslaan'}</button>
                <button onClick={cancelBulk} style={neutralBtn}>Annuleren</button>
              </>
            ) : (
              <>
                <button onClick={startBulk} style={neutralBtn}>Bulk bewerken</button>
                <button onClick={exportCSV} style={neutralBtn}>Export CSV ({filtered.length})</button>
              </>
            )}
          </div>
        )}
        {readOnly && (
          <button onClick={exportCSV} style={neutralBtn}>Export CSV ({filtered.length})</button>
        )}
      </div>

      {showTweedehands && (
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '16px', marginBottom: '16px', border: '1px solid #d4a017' }}>
          <h3 style={{ marginTop: 0 }}>Tweedehands ontvangen</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '10px' }}>
            <Field label="Categorie">
              <select value={tweedehandsForm.category} onChange={e => updateTweedehands('category', e.target.value)} style={inputStyle}>
                {cats.map(c => <option key={c} value={c}>{catLabels[c]}</option>)}
              </select>
            </Field>
            {formVelden(tweedehandsForm.category).map(veld => (
              <Field key={veld.key} label={veld.label}>
                {veld.opties ? (
                  <select value={tweedehandsForm[veld.key] || ''} onChange={e => updateTweedehands(veld.key, e.target.value)} style={inputStyle}>
                    <option value="">—</option>
                    {veld.opties.map(([w, l]) => <option key={w} value={w}>{l}</option>)}
                  </select>
                ) : (
                  <>
                    <input list={`th-maat-${tweedehandsForm.category}`} value={tweedehandsForm[veld.key] || ''} onChange={e => updateTweedehands(veld.key, e.target.value)} placeholder="bv. 150 / M" style={inputStyle} />
                    <datalist id={`th-maat-${tweedehandsForm.category}`}>
                      {(MAAT_SUGGESTIES[tweedehandsForm.category] || []).map(m => <option key={m} value={m} />)}
                    </datalist>
                  </>
                )}
              </Field>
            ))}
            <Field label="Aantal">
              <input type="number" min="1" value={tweedehandsForm.qty} onChange={e => updateTweedehands('qty', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Verkoopprijs">
              <input type="number" min="0" step="0.01" value={tweedehandsForm.price} onChange={e => updateTweedehands('price', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Aankoopprijs/commissie">
              <input type="number" min="0" step="0.01" value={tweedehandsForm.costPrice} onChange={e => updateTweedehands('costPrice', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Staat">
              <select value={tweedehandsForm.staat} onChange={e => updateTweedehands('staat', e.target.value)} style={inputStyle}>
                <option value="goed">Goed</option>
                <option value="redelijk">Redelijk</option>
                <option value="te-herstellen">Te herstellen</option>
              </select>
            </Field>
            <Field label="Herkomst">
              <input value={tweedehandsForm.herkomst} onChange={e => updateTweedehands('herkomst', e.target.value)} placeholder="Naam lid/ouder of schenking" style={inputStyle} />
            </Field>
          </div>
          <div style={{ marginTop: '10px' }}>
            <Field label="Opmerking">
              <input value={tweedehandsForm.opmerking} onChange={e => updateTweedehands('opmerking', e.target.value)} style={inputStyle} />
            </Field>
          </div>
          <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginTop: '10px' }}>
            Wordt opgeslagen als: <strong style={{ color: 'var(--text-primary)' }}>{CATEGORY_DEFAULT_NAME[tweedehandsForm.category]} {bouwVariantTekst(tweedehandsForm.category, { type: tweedehandsForm.type, maat: tweedehandsForm.maat, geslacht: tweedehandsForm.geslacht })}</strong>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={ontvangTweedehands} disabled={savingTweedehands || !tweedehandsCompleet} style={primaryBtn}>{savingTweedehands ? 'Opslaan' : 'Ontvang'} </button>
            <button onClick={() => setShowTweedehands(false)} style={neutralBtn}>Annuleren</button>
          </div>
        </div>
      )}

      <ProductBoom producten={filtered} renderItem={renderItem} />

      {!readOnly && (
        <div style={{ marginTop: '24px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {products.length === 0 && <button onClick={seedProducten} disabled={seeding} style={neutralBtn}>{seeding ? 'Laden' : 'Seed standaardproducten'}</button>}
          {confirmReset ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <span style={{ color: 'var(--warning)' }}>Alle stocks op 0 zetten?</span>
              <button onClick={resetAllStock} style={dangerBtn}>Ja</button>
              <button onClick={() => setConfirmReset(false)} style={neutralBtn}>Nee</button>
            </div>
          ) : (
            <button onClick={() => setConfirmReset(true)} style={outlineDangerBtn}>Reset stock naar 0</button>
          )}
        </div>
      )}
    </div>
  );

  function renderItem(p) {
    const stockNum = p.stock || 0;
    const stockColor = stockNum <= 0 ? 'var(--danger)' : stockNum < 3 ? 'var(--warning)' : 'var(--success)';
    const visual = getProductVisual(p);
    const goldColor = '#d4a017';

    return (
      <div key={p.id} style={{ background: p.tweedehands ? 'rgba(212,160,23,0.08)' : 'var(--bg-card)', border: '1px solid ' + (p.tweedehands ? goldColor : 'var(--border-color)'), borderRadius: '10px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '4px', borderRadius: '2px', alignSelf: 'stretch', background: p.tweedehands ? goldColor : 'transparent', flexShrink: 0 }} />
        <ProductIcon product={p} size={38} radius={10} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: '700', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span>{p.variant}</span>
            {p.tweedehands && <span style={{ background: goldColor, color: '#1a1000', borderRadius: '4px', padding: '1px 5px', fontSize: '9px', fontWeight: '800' }}>2e H</span>}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)', marginTop: '1px' }}>{visual.label}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)', marginTop: '1px' }}>{fmtBedrag(p.price)} verkoopprijs</div>
        </div>
        {readOnly ? (
          <span style={{ minWidth: '32px', textAlign: 'center', fontSize: 'var(--font-size-md)', fontWeight: '800', color: stockColor, padding: '4px 10px', borderRadius: '6px', background: 'var(--bg-primary)' }}>
            {stockNum}
          </span>
        ) : bulkMode ? (
          <input type="number" min="0" value={bulkVals[p.id] ?? String(stockNum)} onChange={e => setBulkVals(prev => ({ ...prev, [p.id]: e.target.value }))} style={{ width: '58px', background: 'var(--bg-primary)', border: '1px solid var(--accent-red)', borderRadius: '6px', color: 'var(--text-primary)', padding: '6px', fontSize: 'var(--font-size-sm)', textAlign: 'center', outline: 'none' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <button onClick={() => adjustStock(p, -1)} disabled={stockNum <= 0} style={{ ...stockBtn, color: stockNum <= 0 ? 'var(--border-color)' : 'var(--text-primary)', cursor: stockNum <= 0 ? 'not-allowed' : 'pointer' }}>−</button>
            {adjEdit === p.id ? (
              <input autoFocus type="number" min="0" value={adjVal} onChange={e => setAdjVal(e.target.value)} onBlur={() => saveAdjVal(p)} onKeyDown={e => e.key === 'Enter' && saveAdjVal(p)} style={{ width: '48px', background: 'var(--bg-primary)', border: '1px solid var(--accent-red)', borderRadius: '6px', color: 'var(--text-primary)', padding: '4px 6px', fontSize: 'var(--font-size-sm)', textAlign: 'center', outline: 'none' }} />
            ) : (
              <span onClick={() => { setAdjEdit(p.id); setAdjVal(String(stockNum)); }} style={{ minWidth: '32px', textAlign: 'center', fontSize: 'var(--font-size-md)', fontWeight: '800', color: stockColor, cursor: 'text', padding: '4px 6px', borderRadius: '6px', background: 'var(--bg-primary)' }}>{stockNum}</span>
            )}
            <button onClick={() => adjustStock(p, 1)} style={stockBtn}>+</button>
          </div>
        )}
      </div>
    );
  }
}

function Stat({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: '10px', padding: '12px', borderLeft: '3px solid ' + color }}>
      <div style={{ fontSize: '22px', fontWeight: '700' }}>{value}</div>
      <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', marginBottom: '4px' }}>{label}</div>
      {children}
    </div>
  );
}

const inputStyle = { width: '100%', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)', padding: '8px 10px', fontSize: 'var(--font-size-md)', boxSizing: 'border-box', outline: 'none' };
const primaryBtn = { background: 'var(--accent-red)', border: 'none', color: 'var(--text-primary)', padding: '7px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: '700' };
const successBtn = { background: 'var(--success)', border: 'none', color: 'var(--text-primary)', padding: '7px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: '700' };
const neutralBtn = { background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: '#ccc', padding: '7px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' };
const dangerBtn = { background: 'var(--danger)', border: 'none', color: 'var(--text-primary)', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: 'var(--font-size-sm)', fontWeight: '700' };
const outlineDangerBtn = { background: 'var(--bg-card)', border: '1px solid var(--danger)', color: 'var(--danger)', padding: '9px 16px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-sm)' };
const stockBtn = { background: 'var(--bg-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', width: '30px', height: '30px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: '16px', lineHeight: 1 };

function filterBtn(active) {
  return {
    flexShrink: 0,
    background: active ? 'var(--accent-red)' : 'var(--bg-card)',
    border: 'none',
    color: 'var(--text-primary)',
    padding: '7px 13px',
    borderRadius: '20px',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)',
    fontWeight: active ? '600' : '400',
  };
}
