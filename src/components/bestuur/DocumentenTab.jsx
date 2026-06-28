// src/components/bestuur/DocumentenTab.jsx
// Tab "Documenten" — gegroepeerd per vergadering + overige.
import React, { useState, useMemo } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../firebase';
import { addBestuursDocument, deleteBestuursDocument } from '../../services/firestoreService';
import { C } from '../../styles/tokens';
import { S, DOC_CATS, formatDatum, formatSize, fileEmoji, SectieTitel } from './shared.jsx';

function DocRij({ d, kanVerwijderen, onVerwijder }) {
  return (
    <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: '12px' }}>
      <span style={{ fontSize: '26px' }}>{fileEmoji(d.fileName)}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <a href={d.url} target="_blank" rel="noreferrer" style={{ color: 'var(--text-primary)', textDecoration: 'none', fontWeight: '600', fontSize: '14px', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {d.titel || d.fileName}
        </a>
        <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>
          {d._bron === 'verslag' ? 'Verslag' : (DOC_CATS[d.categorie] || d.categorie)} · {formatSize(d.fileSize)}
        </div>
      </div>
      {kanVerwijderen && onVerwijder && (
        <button style={{ ...S.iconBtn, color: C.red }} onClick={() => onVerwijder(d)}>🗑</button>
      )}
    </div>
  );
}

export default function DocumentenTab({ documenten, vergaderingen, confirm }) {
  const [modal, setModal] = useState(false);
  const [file, setFile] = useState(null);
  const [titel, setTitel] = useState('');
  const [cat, setCat] = useState('vergadering');
  const [vergaderingId, setVergaderingId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Combine linked docs + embedded verslagen per vergadering
  const perVergadering = useMemo(() => {
    const map = {};
    // Linked docs from bestuursDocumenten
    documenten.forEach(d => {
      if (d.vergaderingId) {
        if (!map[d.vergaderingId]) map[d.vergaderingId] = [];
        map[d.vergaderingId].push({ ...d, _bron: 'doc' });
      }
    });
    // Embedded verslagen uploaded directly to a vergadering
    vergaderingen.forEach(v => {
      (v.verslagen || []).forEach(vsl => {
        const alsBestuursDoc = (documenten || []).some(d => d.vergaderingId === v.id && d.url === vsl.url);
        if (!alsBestuursDoc) {
          if (!map[v.id]) map[v.id] = [];
          map[v.id].push({ ...vsl, _bron: 'verslag', vergaderingId: v.id, _vergId: v.id });
        }
      });
    });
    return map;
  }, [documenten, vergaderingen]);

  const zonderVergadering = useMemo(() =>
    [...documenten].filter(d => !d.vergaderingId).sort((a, b) => (b.uploadedAt?.seconds || 0) - (a.uploadedAt?.seconds || 0)),
    [documenten]
  );

  const vergaderingenMetBestanden = useMemo(() =>
    [...vergaderingen].filter(v => perVergadering[v.id]?.length > 0),
    [vergaderingen, perVergadering]
  );

  const totaalBestanden = documenten.length + vergaderingen.reduce((s, v) => s + (v.verslagen?.length || 0), 0);

  function kies(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    if (!titel) setTitel(f.name.replace(/\.[^.]+$/, ''));
  }

  function upload() {
    if (!file || !titel.trim()) return;
    setUploading(true); setProgress(0);
    const pad = `bestuur/documenten/${Date.now()}_${file.name}`;
    const task = uploadBytesResumable(ref(storage, pad), file);
    task.on('state_changed',
      snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      err => { console.error(err); setUploading(false); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        const gekoppeld = vergaderingen.find(x => x.id === vergaderingId);
        await addBestuursDocument({
          titel: titel.trim(), categorie: cat, url, pad, fileName: file.name, fileSize: file.size,
          vergaderingId: vergaderingId || null, vergaderingTitel: gekoppeld?.titel || '',
        });
        setModal(false); setFile(null); setTitel(''); setCat('vergadering'); setVergaderingId(''); setUploading(false); setProgress(0);
      }
    );
  }

  async function verwijderDoc(d) {
    const ok = await confirm({ titel: 'Document verwijderen?', beschrijving: d.titel, bevestigLabel: 'Verwijderen', variant: 'danger' });
    if (!ok) return;
    if (d.pad) { try { await deleteObject(ref(storage, d.pad)); } catch { /* al weg */ } }
    await deleteBestuursDocument(d.id);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button style={S.btn('primary')} onClick={() => setModal(true)}>+ Document uploaden</button>
      </div>

      {totaalBestanden === 0 && (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>Nog geen bestuursdocumenten.</div>
      )}

      {/* Gegroepeerd per vergadering */}
      {vergaderingenMetBestanden.map(v => (
        <div key={v.id} style={{ marginBottom: '20px' }}>
          <SectieTitel>📅 {v.titel} · {formatDatum(v.datum)}</SectieTitel>
          {perVergadering[v.id].map((d, i) => (
            <DocRij key={d.id || i} d={d} kanVerwijderen={d._bron === 'doc'} onVerwijder={verwijderDoc} />
          ))}
        </div>
      ))}

      {/* Overige documenten */}
      {zonderVergadering.length > 0 && (
        <div>
          {vergaderingenMetBestanden.length > 0 && <SectieTitel>Overige documenten</SectieTitel>}
          {zonderVergadering.map(d => <DocRij key={d.id} d={d} kanVerwijderen onVerwijder={verwijderDoc} />)}
        </div>
      )}

      {modal && (
        <div style={S.modal} onClick={() => !uploading && setModal(false)} onKeyDown={e => { if (e.key === 'Escape' && !uploading) setModal(false); }}>
          <div style={S.modalCard} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="document-modal-titel">
            <h3 style={{ marginTop: 0 }} id="document-modal-titel">Bestuursdocument uploaden</h3>
            <label style={{ display: 'block', background: 'var(--bg-primary)', border: `2px dashed ${C.border}`, borderRadius: '10px', padding: '24px', textAlign: 'center', cursor: 'pointer', marginBottom: '12px', color: 'var(--text-secondary)' }}>
              {file ? <span style={{ color: 'var(--text-primary)' }}>📄 {file.name}</span> : '📁 Klik om bestand te kiezen'}
              <input type="file" accept=".doc,.docx,.pdf,.odt,.xlsx,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={kies} />
            </label>
            <label style={S.label}>Titel</label>
            <input style={S.input} value={titel} onChange={e => setTitel(e.target.value)} placeholder="Naam van het document" />
            <label style={S.label}>Categorie</label>
            <select style={S.input} value={cat} onChange={e => setCat(e.target.value)}>
              {Object.entries(DOC_CATS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <label style={S.label}>Koppelen aan vergadering — verschijnt dan ook bij die vergadering</label>
            <select style={S.input} value={vergaderingId} onChange={e => setVergaderingId(e.target.value)}>
              <option value="">— Geen —</option>
              {vergaderingen.map(v => <option key={v.id} value={v.id}>{v.titel} ({v.datum})</option>)}
            </select>
            {uploading && (
              <div style={{ marginBottom: '10px' }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '4px' }}>{progress}% geüpload…</div>
                <div style={{ height: '6px', background: 'var(--bg-primary)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: C.red, width: `${progress}%`, transition: 'width 0.3s' }} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button style={{ ...S.btn('primary'), flex: 1 }} onClick={upload} disabled={uploading || !file || !titel.trim()}>{uploading ? 'Uploaden…' : '⬆️ Uploaden'}</button>
              <button style={S.btn('ghost')} onClick={() => setModal(false)} disabled={uploading}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
