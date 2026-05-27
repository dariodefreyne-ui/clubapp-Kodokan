// pages/Technieken.jsx — Redesigned tegel-view per categorie met kyu-subtegels
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useConfirm } from '../contexts/ConfirmContext';
import * as XLSX from 'xlsx';

const TYPEN = ['Val', 'houdgreep', 'Verplaatsing', 'Worpen', 'Transitie'];
const KYU_COLORS = {
  '6': { label: 'Wit (6e)', bg: '#ffffff', color: '#333', border: '1px solid #aaa' },
  '5': { label: 'Geel (5e)', bg: '#f1c40f', color: '#333' },
  '4': { label: 'Oranje (4e)', bg: '#e67e22', color: '#fff' },
  '3': { label: 'Groen (3e)', bg: '#27ae60', color: '#fff' },
  '2': { label: 'Blauw (2e)', bg: '#3498db', color: '#fff' },
  '1': { label: 'Bruin (1e)', bg: '#8B4513', color: '#fff' },
};

// ─── Hook: Kyu kleuren uit config of fallback ───────────────────────────────────
function useKyuKleuren() {
  const { configCache } = useAuth();
  const gordels = configCache?.gordels || [];
  if (gordels.length === 0) return KYU_COLORS;
  const map = {};
  for (const g of gordels) {
    if (g.kyu === undefined) continue;
    const key = String(g.kyu);
    const bg = g.kleur || '#888';
    const isWit = bg.toLowerCase() === '#ffffff' || bg.toLowerCase() === '#fff';
    map[key] = { label: g.label || `Kyu ${g.kyu}`, bg, color: isWit ? '#333' : '#fff', ...(isWit ? { border: '1px solid #aaa' } : {}) };
  }
  return Object.keys(map).length > 0 ? map : KYU_COLORS;
}

// ─── KyuBadge ───────────────────────────────────────────────────────────────────
function KyuBadge({ kyu }) {
  const kleuren = useKyuKleuren();
  const cfg = kleuren[kyu];
  if (!cfg) return null;
  return <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '3px', fontSize: '11px', fontWeight: '700', background: cfg.bg, color: cfg.color, border: cfg.border || 'none' }}>{cfg.label}</span>;
}

