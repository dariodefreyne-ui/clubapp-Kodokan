// src/components/beheer/MailTemplatesBeheer.jsx
// Editor voor systeem-mailteksten. Slaat op in mailTemplates/{key}.
// Cloud Functions lezen deze documenten (met fallback op defaults).
import React, { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useToast } from '../ui/Toast.jsx';
import { MAIL_TEMPLATE_DEFAULTS, MAIL_TEMPLATE_KEYS } from '../../config/mailTemplatesDefaults';

const S = {
  wrap: { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px' },
  tabs: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px', borderBottom: '1px solid var(--border-color)' },
  tab: (actief) => ({
    background: 'none', border: 'none',
    color: actief ? 'var(--accent-red)' : 'var(--text-secondary)',
    padding: '10px 14px', cursor: 'pointer',
    fontSize: '13px', fontWeight: actief ? '700' : '400',
    borderBottom: actief ? '2px solid var(--accent-red)' : '2px solid transparent',
    fontFamily: 'inherit', whiteSpace: 'nowrap',
  }),
  veld: { marginBottom: '14px' },
  label: { display: 'block', fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' },
  input: {
    padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px',
    width: '100%', boxSizing: 'border-box',
  },
  textarea: {
    padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px',
    width: '100%', boxSizing: 'border-box', minHeight: '180px',
    fontFamily: 'monospace', lineHeight: '1.5', resize: 'vertical',
  },
  hint: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' },
  btnRij: { display: 'flex', gap: '10px', marginTop: '4px' },
  btnPrimary: {
    padding: '10px 20px', background: 'var(--accent-red)', border: 'none',
    borderRadius: '8px', color: 'var(--btn-primary-text)', fontSize: '14px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  btnSecondary: {
    padding: '10px 16px', background: 'transparent', border: '1px solid var(--border-color)',
    borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px',
    cursor: 'pointer', fontFamily: 'inherit',
  },
  variabelen: {
    display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px',
  },
  variabel: {
    padding: '3px 10px', background: 'rgba(52,152,219,0.12)', color: '#2980b9',
    borderRadius: '999px', fontSize: '11px', fontWeight: '700',
    fontFamily: 'monospace', cursor: 'pointer', userSelect: 'none', border: 'none',
  },
};

function vervangVariabelen(tekst, vars) {
  return String(tekst || '').replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] !== undefined ? String(vars[k]) : `{{${k}}}`);
}

