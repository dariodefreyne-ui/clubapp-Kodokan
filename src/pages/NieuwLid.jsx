import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { koppelLidEnUserViaEmail } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast.jsx';
import { useGordelOpties } from '../hooks/useGordelOpties';
import { C } from '../styles/tokens';

const CURRENT_YEAR = new Date().getFullYear();
const STAPPEN = ['Persoonsgegevens', 'Club & groepen', 'Medisch & bijdrage'];

const s = {
  page: { minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', paddingBottom: '40px' },
  backBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer',
    fontSize: 'var(--font-size-md)', padding: '0 0 8px 0', marginBottom: '4px',
  },
  title: { fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 4px 0' },
  subtitle: { fontSize: 'var(--font-size-md)', color: 'var(--text-secondary)', margin: '0 0 20px 0' },
  voortgangBalk: { marginBottom: '24px' },
  stapLabels: { display: 'flex', justifyContent: 'space-between', marginBottom: '8px' },
  balk: { height: '4px', background: 'var(--border-color)', borderRadius: '2px' },
  balkVul: (stap, totaal) => ({
    height: '100%', background: 'var(--accent-red)', borderRadius: '2px',
    width: `${((stap + 1) / totaal) * 100}%`, transition: 'width 0.3s',
  }),
  card: {
    background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '20px',
    border: '1px solid var(--border-color)', marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--accent-red)',
    textTransform: 'uppercase', letterSpacing: '0.8px',
    margin: '0 0 16px 0', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)',
  },
  fieldGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', fontWeight: '500' },
  input: {
    padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-size-md)',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  inputError: {
    padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--accent-red)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-size-md)',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  },
  select: {
    padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-size-md)',
    outline: 'none', width: '100%', boxSizing: 'border-box', cursor: 'pointer',
  },
  textarea: {
    padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-size-md)',
    outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', minHeight: '80px',
  },
  errorMsg: { fontSize: 'var(--font-size-sm)', color: 'var(--accent-red)', marginTop: '2px' },
  checkboxGroup: { display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '4px' },
  checkboxLabel: {
    display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer',
    fontSize: 'var(--font-size-md)', color: 'var(--text-primary)',
    padding: '6px 12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)', userSelect: 'none',
  },
  checkboxLabelActive: {
    display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer',
    fontSize: 'var(--font-size-md)', color: 'var(--text-primary)',
    padding: '6px 12px', background: 'rgba(192,57,43,0.2)', borderRadius: 'var(--radius-md)',
    border: '1px solid var(--accent-red)', userSelect: 'none',
  },
  inlineCheck: {
    display: 'flex', alignItems: 'center', gap: '10px',
    cursor: 'pointer', fontSize: 'var(--font-size-md)', color: 'var(--text-primary)',
  },
  actionBar: { display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '8px', justifyContent: 'flex-end' },
  btnCancel: {
    padding: '12px 24px', background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontSize: 'var(--font-size-md)',
    fontWeight: '500', cursor: 'pointer', minHeight: '44px', fontFamily: 'inherit',
  },
  btnNext: {
    padding: '12px 28px', background: 'var(--accent-red)', border: 'none',
    borderRadius: 'var(--radius-md)', color: '#fff', fontSize: 'var(--font-size-md)', fontWeight: '600',
    cursor: 'pointer', minHeight: '44px', fontFamily: 'inherit',
  },
  errorBanner: {
    background: 'rgba(192,57,43,0.15)', border: '1px solid rgba(192,57,43,0.4)',
    borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '16px',
    color: 'var(--danger)', fontSize: 'var(--font-size-md)',
  },
};

function generateLidnummer(existingMembers) {
  if (!existingMembers.length) return '1001';
  const nums = existingMembers.map(m => parseInt(m.lidnummer, 10)).filter(n => !isNaN(n));
  if (!nums.length) return '1001';
  return String(Math.max(...nums) + 1);
}

function VoortgangsBalk({ stap }) {
  return (
    <div style={s.voortgangBalk}>
      <div style={s.stapLabels}>
        {STAPPEN.map((label, i) => (
          <span key={label} style={{
            fontSize: '11px',
            fontWeight: i <= stap ? '700' : '400',
            color: i <= stap ? 'var(--accent-red)' : 'var(--text-secondary)',
          }}>{label}</span>
        ))}
      </div>
      <div style={s.balk}>
        <div style={s.balkVul(stap, STAPPEN.length)} />
      </div>
    </div>
  );
}

