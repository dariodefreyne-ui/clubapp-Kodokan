// src/pages/Onboarding.jsx
// Stap-voor-stap onboarding voor nieuwe leden na registratie.
// Stap 1: Welkom, Stap 2: Persoonsgegevens, Stap 3: Meldingen
// Groepen worden beheerd via ledenbeheer en door koppelLidViaEmail gesynchroniseerd.
import React, { useState } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CLUB_NAAM as CLUB_NAAM_FALLBACK } from '../config/appConfig';

const STAPPEN = ['Welkom', 'Gegevens', 'Meldingen'];

const S = {
  page: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    boxSizing: 'border-box',
  },
  card: {
    background: 'var(--bg-card)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)', padding: '32px 28px',
    width: '100%', maxWidth: '540px',
  },
  title: { fontSize: '22px', fontWeight: '800', marginBottom: '6px' },
  sub: { fontSize: 'var(--font-size-md)', color: 'var(--text-secondary)', marginBottom: '28px' },
  label: { fontSize: 'var(--font-size-sm)', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '10px 14px',
    background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)', outline: 'none',
  },
  inputFout: {
    width: '100%', boxSizing: 'border-box', padding: '10px 14px',
    background: 'var(--bg-primary)', border: '1px solid var(--accent-red)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)', outline: 'none',
  },
  fout: { fontSize: 'var(--font-size-sm)', color: 'var(--accent-red)', marginTop: '4px' },
  fieldWrap: { marginBottom: '18px' },
  btnPrimary: {
    width: '100%', padding: '13px', background: 'var(--accent-red)', border: 'none',
    borderRadius: 'var(--radius-md)', color: '#fff', fontSize: 'var(--font-size-md)',
    fontWeight: '700', cursor: 'pointer', marginTop: '8px', fontFamily: 'inherit',
  },
  btnSecondary: {
    padding: '10px 20px', background: 'transparent', border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)',
    fontSize: 'var(--font-size-md)', cursor: 'pointer', fontFamily: 'inherit',
  },
  toggle: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 0', borderBottom: '1px solid var(--border-color)',
  },
};

function VoortgangsBalk({ stap, stappen }) {
  return (
    <div style={{ width: '100%', maxWidth: '540px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        {stappen.map((s, i) => (
          <span key={s} style={{
            fontSize: '11px', fontWeight: i <= stap ? '700' : '400',
            color: i <= stap ? 'var(--accent-red)' : 'var(--text-secondary)',
          }}>{s}</span>
        ))}
      </div>
      <div style={{ height: '4px', background: 'var(--border-color)', borderRadius: '2px' }}>
        <div style={{
          height: '100%', background: 'var(--accent-red)', borderRadius: '2px',
          width: `${((stap + 1) / stappen.length) * 100}%`, transition: 'width 0.3s',
        }} />
      </div>
    </div>
  );
}

function Stap1Welkom({ naam, clubNaam, onVolgende }) {
  return (
    <>
      <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '16px' }}>🥋</div>
      <div style={{ ...S.title, textAlign: 'center' }}>Welkom bij {clubNaam}!</div>
      <div style={{ ...S.sub, textAlign: 'center' }}>
        Dag {naam?.split(' ')[0] || 'judoka'}, fijn dat je erbij bent. Even snel je profiel instellen — duurt maar 2 minuutjes.
      </div>
      <ul style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-md)', paddingLeft: '20px', marginBottom: '28px', lineHeight: '1.8' }}>
        <li>Vul je basisgegevens in</li>
        <li>Stel meldingen in</li>
      </ul>
      <button style={S.btnPrimary} onClick={onVolgende}>Start →</button>
    </>
  );
}

function Stap2Gegevens({ data, onChange, onVolgende, onVorige }) {
  const [fouten, setFouten] = useState({});

  function valideer() {
    const f = {};
    if (!data.naam?.trim()) f.naam = 'Naam is verplicht';
    if (!data.telefoon?.trim()) f.telefoon = 'Telefoon is verplicht';
    setFouten(f);
    return Object.keys(f).length === 0;
  }

  return (
    <>
      <div style={S.title}>Jouw gegevens</div>
      <div style={S.sub}>We hebben deze info nodig voor je lidmaatschap.</div>

      <div style={S.fieldWrap}>
        <label style={S.label}>Naam *</label>
        <input style={fouten.naam ? S.inputFout : S.input}
          value={data.naam || ''} onChange={e => onChange('naam', e.target.value)} />
        {fouten.naam && <div style={S.fout}>{fouten.naam}</div>}
      </div>

      <div style={S.fieldWrap}>
        <label style={S.label}>Geboortedatum <span style={{color:'var(--text-secondary)',fontWeight:'400'}}>(helpt ons jou te koppelen aan je lidrecord)</span></label>
        <input type="date" style={S.input}
          value={data.geboortedatum || ''} onChange={e => onChange('geboortedatum', e.target.value)} />
      </div>

      <div style={S.fieldWrap}>
        <label style={S.label}>Telefoon *</label>
        <input type="tel" style={fouten.telefoon ? S.inputFout : S.input}
          value={data.telefoon || ''} onChange={e => onChange('telefoon', e.target.value)}
          placeholder="+32 4xx xx xx xx" />
        {fouten.telefoon && <div style={S.fout}>{fouten.telefoon}</div>}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
        <button style={S.btnSecondary} onClick={onVorige}>← Terug</button>
        <button style={{ ...S.btnPrimary, marginTop: 0, flex: 1 }} onClick={() => valideer() && onVolgende()}>Volgende →</button>
      </div>
    </>
  );
}

