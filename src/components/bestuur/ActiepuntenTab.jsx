// src/components/bestuur/ActiepuntenTab.jsx
// Tab "Actiepunten" — cross-vergadering overzicht.
import React, { useState, useMemo } from 'react';
import { addBestuursActiepunt } from '../../services/firestoreService';
import { S, ActiepuntRij } from './shared.jsx';

export default function ActiepuntenTab({ actiepunten, vergaderingen, confirm }) {
  const [filter, setFilter] = useState('open');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ omschrijving: '', verantwoordelijke: '', deadline: '', vergaderingId: '' });

  const gesorteerd = useMemo(() => {
    const lijst = [...actiepunten].sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));
    if (filter === 'open') return lijst.filter(a => a.status !== 'afgerond');
    if (filter === 'afgerond') return lijst.filter(a => a.status === 'afgerond');
    return lijst;
  }, [actiepunten, filter]);

  async function bewaar() {
    if (!form.omschrijving.trim()) return;
    const verg = vergaderingen.find(x => x.id === form.vergaderingId);
    await addBestuursActiepunt({
      omschrijving: form.omschrijving.trim(), verantwoordelijke: form.verantwoordelijke.trim(),
      deadline: form.deadline || '', status: 'open',
      vergaderingId: form.vergaderingId || null, vergaderingTitel: verg?.titel || '',
    });
    setForm({ omschrijving: '', verantwoordelijke: '', deadline: '', vergaderingId: '' });
    setModal(false);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[['open', 'Open'], ['alle', 'Alle'], ['afgerond', 'Afgerond']].map(([k, l]) =>
            <button key={k} style={S.tab(filter === k)} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
        <button style={S.btn('primary')} onClick={() => setModal(true)}>+ Nieuw actiepunt</button>
      </div>

      {gesorteerd.length === 0 && <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>Geen actiepunten.</div>}
      {gesorteerd.map(a => (
        <div key={a.id} style={S.card}>
          <ActiepuntRij a={a} confirm={confirm} />
          {a.vergaderingTitel && <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '6px' }}>↳ uit: {a.vergaderingTitel}</div>}
        </div>
      ))}

      {modal && (
        <div style={S.modal} onClick={() => setModal(false)} onKeyDown={e => e.key === 'Escape' && setModal(false)}>
          <div style={S.modalCard} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="actiepunt-modal-titel">
            <h3 style={{ marginTop: 0 }} id="actiepunt-modal-titel">Nieuw actiepunt</h3>
            <label style={S.label}>Omschrijving *</label>
            <input style={S.input} value={form.omschrijving} onChange={e => setForm(f => ({ ...f, omschrijving: e.target.value }))} />
            <label style={S.label}>Verantwoordelijke</label>
            <input style={S.input} value={form.verantwoordelijke} onChange={e => setForm(f => ({ ...f, verantwoordelijke: e.target.value }))} />
            <label style={S.label}>Deadline</label>
            <input type="date" style={S.input} value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} />
            <label style={S.label}>Koppelen aan vergadering (optioneel)</label>
            <select style={S.input} value={form.vergaderingId} onChange={e => setForm(f => ({ ...f, vergaderingId: e.target.value }))}>
              <option value="">— Geen —</option>
              {vergaderingen.map(v => <option key={v.id} value={v.id}>{v.titel} ({v.datum})</option>)}
            </select>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button style={{ ...S.btn('primary'), flex: 1 }} onClick={bewaar} disabled={!form.omschrijving.trim()}>Bewaren</button>
              <button style={S.btn('ghost')} onClick={() => setModal(false)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
