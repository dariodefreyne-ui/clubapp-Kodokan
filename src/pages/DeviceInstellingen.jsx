import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { CLUB_STORAGE_PREFIX } from '../config/appConfig';
import {
  browserOndersteuntPush,
  registreerPushToken,
  deactiveerPushToken,
  heeftActievePushToken,
  laadPushAlerts,
  updatePushAlerts,
  ALERTS_VOOR_ROL,
  ALERT_LABELS,
  ALERT_SUBLABELS,
} from '../notifications/firebaseMessaging';

const STORAGE_KEY = `${CLUB_STORAGE_PREFIX}_device_settings`;

const S = {
  page:       { minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', padding: '16px' },
  title:      { fontSize: '22px', fontWeight: '700', marginBottom: '16px' },
  card:       { background: 'var(--bg-card)', borderRadius: '12px', padding: '16px', marginBottom: '16px' },
  cardTitle:  { fontSize: '16px', fontWeight: '700', marginBottom: '12px', color: 'var(--accent-red)' },
  row:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)' },
  rowLast:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' },
  label:      { fontSize: '15px', fontWeight: '500' },
  sublabel:   { color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' },
  toggle:     (on) => ({ width: '52px', height: '28px', borderRadius: '14px', background: on ? 'var(--accent-red)' : 'var(--text-muted)', position: 'relative', cursor: 'pointer', border: 'none', flexShrink: 0 }),
  toggleDot:  (on) => ({ position: 'absolute', top: '3px', left: on ? '25px' : '3px', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--text-primary)', transition: 'left 0.15s' }),
  statusBadge:(ok) => ({ background: ok ? 'rgba(34,197,94,0.18)' : 'rgba(230,51,70,0.16)', color: ok ? 'var(--success)' : 'var(--danger)', padding: '4px 10px', borderRadius: '10px', fontSize: '12px', display: 'inline-block', marginTop: '4px' }),
  fout:       { color: 'var(--danger)', fontSize: '13px', marginTop: '8px' },
  dimmed:     { opacity: 0.4, pointerEvents: 'none' },
  infoText:   { color: 'var(--text-secondary)', fontSize: '13px', marginTop: '8px', lineHeight: '1.5' },
};

export default function DeviceInstellingen() {
  const { profiel } = useAuth();
  const rol = profiel?.rol || 'lid';

  // ─── Device settings (localStorage) ───────────────────────────────────────
  const [wakeLockActive,  setWakeLockActive]  = useState(false);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const wakeLockRef = useRef(null);

  useEffect(() => {
    const handler = () => setFullscreenActive(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  }

  async function toggleWakeLock() {
    if (wakeLockActive && wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setWakeLockActive(false);
    } else {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        setWakeLockActive(true);
      } catch {
        // Wake lock niet ondersteund of geweigerd
      }
    }
  }

  // ─── Push notificaties ────────────────────────────────────────────────────
  const [pushOndersteund, setPushOndersteund] = useState(null); // null = nog aan het laden
  const [pushActief,      setPushActief]      = useState(false);
  const [pushLaden,       setPushLaden]       = useState(false);
  const [pushFout,        setPushFout]        = useState(null);
  const [alerts,          setAlerts]          = useState(null);  // null = nog niet geladen
  const [alertsLaden,     setAlertsLaden]     = useState(false);

  // Controleer browser-ondersteuning en laad huidige status
  useEffect(() => {
    let gemonteerd = true;

    async function init() {
      const ondersteund = await browserOndersteuntPush();
      if (!gemonteerd) return;
      setPushOndersteund(ondersteund);

      if (!ondersteund || !profiel?.uid) return;

      const actief = await heeftActievePushToken(profiel.uid);
      if (!gemonteerd) return;
      setPushActief(actief);

      if (actief) {
        const geladen = await laadPushAlerts(profiel.uid, rol);
        if (!gemonteerd) return;
        setAlerts(geladen);
      }
    }

    init();
    return () => { gemonteerd = false; };
  }, [profiel?.uid, rol]);

  // Hoofd-toggle: push aan/uit
  async function togglePush() {
    if (!profiel) return;
    setPushLaden(true);
    setPushFout(null);

    try {
      if (pushActief) {
        await deactiveerPushToken(profiel);
        setPushActief(false);
        setAlerts(null);
      } else {
        await registreerPushToken(profiel, null);
        setPushActief(true);
        // Laad alerts die net opgeslagen zijn
        const geladen = await laadPushAlerts(profiel.uid, rol);
        setAlerts(geladen);
      }
    } catch (e) {
      setPushFout(e.message);
    }

    setPushLaden(false);
  }

  // Individuele alert-toggle
  const toggleAlert = useCallback(async (sleutel) => {
    if (!profiel?.uid || !alerts) return;
    setAlertsLaden(true);

    const nieuweAlerts = { ...alerts, [sleutel]: !alerts[sleutel] };
    setAlerts(nieuweAlerts); // optimistisch updaten

    try {
      await updatePushAlerts(profiel.uid, nieuweAlerts);
    } catch {
      // Zet terug bij fout
      setAlerts(alerts);
    }

    setAlertsLaden(false);
  }, [profiel?.uid, alerts]);

  // Welke alert-sleutels tonen voor deze rol
  const alertSleutels = ALERTS_VOOR_ROL[rol] || ALERTS_VOOR_ROL.lid;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <div style={S.title}>Instellingen</div>

      {/* ── Push Notificaties ── */}
      <div style={S.card}>
        <div style={S.cardTitle}>Meldingen</div>

        {pushOndersteund === null && (
          <div style={S.infoText}>Bezig met laden...</div>
        )}

        {pushOndersteund === false && (
          <div style={S.infoText}>
            Push-meldingen worden niet ondersteund door deze browser of dit toestel.
            Probeer Chrome of Edge op Android of desktop.
          </div>
        )}

        {pushOndersteund === true && (
          <>
            {/* Hoofd-toggle */}
            <div style={S.row}>
              <div>
                <div style={S.label}>Push-meldingen</div>
                <div style={S.sublabel}>
                  {pushActief ? 'Actief op dit toestel' : 'Niet actief op dit toestel'}
                </div>
                {pushActief && (
                  <span style={S.statusBadge(true)}>Aan</span>
                )}
                {!pushActief && (
                  <span style={S.statusBadge(false)}>Uit</span>
                )}
              </div>
              <button
                style={S.toggle(pushActief)}
                onClick={togglePush}
                disabled={pushLaden}
              >
                <div style={S.toggleDot(pushActief)} />
              </button>
            </div>

            {pushFout && (
              <div style={S.fout}>{pushFout}</div>
            )}

            {/* Per-type toggles — enkel zichtbaar als push actief is */}
            {pushActief && alerts && (
              <div style={alertsLaden ? S.dimmed : {}}>
                {alertSleutels.map((sleutel, index) => {
                  const isLaatste = index === alertSleutels.length - 1;
                  return (
                    <div key={sleutel} style={isLaatste ? S.rowLast : S.row}>
                      <div>
                        <div style={{ ...S.label, fontSize: '14px' }}>
                          {ALERT_LABELS[sleutel]}
                        </div>
                        <div style={S.sublabel}>
                          {ALERT_SUBLABELS[sleutel]}
                        </div>
                      </div>
                      <button
                        style={S.toggle(!!alerts[sleutel])}
                        onClick={() => toggleAlert(sleutel)}
                        disabled={alertsLaden}
                      >
                        <div style={S.toggleDot(!!alerts[sleutel])} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {pushActief && !alerts && (
              <div style={S.infoText}>Meldingsvoorkeuren laden...</div>
            )}
          </>
        )}
      </div>

      {/* ── Scherm ── */}
      <div style={S.card}>
        <div style={S.cardTitle}>Scherm</div>

        <div style={S.row}>
          <div>
            <div style={S.label}>Volledig scherm</div>
            <div style={S.sublabel}>
              {fullscreenActive ? 'Actief' : 'Niet actief'}
            </div>
          </div>
          <button style={S.toggle(fullscreenActive)} onClick={toggleFullscreen}>
            <div style={S.toggleDot(fullscreenActive)} />
          </button>
        </div>

        <div style={S.rowLast}>
          <div>
            <div style={S.label}>Scherm aan houden</div>
            <div style={S.sublabel}>
              {wakeLockActive ? 'Scherm blijft aan' : 'Normaal gedrag'}
            </div>
          </div>
          <button style={S.toggle(wakeLockActive)} onClick={toggleWakeLock}>
            <div style={S.toggleDot(wakeLockActive)} />
          </button>
        </div>
      </div>
    </div>
  );
}
