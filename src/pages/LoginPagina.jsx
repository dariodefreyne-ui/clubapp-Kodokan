// src/pages/LoginPagina.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { CLUB_NAAM } from '../config/appConfig';

const S = {
  page: {
    minHeight: '100vh',
    background: '#1a1a1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    background: '#2d2d2d',
    borderRadius: '16px',
    padding: '32px 24px',
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
    marginBottom: '8px',
  },
  logoTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#fff',
  },
  logoSub: {
    fontSize: '13px',
    color: '#aaa',
    marginTop: '4px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#aaa',
    marginBottom: '6px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    width: '100%',
    padding: '13px 14px',
    background: '#1a1a1a',
    border: '1px solid #3a3a3a',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '15px',
    marginBottom: '16px',
    boxSizing: 'border-box',
    outline: 'none',
  },
  btn: {
    width: '100%',
    padding: '14px',
    background: '#c0392b',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    marginTop: '4px',
  },
  linkBtn: {
    width: '100%',
    background: 'none',
    border: 'none',
    color: '#aaa',
    cursor: 'pointer',
    fontSize: '13px',
    marginTop: '12px',
    textDecoration: 'underline',
  },
  fout: {
    background: 'rgba(231,76,60,0.15)',
    border: '1px solid #e74c3c',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#e74c3c',
    fontSize: '14px',
    marginBottom: '16px',
  },
  info: {
    background: 'rgba(39,174,96,0.15)',
    border: '1px solid #27ae60',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#27ae60',
    fontSize: '14px',
    marginBottom: '16px',
  },
};

const foutCodesRegistratie = {
  'auth/email-already-in-use': 'Dit e-mailadres is al in gebruik.',
  'auth/invalid-email': 'Ongeldig e-mailadres.',
  'auth/weak-password': 'Wachtwoord moet minstens 6 tekens bevatten.',
};

export default function LoginPagina() {
  const { login, resetWachtwoord, registreer } = useAuth();

  const [modus, setModus] = useState('inloggen');

  // Inloggen state
  const [email, setEmail] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [fout, setFout] = useState('');
  const [melding, setMelding] = useState('');
  const [bezig, setBezig] = useState(false);
  const [resetBezig, setResetBezig] = useState(false);

  // Registreren state
  const [regNaam, setRegNaam] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regWachtwoord, setRegWachtwoord] = useState('');
  const [regWachtwoord2, setRegWachtwoord2] = useState('');
  const [regFout, setRegFout] = useState('');
  const [regMelding, setRegMelding] = useState('');
  const [regBezig, setRegBezig] = useState(false);

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
        'auth/user-not-found': 'Geen account gevonden voor dit e-mailadres.',
        'auth/wrong-password': 'Wachtwoord klopt niet.',
        'auth/invalid-email': 'Ongeldig e-mailadres.',
        'auth/too-many-requests': 'Te veel pogingen. Probeer later opnieuw.',
        'auth/invalid-credential': 'E-mail of wachtwoord klopt niet.',
      };
      setFout(codes[e.code] || 'Inloggen mislukt. Probeer opnieuw.');
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
    borderBottom: actief ? '2px solid #c0392b' : '2px solid transparent',
    color: actief ? '#fff' : '#666',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    marginBottom: '20px',
  });

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>
          <div style={S.logoIcon}>🥋</div>
          <div style={S.logoTitle}>{CLUB_NAAM}</div>
          <div style={S.logoSub}>Clubbeheer</div>
        </div>

        <div style={{ display: 'flex' }}>
          <button style={tabStijl(modus === 'inloggen')} onClick={() => wisselModus('inloggen')}>
            Inloggen
          </button>
          <button style={tabStijl(modus === 'registreren')} onClick={() => wisselModus('registreren')}>
            Registreren
          </button>
        </div>

        {modus === 'inloggen' && (
          <>
            {fout && <div style={S.fout}>{fout}</div>}
            {melding && <div style={S.info}>{melding}</div>}

            <label style={S.label}>E-mailadres</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              placeholder="naam@email.be"
              autoComplete="email"
              style={S.input}
            />

            <label style={S.label}>Wachtwoord</label>
            <input
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

        {modus === 'registreren' && (
          <>
            {regFout && <div style={S.fout}>{regFout}</div>}
            {regMelding && <div style={S.info}>{regMelding}</div>}

            <label style={S.label}>Naam</label>
            <input
              type="text"
              value={regNaam}
              onChange={e => setRegNaam(e.target.value)}
              placeholder="Voornaam Achternaam"
              autoComplete="name"
              style={S.input}
            />

            <label style={S.label}>E-mailadres</label>
            <input
              type="email"
              value={regEmail}
              onChange={e => setRegEmail(e.target.value)}
              placeholder="naam@email.be"
              autoComplete="email"
              style={S.input}
            />

            <label style={S.label}>Wachtwoord</label>
            <input
              type="password"
              value={regWachtwoord}
              onChange={e => setRegWachtwoord(e.target.value)}
              placeholder="Minimaal 6 tekens"
              autoComplete="new-password"
              style={S.input}
            />

            <label style={S.label}>Wachtwoord herhalen</label>
            <input
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
