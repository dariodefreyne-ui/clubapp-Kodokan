import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { CLUB_STORAGE_PREFIX } from '../config/appConfig';
import { THEMAS, laadThema, pasThemaToe } from '../utils/themaUtils.js';
import {
  browserOndersteuntPush,
  registreerPushToken,
  deactiveerPushToken,
  heeftActievePushToken,
  laadVoorkeuren,
  laadTokenOverride,
  zetTokenOverride,
  bereckenEffectief,
  zetPushHandmatigUitgeschakeld,
  RUBRIEKEN,
  rubriekenVoorRol,
} from '../notifications/firebaseMessaging';

const STORAGE_KEY = `${CLUB_STORAGE_PREFIX}_device_settings`;

const S = {
  page:        {},
  title:       { fontSize: '22px', fontWeight: '700', marginBottom: '16px' },
  card:        { background: 'var(--bg-card)', borderRadius: '12px', padding: '16px', marginBottom: '16px' },
  cardTitle:   { fontSize: '16px', fontWeight: '700', marginBottom: '12px', color: 'var(--accent-red)' },
  row:         { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border-color)', gap: '12px' },
  rowLast:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', gap: '12px' },
  label:       { fontSize: '15px', fontWeight: '500' },
  sublabel:    { color: 'var(--text-secondary)', fontSize: '13px', marginTop: '2px' },
  toggle:      (on) => ({ width: '52px', height: '28px', borderRadius: '14px', background: on ? 'var(--accent-red)' : 'var(--text-muted)', position: 'relative', cursor: 'pointer', border: 'none', flexShrink: 0 }),
  toggleDot:   (on) => ({ position: 'absolute', top: '3px', left: on ? '25px' : '3px', width: '22px', height: '22px', borderRadius: '50%', background: 'var(--text-primary)', transition: 'left 0.15s' }),
  statusBadge: (ok) => ({ background: ok ? 'rgba(34,197,94,0.18)' : 'rgba(230,51,70,0.16)', color: ok ? 'var(--success)' : 'var(--danger)', padding: '4px 10px', borderRadius: '10px', fontSize: '12px', display: 'inline-block', marginTop: '4px' }),
  fout:        { color: 'var(--danger)', fontSize: '13px', marginTop: '8px' },
  dimmed:      { opacity: 0.4, pointerEvents: 'none' },
  infoText:    { color: 'var(--text-secondary)', fontSize: '13px', marginTop: '8px', lineHeight: '1.5' },
  bronChip:    (bron) => ({
    fontSize: '11px',
    padding: '2px 7px',
    borderRadius: '8px',
    background: bron === 'apparaat' ? 'rgba(41,128,185,0.18)' : 'transparent',
    color: bron === 'apparaat' ? '#3498db' : 'var(--text-secondary)',
    border: bron === 'apparaat' ? '1px solid rgba(41,128,185,0.4)' : '1px solid transparent',
    marginLeft: '8px',
    fontWeight: '600',
  }),
  selectBtn: (actief) => ({
    background: actief ? 'var(--accent-red)' : 'transparent',
    color: actief ? 'var(--text-primary)' : 'var(--text-secondary)',
    border: `1px solid ${actief ? 'var(--accent-red)' : 'var(--border-color)'}`,
    padding: '6px 10px',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  }),
};

