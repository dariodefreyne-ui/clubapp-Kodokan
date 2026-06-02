// KandidaatToevoegenModal — voeg een kandidaat toe aan een examen
// Lazy member loading: leden worden pas gezocht na invoer (min 2 tekens).
// Vrije naam-invoer: als het lid niet in ledenbeheer staat, kan een naam worden ingetikt.
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { zoekLedenOpNaam } from '../../services/firestoreService';
import { C, buttonStyle, inputStyle } from '../../styles/tokens';
import { BELT_COLORS, BELT_KYU_LABELS, BELT_NEXT, BELTS } from './examenConstants';

const overlayStyle = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 2000,
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
};
const panelStyle = {
  background: C.surface, borderRadius: 16, padding: 24, width: '100%', maxWidth: 480,
  boxShadow: '0 8px 40px rgba(0,0,0,0.5)', maxHeight: '90vh', overflowY: 'auto',
};

function BeltBadge({ belt, small }) {
  const cfg = BELT_COLORS[belt] || { bg: C.bg, color: C.textMuted };
  return (
    <span style={{
      ...cfg,
      padding: small ? '1px 7px' : '3px 10px',
      borderRadius: 20,
      fontSize: small ? 11 : 12,
      fontWeight: 700,
      display: 'inline-block',
      whiteSpace: 'nowrap',
    }}>
      {BELT_KYU_LABELS[belt] || belt}
    </span>
  );
}

