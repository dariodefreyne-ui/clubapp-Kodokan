// src/pages/Beheer.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
 getClubSettings,
 setClubSettings,
 DEFAULT_GEEN_TRAINING_MARKERS,
 normaliseerGeenTrainingMarkers,
} from '../services/firestoreService';
import { CLUB_NAAM } from '../config/appConfig';
import { seedTechnieken } from '../scripts/seedTechnieken';
import { migreerSeizoen } from '../scripts/migreerSeizoen';
import GebruikersBeheer from '../components/beheer/GebruikersBeheer';
import LesgeversBeheer from '../components/beheer/LesgeversBeheer';
import GroepenBeheer from '../components/beheer/GroepenBeheer';
import PaginaRollenBeheer from '../components/beheer/PaginaRollenBeheer';
import {
 TrainerMeldingenBeheer,
 StockMeldingenBeheer,
 StockOverzichtMail,
 PushStatusDashboard,
 ClubBerichtBeheer,
 NieuwLidMeldingenBeheer,
} from '../components/beheer/MeldingenBeheer';
import {
  CategorieenBeheer,
  LesgevertypesBeheer,
  GordelsBeheer,
  CommunicatieCategorieenBeheer,
  TechniekCategorieenBeheer,
} from '../components/beheer/InstellingenBeheer';
import UitbetalingstarievenBeheer from '../components/beheer/UitbetalingstarievenBeheer';
import {
  ClubInstellingenBeheer,
  SeizoenInstellingenBeheer,
} from '../components/beheer/AlgemeenInstellingenBeheer';
import { C, cardStyle } from '../styles/tokens';

function buildSections(isAdmin) {
  const s = [
    {
      id: 'club',
      icon: '🏠',
      label: 'Club',
      desc: 'Clubinstellingen & training detectie',
      accentColor: C.red,
      accentDim: C.redDim,
      subs: [
        { id: 'instellingen', icon: '⚙️', label: 'Instellingen', desc: 'Clubnaam, logo en training detectie' },
        { id: 'appinfo', icon: 'ℹ️', label: 'App informatie', desc: 'Technische details over de app' },
      ],
    },
    {
      id: 'gebruikers',
      icon: '👥',
      label: 'Gebruikers',
      desc: 'Rollen toewijzen per lid',
      accentColor: C.blue,
      accentDim: C.blueDim,
    },
    {
      id: 'groepen',
      icon: '🥋',
      label: 'Groepen',
      desc: 'Trainingsgroepen & duur',
      accentColor: C.green,
      accentDim: C.greenDim,
    },
    {
      id: 'lesgevers',
      icon: '👤',
      label: 'Lesgevers',
      desc: 'Lesgever beheer',
      accentColor: C.orange,
      accentDim: C.orangeDim,
    },
  ];
  s.push({
    id: 'clubdata',
    icon: '📋',
    label: 'Clubdata',
    desc: 'Categorieën, gordels & tarieven',
    accentColor: '#0EA5E9',
    accentDim: 'rgba(14,165,233,0.16)',
    subs: [
      { id: 'categorieen',            icon: '🏷️', label: 'Leeftijdscategorieën', desc: 'U7, U9, U11, ..., Senior' },
      { id: 'gordels',                icon: '🥋', label: 'Gordels / KYU',         desc: 'Kleuren en labels per graad' },
      { id: 'lesgevertypes',          icon: '👤', label: 'Lesgever-types',         desc: 'Initiator, Trainer A, ...' },
      { id: 'communicatieCatrieen',   icon: '📣', label: 'Communicatie-categorieën', desc: 'Labels voor berichten' },
      { id: 'techniekCategorieen',    icon: '📖', label: 'Techniek-categorieën',   desc: 'Val, worpen, houdgreep, ...' },
      { id: 'uitbetalingstarieven',   icon: '🚗', label: 'Uitbetalingstarieven',   desc: 'Uurloon en km-vergoeding' },
      { id: 'club',                   icon: '🏛️', label: 'Club',                  desc: 'Naam, contact, logo' },
      { id: 'seizoen',                icon: '📅', label: 'Seizoen',                desc: 'Start- en einddatum' },
    ],
  });
  if (isAdmin) {
    s.push(
      {
        id: 'paginas',
        icon: '📄',
        label: "Pagina's",
        desc: 'Toegang per rol instellen',
        accentColor: C.purple,
        accentDim: C.purpleDim,
      },
      {
        id: 'meldingen',
        icon: '🔔',
        label: 'Meldingen',
        desc: 'Notificaties & berichten',
        accentColor: '#F59E0B',
        accentDim: 'rgba(245,158,11,0.16)',
        subs: [
          { id: 'nieuwlid', icon: '🆕', label: 'Nieuw lid', desc: 'Meldingen bij registratie' },
          { id: 'trainer', icon: '📅', label: 'Trainer herinneringen', desc: 'Automatische planning meldingen' },
          { id: 'stock', icon: '📦', label: 'Stock meldingen', desc: 'Stock alerts & overzicht mailen' },
          { id: 'clubbericht', icon: '📢', label: 'Clubbericht', desc: 'Push bericht naar leden' },
          { id: 'pushstatus', icon: '📲', label: 'Push status', desc: 'Actieve push tokens' },
        ],
      },
      {
        id: 'data',
        icon: '🗄️',
        label: 'Data',
        desc: 'Databeheer & migraties',
        accentColor: C.textMuted,
        accentDim: 'rgba(100,116,139,0.16)',
      }
    );
  }
  return s;
}