export default function DeviceInstellingen() {
  const { profiel } = useAuth();
  const rol = profiel?.rol || 'lid';

  // ─── Device settings (localStorage) ───────────────────────────────────────
  const [wakeLockActive,  setWakeLockActive]  = useState(false);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const wakeLockRef = useRef(null);

  const [huidigThema, setHuidigThema] = useState(() => laadThema());

  function kiesThema(themaId) {
    pasThemaToe(themaId);
    setHuidigThema(themaId);
  }

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
  const [pushOndersteund, setPushOndersteund] = useState(null);
  const [pushActief,      setPushActief]      = useState(false);
  const [pushLaden,       setPushLaden]       = useState(false);
  const [pushFout,        setPushFout]        = useState(null);

  const [voorkeuren, setVoorkeuren] = useState({});      // user-niveau
  const [override,   setOverride]   = useState({});      // token-niveau
  const [overrideBezig, setOverrideBezig] = useState(false);

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

      const v = await laadVoorkeuren(profiel.uid, rol);
      if (!gemonteerd) return;
      setVoorkeuren(v);

      if (actief) {
        const ov = await laadTokenOverride();
        if (!gemonteerd) return;
        setOverride(ov);
      }
    }

    init();
    return () => { gemonteerd = false; };
  }, [profiel?.uid, rol]);

  async function togglePush() {
    if (!profiel) return;
    setPushLaden(true);
    setPushFout(null);

    try {
      if (pushActief) {
        await deactiveerPushToken(profiel.uid);
        zetPushHandmatigUitgeschakeld(true);
        setPushActief(false);
        setOverride({});
      } else {
        await registreerPushToken(profiel);
        zetPushHandmatigUitgeschakeld(false);
        setPushActief(true);
        const v = await laadVoorkeuren(profiel.uid, rol);
        setVoorkeuren(v);
        const ov = await laadTokenOverride();
        setOverride(ov);
      }
    } catch (e) {
      setPushFout(e.message);
    }

    setPushLaden(false);
  }

  // Tri-state override per rubriek: 'volgt' | 'aan' | 'uit'
  const setOverrideModus = useCallback(async (rubriek, modus) => {
    setOverrideBezig(true);
    setPushFout(null);
    const nieuw = { ...override };
    let waardeNaarServer;

    if (modus === 'volgt') {
      delete nieuw[rubriek];
      waardeNaarServer = null;
    } else if (modus === 'aan') {
      nieuw[rubriek] = true;
      waardeNaarServer = true;
    } else {
      nieuw[rubriek] = false;
      waardeNaarServer = false;
    }

    setOverride(nieuw);

    try {
      await zetTokenOverride(rubriek, waardeNaarServer, profiel?.uid);
    } catch (e) {
      setOverride(override);
      setPushFout(`Opslaan mislukt: ${e.message}`);
    }
    setOverrideBezig(false);
  }, [override, profiel?.uid]);

  const zichtbareRubrieken = rubriekenVoorRol(rol);
  const effectief = bereckenEffectief(voorkeuren, override);

  return (
    <div style={S.page}>
      <div style={S.title}>Instellingen</div>

      {/* ── Push Notificaties ── */}
      <div style={S.card}>
        <div style={S.cardTitle}>Meldingen op dit toestel</div>

        {pushOndersteund === null && <div style={S.infoText}>Bezig met laden...</div>}

        {pushOndersteund === false && (
          <div style={S.infoText}>
            Push-meldingen worden niet ondersteund door deze browser of dit toestel.
            Probeer Chrome of Edge op Android of desktop.
          </div>
        )}

        {pushOndersteund === true && (
          <>
            <div style={S.row}>
              <div>
                <div style={S.label}>Push-meldingen</div>
                <div style={S.sublabel}>
                  {pushActief ? 'Actief op dit toestel' : 'Niet actief op dit toestel'}
                </div>
                <span style={S.statusBadge(pushActief)}>{pushActief ? 'Aan' : 'Uit'}</span>
              </div>
              <button
                style={S.toggle(pushActief)}
                onClick={togglePush}
                disabled={pushLaden}
              >
                <div style={S.toggleDot(pushActief)} />
              </button>
            </div>

            {pushFout && <div style={S.fout}>{pushFout}</div>}

            {pushActief && (
              <>
                <div style={{ ...S.infoText, marginTop: '14px' }}>
                  Per rubriek kun je hieronder afwijken van je account-instellingen.
                  "Volg account" gebruikt wat je in je profiel hebt staan; "Alleen
                  hier aan/uit" overschrijft voor enkel dit toestel.
                </div>

                <div style={overrideBezig ? S.dimmed : {}}>
                  {zichtbareRubrieken.map((sleutel, index) => {
                    const isLaatste = index === zichtbareRubrieken.length - 1;
                    const rubriek = RUBRIEKEN[sleutel];
                    const eff = effectief[sleutel] || { actief: false, bron: 'account' };
                    const modus = override[sleutel] === undefined
                      ? 'volgt'
                      : override[sleutel] ? 'aan' : 'uit';

                    return (
                      <div key={sleutel} style={isLaatste ? S.rowLast : S.row}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ ...S.label, fontSize: '14px', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                            {rubriek.label}
                            {eff.bron === 'apparaat' && (
                              <span style={S.bronChip('apparaat')}>apparaat-instelling</span>
                            )}
                          </div>
                          <div style={S.sublabel}>{rubriek.sublabel}</div>
                          <div style={{ ...S.sublabel, marginTop: '4px' }}>
                            Effectief: <strong>{eff.actief ? 'aan' : 'uit'}</strong>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          <button style={S.selectBtn(modus === 'volgt')} onClick={() => setOverrideModus(sleutel, 'volgt')} disabled={overrideBezig}>
                            Volg account
                          </button>
                          <button style={S.selectBtn(modus === 'aan')} onClick={() => setOverrideModus(sleutel, 'aan')} disabled={overrideBezig}>
                            Aan
                          </button>
                          <button style={S.selectBtn(modus === 'uit')} onClick={() => setOverrideModus(sleutel, 'uit')} disabled={overrideBezig}>
                            Uit
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Thema ── */}
      <div style={S.card}>
        <div style={S.cardTitle}>Thema</div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {THEMAS.map(t => {
            const actief = huidigThema === t.id;
            const isLight = t.id === 'light';
            return (
              <button
                key={t.id}
                onClick={() => kiesThema(t.id)}
                style={{
                  flex: '1 1 110px',
                  background: t.bg,
                  border: `2px solid ${actief ? t.accent : 'transparent'}`,
                  borderRadius: '12px',
                  padding: '12px 10px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  outline: 'none',
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                  {[t.bg, t.card, t.accent].map((c, i) => (
                    <div key={i} style={{
                      width: '18px', height: '18px', borderRadius: '4px', background: c,
                      border: `1px solid ${isLight ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.15)'}`,
                      flexShrink: 0,
                    }} />
                  ))}
                </div>
                <div style={{ color: isLight ? '#0F172A' : '#F8FAFC', fontSize: '13px', fontWeight: '700', lineHeight: 1.2 }}>
                  {t.label}
                </div>
                <div style={{ color: isLight ? '#64748B' : '#94A3B8', fontSize: '11px', marginTop: '3px' }}>
                  {t.sub}
                </div>
                {actief && (
                  <div style={{ color: t.accent, fontSize: '11px', fontWeight: '700', marginTop: '5px' }}>✓ Actief</div>
                )}
              </button>
            );
          })}
        </div>
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