export default function KandidaatToevoegenModal({ bestaandeIds, groepId, onSave, onClose }) {
  const [zoekterm, setZoekterm] = useState('');
  const [resultaten, setResultaten] = useState([]);
  const [zoekend, setZoekend] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState(null); // { id, naam, gordel } or null (free text)
  const [vrijNaam, setVrijNaam] = useState(''); // free-text fallback
  const [modus, setModus] = useState('zoek'); // 'zoek' | 'vrij'
  const [targetBelt, setTargetBelt] = useState('');
  const [isStreepje, setIsStreepje] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const debounceRef = useRef(null);

  const zoek = useCallback(async (term) => {
    if (term.length < 2) { setResultaten([]); return; }
    setZoekend(true);
    try {
      const res = await zoekLedenOpNaam(term, 20);
      const filtered = res.filter(m => !bestaandeIds?.includes(m.id));
      // Leden van de examengroep komen eerst; anderen worden gemarkeerd maar niet verborgen
      const sorted = groepId
        ? [
            ...filtered.filter(m => m.groepen?.includes(groepId)),
            ...filtered.filter(m => !m.groepen?.includes(groepId)),
          ]
        : filtered;
      setResultaten(sorted);
    } catch {
      setResultaten([]);
    } finally {
      setZoekend(false);
    }
  }, [bestaandeIds, groepId]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => zoek(zoekterm), 300);
    return () => clearTimeout(debounceRef.current);
  }, [zoekterm, zoek]);

  useEffect(() => {
    if (geselecteerd?.gordel) {
      const next = BELT_NEXT[geselecteerd.gordel];
      setTargetBelt(next || geselecteerd.gordel);
    }
  }, [geselecteerd]);

  function selecteer(lid) {
    setGeselecteerd(lid);
    setZoekterm(lid.naam || '');
    setResultaten([]);
    const next = BELT_NEXT[lid.gordel] || lid.gordel;
    setTargetBelt(next);
  }

  async function toevoegen() {
    const naam = modus === 'vrij' ? vrijNaam.trim() : (geselecteerd?.naam || '');
    if (!naam) { setErr('Naam is verplicht.'); return; }
    if (!targetBelt) { setErr('Kies een doelgordel.'); return; }
    setSaving(true);
    setErr('');
    try {
      const data = {
        memberId: modus === 'zoek' ? (geselecteerd?.id || null) : null,
        memberName: naam,
        currentBelt: modus === 'zoek' ? (geselecteerd?.gordel || null) : null,
        targetBelt,
        isStreepje,
        examFase: 'nieuw',
      };
      onSave(data);
    } catch (e) {
      setErr('Toevoegen mislukt: ' + e.message);
      setSaving(false);
    }
  }

  const kanToevoegen = targetBelt && (modus === 'vrij' ? vrijNaam.trim() : geselecteerd?.naam);

  return (
    <div style={overlayStyle} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={panelStyle}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontSize: 18, fontWeight: 800, flex: 1, color: C.textPrimary }}>Kandidaat toevoegen</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 22, cursor: 'pointer', padding: 0 }}>×</button>
        </div>

        {/* Zoek vs vrij */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {['zoek', 'vrij'].map(m => (
            <button
              key={m}
              onClick={() => { setModus(m); setErr(''); }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                background: modus === m ? C.blue : C.bg,
                color: modus === m ? '#fff' : C.textMuted,
                border: `1px solid ${modus === m ? C.blue : C.border}`,
              }}
            >
              {m === 'zoek' ? 'Lid zoeken' : 'Vrije naam'}
            </button>
          ))}
        </div>

        {modus === 'zoek' ? (
          <div style={{ marginBottom: 16, position: 'relative' }}>
            <input
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
              value={zoekterm}
              onChange={e => { setZoekterm(e.target.value); if (geselecteerd) setGeselecteerd(null); }}
              placeholder={groepId ? "Zoek op naam (gefilterd op groep)…" : "Zoek op naam (min. 2 tekens)…"}
              autoFocus
            />
            {zoekend && (
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4 }}>Zoeken…</div>
            )}
            {resultaten.length > 0 && (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, marginTop: 4, maxHeight: 200, overflowY: 'auto' }}>
                {resultaten.map(m => {
                  const inGroep = !groepId || m.groepen?.includes(groepId);
                  return (
                    <div
                      key={m.id}
                      onClick={() => selecteer(m)}
                      style={{ padding: '10px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${C.border}` }}
                      onMouseEnter={e => e.currentTarget.style.background = C.bg}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{m.naam}</span>
                      {!inGroep && (
                        <span style={{ fontSize: 10, color: C.textMuted, background: C.bg, borderRadius: 4, padding: '1px 6px', border: `1px solid ${C.border}`, whiteSpace: 'nowrap' }}>andere groep</span>
                      )}
                      {m.gordel && <BeltBadge belt={m.gordel} small />}
                    </div>
                  );
                })}
              </div>
            )}
            {geselecteerd && (
              <div style={{ marginTop: 8, padding: '8px 12px', background: C.green + '18', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: C.green, fontWeight: 700 }}>✓</span>
                <span style={{ fontSize: 13, color: C.textPrimary, flex: 1 }}>{geselecteerd.naam}</span>
                {geselecteerd.gordel && <BeltBadge belt={geselecteerd.gordel} small />}
                <button onClick={() => { setGeselecteerd(null); setZoekterm(''); }} style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 16 }}>×</button>
              </div>
            )}
            {!geselecteerd && zoekterm.length >= 2 && !zoekend && resultaten.length === 0 && (
              <div style={{ fontSize: 13, color: C.textMuted, marginTop: 6 }}>
                Geen leden gevonden. Gebruik "Vrije naam" als het lid nog niet in ledenbeheer staat.
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: 16 }}>
            <input
              style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
              value={vrijNaam}
              onChange={e => setVrijNaam(e.target.value)}
              placeholder="Naam kandidaat (vrij in te tikken)"
              autoFocus
            />
          </div>
        )}

        {/* Doelgordel + streepje */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 600, marginBottom: 6 }}>Doelgordel *</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {BELTS.map(b => {
              const cfg = BELT_COLORS[b] || {};
              const active = targetBelt === b;
              return (
                <button
                  key={b}
                  onClick={() => setTargetBelt(b)}
                  style={{
                    padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    ...(active ? cfg : { background: C.bg, color: C.textMuted, border: `1px solid ${C.border}` }),
                    outline: active ? `2px solid ${C.blue}` : 'none', outlineOffset: 2,
                  }}
                >
                  {BELT_KYU_LABELS[b] || b}
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
            <input
              type="checkbox"
              checked={isStreepje}
              onChange={e => setIsStreepje(e.target.checked)}
              style={{ width: 16, height: 16 }}
            />
            <span style={{ color: C.textPrimary }}>Streepje (tussentijdse stap, enkel nieuwe technieken, geen gordelpromovering)</span>
          </label>
        </div>

        {err && <div style={{ color: C.red, fontSize: 13, marginBottom: 10 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ ...buttonStyle('ghost'), flex: 1 }}>Annuleren</button>
          <button
            onClick={toevoegen}
            disabled={saving || !kanToevoegen}
            style={{ ...buttonStyle('primary'), flex: 1, opacity: !kanToevoegen ? 0.5 : 1 }}
          >
            {saving ? 'Toevoegen…' : 'Toevoegen'}
          </button>
        </div>
      </div>
    </div>
  );
}
