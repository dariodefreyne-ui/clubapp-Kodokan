// src/pages/Beheer.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getClubSettings, setClubSettings } from '../services/firestoreService';
import { CLUB_NAAM } from '../config/appConfig';
import { seedTechnieken } from '../scripts/seedTechnieken';
import { migreerSeizoen } from '../scripts/migreerSeizoen';
import { S } from '../components/beheer/beheerStyles';
import GebruikersBeheer from '../components/beheer/GebruikersBeheer';
import LesgeversBeheer from '../components/beheer/LesgeversBeheer';
import GroepenBeheer from '../components/beheer/GroepenBeheer';
import PaginaRollenBeheer from '../components/beheer/PaginaRollenBeheer';
import { TrainerMeldingenBeheer, StockMeldingenBeheer, StockOverzichtMail, PushStatusDashboard, ClubBerichtBeheer } from '../components/beheer/MeldingenBeheer';

const TABS = [
  { id: 'club', label: '🏠 Club' },
  { id: 'gebruikers', label: '👥 Gebruikers' },
  { id: 'paginas', label: '📄 Paginas' },
  { id: 'groepen', label: '🥋 Groepen' },
  { id: 'lesgevers', label: '👤 Lesgevers' },
  { id: 'meldingen', label: '🔔 Meldingen' },
  { id: 'data', label: '⚙️ Data' },
];

