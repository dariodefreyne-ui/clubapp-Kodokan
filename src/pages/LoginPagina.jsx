// src/pages/LoginPagina.jsx
import React, { useState, useEffect } from 'react';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CLUB_NAAM as CLUB_NAAM_FALLBACK } from '../config/appConfig';

function getCachedClubNaam() {
  try {
    const raw = localStorage.getItem('clubSettingsCache');
    if (!raw) return CLUB_NAAM_FALLBACK;
    const data = JSON.parse(raw);
    return data.clubname || data.naamKort || CLUB_NAAM_FALLBACK;
  } catch {
    return CLUB_NAAM_FALLBACK;
  }
}
function getCachedLogoUrl() {
  try {
    const raw = localStorage.getItem('clubSettingsCache');
    if (!raw) return '';
    return JSON.parse(raw).logoUrl || '';
  } catch {
    return '';
  }
}

const S = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--space-6)',
  },
  card: {
    background: 'var(--bg-card)',
    borderRadius: 'var(--radius-xl)',
    padding: '32px var(--space-6)',
    width: '100%',
    maxWidth: '380px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  },
  logo: {
    textAlign: 'center',
    marginBottom: '28px',
  },
  logoIcon: {
    fontSize: '48px',
    marginBottom: 'var(--space-2)',
  },
  logoTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: 'var(--text-primary)',
  },
  logoSub: {
    fontSize: 'var(--font-size-sm)',
    color: 'var(--text-secondary)',
    marginTop: 'var(--space-1)',
  },
  label: {
    display: 'block',
    fontSize: 'var(--font-size-sm)',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '13px 14px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontSize: 'var(--font-size-md)',
    marginBottom: 'var(--space-4)',
    boxSizing: 'border-box',
    outline: 'none',
  },
  btn: {
    width: '100%',
    padding: '14px',
    background: 'var(--accent-red)',
    border: 'none',
    borderRadius: '10px',
    color: 'var(--text-primary)',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: 'var(--space-1)',
  },
  linkBtn: {
    width: '100%',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: 'var(--font-size-sm)',
    marginTop: 'var(--space-3)',
    textDecoration: 'underline',
  },
  fout: {
    background: 'rgba(231,76,60,0.15)',
    border: '1px solid var(--danger)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 14px',
    color: 'var(--danger)',
    fontSize: 'var(--font-size-md)',
    marginBottom: 'var(--space-4)',
  },
  info: {
    background: 'rgba(39,174,96,0.15)',
    border: '1px solid var(--success)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 14px',
    color: 'var(--success)',
    fontSize: 'var(--font-size-md)',
    marginBottom: 'var(--space-4)',
  },
};

function valideerWachtwoord(ww) {
  if (ww.length < 8) return 'Wachtwoord moet minimaal 8 tekens bevatten.';
  if (!/[A-Z]/.test(ww)) return 'Wachtwoord moet minstens 1 hoofdletter bevatten.';
  if (!/[0-9]/.test(ww)) return 'Wachtwoord moet minstens 1 cijfer bevatten.';
  return null;
}

const foutCodesRegistratie = {
  'auth/email-already-in-use': 'Dit e-mailadres is al in gebruik.',
  'auth/invalid-email': 'Ongeldig e-mailadres.',
  'auth/weak-password': 'Wachtwoord moet minstens 6 tekens bevatten.',
};

