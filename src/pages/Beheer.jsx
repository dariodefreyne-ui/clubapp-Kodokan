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
import { TrainerMeldingenBeheer, StockMeldingenBeheer, StockOverzichtMail, PushStatusDashboard, ClubBerichtBeheer, NieuwLidMeldingenBeheer } from '../components/beheer/MeldingenBeheer';

const TABS_BESTUURSLID = [
  { id: 'club', label: '🏠 Club' },
  { id: 'gebruikers', label: '👥 Gebruikers' },
  { id: 'groepen', label: '🥋 Groepen' },
  { id: 'lesgevers', label: '👤 Lesgevers' },
];

const TABS_ADMIN_ONLY = [
  { id: 'paginas', label: '📄 Paginas' },
  { id: 'meldingen', label: '🔔 Meldingen' },
  { id: 'data', label: '⚙️ Data' },
];

// Gecombineerd: admin ziet alles, bestuurslid enkel TABS_BESTUURSLID

export default function Beheer() {
  const { role, isAdmin } = useAuth();
  const zichtbareTabs = isAdmin
    ? [...TABS_BESTUURSLID, ...TABS_ADMIN_ONLY]
    : TABS_BESTUURSLID;
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

  if (role !== 'admin' && role !== 'bestuurslid') {
    return (
      <div style={S.page}>
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '48px', marginBottom: 'var(--space-4)' }}>🔒</div>
          <div style={{ fontSize: 'var(--font-size-lg)' }}>Alleen beschikbaar voor admin of bestuurslid.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <div style={S.title}>🔧 Beheer</div>
      {saved && <div style={S.successMsg}>✓ {saved}</div>}

      <div style={{ display: 'flex', gap: '0', marginBottom: 'var(--space-5)', borderBottom: '1px solid var(--border-color)', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {zichtbareTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActieveTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              color: actieveTab === tab.id ? 'var(--accent-red)' : 'var(--text-secondary)',
              padding: '10px 14px',
              cursor: 'pointer',
              fontSize: 'var(--font-size-sm)',
              fontWeight: actieveTab === tab.id ? '700' : '400',
              borderBottom: actieveTab === tab.id ? '2px solid var(--accent-red)' : '2px solid transparent',
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
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-2) 0', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>{k}</span>
                  <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: '500' }}>{v}</span>
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

      {actieveTab === 'paginas' && isAdmin && (
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

      {actieveTab === 'meldingen' && isAdmin && (
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>👤 Nieuw lid registratie</div>
            <NieuwLidMeldingenBeheer />
          </div>
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
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Overzicht van alle geregistreerde push tokens. Gebruik dit om te controleren of meldingen actief zijn op de juiste toestellen.
            </div>
            <PushStatusDashboard />
          </div>
        </div>
      )}

      {actieveTab === 'data' && isAdmin && (
        <div>
          <div style={S.card}>
            <div style={S.cardTitle}>Data beheer</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-2)', marginTop: 0 }}>
              Eenmalige actie: vult de Firestore-collectie
              <code style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', color: 'var(--accent-red)' }}>technieken</code>
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
                background: seedStatus === 'klaar' ? 'var(--success)' : 'var(--accent-red)',
                border: 'none',
                color: 'var(--text-primary)',
                padding: '10px var(--space-4)',
                borderRadius: 'var(--radius-md)',
                cursor: seedStatus === 'bezig' ? 'not-allowed' : 'pointer',
                fontSize: 'var(--font-size-md)',
                fontWeight: '600',
                opacity: seedStatus === 'bezig' ? 0.7 : 1,
              }}
            >
              {seedStatus === 'bezig' ? '⏳ Bezig...' : seedStatus === 'klaar' ? '✓ Geseed' : '🌱 Seed technieken'}
            </button>

            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--space-4)', marginBottom: 'var(--space-2)' }}>
              Eenmalige migratie: voegt het
              <code style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', color: 'var(--accent-red)' }}>seizoen</code>-veld
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
              style={{ background: '#2980b9', border: 'none', color: 'var(--text-primary)', padding: '10px var(--space-4)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-md)', fontWeight: '600' }}
            >
              🔄 Migreer seizoen (eenmalig)
            </button>
          </div>

          <div style={S.card}>
            <div style={S.cardTitle}>Firebase configuratie</div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-md)', margin: '0 0 var(--space-3)' }}>
              Pas <code style={{ background: 'var(--bg-primary)', padding: '2px 6px', borderRadius: 'var(--radius-sm)', color: 'var(--accent-red)' }}>src/firebase.js</code> aan met uw eigen Firebase projectinstellingen.
            </p>
            <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', fontFamily: 'monospace', fontSize: 'var(--font-size-sm)', color: 'var(--success)', overflowX: 'auto' }}>
              {`const firebaseConfig = {\n apiKey: "uw-api-key",\n authDomain: "uw-project.firebaseapp.com",\n projectId: "uw-project-id",\n storageBucket: "uw-project.appspot.com",\n messagingSenderId: "123456",\n appId: "uw-app-id"\n};`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