export default function NieuwLid() {
  const navigate = useNavigate();
  const toast = useToast();
  const { configCache } = useAuth();
  const alleGroepen = configCache?.groepen || [];
  const { opties: BELT_OPTIONS, labels: BELT_LABELS } = useGordelOpties();

  const [stap, setStap] = useState(0);
  const [saving, setSaving] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [lidnummerLoading, setLidnummerLoading] = useState(false);
  const [lidnummerSuggested, setLidnummerSuggested] = useState(false);

  const [form, setForm] = useState({
    naam: '', geboortedatum: '', email: '', telefoon: '',
    gordel: 'wit', lidnummer: '', ingeschrevenJaar: String(CURRENT_YEAR), groepen: [],
    medischeInfo: '', noodcontactNaam: '', noodcontactTelefoon: '',
    bijdrageBetaald: false, bijdrageVervaldatum: '', actief: true,
  });

  const handleLidnummerFocus = async () => {
    if (lidnummerSuggested || form.lidnummer) return;
    setLidnummerLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'members'), orderBy('lidnummer')));
      setForm(f => ({ ...f, lidnummer: generateLidnummer(snap.docs.map(d => d.data())) }));
      setLidnummerSuggested(true);
    } catch { /* silent */ }
    setLidnummerLoading(false);
  };

  const setField = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (fieldErrors[key]) setFieldErrors(e => { const c = { ...e }; delete c[key]; return c; });
  };

  const toggleGroep = (groep) => {
    setForm(f => ({
      ...f,
      groepen: f.groepen.includes(groep) ? f.groepen.filter(g => g !== groep) : [...f.groepen, groep],
    }));
  };

  function valideerStap(stapIndex) {
    const errors = {};
    if (stapIndex === 0) {
      if (!form.naam.trim()) errors.naam = 'Naam is verplicht';
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Ongeldig e-mailadres';
    }
    if (stapIndex === 1) {
      if (form.ingeschrevenJaar && (isNaN(Number(form.ingeschrevenJaar)) || Number(form.ingeschrevenJaar) < 1900)) {
        errors.ingeschrevenJaar = 'Ongeldig jaar';
      }
    }
    return errors;
  }

  function volgende() {
    const errors = valideerStap(stap);
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    setFieldErrors({});
    setStap(s => s + 1);
  }

  const handleSubmit = async () => {
    const errors = valideerStap(2);
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    setSaving(true);
    setGlobalError('');
    try {
      const email = form.email.trim() || null;
      const ref = await addDoc(collection(db, 'members'), {
        naam: form.naam.trim(),
        geboortedatum: form.geboortedatum || null,
        email,
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
      });
      // Koppel automatisch aan een bestaand account met dit e-mailadres.
      if (email) { try { await koppelLidEnUserViaEmail(ref.id, email); } catch { /* niet kritisch */ } }
      toast({ bericht: `${form.naam.trim() || 'Lid'} toegevoegd`, type: 'success' });
      navigate('/leden');
    } catch (err) {
      console.error(err);
      setGlobalError('Opslaan mislukt: ' + (err.message || 'Onbekende fout'));
    }
    setSaving(false);
  };

  return (
    <div style={s.page}>
      <button style={s.backBtn} onClick={() => navigate('/leden')}>← Terug naar ledenlijst</button>
      <h1 style={s.title}>Nieuw lid toevoegen</h1>
      <p style={s.subtitle}>Stap {stap + 1} van {STAPPEN.length}: {STAPPEN[stap]}</p>

      <VoortgangsBalk stap={stap} />

      {globalError && <div style={s.errorBanner}>{globalError}</div>}

      {/* ─── STAP 1: Persoonsgegevens ─── */}
      {stap === 0 && (
        <div style={s.card}>
          <p style={s.sectionTitle}>Persoonsgegevens</p>
          <div style={s.fieldGrid}>
            <div style={s.fieldWrap}>
              <label style={s.label}>Naam *</label>
              <input type="text" value={form.naam} onChange={e => setField('naam', e.target.value)}
                placeholder="Volledige naam" style={fieldErrors.naam ? s.inputError : s.input} autoFocus />
              {fieldErrors.naam && <span style={s.errorMsg}>{fieldErrors.naam}</span>}
            </div>
            <div style={s.fieldWrap}>
              <label style={s.label}>Geboortedatum</label>
              <input type="date" value={form.geboortedatum} onChange={e => setField('geboortedatum', e.target.value)} style={s.input} />
            </div>
            <div style={s.fieldWrap}>
              <label style={s.label}>E-mail</label>
              <input type="email" value={form.email} onChange={e => setField('email', e.target.value)}
                placeholder="naam@voorbeeld.be" style={fieldErrors.email ? s.inputError : s.input} />
              {fieldErrors.email && <span style={s.errorMsg}>{fieldErrors.email}</span>}
            </div>
            <div style={s.fieldWrap}>
              <label style={s.label}>Telefoon</label>
              <input type="tel" value={form.telefoon} onChange={e => setField('telefoon', e.target.value)}
                placeholder="+32 ..." style={s.input} />
            </div>
          </div>
          <div style={s.actionBar}>
            <button type="button" style={s.btnCancel} onClick={() => navigate('/leden')}>Annuleren</button>
            <button type="button" style={s.btnNext} onClick={volgende}>Volgende →</button>
          </div>
        </div>
      )}

      {/* ─── STAP 2: Club & groepen ─── */}
      {stap === 1 && (
        <div style={s.card}>
          <p style={s.sectionTitle}>Club & groepen</p>
          <div style={s.fieldGrid}>
            <div style={s.fieldWrap}>
              <label style={s.label}>Gordel</label>
              <select value={form.gordel} onChange={e => setField('gordel', e.target.value)} style={s.select}>
                {BELT_OPTIONS.map(b => <option key={b} value={b}>{BELT_LABELS[b] || b.charAt(0).toUpperCase() + b.slice(1)}</option>)}
              </select>
            </div>
            <div style={s.fieldWrap}>
              <label style={s.label}>Lidnummer</label>
              <input type="text" value={lidnummerLoading ? 'Laden...' : form.lidnummer}
                onChange={e => setField('lidnummer', e.target.value)}
                onFocus={handleLidnummerFocus} placeholder="Klik om te genereren"
                style={s.input} readOnly={lidnummerLoading} />
            </div>
            <div style={s.fieldWrap}>
              <label style={s.label}>Ingeschreven jaar</label>
              <input type="number" value={form.ingeschrevenJaar} onChange={e => setField('ingeschrevenJaar', e.target.value)}
                min="1900" max={CURRENT_YEAR + 1} style={fieldErrors.ingeschrevenJaar ? s.inputError : s.input} />
              {fieldErrors.ingeschrevenJaar && <span style={s.errorMsg}>{fieldErrors.ingeschrevenJaar}</span>}
            </div>
          </div>
          <div style={{ marginTop: '16px' }}>
            <label style={s.label}>Groepen</label>
            <div style={s.checkboxGroup}>
              {alleGroepen.map(g => (
                <label key={g.id} style={form.groepen.includes(g.naam) ? s.checkboxLabelActive : s.checkboxLabel}>
                  <input type="checkbox" checked={form.groepen.includes(g.naam)} onChange={() => toggleGroep(g.naam)} style={{ display: 'none' }} />
                  {form.groepen.includes(g.naam) ? '✓ ' : ''}{g.naam}
                </label>
              ))}
            </div>
          </div>
          <div style={s.actionBar}>
            <button type="button" style={s.btnCancel} onClick={() => setStap(0)}>← Terug</button>
            <button type="button" style={s.btnNext} onClick={volgende}>Volgende →</button>
          </div>
        </div>
      )}

      {/* ─── STAP 3: Medisch & bijdrage ─── */}
      {stap === 2 && (
        <div style={s.card}>
          <p style={s.sectionTitle}>Medisch & bijdrage</p>
          <div style={{ marginBottom: '14px' }}>
            <label style={s.label}>Medische informatie</label>
            <textarea value={form.medischeInfo} onChange={e => setField('medischeInfo', e.target.value)}
              placeholder="Allergieën, medicatie, beperkingen..." style={s.textarea} />
          </div>
          <div style={{ ...s.fieldGrid, marginBottom: '16px' }}>
            <div style={s.fieldWrap}>
              <label style={s.label}>Noodcontact naam</label>
              <input type="text" value={form.noodcontactNaam} onChange={e => setField('noodcontactNaam', e.target.value)}
                placeholder="Naam ouder / voogd" style={s.input} />
            </div>
            <div style={s.fieldWrap}>
              <label style={s.label}>Noodcontact telefoon</label>
              <input type="tel" value={form.noodcontactTelefoon} onChange={e => setField('noodcontactTelefoon', e.target.value)}
                placeholder="+32 ..." style={s.input} />
            </div>
            <div style={s.fieldWrap}>
              <label style={s.label}>Vervaldatum bijdrage</label>
              <input type="date" value={form.bijdrageVervaldatum} onChange={e => setField('bijdrageVervaldatum', e.target.value)} style={s.input} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '8px' }}>
            <label style={s.inlineCheck}>
              <input type="checkbox" checked={form.bijdrageBetaald} onChange={e => setField('bijdrageBetaald', e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-red)', cursor: 'pointer' }} />
              <span>Bijdrage betaald</span>
            </label>
            <label style={s.inlineCheck}>
              <input type="checkbox" checked={form.actief} onChange={e => setField('actief', e.target.checked)}
                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-red)', cursor: 'pointer' }} />
              <span>Lid is actief</span>
            </label>
          </div>
          <div style={s.actionBar}>
            <button type="button" style={s.btnCancel} onClick={() => setStap(1)}>← Terug</button>
            <button type="button" style={s.btnNext} onClick={handleSubmit} disabled={saving}>
              {saving ? 'Opslaan...' : 'Lid opslaan ✓'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
