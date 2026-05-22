// src/components/ui/FormField.jsx
// Consistent formulier-veld component. Eén styling, één validatie-patroon.
import React from 'react';
import { C, inputStyle } from '../../styles/tokens';
import { isoNaarDatum, datumNaarIso } from '../../utils/datumUtils';

const labelStyle = {
  display: 'block',
  fontSize: '12px',
  fontWeight: '600',
  color: C.textSec,
  marginBottom: '5px',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
};

const hintStyle = {
  fontSize: '11px',
  color: C.textMuted,
  marginTop: '4px',
};

const errorStyle = {
  fontSize: '11px',
  color: C.red,
  marginTop: '4px',
};

/**
 * FormField — universeel formulier-veld.
 *
 * Props:
 *  label      {string}   - Veldlabel
 *  type       {string}   - 'text'|'email'|'number'|'date'|'select'|'textarea'|'checkbox'|'color'
 *  value      {*}        - Huidige waarde
 *  onChange   {function} - (newValue) => void  (geeft altijd de parsed waarde terug)
 *  required   {bool}
 *  hint       {string}   - Hulptekst onder het veld
 *  fout       {string}   - Foutmelding onder het veld
 *  opties     {Array}    - Voor 'select': [{value, label}]
 *  disabled   {bool}
 *  placeholder{string}
 *  min/max    {number}   - Voor 'number'
 *  rijen      {number}   - Voor 'textarea' (default 3)
 */
export default function FormField({
  label,
  type = 'text',
  value,
  onChange,
  required = false,
  hint,
  fout,
  opties = [],
  disabled = false,
  placeholder,
  min,
  max,
  rijen = 3,
  style: extraStyle,
}) {
  const basis = { ...inputStyle, ...(fout ? { borderColor: C.red } : {}), ...extraStyle };

  function geefWaarde(e) {
    if (type === 'checkbox') return onChange(e.target.checked);
    if (type === 'number') return onChange(e.target.value === '' ? '' : Number(e.target.value));
    // date-veld: HTML geeft ISO (yyyy-mm-dd), we slaan ISO op maar tonen dd/mm/yyyy
    if (type === 'date') return onChange(e.target.value); // blijft ISO intern
    onChange(e.target.value);
  }

  const gedeeldProps = { disabled, placeholder };

  let invoer;
  if (type === 'select') {
    invoer = (
      <select value={value ?? ''} onChange={geefWaarde} disabled={disabled}
        style={{ ...basis, appearance: 'none', WebkitAppearance: 'none' }}>
        {!required && <option value="">— Kies —</option>}
        {opties.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  } else if (type === 'textarea') {
    invoer = (
      <textarea value={value ?? ''} onChange={geefWaarde} rows={rijen}
        {...gedeeldProps} style={{ ...basis, resize: 'vertical', minHeight: '80px' }} />
    );
  } else if (type === 'checkbox') {
    return (
      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: disabled ? 'default' : 'pointer' }}>
        <input type="checkbox" checked={!!value} onChange={geefWaarde} disabled={disabled}
          style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: C.red }} />
        <span style={{ fontSize: '13px', color: C.textPrimary }}>{label}</span>
        {required && <span style={{ color: C.red }}>*</span>}
      </label>
    );
  } else if (type === 'date') {
    // <input type="date"> werkt met ISO intern; we tonen dd/mm/yyyy als placeholder-hint
    invoer = (
      <input type="date" value={value ?? ''} onChange={geefWaarde} min={min} max={max}
        {...gedeeldProps} style={basis} />
    );
  } else if (type === 'color') {
    invoer = (
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input type="color" value={value || '#888888'} onChange={geefWaarde} disabled={disabled}
          style={{ width: '40px', height: '36px', padding: 0, border: 'none', borderRadius: '6px', cursor: 'pointer' }} />
        <input type="text" value={value ?? ''} onChange={geefWaarde} placeholder="#rrggbb"
          style={{ ...basis, width: '100px' }} disabled={disabled} />
      </div>
    );
  } else {
    invoer = (
      <input type={type} value={value ?? ''} onChange={geefWaarde} min={min} max={max}
        {...gedeeldProps} style={basis} />
    );
  }

  return (
    <div>
      {label && (
        <label style={labelStyle}>
          {label}
          {required && <span style={{ color: C.red, marginLeft: '3px' }}>*</span>}
        </label>
      )}
      {invoer}
      {hint && !fout && <div style={hintStyle}>{hint}</div>}
      {fout && <div style={errorStyle}>{fout}</div>}
    </div>
  );
}
