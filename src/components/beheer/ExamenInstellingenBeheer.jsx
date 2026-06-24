import React, { useState, useEffect } from 'react';
import { getExamenConfig, setExamenConfig } from '../../services/firestoreService';
import { C, inputStyle } from '../../styles/tokens';

const DEFAULTS = {
  drempelGoed: 5,
  drempelUitstekend: 8,
  tekstOnvoldoende:
    'Het examen werd niet behaald. Er zijn nog onvoldoende technieken die voldoende worden beheerst. We raden aan om verder te oefenen en op een later tijdstip opnieuw deel te nemen.',
  tekstGoed:
    'Gefeliciteerd! Het examen werd succesvol afgelegd. De technieken worden goed beheerst en de graad kan worden toegekend.',
  tekstUitstekend:
    'Uitstekend resultaat! De technieken worden op een hoog niveau beheerst. Proficiat met dit schitterend examenresultaat!',
};

const inp = {
  ...inputStyle,
  padding: '9px 12px',
  marginBottom: 10,
};

const lbl = { display: 'block', color: C.textSec, fontSize: 12, fontWeight: 600, marginBottom: 4 };
const area = { ...inp, minHeight: 90, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 };
const numInp = { ...inp, width: 90 };

export default function ExamenInstellingenBeheer() {
  const [cfg, setCfg] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [ladend, setLadend] = useState(true);

  useEffect(() => {
    getExamenConfig().then(data => {
      if (data) setCfg(c => ({ ...c, ...data }));
      setLadend(false);
    });
  }, []);

  async function opslaan() {
    setSaving(true);
    await setExamenConfig(cfg);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (ladend) return <div style={{ color: C.textSec, padding: '16px' }}>Laden...</div>;

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 17, color: C.red }}>Examen instellingen</h2>

      {saved && (
        <div style={{ background: C.greenDim, border: `1px solid ${C.green}`, borderRadius: 10, padding: '10px 14px', color: C.green, marginBottom: 16, fontSize: 13 }}>
          ✓ Instellingen opgeslagen
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div>
          <label style={lbl}>Drempel "Goed" (score ≥ X)</label>
          <input type="number" min="0" max="10" step="0.5" style={numInp}
            value={cfg.drempelGoed}
            onChange={e => setCfg(c => ({ ...c, drempelGoed: parseFloat(e.target.value) || 0 }))} />
        </div>
        <div>
          <label style={lbl}>Drempel "Uitstekend" (score ≥ X)</label>
          <input type="number" min="0" max="10" step="0.5" style={numInp}
            value={cfg.drempelUitstekend}
            onChange={e => setCfg(c => ({ ...c, drempelUitstekend: parseFloat(e.target.value) || 0 }))} />
        </div>
      </div>

      <div style={{ background: C.surface, borderRadius: 10, padding: '12px 14px', marginBottom: 12, border: `1px solid ${C.borderSoft}` }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
          <span style={{ background: C.redDim, color: C.red, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>ONVOLDOENDE</span>
          <span style={{ color: C.textMuted, fontSize: 12 }}>score &lt; {cfg.drempelGoed}</span>
        </div>
        <label style={lbl}>Conclusietekst voor lid</label>
        <textarea style={area} value={cfg.tekstOnvoldoende}
          onChange={e => setCfg(c => ({ ...c, tekstOnvoldoende: e.target.value }))} />
      </div>

      <div style={{ background: C.surface, borderRadius: 10, padding: '12px 14px', marginBottom: 12, border: `1px solid ${C.borderSoft}` }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
          <span style={{ background: C.orangeDim, color: C.orange, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>GOED</span>
          <span style={{ color: C.textMuted, fontSize: 12 }}>{cfg.drempelGoed} ≤ score &lt; {cfg.drempelUitstekend}</span>
        </div>
        <label style={lbl}>Conclusietekst voor lid</label>
        <textarea style={area} value={cfg.tekstGoed}
          onChange={e => setCfg(c => ({ ...c, tekstGoed: e.target.value }))} />
      </div>

      <div style={{ background: C.surface, borderRadius: 10, padding: '12px 14px', marginBottom: 20, border: `1px solid ${C.borderSoft}` }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
          <span style={{ background: C.greenDim, color: C.green, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>UITSTEKEND</span>
          <span style={{ color: C.textMuted, fontSize: 12 }}>score ≥ {cfg.drempelUitstekend}</span>
        </div>
        <label style={lbl}>Conclusietekst voor lid</label>
        <textarea style={area} value={cfg.tekstUitstekend}
          onChange={e => setCfg(c => ({ ...c, tekstUitstekend: e.target.value }))} />
      </div>

      <button
        onClick={opslaan}
        disabled={saving}
        style={{ background: C.red, border: 'none', color: C.btnPrimaryText, padding: '11px 22px', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 700, fontSize: 13, opacity: saving ? 0.7 : 1 }}
      >
        {saving ? 'Opslaan...' : '✓ Opslaan'}
      </button>
    </div>
  );
}