export default function Beheer() {
  const { role } = useAuth();
  const [actieveTab, setActieveTab] = useState('club');
  const [settings, setSettings] = useState({ clubname: CLUB_NAAM, logoUrl: '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [seedStatus, setSeedStatus] = useState('');

  useEffect(() => {
    getClubSettings().then(data => { if (data) setSettings(data); });
  }, []);

  async function saveSettings() {
    setSaving(true);
    await setClubSettings(settings);
    setSaved('Instellingen opgeslagen!');
    setTimeout(() => setSaved(''), 3000);
    setSaving(false);
  }

  if (role !== 'beheerder') {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', padding: '60px', color: '#aaa' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
          <div style={{ fontSize: '18px' }}>Alleen beschikbaar voor beheerders.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.title}>🔧 Beheer</div>
      {saved && <div style={S.successMsg}>✓ {saved}</div>}

      <div style={{ display: 'flex', gap: '0', marginBottom: '20px', borderBottom: '1px solid #3a3a3a', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActieveTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              color: actieveTab === tab.id ? '#c0392b' : '#aaa',
              padding: '10px 14px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: actieveTab === tab.id ? '700' : '400',
              borderBottom: actieveTab === tab.id ? '2px solid #c0392b' : '2px solid transparent',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {actieveTab === 'club' && (
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Clubinstellingen</div>
            <label style={S.label}>Clubnaam</label>
            <input
              style={S.input}
              value={settings.clubname || ''}
              onChange={e => setSettings(s => ({ ...s, clubname: e.target.value }))}
              placeholder="Clubnaam"
            />
            <label style={S.label}>Logo URL (optioneel)</label>
            <input
              style={S.input}
              value={settings.logoUrl || ''}
              onChange={e => setSettings(s => ({ ...s, logoUrl: e.target.value }))}
              placeholder="https://..."
            />
            {settings.logoUrl && (
              <img src={settings.logoUrl} alt="Logo" style={{ maxHeight: '80px', borderRadius: '8px', marginBottom: '10px', objectFit: 'contain' }} />
            )}
            <button style={S.btn('primary')} onClick={saveSettings} disabled={saving}>
              {saving ? 'Opslaan...' : '✓ Opslaan'}
            </button>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>App informatie</div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {[
                ['Versie', '1.0.0'],
                ['Technologie', 'React + Firebase'],
                ['Hosting', 'Firebase Hosting (gratis tier)'],
                ['Authenticatie', 'Firebase Authentication (email)'],
                ['Betaald?', 'Nee - volledig gratis'],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #3a3a3a' }}>
                  <span style={{ color: '#aaa', fontSize: '13px' }}>{k}</span>
                  <span style={{ fontSize: '13px', fontWeight: '500' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {actieveTab === 'gebruikers' && (
        <div style={S.card}>
          <div style={S.cardTitle}>👥 Gebruikers</div>
          <GebruikersBeheer />
        </div>
      )}

      {actieveTab === 'paginas' && (
        <div style={S.card}>
          <div style={S.cardTitle}>📄 Paginas per rol</div>
          <PaginaRollenBeheer />
        </div>
      )}

      {actieveTab === 'groepen' && (
        <div style={S.card}>
          <div style={S.cardTitle}>🥋 Groepen & trainingsduur</div>
          <GroepenBeheer />
        </div>
      )}

      {actieveTab === 'lesgevers' && (
        <div style={S.card}>
          <div style={S.cardTitle}>👤 Lesgevers</div>
          <LesgeversBeheer />
        </div>
      )}

      {actieveTab === 'meldingen' && (
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Trainer herinneringen</div>
            <TrainerMeldingenBeheer />
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>Stock meldingen</div>
            <StockMeldingenBeheer />
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>Clubbericht</div>
            <ClubBerichtBeheer />
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>Stock overzicht mailen</div>
            <StockOverzichtMail />
          </div>
          <div style={S.card}>
            <div style={S.cardTitle}>📲 Push token status</div>
            <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '14px' }}>
              Overzicht van alle geregistreerde push tokens. Gebruik dit om te controleren of meldingen actief zijn op de juiste toestellen.
            </div>
            <PushStatusDashboard />
          </div>
        </div>
      )}

      {actieveTab === 'data' && (
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Data beheer</div>
            <p style={{ color: '#aaa', fontSize: '13px', marginBottom: '8px', marginTop: 0 }}>
              Eenmalige actie: vult de Firestore-collectie
              <code style={{ background: '#1a1a1a', padding: '2px 6px', borderRadius: '4px', color: '#c0392b' }}>technieken</code>
              met de standaard techniekdata. Wordt overgeslagen als de data al aanwezig is.
            </p>
            <button
              onClick={async () => {
                setSeedStatus('bezig');
                try {
                  await seedTechnieken();
                  setSeedStatus('klaar');
                } catch (e) {
                  setSeedStatus('');
                  alert('Fout bij seeding: ' + e.message);
                }
              }}
              disabled={seedStatus === 'bezig'}
              style={{
                background: seedStatus === 'klaar' ? '#27ae60' : '#c0392b',
                border: 'none',
                color: '#fff',
                padding: '10px 16px',
                borderRadius: '8px',
                cursor: seedStatus === 'bezig' ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                opacity: seedStatus === 'bezig' ? 0.7 : 1,
              }}
            >
              {seedStatus === 'bezig' ? '⏳ Bezig...' : seedStatus === 'klaar' ? '✓ Geseed' : '🌱 Seed technieken'}
            </button>

            <p style={{ color: '#aaa', fontSize: '13px', marginTop: '16px', marginBottom: '8px' }}>
              Eenmalige migratie: voegt het
              <code style={{ background: '#1a1a1a', padding: '2px 6px', borderRadius: '4px', color: '#c0392b' }}>seizoen</code>-veld
              toe aan bestaande trainingen zonder seizoen.
            </p>
            <button
              onClick={async () => {
                try {
                  const n = await migreerSeizoen();
                  alert(`${n} trainingen gemigreerd`);
                } catch (e) {
                  alert('Migratie mislukt: ' + e.message);
                }
              }}
              style={{ background: '#2980b9', border: 'none', color: '#fff', padding: '10px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' }}
            >
              🔄 Migreer seizoen (eenmalig)
            </button>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>Firebase configuratie</div>
            <p style={{ color: '#aaa', fontSize: '14px', margin: '0 0 12px' }}>
              Pas <code style={{ background: '#1a1a1a', padding: '2px 6px', borderRadius: '4px', color: '#c0392b' }}>src/firebase.js</code> aan met uw eigen Firebase projectinstellingen.
            </p>
            <div style={{ background: '#1a1a1a', borderRadius: '8px', padding: '12px', fontFamily: 'monospace', fontSize: '12px', color: '#27ae60', overflowX: 'auto' }}>
              {`const firebaseConfig = {\n apiKey: "uw-api-key",\n authDomain: "uw-project.firebaseapp.com",\n projectId: "uw-project-id",\n storageBucket: "uw-project.appspot.com",\n messagingSenderId: "123456",\n appId: "uw-app-id"\n};`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