export default function MailTemplatesBeheer() {
  const toast = useToast();
  const [actieveKey, setActieveKey] = useState(MAIL_TEMPLATE_KEYS[0]);
  const [data, setData] = useState({ onderwerp: '', titel: '', inhoud: '' });
  const [origineel, setOrigineel] = useState(null);
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);

  const defaultTemplate = MAIL_TEMPLATE_DEFAULTS[actieveKey];

  useEffect(() => {
    setLaden(true);
    getDoc(doc(db, 'mailTemplates', actieveKey))
      .then(snap => {
        const opgeslagen = snap.exists() ? snap.data() : null;
        const huidig = {
          onderwerp: opgeslagen?.onderwerp ?? defaultTemplate.onderwerp,
          titel: opgeslagen?.titel ?? defaultTemplate.titel,
          inhoud: opgeslagen?.inhoud ?? defaultTemplate.inhoud,
        };
        setData(huidig);
        setOrigineel(huidig);
        setLaden(false);
      })
      .catch(() => {
      setData({
        onderwerp: defaultTemplate.onderwerp,
        titel: defaultTemplate.titel,
        inhoud: defaultTemplate.inhoud,
      });
      setLaden(false);
    });
  }, [actieveKey]);

  function setVeld(key, val) { setData(d => ({ ...d, [key]: val })); }

  async function slaOp() {
    setBezig(true);
    try {
      await setDoc(doc(db, 'mailTemplates', actieveKey), {
        onderwerp: data.onderwerp,
        titel: data.titel,
        inhoud: data.inhoud,
        bijgewerkt: serverTimestamp(),
      }, { merge: true });
      setOrigineel(data);
      toast({ bericht: 'Template opgeslagen', type: 'success' });
    } catch (e) {
      toast({ bericht: `Fout: ${e.message}`, type: 'error' });
    }
    setBezig(false);
  }

  function herstel() {
    setData({
      onderwerp: defaultTemplate.onderwerp,
      titel: defaultTemplate.titel,
      inhoud: defaultTemplate.inhoud,
    });
    toast({ bericht: 'Hersteld naar standaard (nog niet opgeslagen)', type: 'info' });
  }

  // Voorbeeld: vervang variabelen met dummy-waarden voor preview
  const dummyVars = Object.fromEntries((defaultTemplate.variabelen || []).map(v => [v, `<${v}>`]));
  const voorbeeldOnderwerp = vervangVariabelen(data.onderwerp, dummyVars);

  const gewijzigd = origineel && (
    origineel.onderwerp !== data.onderwerp ||
    origineel.titel !== data.titel ||
    origineel.inhoud !== data.inhoud
  );

  return (
    <>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 12px' }}>
        Pas hier het onderwerp, de titel en de HTML-inhoud van automatische systeemmails aan.
        Variabelen zoals <code style={{ background: 'var(--bg-primary)', padding: '1px 6px', borderRadius: '4px' }}>{'{{naam}}'}</code> worden
        bij verzending vervangen door de juiste waarde.
      </p>

      <div style={S.tabs}>
        {MAIL_TEMPLATE_KEYS.map(k => (
          <button key={k} style={S.tab(actieveKey === k)} onClick={() => setActieveKey(k)}>
            {MAIL_TEMPLATE_DEFAULTS[k].naam}
          </button>
        ))}
      </div>

      <div style={S.wrap}>
        {laden ? (
          <div style={{ color: 'var(--text-secondary)' }}>Laden...</div>
        ) : (
          <>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', fontStyle: 'italic' }}>
              {defaultTemplate.omschrijving}
            </div>

            <div style={S.veld}>
              <label style={S.label}>Onderwerp</label>
              <input
                style={S.input}
                value={data.onderwerp}
                onChange={e => setVeld('onderwerp', e.target.value)}
              />
              <div style={S.hint}>
                Voorbeeld: <em>{voorbeeldOnderwerp}</em>
              </div>
            </div>

            <div style={S.veld}>
              <label style={S.label}>Titel (h2 bovenaan de mail)</label>
              <input
                style={S.input}
                value={data.titel}
                onChange={e => setVeld('titel', e.target.value)}
              />
            </div>

            <div style={S.veld}>
              <label style={S.label}>Inhoud (HTML toegelaten)</label>
              <textarea
                style={S.textarea}
                value={data.inhoud}
                onChange={e => setVeld('inhoud', e.target.value)}
              />
              <div style={S.hint}>
                Gebruik <code>{'<p>'}</code>, <code>{'<strong>'}</code>, <code>{'<br>'}</code> etc. voor opmaak.
              </div>
            </div>

            {(defaultTemplate.variabelen || []).length > 0 && (
              <div style={S.veld}>
                <label style={S.label}>Beschikbare variabelen (klik om te kopiëren)</label>
                <div style={S.variabelen}>
                  {defaultTemplate.variabelen.map(v => (
                    <button
                      key={v}
                      style={S.variabel}
                      onClick={() => {
                        navigator.clipboard.writeText(`{{${v}}}`);
                        toast({ bericht: `{{${v}}} gekopieerd`, type: 'info', duur: 1500 });
                      }}
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={S.btnRij}>
              <button style={S.btnPrimary} onClick={slaOp} disabled={bezig || !gewijzigd}>
                {bezig ? 'Opslaan...' : (gewijzigd ? 'Opslaan' : 'Geen wijzigingen')}
              </button>
              <button style={S.btnSecondary} onClick={herstel} disabled={bezig}>
                Herstel naar standaard
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
