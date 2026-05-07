// src/components/beheer/beheerStyles.js
// Gedeelde stijlen en helpers voor alle Beheer subcomponenten
import React from 'react';

export const S = {
  page: { minHeight: '100vh', background: '#1a1a1a', color: '#fff', padding: '16px' },
  title: { fontSize: '22px', fontWeight: '700', marginBottom: '16px' },
  card: { background: '#2d2d2d', borderRadius: '12px', padding: '16px', marginBottom: '16px' },
  cardTitle: { fontSize: '16px', fontWeight: '700', marginBottom: '12px', color: '#c0392b' },
  input: { width: '100%', background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#fff', padding: '10px', fontSize: '15px', boxSizing: 'border-box', marginBottom: '10px' },
  label: { color: '#aaa', fontSize: '12px', marginBottom: '4px', display: 'block' },
  btn: (v = 'primary') => ({ background: v === 'primary' ? '#c0392b' : '#3a3a3a', border: 'none', color: '#fff', padding: '12px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '15px', fontWeight: '600' }),
  row: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  pinRow: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' },
  pinLabel: { minWidth: '100px', color: '#aaa', fontSize: '14px' },
  pinInput: { background: '#1a1a1a', border: '1px solid #3a3a3a', borderRadius: '8px', color: '#fff', padding: '10px', fontSize: '15px', width: '120px', letterSpacing: '4px' },
  roleTag: { background: 'rgba(192,57,43,0.2)', color: '#e74c3c', padding: '4px 10px', borderRadius: '10px', fontSize: '12px', fontWeight: '600' },
  successMsg: { background: '#27ae60', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', fontWeight: '600', marginBottom: '12px' },
  dangerZone: { background: '#1a1a1a', borderRadius: '10px', padding: '14px', border: '1px solid #e74c3c', marginTop: '8px' },
};

export function rolBadge(rol) {
  const config = {
    beheerder: { kleur: '#c0392b', label: 'Beheerder' },
    trainer: { kleur: '#2980b9', label: 'Trainer' },
    lid: { kleur: '#555', label: 'Lid' },
  };
  const c = config[rol] || config.lid;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '999px',
      fontSize: '11px',
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      background: c.kleur + '33',
      color: c.kleur,
      border: '1px solid ' + c.kleur,
      marginLeft: '8px',
    }}>
      {c.label}
    </span>
  );
}