function TileGrid({ items, onSelect, accentDim }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
      {items.map(item => (
        <button
          key={item.id}
          onClick={() => onSelect(item.id)}
          style={{
            background: C.card,
            border: `1px solid ${C.borderSoft}`,
            borderRadius: '20px',
            padding: '20px 16px',
            cursor: 'pointer',
            textAlign: 'left',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: '12px',
            minHeight: '130px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: '80px', height: '80px',
            background: `radial-gradient(circle at top right, ${item.accentDim || accentDim}, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <div style={{
            width: '46px', height: '46px',
            background: item.accentDim || accentDim,
            borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', flexShrink: 0,
          }}>
            {item.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: '800', color: C.textPrimary, lineHeight: 1.2, marginBottom: '4px' }}>
              {item.label}
            </div>
            <div style={{ fontSize: '12px', color: C.textSec, lineHeight: 1.4 }}>
              {item.desc}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function Beheer() {
  const { role, isAdmin } = useAuth();
  const [activeSection, setActiveSection] = useState(null);
  const [activeSub, setActiveSub] = useState(null);
  const [settings, setSettings] = useState({
    clubname: CLUB_NAAM,
    logoUrl: '',
    trainingGeenTrainingMarkers: DEFAULT_GEEN_TRAINING_MARKERS,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');
  const [seedStatus, setSeedStatus] = useState('');

  const sections = useMemo(() => buildSections(isAdmin), [isAdmin]);

  useEffect(() => {
    getClubSettings().then(data => {
      const volgendeSettings = data || {};
      setSettings({
        clubname: CLUB_NAAM,
        logoUrl: '',
        ...volgendeSettings,
        trainingGeenTrainingMarkers: normaliseerGeenTrainingMarkers([
          ...(Array.isArray(volgendeSettings?.trainingGeenTrainingMarkers)
            ? volgendeSettings.trainingGeenTrainingMarkers
            : []),
          volgendeSettings?.geenTrainingMarker,
          volgendeSettings?.geenTrainingTekst,
          volgendeSettings?.geenTrainingMarkers,
          volgendeSettings?.trainerReminder?.uitsluitZin,
        ].filter(Boolean)),
      });
    });
  }, []);

  const updateGeenTrainingMarker = (index, value) => {
    setSettings(s => {
      const markers = Array.isArray(s.trainingGeenTrainingMarkers)
        ? [...s.trainingGeenTrainingMarkers]
        : [...DEFAULT_GEEN_TRAINING_MARKERS];
      markers[index] = value;
      return { ...s, trainingGeenTrainingMarkers: markers };
    });
  };

  const voegGeenTrainingMarkerToe = () => {
    setSettings(s => ({
      ...s,
      trainingGeenTrainingMarkers: [
        ...(Array.isArray(s.trainingGeenTrainingMarkers) ? s.trainingGeenTrainingMarkers : DEFAULT_GEEN_TRAINING_MARKERS),
        '',
      ],
    }));
  };

  const verwijderGeenTrainingMarker = (index) => {
    setSettings(s => ({
      ...s,
      trainingGeenTrainingMarkers: (Array.isArray(s.trainingGeenTrainingMarkers) ? s.trainingGeenTrainingMarkers : DEFAULT_GEEN_TRAINING_MARKERS)
        .filter((_, i) => i !== index),
    }));
  };

  async function saveSettings() {
    setSaving(true);
    const opgeschoondeMarkers = normaliseerGeenTrainingMarkers([
      ...(Array.isArray(settings?.trainingGeenTrainingMarkers)
        ? settings.trainingGeenTrainingMarkers
        : []),
      settings?.geenTrainingMarker,
      settings?.geenTrainingTekst,
      settings?.geenTrainingMarkers,
      settings?.trainerReminder?.uitsluitZin,
    ].filter(Boolean));
    await setClubSettings({
      ...settings,
      trainingGeenTrainingMarkers: opgeschoondeMarkers,
    });
    setSettings(s => ({ ...s, trainingGeenTrainingMarkers: opgeschoondeMarkers }));
    setSaved('Instellingen opgeslagen!');
    setTimeout(() => setSaved(''), 3000);
    setSaving(false);
  }

  if (role !== 'admin' && role !== 'bestuurslid') {
    return (
      <div style={{ padding: '24px', color: 'var(--text-primary)' }}>
        <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔒</div>
        <div>Alleen beschikbaar voor admin of bestuurslid.</div>
      </div>
    );
  }

  const markers = Array.isArray(settings.trainingGeenTrainingMarkers)
    ? settings.trainingGeenTrainingMarkers
    : DEFAULT_GEEN_TRAINING_MARKERS;

  function goBack() {
    if (activeSub) {
      setActiveSub(null);
    } else {
      setActiveSection(null);
    }
  }

  function handleSectionSelect(id) {
    setActiveSub(null);
    setActiveSection(id);
  }

  function renderSectionContent() {
    const sec = sections.find(s => s.id === activeSection);

    if (activeSection === 'club') {
      if (activeSub === 'instellingen') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {saved && (
              <div style={{ background: 'rgba(39,174,96,0.15)', border: '1px solid var(--success)', borderRadius: 'var(--radius-md)', padding: '10px 14px', color: 'var(--success)' }}>
                ✓ {saved}
              </div>
            )}
            <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
              <h2 style={{ margin: '0 0 12px', fontSize: 'var(--font-size-lg)', color: 'var(--accent-red)' }}>Clubinstellingen</h2>
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '6px' }}>Clubnaam</label>
              <input
                value={settings.clubname || ''}
                onChange={e => setSettings(s => ({ ...s, clubname: e.target.value }))}
                placeholder="Clubnaam"
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', marginBottom: '12px', boxSizing: 'border-box' }}
              />
              <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginBottom: '6px' }}>Logo URL (optioneel)</label>
              <input
                value={settings.logoUrl || ''}
                onChange={e => setSettings(s => ({ ...s, logoUrl: e.target.value }))}
                placeholder="https://..."
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', marginBottom: '12px', boxSizing: 'border-box' }}
              />
              {settings.logoUrl && <img src={settings.logoUrl} alt="Logo" style={{ maxHeight: '80px', display: 'block', marginBottom: '12px' }} />}
            </section>

            <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
              <h2 style={{ margin: '0 0 6px', fontSize: 'var(--font-size-lg)', color: 'var(--accent-red)' }}>Training detectie en trainerherinneringen</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 0 }}>
                Deze teksten betekenen dat er geen gewone training is. Ze worden gebruikt bij Excel import en om trainerherinneringen niet te versturen voor bijvoorbeeld Sporthal gesloten, vakantie of tornooi. Herkenning is hoofdletterongevoelig.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                {markers.map((marker, index) => (
                  <div key={index} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      value={marker}
                      onChange={e => updateGeenTrainingMarker(index, e.target.value)}
                      placeholder="Bijv. sporthal gesloten"
                      style={{ flex: 1, padding: '10px 12px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
                    />
                    <button
                      onClick={() => verwijderGeenTrainingMarker(index)}
                      style={{ padding: '10px 12px', background: 'transparent', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', cursor: 'pointer' }}
                    >
                      Verwijder
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={voegGeenTrainingMarkerToe}
                style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '10px 14px', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: '600' }}
              >
                + Tekst toevoegen
              </button>
            </section>

            <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
              <button
                onClick={saveSettings}
                disabled={saving}
                style={{ background: 'var(--accent-red)', border: 'none', color: 'var(--text-primary)', padding: '12px 24px', borderRadius: 'var(--radius-md)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 'var(--font-size-md)', fontWeight: '700', opacity: saving ? 0.7 : 1 }}
              >
                {saving ? 'Opslaan...' : '✓ Opslaan'}
              </button>
            </section>
          </div>
        );
      }

      if (activeSub === 'appinfo') {
        return (
          <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <h2 style={{ margin: '0 0 12px', fontSize: 'var(--font-size-lg)', color: 'var(--accent-red)' }}>App informatie</h2>
            {[
              ['Versie', '1.0.0'],
              ['Technologie', 'React + Firebase'],
              ['Hosting', 'Firebase Hosting (gratis tier)'],
              ['Authenticatie', 'Firebase Authentication (email)'],
              ['Betaald?', 'Nee - volledig gratis'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-secondary)' }}>{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </section>
        );
      }

      return <TileGrid items={sec.subs} onSelect={setActiveSub} accentDim={sec.accentDim} />;
    }

    if (activeSection === 'clubdata') {
      const subComponents = {
        categorieen:            <CategorieenBeheer />,
        gordels:                <GordelsBeheer />,
        lesgevertypes:          <LesgevertypesBeheer />,
        communicatieCatrieen:   <CommunicatieCategorieenBeheer />,
        techniekCategorieen:    <TechniekCategorieenBeheer />,
        uitbetalingstarieven:   <UitbetalingstarievenBeheer />,
        club:                   <ClubInstellingenBeheer />,
        seizoen:                <SeizoenInstellingenBeheer />,
      };
      if (activeSub && subComponents[activeSub]) {
        return (
          <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            {subComponents[activeSub]}
          </section>
        );
      }
      return <TileGrid items={sec.subs} onSelect={setActiveSub} accentDim={sec.accentDim} />;
    }

    if (activeSection === 'gebruikers') {
      return (
        <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <GebruikersBeheer />
        </section>
      );
    }

    if (activeSection === 'groepen') {
      return (
        <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <GroepenBeheer />
        </section>
      );
    }

    if (activeSection === 'lesgevers') {
      return (
        <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <LesgeversBeheer />
        </section>
      );
    }

    if (activeSection === 'paginas' && isAdmin) {
      return (
        <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <PaginaRollenBeheer />
        </section>
      );
    }

    if (activeSection === 'meldingen' && isAdmin) {
      if (activeSub === 'nieuwlid') {
        return (
          <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <NieuwLidMeldingenBeheer />
          </section>
        );
      }
      if (activeSub === 'trainer') {
        return (
          <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <TrainerMeldingenBeheer />
          </section>
        );
      }
      if (activeSub === 'stock') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 'var(--font-size-lg)', color: 'var(--accent-red)' }}>📦 Stock alerts</h2>
              <StockMeldingenBeheer />
            </section>
            <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
              <h2 style={{ margin: '0 0 12px', fontSize: 'var(--font-size-lg)', color: 'var(--accent-red)' }}>📧 Overzicht mailen</h2>
              <StockOverzichtMail />
            </section>
          </div>
        );
      }
      if (activeSub === 'clubbericht') {
        return (
          <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <ClubBerichtBeheer />
          </section>
        );
      }
      if (activeSub === 'pushstatus') {
        return (
          <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <p style={{ color: 'var(--text-secondary)', marginTop: 0 }}>Overzicht van alle geregistreerde push tokens. Gebruik dit om te controleren of meldingen actief zijn op de juiste toestellen.</p>
            <PushStatusDashboard />
          </section>
        );
      }

      return <TileGrid items={sec.subs} onSelect={setActiveSub} accentDim={sec.accentDim} />;
    }

    if (activeSection === 'data' && isAdmin) {
      return (
        <section style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <h2>Data beheer</h2>
          <h3>Technieken</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Eenmalige actie: vult de Firestore-collectie technieken.</p>
          <button
            onClick={async () => {
              setSeedStatus('bezig');
              try { await seedTechnieken(); setSeedStatus('klaar'); }
              catch (e) { setSeedStatus(''); alert('Fout bij seeding: ' + e.message); }
            }}
            disabled={seedStatus === 'bezig'}
            style={{ background: seedStatus === 'klaar' ? 'var(--success)' : 'var(--accent-red)', border: 'none', color: 'var(--text-primary)', padding: '10px var(--space-4)', borderRadius: 'var(--radius-md)', cursor: seedStatus === 'bezig' ? 'not-allowed' : 'pointer', fontSize: 'var(--font-size-md)', fontWeight: '600', opacity: seedStatus === 'bezig' ? 0.7 : 1 }}
          >
            {seedStatus === 'bezig' ? '⏳ Bezig...' : seedStatus === 'klaar' ? '✓ Geseed' : '🌱 Seed technieken'}
          </button>
          <h3>Seizoen</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Eenmalige migratie: voegt het seizoenveld toe aan bestaande trainingen.</p>
          <button
            onClick={async () => {
              try { const n = await migreerSeizoen(); alert(`${n} trainingen gemigreerd`); }
              catch (e) { alert('Migratie mislukt: ' + e.message); }
            }}
            style={{ background: '#2980b9', border: 'none', color: 'var(--text-primary)', padding: '10px var(--space-4)', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontSize: 'var(--font-size-md)', fontWeight: '600' }}
          >
            🔄 Migreer seizoen (eenmalig)
          </button>
          <h3>Firebase configuratie</h3>
          <code>src/firebase.js</code>
        </section>
      );
    }

    return null;
  }

  // Sectie / sub-scherm
  if (activeSection) {
    const sec = sections.find(s => s.id === activeSection);
    const displayIcon = activeSub && sec?.subs
      ? sec.subs.find(s => s.id === activeSub)?.icon
      : sec?.icon;
    const displayLabel = activeSub && sec?.subs
      ? sec.subs.find(s => s.id === activeSub)?.label
      : sec?.label;

    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '16px' }}>
        <button
          onClick={goBack}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', color: C.textSec,
            cursor: 'pointer', fontSize: '14px', fontWeight: '600',
            padding: '0 0 14px 0',
          }}
        >
          ← {activeSub ? sec?.label : 'Beheer'}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{
            width: '44px', height: '44px',
            background: sec?.accentDim,
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '22px', flexShrink: 0,
          }}>
            {displayIcon}
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: C.textPrimary, lineHeight: 1.2 }}>
            {displayLabel}
          </h2>
        </div>

        {renderSectionContent()}
      </div>
    );
  }

  // Hoofd tegel-overzicht
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '16px' }}>
      <section style={{ ...cardStyle({ gradient: true }), marginBottom: '24px' }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 'clamp(22px,5vw,30px)', fontWeight: 900, color: C.textPrimary }}>
          🔧 Beheer
        </h1>
        <p style={{ margin: 0, color: C.textSec, fontSize: '13px' }}>
          Clubbeheer, gebruikers en instellingen
        </p>
      </section>

      <TileGrid items={sections} onSelect={handleSectionSelect} accentDim={C.redDim} />
    </div>
  );
}
