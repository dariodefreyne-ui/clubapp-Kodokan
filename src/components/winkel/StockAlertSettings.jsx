import React, { useEffect, useState } from 'react';
import {
  heeftActieveStockPush,
  registreerVoorgrondStockMeldingen,
  stopStockPushMeldingen,
  vraagStockPushToestemming,
} from '../../notifications/firebaseMessaging';

export default function StockAlertSettings({ profiel }) {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;

    async function laadStatus() {
      try {
        const ok = 'Notification' in window && 'serviceWorker' in navigator;
        const actief = await heeftActieveStockPush(profiel);
        if (mounted) {
          setSupported(ok);
          setEnabled(actief);
        }
      } catch {
        if (mounted) {
          setSupported(false);
          setEnabled(false);
        }
      }
      if (mounted) setLoading(false);
    }

    laadStatus();
    return () => { mounted = false; };
  }, [profiel]);

  useEffect(() => {
    let unsubscribe = () => {};

    registreerVoorgrondStockMeldingen(payload => {
      const title = payload.notification?.title || 'Stockmelding';
      const body = payload.notification?.body || 'Een product is uit stock.';
      setMessage(`${title}: ${body}`);
    }).then(fn => {
      unsubscribe = fn || (() => {});
    });

    return () => unsubscribe();
  }, []);

  async function inschakelen() {
    setLoading(true);
    setMessage('');
    try {
      await vraagStockPushToestemming(profiel);
      setEnabled(true);
      setMessage('Stockmeldingen zijn ingeschakeld op dit toestel.');
    } catch (e) {
      setMessage(e.message || 'Stockmeldingen inschakelen mislukt.');
    }
    setLoading(false);
  }

  async function uitschakelen() {
    setLoading(true);
    setMessage('');
    try {
      await stopStockPushMeldingen(profiel);
      setEnabled(false);
      setMessage('Stockmeldingen zijn uitgeschakeld op dit toestel.');
    } catch (e) {
      setMessage(e.message || 'Stockmeldingen uitschakelen mislukt.');
    }
    setLoading(false);
  }

  if (!supported && !loading) {
    return (
      <div style={boxStyle}>
        <strong>Stockmeldingen</strong>
        <div style={subStyle}>Deze browser ondersteunt geen pushmeldingen.</div>
      </div>
    );
  }

  return (
    <div style={boxStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <strong>Stockmeldingen</strong>
          <div style={subStyle}>
            Ontvang een pushbericht wanneer een product op 0 valt.
          </div>
        </div>

        {enabled ? (
          <button onClick={uitschakelen} disabled={loading} style={secondaryBtn}>
            Uitschakelen
          </button>
        ) : (
          <button onClick={inschakelen} disabled={loading} style={primaryBtn}>
            Inschakelen
          </button>
        )}
      </div>

      {message && (
        <div style={{ color: message.includes('mislukt') ? 'var(--danger)' : 'var(--text-secondary)', fontSize: '12px', marginTop: '8px' }}>
          {message}
        </div>
      )}
    </div>
  );
}

const boxStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: '12px',
  padding: '14px',
  marginBottom: '16px',
};

const subStyle = {
  color: 'var(--text-secondary)',
  fontSize: '12px',
  marginTop: '3px',
};

const primaryBtn = {
  background: 'var(--accent-red)',
  border: 'none',
  color: 'var(--text-primary)',
  padding: '9px 14px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '700',
};

const secondaryBtn = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  color: '#ccc',
  padding: '9px 14px',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: '700',
};
