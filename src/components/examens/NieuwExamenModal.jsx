// NieuwExamenModal — examen aanmaken of bewerken (datum, naam, locatie, groep)
import React, { useState, useEffect } from 'react';
import { useGroepen } from '../../contexts/GroepenContext';
import { addEvent, updateEvent } from '../../services/firestoreService';
import { stuurPushTrigger, PUSH_TYPES } from '../../services/pushService';
import { C, buttonStyle, inputStyle } from '../../styles/tokens';

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 2000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};
const panelStyle = {
  background: C.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 460,
  boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
};

export default function NieuwExamenModal({ bestaand, onSave, onClose }) {
  const { groepen } = useGroepen();
  const [form, setForm] = useState({
    naam: '',
    datum: '',
    locatie: '',
    groepId: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (bestaand) {
      setForm({
        naam: bestaand.naam || '',
        datum: bestaand.datum || '',
        locatie: bestaand.locatie || '',
        groepId: bestaand.groepId || '',
      });
    }
  }, [bestaand]);

  function set(k) {
    return e => setForm(f => ({ ...f, [k]: e.target.value }));
  }

  async function opslaan() {
    if (!form.naam.trim() || !form.datum) { setErr('Naam en datum zijn verplicht.'); return; }
    setSaving(true);
    setErr('');
    try {
      const data = {
        naam: form.naam.trim(),
        datum: form.datum,
        locatie: form.locatie.trim(),
        groepId: form.groepId || null,
        type: 'examen',
      };
      if (bestaand) {
        await updateEvent(bestaand.id, data);
        onSave({ ...bestaand, ...data });
      } else {
        const ref = await addEvent(data);
        const nieuw = { id: ref.id, ...data };
        stuurPushTrigger(PUSH_TYPES.EXAMEN_GEPLAND, {
          naam: data.naam, datum: data.datum, locatie: data.locatie || '',
        });
        onSave(nieuw);
      }
    } catch (e) {
      setErr('Opslaan mislukt: ' + e.message);
      setSaving(false);
    }
  }

  const groepLabel = groepen.find(g => g.id === form.groepId)?.naam || '';

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 18, fontWeight: 800, flex: 1, color: C.textPrimary }}>
            {bestaand ? 'Examen bewerken' : 'Nieuw examen'}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 22, cursor: 'pointer', padding: 0 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>
            Naam *
            <input
              style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
              value={form.naam}
              onChange={set('naam')}
              placeholder="bv. Clubexamen april 2025"
            />
          </label>

          <label style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>
            Datum *
            <input
              type="date"
              style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
              value={form.datum}
              onChange={set('datum')}
            />
          </label>

          <label style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>
            Locatie
            <input
              style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
              value={form.locatie}
              onChange={set('locatie')}
              placeholder="bv. Judozaal Kodokan"
            />
          </label>

          <label style={{ fontSize: 13, color: C.textMuted, fontWeight: 600 }}>
            Groep
            <select
              style={{ ...inputStyle, display: 'block', width: '100%', marginTop: 4, boxSizing: 'border-box' }}
              value={form.groepId}
              onChange={set('groepId')}
            >
              <option value="">— Niet opgegeven —</option>
              {groepen
                .filter(g => !g.dag || g.dag.toLowerCase().includes('woensdag'))
                .map(g => (
                  <option key={g.id} value={g.id}>{g.naam}</option>
                ))}
            </select>
          </label>
        </div>

        {err && <div style={{ color: C.red, fontSize: 13, marginTop: 12 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ ...buttonStyle('ghost'), flex: 1 }}>Annuleren</button>
          <button
            onClick={opslaan}
            disabled={saving || !form.naam.trim() || !form.datum}
            style={{ ...buttonStyle('primary'), flex: 1, opacity: (!form.naam.trim() || !form.datum) ? 0.5 : 1 }}
          >
            {saving ? 'Opslaan…' : bestaand ? 'Opslaan' : 'Aanmaken'}
          </button>
        </div>
      </div>
    </div>
  );
}