// ─── EditTechniekModal (inline edit: naam + fase) ──────────────────────────────
function EditTechniekModal({ techniek, isOpen, onClose, onSave, isBusy }) {
  const [naam, setNaam] = useState(techniek?.techniek || '');
  const [fase, setFase] = useState(techniek?.basis_vanaf_kyu ? 'basis' : 'verdieping');
  
  useEffect(() => { setNaam(techniek?.techniek || ''); }, [techniek?.id, isOpen]);

  if (!isOpen || !techniek) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '10px', maxWidth: '400px', width: '90%', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>Techniek bewerken</h3>
        <input type="text" value={naam} onChange={e => setNaam(e.target.value)} style={{ width: '100%', padding: '8px', marginBottom: '12px', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '13px', boxSizing: 'border-box', color: 'var(--text-primary)', background: 'var(--bg-primary)' }} />
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {['basis', 'verdieping'].map(f => (
            <button key={f} onClick={() => setFase(f)} style={{ flex: 1, padding: '6px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', border: `1px solid ${fase === f ? 'var(--primary-color)' : 'var(--border-color)'}`, background: fase === f ? 'rgba(66,153,225,0.1)' : 'transparent', color: fase === f ? 'var(--primary-color)' : 'var(--text-secondary)', cursor: 'pointer' }}>{f}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onClose} style={{ flex: 1, padding: '8px', border: '1px solid var(--border-color)', borderRadius: '6px', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Annuleren</button>
          <button onClick={() => onSave({ ...techniek, techniek: naam, basis_vanaf_kyu: fase === 'basis' ? techniek.basis_vanaf_kyu || '6' : '', verdieping_vanaf_kyu: fase === 'verdieping' ? techniek.verdieping_vanaf_kyu || '5' : '' })} disabled={isBusy} style={{ flex: 1, padding: '8px', border: 'none', borderRadius: '6px', background: 'var(--primary-color)', color: '#fff', cursor: isBusy ? 'default' : 'pointer', opacity: isBusy ? 0.6 : 1, fontSize: '13px', fontWeight: '700' }}>✓ Opslaan</button>
        </div>
      </div>
    </div>
  );
}

// ─── TechniekRij (in kyu-subtegel) ──────────────────────────────────────────────
function TechniekRij({ techniek, onEdit, onDetails }) {
  return (
    <div style={{ padding: '8px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', marginBottom: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
      <span style={{ flex: 1, fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{techniek.techniek}</span>
      <button onClick={() => onEdit(techniek)} style={{ padding: '4px 8px', fontSize: '11px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-secondary)' }}>Edit</button>
      <button onClick={() => onDetails?.(techniek)} style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--primary-color)', border: 'none', borderRadius: '4px', cursor: 'pointer', color: '#fff', fontWeight: '600' }}>Details</button>
    </div>
  );
}

// ─── KyuSubtegel (kyu rows in category) ──────────────────────────────────────────
function KyuSubtegel({ kyu, technieken, onEdit, onDetails, typeLabel }) {
  const kleuren = useKyuKleuren();
  const cfg = kleuren[kyu];
  const [open, setOpen] = useState(false);
  
  if (!cfg || technieken.length === 0) return null;

  return (
    <div style={{ marginBottom: '8px', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
      <button onClick={() => setOpen(!open)} style={{ width: '100%', padding: '10px 12px', background: cfg.bg, color: cfg.color, border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '700', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>{cfg.label} ({technieken.length})</span>
        <span style={{ fontSize: '11px' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '8px' }}>
          {technieken.map(t => <TechniekRij key={t.id} techniek={t} onEdit={onEdit} onDetails={onDetails} />)}
        </div>
      )}
    </div>
  );
}

// ─── CategorieTegel ─────────────────────────────────────────────────────────────
function CategorieTegel({ type, technieken, onEdit, onDetails }) {
  const perKyu = {};
  TYPEN.forEach(t => perKyu[t] = {});
  ['6', '5', '4', '3', '2', '1'].forEach(k => { for (const t of TYPEN) perKyu[t][k] = []; });
  
  for (const tech of technieken) {
    if (tech.basis_vanaf_kyu) perKyu[type][tech.basis_vanaf_kyu]?.push(tech);
    if (tech.verdieping_vanaf_kyu && tech.verdieping_vanaf_kyu !== tech.basis_vanaf_kyu) perKyu[type][tech.verdieping_vanaf_kyu]?.push(tech);
  }

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>{type}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {['6', '5', '4', '3', '2', '1'].map(kyu => (
          <KyuSubtegel key={kyu} kyu={kyu} technieken={perKyu[type][kyu] || []} onEdit={onEdit} onDetails={onDetails} typeLabel={type} />
        ))}
      </div>
    </div>
  );
}

// ─── UploadTegel (admin-only) ───────────────────────────────────────────────────
function UploadTegel({ isAdmin, fileInputRef, onFileChange, onImport, importPreview, onCancelImport, busy }) {
  if (!isAdmin) return null;

  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px', gridColumn: '1 / -1' }}>
      <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: '800', color: 'var(--text-primary)' }}>📤 Excel Import/Export</h3>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button onClick={() => fileInputRef.current?.click()} style={{ padding: '8px 16px', background: 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>📥 Importeren</button>
        {!importPreview && <button onClick={() => exporteerExcel(technieken)} style={{ padding: '8px 16px', background: 'var(--text-secondary)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>📊 Exporteren</button>}
        {importPreview && <button onClick={onImport} disabled={busy} style={{ padding: '8px 16px', background: 'var(--success-color)', color: '#fff', border: 'none', borderRadius: '6px', cursor: busy ? 'default' : 'pointer', fontWeight: '600', fontSize: '13px', opacity: busy ? 0.6 : 1 }}>✓ Bevestig Import</button>}
        {importPreview && <button onClick={onCancelImport} style={{ padding: '8px 16px', background: 'var(--danger-color)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>✕ Annuleren</button>}
      </div>
      <input ref={fileInputRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={onFileChange} />
    </div>
  );
}


// ─── TechniekDetailModal (volledige detail + edit) ─────────────────────────────
function TechniekDetailModal({ techniek, isOpen, onClose, isBeheerder }) {
  const [editable, setEditable] = useState(false);
  const [data, setData] = useState(techniek || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => { setData(techniek || {}); setEditable(false); }, [techniek?.id, isOpen]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'technieken', techniek.id), {
        techniek: data.techniek,
        type: data.type,
        basis_vanaf_kyu: data.basis_vanaf_kyu,
        verdieping_vanaf_kyu: data.verdieping_vanaf_kyu,
        basisvoorwaarden: data.basisvoorwaarden || [],
        basisfase: data.basisfase || [],
        verdieping: data.verdieping || [],
        aandachtspunten: data.aandachtspunten || [],
        remediering: data.remediering || [],
        oefenvormen: data.oefenvormen || [],
        updatedAt: serverTimestamp(),
      });
      setEditable(false);
    } catch (e) {
      alert('Fout: ' + e.message);
    }
    setSaving(false);
  };

  if (!isOpen || !techniek) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--card-bg)', width: '100%', maxWidth: '600px', maxHeight: '90vh', overflow: 'auto', borderRadius: '16px 16px 0 0', padding: '20px' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)' }}>{data.techniek}</h2>
          <button onClick={onClose} style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
        </div>
        
        <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-primary)', borderRadius: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700' }}>Type: </span>
          <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '600' }}>{data.type}</span>
        </div>

        {isBeheerder && (
          <button onClick={() => setEditable(!editable)} style={{ padding: '8px 16px', marginBottom: '12px', background: editable ? 'var(--danger-color)' : 'var(--primary-color)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '13px' }}>
            {editable ? 'Annuleren' : '✏️ Bewerken'}
          </button>
        )}

        {editable && isBeheerder ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Naam</label>
              <input value={data.techniek} onChange={e => setData({ ...data, techniek: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', color: 'var(--text-primary)', background: 'var(--bg-primary)', fontSize: '13px' }} />
            </div>
            <button onClick={handleSave} disabled={saving} style={{ padding: '10px', background: 'var(--success-color)', color: '#fff', border: 'none', borderRadius: '6px', cursor: saving ? 'default' : 'pointer', fontWeight: '700', opacity: saving ? 0.6 : 1 }}>
              {saving ? '…' : '✓ Opslaan'}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: '13px', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
            {data.basisvoorwaarden?.join('\n') || 'Geen basisvoorwaarden'}
          </div>
        )}
        
        <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--border-color)' }} />
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          Volledige edit → onderhoud direct in beheerder sectie
        </div>
      </div>
    </div>
  );
}



// ─── Excel export ───────────────────────────────────────────────────────────────
function exporteerExcel(technieken) {
  const rows = [['Techniek', 'Type', 'Basis Kyu', 'Verdieping Kyu']];
  technieken.forEach(t => {
    rows.push([t.techniek, t.type, t.basis_vanaf_kyu || '', t.verdieping_vanaf_kyu || '']);
  });
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 12 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Technieken');
  XLSX.writeFile(wb, 'technieken_export.xlsx');
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────────
export default function TechniekkenPagina() {
  const { role, configCache } = useAuth();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  
  const [technieken, setTechnieken] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoekterm, setZoekterm] = useState('');
  const [filterKyu, setFilterKyu] = useState('Alle');
  const [editingTech, setEditingTech] = useState(null);
  const [detailTech, setDetailTech] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const fileInputRef = useRef(null);
  
  const isAdmin = role === 'bestuurslid' || role === 'admin';
  const kyuKleuren = useKyuKleuren();

  // Laad technieken realtime
  useEffect(() => {
    const q = query(collection(db, 'technieken'), orderBy('type'), orderBy('techniek'));
    const unsub = onSnapshot(q, snap => {
      setTechnieken(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, err => { console.error('Fout bij laden technieken:', err); setLoading(false); });
    return unsub;
  }, []);

  // Filter
  const gefilterde = useMemo(() => {
    return technieken.filter(t => {
      if (zoekterm && !t.techniek.toLowerCase().includes(zoekterm.toLowerCase())) return false;
      if (filterKyu !== 'Alle' && !((t.basis_vanaf_kyu === filterKyu) || (t.verdieping_vanaf_kyu === filterKyu))) return false;
      return true;
    });
  }, [technieken, zoekterm, filterKyu]);

  // Group by type
  const perType = useMemo(() => {
    const g = {};
    TYPEN.forEach(t => g[t] = []);
    gefilterde.forEach(t => { if (g[t.type]) g[t.type].push(t); });
    return g;
  }, [gefilterde]);

  const handleEdit = async (tech) => {
    setEditingTech(tech);
  };

  const handleSaveEdit = async (updated) => {
    try {
      await updateDoc(doc(db, 'technieken', updated.id), {
        techniek: updated.techniek,
        basis_vanaf_kyu: updated.basis_vanaf_kyu,
        verdieping_vanaf_kyu: updated.verdieping_vanaf_kyu,
        updatedAt: serverTimestamp(),
      });
      setEditingTech(null);
    } catch (e) {
      alert('Fout bij opslaan: ' + e.message);
    }
  };

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      setImportPreview(rows.map((r, i) => ({
        _id: (r['Techniek'] || '').toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || 'tech_' + i,
        techniek: r['Techniek'] || '',
        type: r['Type'] || '',
        basis_vanaf_kyu: r['Basis Kyu'] || '',
        verdieping_vanaf_kyu: r['Verdieping Kyu'] || '',
      })));
    } catch (err) {
      alert('Fout bij lezen: ' + err.message);
    }
    e.target.value = '';
  }, []);

  const handleImport = useCallback(async () => {
    if (!importPreview) return;
    setImportBusy(true);
    try {
      for (const t of importPreview) {
        const bestaand = technieken.find(x => x.id === t._id);
        const update = { techniek: t.techniek, type: t.type, basis_vanaf_kyu: t.basis_vanaf_kyu, verdieping_vanaf_kyu: t.verdieping_vanaf_kyu, updatedAt: serverTimestamp() };
        bestaand ? await updateDoc(doc(db, 'technieken', t._id), update) : await setDoc(doc(db, 'technieken', t._id), { ...update, kyu_graden: [], oefenvormen: [] });
      }
      setImportPreview(null);
    } catch (err) {
      alert('Fout bij import: ' + err.message);
    }
    setImportBusy(false);
  }, [importPreview, technieken]);

  if (!role) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>🔒 Geen toegang</div>;
  if (loading) return <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)' }}>Laden...</div>;

  return (
    <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto', paddingBottom: '40px' }}>
      <h1 style={{ margin: '0 0 20px', fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)' }}>🥋 Technieken</h1>

      {/* Filters */}
      <div style={{ background: 'var(--card-bg)', padding: '16px', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--border-color)' }}>
        <div style={{ marginBottom: '12px' }}>
          <input type="text" value={zoekterm} onChange={e => setZoekterm(e.target.value)} placeholder="Zoeken..." style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', fontSize: '13px', color: 'var(--text-primary)', background: 'var(--bg-primary)' }} />
        </div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '700', alignSelf: 'center' }}>KYU:</span>
          {['Alle', ...Object.keys(kyuKleuren).sort()].map(k => (
            <button key={k} onClick={() => setFilterKyu(k)} style={{ padding: '6px 12px', borderRadius: '6px', border: `1px solid ${filterKyu === k ? 'var(--primary-color)' : 'var(--border-color)'}`, background: filterKyu === k ? 'rgba(66,153,225,0.1)' : 'transparent', color: filterKyu === k ? 'var(--primary-color)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', fontWeight: '600' }}>
              {k === 'Alle' ? 'Alle' : kyuKleuren[k]?.label || k}
            </button>
          ))}
        </div>
      </div>

      {/* Categorie tegels grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        {TYPEN.map(type => (
          <CategorieTegel key={type} type={type} technieken={perType[type]} onEdit={handleEdit} onDetails={setDetailTech} />
        ))}
      </div>

      {/* Upload tegel */}
      <UploadTegel isAdmin={isAdmin} fileInputRef={fileInputRef} onFileChange={handleFileChange} onImport={handleImport} importPreview={importPreview} onCancelImport={() => setImportPreview(null)} busy={importBusy} />

      {/* Edit modal */}
      <EditTechniekModal techniek={editingTech} isOpen={!!editingTech} onClose={() => setEditingTech(null)} onSave={handleSaveEdit} isBusy={false} />

      {/* Detail modal */}
      <TechniekDetailModal techniek={detailTech} isOpen={!!detailTech} onClose={() => setDetailTech(null)} isBeheerder={isAdmin} />
    </div>
  );
}
