// src/components/beheer/beheerStyles.js
// Gedeelde stijlen en helpers voor alle Beheer subcomponenten
import React from 'react';
import { C, cardStyle, buttonStyle, inputStyle } from '../../styles/tokens';

export const S = {
  page: { minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '16px' },
  title: { fontSize: '22px', fontWeight: '700', marginBottom: '16px' },
  card: { ...cardStyle(), marginBottom: '16px' },
  cardTitle: { fontSize: '16px', fontWeight: '700', marginBottom: '12px', color: 'var(--accent-red)' },
  input: { ...inputStyle, marginBottom: '10px' },
  label: { color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '4px', display: 'block' },
  btn: (v = 'primary') => buttonStyle(v),
  row: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  pinRow: { display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '12px' },
  pinLabel: { minWidth: '100px', color: 'var(--text-secondary)', fontSize: 'var(--font-size-md)' },
  pinInput: { background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', padding: '10px', fontSize: 'var(--font-size-md)', width: '120px', letterSpacing: '4px' },
  roleTag: { background: 'rgba(192,57,43,0.2)', color: 'var(--danger)', padding: '4px 10px', borderRadius: '10px', fontSize: 'var(--font-size-sm)', fontWeight: '600' },
  successMsg: { background: 'var(--success)', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 'var(--font-size-md)', fontWeight: '600', marginBottom: '12px' },
  dangerZone: { background: 'var(--bg-primary)', borderRadius: '10px', padding: '14px', border: '1px solid var(--danger)', marginTop: '8px' },
};

export function rolBadge(rol) {
  const config = {
    admin:       { kleur: '#c0392b', label: 'Admin' },
    bestuurslid: { kleur: '#c0392b', label: 'Bestuurslid' },
    trainer:     { kleur: '#2980b9', label: 'Trainer' },
    lid:         { kleur: '#555',    label: 'Lid' },
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