function Stap3Meldingen({ meldingen, onToggle, onVoltooien, onVorige, bezig, fout }) {
  const opties = [
    { key: 'wedstrijden', label: 'Wedstrijden', omschrijving: 'Nieuwe wedstrijden en inschrijvingen' },
    { key: 'examens', label: 'Examens', omschrijving: 'Examenuitnodigingen en resultaten' },
    { key: 'trainingen', label: 'Trainingen', omschrijving: 'Wijzigingen of annulaties van trainingen' },
    { key: 'communicatie', label: 'Communicatie', omschrijving: 'Berichten van het bestuur' },
  ];

  return (
    <>
      <div style={S.title}>Meldingen</div>
      <div style={S.sub}>Kies waarvoor je meldingen wil ontvangen. Je kan dit later altijd aanpassen.</div>

      {opties.map(o => (
        <div key={o.key} style={S.toggle}>
          <div>
            <div style={{ fontWeight: '600', fontSize: 'var(--font-size-md)' }}>{o.label}</div>
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>{o.omschrijving}</div>
          </div>
          <button
            onClick={() => onToggle(o.key)}
            style={{
              width: '46px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
              background: meldingen[o.key] ? 'var(--accent-red)' : 'var(--border-color)',
              position: 'relative', transition: 'background 0.2s', flexShrink: 0,
            }}
          >
            <span style={{
              position: 'absolute', top: '3px', borderRadius: '50%',
              width: '20px', height: '20px', background: '#fff',
              left: meldingen[o.key] ? '23px' : '3px', transition: 'left 0.2s',
            }} />
          </button>
        </div>
      ))}

      {fout && <div style={{ ...S.fout, marginTop: '16px', fontSize: 'var(--font-size-md)' }}>{fout}</div>}
      <div style={{ display: 'flex', gap: '10px', marginTop: '24px' }}>
        <button style={S.btnSecondary} onClick={onVorige}>← Terug</button>
        <button style={{ ...S.btnPrimary, marginTop: 0, flex: 1 }} onClick={onVoltooien} disabled={bezig}>
          {bezig ? 'Opslaan...' : 'Klaar — naar de app →'}
        </button>
      </div>
    </>
  );
}

export default function Onboarding() {
  const { profiel, configCache, setProfiel } = useAuth();
  const [stap, setStap] = useState(0);
  const [gegevens, setGegevens] = useState({ naam: profiel?.naam || '', geboortedatum: '', telefoon: '' });
  const [meldingen, setMeldingen] = useState({ wedstrijden: true, examens: true, trainingen: true, communicatie: true });
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState(null);

  function wijzigGegevens(key, val) {
    setGegevens(prev => ({ ...prev, [key]: val }));
  }

  function toggleMelding(key) {
    setMeldingen(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function voltooien() {
    if (!profiel?.uid) return;
    setBezig(true);
    setFout(null);
    try {
      await setDoc(doc(db, 'users', profiel.uid), {
        naam: gegevens.naam.trim() || profiel.naam || '',
        geboortedatum: gegevens.geboortedatum || null,
        telefoon: gegevens.telefoon.trim() || '',
        notificatieVoorkeuren: {
          wedstrijden: { inApp: meldingen.wedstrijden, push: meldingen.wedstrijden },
          examens: { inApp: meldingen.examens, push: meldingen.examens },
          trainingen: { inApp: meldingen.trainingen, push: meldingen.trainingen },
          communicatie: { inApp: meldingen.communicatie, push: meldingen.communicatie },
        },
        onboardingVoltooid: true,
        bijgewerkt: serverTimestamp(),
      }, { merge: true });
      // Lokaal profiel direct updaten zodat App.jsx meteen naar de app navigeert,
      // zonder te wachten op de Firestore onSnapshot (die vertraagd kan zijn door
      // de async initialiseerNotificatiesIndienNodig-call in AuthContext).
      setProfiel(prev => ({ ...prev, onboardingVoltooid: true }));
    } catch (e) {
      console.error('Onboarding opslaan mislukt:', e);
      setFout('Opslaan mislukt. Controleer je verbinding en probeer opnieuw.');
      setBezig(false);
    }
  }

  return (
    <div style={S.page}>
      <VoortgangsBalk stap={stap} stappen={STAPPEN} />
      <div style={S.card}>
        {stap === 0 && (
          <Stap1Welkom
            naam={profiel?.naam}
            clubNaam={configCache?.clubSettings?.clubname || configCache?.clubSettings?.naam || CLUB_NAAM_FALLBACK}
            onVolgende={() => setStap(1)}
          />
        )}
        {stap === 1 && (
          <Stap2Gegevens
            data={gegevens}
            onChange={wijzigGegevens}
            onVolgende={() => setStap(2)}
            onVorige={() => setStap(0)}
          />
        )}
        {stap === 2 && (
          <Stap3Meldingen
            meldingen={meldingen}
            onToggle={toggleMelding}
            onVoltooien={voltooien}
            onVorige={() => setStap(1)}
            bezig={bezig}
            fout={fout}
          />
        )}
      </div>
    </div>
  );
}
