import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const BELT_OPTIONS = ['wit', 'geel', 'oranje', 'groen', 'blauw', 'bruin', 'zwart'];
const GROEPEN_OPTIONS = ['Groep 1', 'Groep 2', 'Groep 3', 'Groep 4', 'Competitie', 'Kata'];
const CURRENT_YEAR = new Date().getFullYear();

const s = {
  page: { minHeight: '100vh', background: '#1a1a1a', color: '#ffffff', paddingBottom: '40px' },
  header: { marginBottom: '24px' },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: 'none', border: 'none', color: '#aaaaaa', cursor: 'pointer',
    fontSize: '14px', padding: '0 0 8px 0', marginBottom: '4px',
  },
  title: { fontSize: '24px', fontWeight: '700', color: '#ffffff', margin: '0 0 4px 0' },
  subtitle: { fontSize: '14px', color: '#aaaaaa', margin: 0 },
  card: {
    background: '#2d2d2d', borderRadius: '12px', padding: '20px',
    border: '1px solid #3a3a3a', marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '13px', fontWeight: '600', color: '#c0392b',
    textTransform: 'uppercase', letterSpacing: '0.8px',
    margin: '0 0 16px 0', paddingBottom: '8px',
    borderBottom: '1px solid #3a3a3a',
  },
  fieldGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: '13px', color: '#aaaaaa', fontWeight: '500' },
  input: {
    padding: '10px 14px', background: '#1a1a1a', border: '1px solid #444',
    borderRadius: '8px', color: '#ffffff', fontSize: '14px', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  },
  inputError: {
    padding: '10px 14px', background: '#1a1a1a', border: '1px solid #c0392b',
    borderRadius: '8px', color: '#ffffff', fontSize: '14px', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  },
  select: {
    padding: '10px 14px', background: '#1a1a1a', border: '1px solid #444',
    borderRadius: '8px', color: '#ffffff', fontSize: '14px', outline: 'none',
    width: '100%', boxSizing: 'border-box', cursor: 'pointer',
  },
  textarea: {
    padding: '10px 14px', background: '#1a1a1a', border: '1px solid #444',
    borderRadius: '8px', color: '#ffffff', fontSize: '14px', outline: 'none',
    width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: '80px',
  },
  errorMsg: { fontSize: '12px', color: '#c0392b', marginTop: '2px' },
  checkboxGroup: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '4px' },
  checkboxLabel: {
    display: 'flex', alignItems: 'center', gap: '7px',
    cursor: 'pointer', fontSize: '14px', color: '#cccccc',
    padding: '6px 12px', background: '#1a1a1a', borderRadius: '8px',
    border: '1px solid #3a3a3a', userSelect: 'none',
  },
  checkboxLabelActive: {
    display: 'flex', alignItems: 'center', gap: '7px',
    cursor: 'pointer', fontSize: '14px', color: '#ffffff',
    padding: '6px 12px', background: 'rgba(192,57,43,0.2)', borderRadius: '8px',
    border: '1px solid #c0392b', userSelect: 'none',
  },
  inlineCheck: {
    display: 'flex', alignItems: 'center', gap: '10px',
    cursor: 'pointer', fontSize: '14px', color: '#cccccc',
  },
  actionBar: {
    display: 'flex', gap: '12px', flexWrap: 'wrap',
    marginTop: '24px', justifyContent: 'flex-end',
  },
  btnCancel: {
    padding: '12px 24px', background: '#2d2d2d', border: '1px solid #444',
    borderRadius: '8px', color: '#ffffff', fontSize: '14px', fontWeight: '500',
    cursor: 'pointer', minHeight: '44px',
  },
  btnSave: {
    padding: '12px 28px', background: '#c0392b', border: 'none',
    borderRadius: '8px', color: '#ffffff', fontSize: '14px', fontWeight: '600',
    cursor: 'pointer', minHeight: '44px', transition: 'background 0.2s',
  },
  btnSaveDisabled: {
    padding: '12px 28px', background: '#6b2017', border: 'none',
    borderRadius: '8px', color: '#aaaaaa', fontSize: '14px', fontWeight: '600',
    cursor: 'not-allowed', minHeight: '44px',
  },
  errorBanner: {
    background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.4)',
    borderRadius: '8px', padding: '12px 16px', marginBottom: '16px',
    color: '#e74c3c', fontSize: '14px',
  },
};

function generateLidnummer(existingMembers) {
  if (!existingMembers.length) return '1001';
  const nums = existingMembers
    .map((m) => parseInt(m.lidnummer, 10))
    .filter((n) => !isNaN(n));
  if (!nums.length) return '1001';
  return String(Math.max(...nums) + 1);
}