export default function LoginPagina() {
  const { login, resetWachtwoord, registreer } = useAuth();

  // Start met de localStorage cache zodat er geen flicker is,
  // dan meteen live ophalen uit Firestore (publieke read, geen auth nodig).
  const [clubNaam, setClubNaam] = useState(getCachedClubNaam());
  const [logoUrl, setLogoUrl]   = useState(getCachedLogoUrl());
  // Standaard gesloten tot Firestore expliciet 'true' bevestigt — voorkomt open
  // registratie tijdens het laden of bij een mislukte fetch.
  const [registratieOpen, setRegistratieOpen] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'club')).then(snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      const naam = data.clubname || data.naam || CLUB_NAAM_FALLBACK;
      const logo = data.logoUrl || '';
      setClubNaam(naam);
      setLogoUrl(logo);
      setRegistratieOpen(data.registratieOpen === true);
      // Cache bijwerken zodat volgende bezoek/uitlog meteen de juiste waarden toont
      try {
        localStorage.setItem('clubSettingsCache', JSON.stringify({
          clubname: naam,
          naamKort: data.naamKort || '',
          logoUrl: logo,
        }));
      } catch { /* localStorage onbeschikbaar */ }
    }).catch(() => { /* stil falen, fallback-waarden blijven staan */ });
  }, []);

  const [modus, setModus] = useState('inloggen');

  // Inloggen state
  const [email, setEmail]           = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [fout, setFout]             = useState('');
  const [melding, setMelding]       = useState('');
  const [bezig, setBezig]           = useState(false);
  const [resetBezig, setResetBezig] = useState(false);

  // Registreren state
  const [regNaam, setRegNaam]             = useState('');
  const [regEmail, setRegEmail]           = useState('');
  const [regWachtwoord, setRegWachtwoord] = useState('');
  const [regWachtwoord2, setRegWachtwoord2] = useState('');
  const [regFout, setRegFout]             = useState('');
  const [regMelding, setRegMelding]       = useState('');
  const [regBezig, setRegBezig]           = useState(false);

  const wisselModus = (nieuweModus) => {
    setModus(nieuweModus);
    setFout('');
    setMelding('');
    setRegFout('');
    setRegMelding('');
  };

  const handleSubmit = async () => {
    if (!email || !wachtwoord) {
      setFout('Vul email en wachtwoord in.');
      setMelding('');
      return;
    }
    setBezig(true);
    setFout('');
    setMelding('');
    try {
      await login(email.trim(), wachtwoord);
    } catch (e) {
      const codes = {
        'auth/user-not-found':     'Geen account gevonden voor dit e-mailadres.',
        'auth/wrong-password':     'Wachtwoord klopt niet.',
        'auth/invalid-email':      'Ongeldig e-mailadres.',
        'auth/too-many-requests':  'Te veel pogingen. Probeer later opnieuw.',
        'auth/invalid-credential': 'E-mail of wachtwoord klopt niet.',
        'auth/network-request-failed': 'Geen netwerkverbinding. Controleer je internet.',
      };
      setFout(codes[e.code] || `Inloggen mislukt (${e.code}). Probeer opnieuw.`);
    } finally {
      setBezig(false);
    }
  };

  const handleResetWachtwoord = async () => {
    if (!email.trim()) {
      setFout('Vul eerst je e-mailadres in.');
      setMelding('');
      return;
    }
    setResetBezig(true);
    setFout('');
    setMelding('');
    try {
      await resetWachtwoord(email.trim());
      setMelding('Als dit e-mailadres bestaat, is er zonet een mail voor reset wachtwoord verzonden.');
    } catch (e) {
      if (e.code === 'auth/invalid-email') {
        setFout('Ongeldig e-mailadres.');
      } else {
        setMelding('Als dit e-mailadres bestaat, is er zonet een mail voor reset wachtwoord verzonden.');
      }
    } finally {
      setResetBezig(false);
    }
  };

  const handleRegistreer = async () => {
    setRegFout('');
    setRegMelding('');
    if (!regNaam.trim() || !regEmail.trim() || !regWachtwoord || !regWachtwoord2) {
      setRegFout('Vul alle velden in.');
      return;
    }
    if (regWachtwoord !== regWachtwoord2) {
      setRegFout('Wachtwoorden komen niet overeen.');
      return;
    }
    const wwFout = valideerWachtwoord(regWachtwoord);
    if (wwFout) { setRegFout(wwFout); return; }
    setRegBezig(true);
    try {
      await registreer(regEmail.trim(), regWachtwoord, regNaam);
      setRegMelding('Account aangemaakt! Je bent nu ingelogd.');
    } catch (e) {
      setRegFout(foutCodesRegistratie[e.code] || 'Registratie mislukt. Probeer opnieuw.');
    } finally {
      setRegBezig(false);
    }
  };

  const tabStijl = (actief) => ({
    flex: 1,
    padding: '10px 0',
    background: 'none',
    border: 'none',
    borderBottom: actief ? '2px solid var(--accent-red)' : '2px solid transparent',
    color: actief ? 'var(--text-primary)' : 'var(--text-secondary)',
    fontSize: 'var(--font-size-md)',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: 'var(--space-5)',
  });

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={clubNaam}
              style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '12px', marginBottom: '12px' }}
            />
          ) : (
            <div style={S.logoIcon}>🥋</div>
          )}
          <div style={S.logoTitle}>{clubNaam}</div>
          <div style={S.logoSub}>Clubbeheer</div>
        </div>

        <div style={{ display: 'flex' }}>
          <button style={tabStijl(modus === 'inloggen')} onClick={() => wisselModus('inloggen')}>
            Inloggen
          </button>
          {registratieOpen && (
            <button style={tabStijl(modus === 'registreren')} onClick={() => wisselModus('registreren')}>
              Registreren
            </button>
          )}
        </div>

        {modus === 'inloggen' && (
          <>
            {fout    && <div style={S.fout}>{fout}</div>}
            {melding && <div style={S.info}>{melding}</div>}

            <label style={S.label} htmlFor="login-email">E-mailadres</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="naam@email.be"
              autoComplete="email"
              style={S.input}
            />

            <label style={S.label} htmlFor="login-wachtwoord">Wachtwoord</label>
            <input
              id="login-wachtwoord"
              type="password"
              value={wachtwoord}
              onChange={e => setWachtwoord(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="••••••••"
              autoComplete="current-password"
              style={S.input}
            />

            <button onClick={handleSubmit} disabled={bezig || resetBezig} style={S.btn}>
              {bezig ? 'Bezig...' : '🔐 Inloggen'}
            </button>

            <button onClick={handleResetWachtwoord} disabled={bezig || resetBezig} style={S.linkBtn}>
              {resetBezig ? 'Mail verzenden...' : 'Wachtwoord vergeten?'}
            </button>
          </>
        )}

        {modus === 'registreren' && registratieOpen && (
          <>
            {regFout    && <div style={S.fout}>{regFout}</div>}
            {regMelding && <div style={S.info}>{regMelding}</div>}

            <label style={S.label} htmlFor="reg-naam">Naam</label>
            <input
              id="reg-naam"
              type="text"
              value={regNaam}
              onChange={e => setRegNaam(e.target.value)}
              placeholder="Voornaam Achternaam"
              autoComplete="name"
              style={S.input}
            />

            <label style={S.label} htmlFor="reg-email">E-mailadres</label>
            <input
              id="reg-email"
              type="email"
              value={regEmail}
              onChange={e => setRegEmail(e.target.value)}
              placeholder="naam@email.be"
              autoComplete="email"
              style={S.input}
            />

            <label style={S.label} htmlFor="reg-wachtwoord">Wachtwoord</label>
            <input
              id="reg-wachtwoord"
              type="password"
              value={regWachtwoord}
              onChange={e => setRegWachtwoord(e.target.value)}
              placeholder="Min. 8 tekens, 1 hoofdletter, 1 cijfer"
              autoComplete="new-password"
              style={S.input}
            />

            <label style={S.label} htmlFor="reg-wachtwoord2">Wachtwoord herhalen</label>
            <input
              id="reg-wachtwoord2"
              type="password"
              value={regWachtwoord2}
              onChange={e => setRegWachtwoord2(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRegistreer()}
              placeholder="Herhaal wachtwoord"
              autoComplete="new-password"
              style={S.input}
            />

            <button onClick={handleRegistreer} disabled={regBezig} style={S.btn}>
              {regBezig ? 'Bezig...' : 'Account aanmaken'}
            </button>

            <button onClick={() => wisselModus('inloggen')} style={S.linkBtn}>
              Terug naar inloggen
            </button>
          </>
        )}
      </div>
    </div>
  );
}
