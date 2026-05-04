// src/pages/LoginPagina.jsx
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

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

export default function LoginPagina() {
  const { login, resetWachtwoord } = useAuth();
  const [email, setEmail] = useState('');
  const [wachtwoord, setWachtwoord] = useState('');
  const [fout, setFout] = useState('');
  const [melding, setMelding] = useState('');
  const [bezig, setBezig] = useState(false);
  const [resetBezig, setResetBezig] = useState(false);

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

  return (
    <div style={S.page}>
      <div style={S.card}>
        <div style={S.logo}>
          <div style={S.logoIcon}>🥋</div>
          <div style={S.logoTitle}>Judo Kodokan Merchtem</div>
          <div style={S.logoSub}>Clubbeheer</div>
        </div>

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
      </div>
    </div>
  );
}