export default function NieuwLid() {
  const navigate = useNavigate();
  const { isBeheerder } = useAuth();

  const [saving, setSaving] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [lidnummerLoading, setLidnummerLoading] = useState(false);
  const [lidnummerSuggested, setLidnummerSuggested] = useState(false);

  const [form, setForm] = useState({
    naam: '',
    geboortedatum: '',
    email: '',
    telefoon: '',
    gordel: 'wit',
    lidnummer: '',
    ingeschrevenJaar: String(CURRENT_YEAR),
    groepen: [],
    medischeInfo: '',
    noodcontactNaam: '',
    noodcontactTelefoon: '',
    bijdrageBetaald: false,
    bijdrageVervaldatum: '',
    actief: true,
  });

  // Auto-suggest lidnummer on first focus of that field
  const handleLidnummerFocus = async () => {
    if (lidnummerSuggested || form.lidnummer) return;
    setLidnummerLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'members'), orderBy('lidnummer')));
      const existing = snap.docs.map((d) => d.data());
      const suggested = generateLidnummer(existing);
      setForm((f) => ({ ...f, lidnummer: suggested }));
      setLidnummerSuggested(true);
    } catch {
      // silent — user can type manually
    } finally {
      setLidnummerLoading(false);
    }
  };

  const setField = (key, val) => {
    setForm((f) => ({ ...f, [key]: val }));
    if (fieldErrors[key]) {
      setFieldErrors((e) => { const copy = { ...e }; delete copy[key]; return copy; });
    }
  };

  const toggleGroep = (groep) => {
    setForm((f) => ({
      ...f,
      groepen: f.groepen.includes(groep)
        ? f.groepen.filter((g) => g !== groep)
        : [...f.groepen, groep],
    }));
  };

  const validate = () => {
    const errors = {};
    if (!form.naam.trim()) errors.naam = 'Naam is verplicht';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errors.email = 'Ongeldig e-mailadres';
    }
    if (form.ingeschrevenJaar && (isNaN(Number(form.ingeschrevenJaar)) || Number(form.ingeschrevenJaar) < 1900)) {
      errors.ingeschrevenJaar = 'Ongeldig jaar';
    }
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validate();
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      return;
    }
    setSaving(true);
    setGlobalError('');
    try {
      const payload = {
        naam: form.naam.trim(),
        geboortedatum: form.geboortedatum || null,
        email: form.email.trim() || null,
        telefoon: form.telefoon.trim() || null,
        gordel: form.gordel,
        lidnummer: form.lidnummer.trim() || null,
        ingeschrevenJaar: form.ingeschrevenJaar ? Number(form.ingeschrevenJaar) : CURRENT_YEAR,
        groepen: form.groepen,
        medischeInfo: form.medischeInfo.trim() || null,
        noodcontactNaam: form.noodcontactNaam.trim() || null,
        noodcontactTelefoon: form.noodcontactTelefoon.trim() || null,
        bijdrageBetaald: form.bijdrageBetaald,
        bijdrageVervaldatum: form.bijdrageVervaldatum || null,
        actief: form.actief,
        aangemaaktOp: new Date().toISOString(),
      };
      await addDoc(collection(db, 'members'), payload);
      navigate('/leden');
    } catch (err) {
      console.error(err);
      setGlobalError('Opslaan mislukt: ' + (err.message || 'Onbekende fout'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <button style={s.backBtn} onClick={() => navigate('/leden')}>
          ← Terug naar ledenlijst
        </button>
        <h1 style={s.title}>Nieuw lid toevoegen</h1>
        <p style={s.subtitle}>Vul de gegevens in voor het nieuwe clublid</p>
      </div>

      {globalError && <div style={s.errorBanner}>{globalError}</div>}

      <form onSubmit={handleSubmit} noValidate>

        {/* === Persoonlijke gegevens === */}
        <div style={s.card}>
          <p style={s.sectionTitle}>Persoonlijke gegevens</p>
          <div style={s.fieldGrid}>

            <div style={s.fieldWrap}>
              <label style={s.label}>Naam *</label>
              <input
                type="text"
                value={form.naam}
                onChange={(e) => setField('naam', e.target.value)}
                placeholder="Volledige naam"
                style={fieldErrors.naam ? s.inputError : s.input}
                autoFocus
              />
              {fieldErrors.naam && <span style={s.errorMsg}>{fieldErrors.naam}</span>}
            </div>

            <div style={s.fieldWrap}>
              <label style={s.label}>Geboortedatum</label>
              <input
                type="date"
                value={form.geboortedatum}
                onChange={(e) => setField('geboortedatum', e.target.value)}
                style={s.input}
              />
            </div>

            <div style={s.fieldWrap}>
              <label style={s.label}>E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="naam@voorbeeld.be"
                style={fieldErrors.email ? s.inputError : s.input}
              />
              {fieldErrors.email && <span style={s.errorMsg}>{fieldErrors.email}</span>}
            </div>

            <div style={s.fieldWrap}>
              <label style={s.label}>Telefoon</label>
              <input
                type="tel"
                value={form.telefoon}
                onChange={(e) => setField('telefoon', e.target.value)}
                placeholder="+32 ..."
                style={s.input}
              />
            </div>

          </div>
        </div>

        {/* === Club gegevens === */}
        <div style={s.card}>
          <p style={s.sectionTitle}>Club gegevens</p>
          <div style={s.fieldGrid}>

            <div style={s.fieldWrap}>
              <label style={s.label}>Gordel</label>
              <select
                value={form.gordel}
                onChange={(e) => setField('gordel', e.target.value)}
                style={s.select}
              >
                {BELT_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b.charAt(0).toUpperCase() + b.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div style={s.fieldWrap}>
              <label style={s.label}>Lidnummer</label>
              <input
                type="text"
                value={lidnummerLoading ? 'Laden...' : form.lidnummer}
                onChange={(e) => setField('lidnummer', e.target.value)}
                onFocus={handleLidnummerFocus}
                placeholder="Klik om te genereren"
                style={s.input}
                readOnly={lidnummerLoading}
              />
            </div>

            <div style={s.fieldWrap}>
              <label style={s.label}>Ingeschreven jaar</label>
              <input
                type="number"
                value={form.ingeschrevenJaar}
                onChange={(e) => setField('ingeschrevenJaar', e.target.value)}
                min="1900"
                max={CURRENT_YEAR + 1}
                style={fieldErrors.ingeschrevenJaar ? s.inputError : s.input}
              />
              {fieldErrors.ingeschrevenJaar && (
                <span style={s.errorMsg}>{fieldErrors.ingeschrevenJaar}</span>
              )}
            </div>

          </div>

          <div style={{ marginTop: '16px' }}>
            <label style={s.label}>Groepen</label>
            <div style={s.checkboxGroup}>
              {GROEPEN_OPTIONS.map((g) => (
                <label
                  key={g}
                  style={form.groepen.includes(g) ? s.checkboxLabelActive : s.checkboxLabel}
                >
                  <input
                    type="checkbox"
                    checked={form.groepen.includes(g)}
                    onChange={() => toggleGroep(g)}
                    style={{ display: 'none' }}
                  />
                  {form.groepen.includes(g) ? '✓ ' : ''}{g}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* === Medisch & noodcontact === */}
        <div style={s.card}>
          <p style={s.sectionTitle}>Medisch & noodcontact</p>
          <div style={{ marginBottom: '14px' }}>
            <label style={s.label}>Medische informatie</label>
            <textarea
              value={form.medischeInfo}
              onChange={(e) => setField('medischeInfo', e.target.value)}
              placeholder="Allergieën, medicatie, beperkingen..."
              style={s.textarea}
            />
          </div>
          <div style={s.fieldGrid}>
            <div style={s.fieldWrap}>
              <label style={s.label}>Noodcontact naam</label>
              <input
                type="text"
                value={form.noodcontactNaam}
                onChange={(e) => setField('noodcontactNaam', e.target.value)}
                placeholder="Naam ouder / voogd"
                style={s.input}
              />
            </div>
            <div style={s.fieldWrap}>
              <label style={s.label}>Noodcontact telefoon</label>
              <input
                type="tel"
                value={form.noodcontactTelefoon}
                onChange={(e) => setField('noodcontactTelefoon', e.target.value)}
                placeholder="+32 ..."
                style={s.input}
              />
            </div>
          </div>
        </div>

        {/* === Lidmaatschap === */}
        <div style={s.card}>
          <p style={s.sectionTitle}>Lidmaatschap</p>
          <div style={s.fieldGrid}>
            <div style={s.fieldWrap}>
              <label style={s.label}>Vervaldatum bijdrage</label>
              <input
                type="date"
                value={form.bijdrageVervaldatum}
                onChange={(e) => setField('bijdrageVervaldatum', e.target.value)}
                style={s.input}
              />
            </div>
          </div>
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={s.inlineCheck}>
              <input
                type="checkbox"
                checked={form.bijdrageBetaald}
                onChange={(e) => setField('bijdrageBetaald', e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#c0392b', cursor: 'pointer' }}
              />
              <span>Bijdrage betaald</span>
            </label>
            <label style={s.inlineCheck}>
              <input
                type="checkbox"
                checked={form.actief}
                onChange={(e) => setField('actief', e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: '#c0392b', cursor: 'pointer' }}
              />
              <span>Lid is actief</span>
            </label>
          </div>
        </div>

        {/* === Actions === */}
        <div style={s.actionBar}>
          <button
            type="button"
            style={s.btnCancel}
            onClick={() => navigate('/leden')}
            onMouseOver={(e) => { e.currentTarget.style.background = '#3a3a3a'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = '#2d2d2d'; }}
          >
            Annuleren
          </button>
          <button
            type="submit"
            style={saving ? s.btnSaveDisabled : s.btnSave}
            disabled={saving}
            onMouseOver={(e) => { if (!saving) e.currentTarget.style.background = '#a93226'; }}
            onMouseOut={(e) => { if (!saving) e.currentTarget.style.background = '#c0392b'; }}
          >
            {saving ? 'Opslaan...' : 'Lid opslaan'}
          </button>
        </div>

      </form>
    </div>
  );
}
