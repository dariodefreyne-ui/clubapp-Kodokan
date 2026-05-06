import React, { useState, useEffect, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { messaging } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext.jsx';

const VAPID_KEY = 'BHfJZX-L_pwL9Z0-Ce9G4IQD9adYPPTlUwYQ_1RgNIu2SuroElB6-ls9VYg0PYu9Fdmh1meagyUPF40fpNG3ZDg';

const S = {
  page: { minHeight:'100vh', background:'#1a1a1a', color:'#fff', padding:'16px' },
  title: { fontSize:'22px', fontWeight:'700', marginBottom:'16px' },
  card: { background:'#2d2d2d', borderRadius:'12px', padding:'16px', marginBottom:'16px' },
  cardTitle: { fontSize:'16px', fontWeight:'700', marginBottom:'12px', color:'#c0392b' },
  row: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid #3a3a3a' },
  label: { fontSize:'15px', fontWeight:'500' },
  sublabel: { color:'#aaa', fontSize:'13px', marginTop:'2px' },
  toggle: (on) => ({ width:'52px', height:'28px', borderRadius:'14px', background: on?'#c0392b':'#555', position:'relative', cursor:'pointer', transition:'background 0.2s', border:'none', flexShrink:0 }),
  toggleDot: (on) => ({ position:'absolute', top:'3px', left: on?'25px':'3px', width:'22px', height:'22px', borderRadius:'50%', background:'#fff', transition:'left 0.2s' }),
  densityBtns: { display:'flex', gap:'8px' },
  densityBtn: (active) => ({ background:active?'#c0392b':'#1a1a1a', border:`1px solid ${active?'#c0392b':'#3a3a3a'}`, color:'#fff', padding:'8px 16px', borderRadius:'8px', cursor:'pointer', fontSize:'14px', fontWeight:active?'700':'400' }),
  statusBadge: (ok) => ({ background:ok?'rgba(39,174,96,0.2)':'rgba(231,76,60,0.2)', color:ok?'#27ae60':'#e74c3c', padding:'4px 10px', borderRadius:'10px', fontSize:'12px', fontWeight:'600' }),
  infoRow: { display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #2a2a2a', fontSize:'13px' },
};

const STORAGE_KEY = 'kodokan_device_settings';
const defaults = { fullscreen: false, keepAwake: false, density: 'comfort', fontSize: 'normaal' };

export default function DeviceInstellingen() {
  const { firebaseUser, profiel } = useAuth();
  const [settings, setSettings] = useState(() => {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
    catch { return defaults; }
  });
  const [wakeLockSupported, setWakeLockSupported] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [saved, setSaved] = useState(false);
  const wakeLockRef = useRef(null);
  const [notifStatus, setNotifStatus] = useState('onbekend');
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifFout, setNotifFout] = useState(null);

  useEffect(() => {
    setWakeLockSupported('wakeLock' in navigator);
    setFullscreenSupported(!!document.documentElement.requestFullscreen);
    const handleFullscreenChange = () => setFullscreenActive(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    // Apply density
    document.documentElement.setAttribute('data-density', settings.density);
    // Apply font size
    const sizes = { klein:'14px', normaal:'16px', groot:'18px' };
    document.documentElement.style.fontSize = sizes[settings.fontSize] || '16px';
  }, [settings.density, settings.fontSize]);

  useEffect(() => {
    if (!firebaseUser) return;
    if (!('Notification' in window)) {
      setNotifStatus('geblokkeerd');
      return;
    }
    if (Notification.permission === 'denied') {
      setNotifStatus('geblokkeerd');
      return;
    }

    async function checkToken() {
      try {
        const swReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (!swReg) { setNotifStatus('uit'); return; }
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });
        if (!token) { setNotifStatus('uit'); return; }
        const snap = await getDoc(doc(db, 'notificationTokens', token));
        if (snap.exists() && snap.data().active) {
          setNotifStatus('aan');
        } else {
          setNotifStatus('uit');
        }
      } catch {
        setNotifStatus('uit');
      }
    }

    checkToken();
  }, [firebaseUser]);

  function save(newSettings) {
    setSettings(newSettings);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function update(key, value) {
    save({ ...settings, [key]: value });
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (e) { console.error(e); }
  }

  async function toggleWakeLock() {
    if (wakeLockActive && wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setWakeLockActive(false);
      update('keepAwake', false);
    } else {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        setWakeLockActive(true);
        update('keepAwake', true);
        wakeLockRef.current.addEventListener('release', () => {
          setWakeLockActive(false);
          wakeLockRef.current = null;
        });
      } catch (e) { console.error('WakeLock error:', e); }
    }
  }

  function resetSettings() {
    save(defaults);
    // Reset font size
    document.documentElement.style.fontSize = '16px';
    document.documentElement.removeAttribute('data-density');
  }

  async function toggleNotificaties() {
    if (!firebaseUser) return;
    setNotifLoading(true);
    setNotifFout(null);
    // iOS vereist dat de app als PWA geinstalleerd is voor push meldingen werken.
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (!isStandalone) {
      setNotifFout('Voeg de app toe aan je beginscherm en open hem daarna opnieuw om meldingen te activeren.');
      setNotifLoading(false);
      return;
    }
    try {
      if (notifStatus === 'aan') {
        // Haal SW registratie op om FCM correct te koppelen
        const swReg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });
        if (token) {
          await setDoc(doc(db, 'notificationTokens', token), {
            active: false,
            stockAlerts: false,
            uid: firebaseUser.uid,
            updatedAt: serverTimestamp(),
          }, { merge: true });
        }
        setNotifStatus('uit');
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setNotifStatus('geblokkeerd');
          setNotifFout('Toestemming geweigerd. Sta notificaties toe in je browserinstellingen.');
          setNotifLoading(false);
          return;
        }
        const swReg = await navigator.serviceWorker.ready;
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });
        if (!token) throw new Error('Geen token ontvangen');
        const tokenRef = doc(db, 'notificationTokens', token);
        const tokenSnap = await getDoc(tokenRef);
        const tokenData = tokenSnap.exists() ? tokenSnap.data() : null;
        if (tokenData?.active === true && tokenData?.stockAlerts === true) {
          setNotifStatus('aan');
          setNotifLoading(false);
          return;
        }
        await setDoc(tokenRef, {
          uid: firebaseUser.uid || null,
          naam: profiel?.naam || firebaseUser.email || null,
          email: profiel?.email || firebaseUser.email || null,
          rol: profiel?.rol || null,
          token,
          stockAlerts: true,
          active: true,
          platform: 'web',
          userAgent: navigator.userAgent,
          device: navigator.userAgent.substring(0, 100),
          updatedAt: serverTimestamp(),
          ...(!tokenSnap.exists() ? { createdAt: serverTimestamp() } : {}),
        }, { merge: true });
        setNotifStatus('aan');
      }
    } catch (e) {
      console.error('FCM fout:', e);
      setNotifFout('Fout bij instellen notificaties: ' + (e.message || e));
    }
    setNotifLoading(false);
  }

  return (
    <div style={S.page}>
      <div style={S.title}>⚙️ Device Instellingen</div>
      {saved && (
        <div style={{ background:'#27ae60', borderRadius:'8px', padding:'10px 14px', fontSize:'14px', fontWeight:'600', marginBottom:'12px' }}>
          ✓ Instellingen opgeslagen
        </div>
      )}

      {/* Display */}
      <div style={S.card}>
        <div style={S.cardTitle}>Weergave</div>
        <div style={S.row}>
          <div>
            <div style={S.label}>Volledig scherm</div>
            <div style={S.sublabel}>Verberg browser UI (kiosk-modus)</div>
          </div>
          <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
            {fullscreenActive && <span style={S.statusBadge(true)}>Actief</span>}
            {!fullscreenSupported ? (
              <span style={S.statusBadge(false)}>Niet ondersteund</span>
            ) : (
              <button style={S.toggle(fullscreenActive)} onClick={toggleFullscreen}>
                <div style={S.toggleDot(fullscreenActive)} />
              </button>
            )}
          </div>
        </div>
        <div style={S.row}>
          <div>
            <div style={S.label}>Scherm aan houden</div>
            <div style={S.sublabel}>Voorkomt slaapstand (WakeLock API)</div>
          </div>
          <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
            {wakeLockActive && <span style={S.statusBadge(true)}>Actief</span>}
            {!wakeLockSupported ? (
              <span style={S.statusBadge(false)}>Niet ondersteund</span>
            ) : (
              <button style={S.toggle(wakeLockActive)} onClick={toggleWakeLock}>
                <div style={S.toggleDot(wakeLockActive)} />
              </button>
            )}
          </div>
        </div>
      </div>

      {profiel?.rol === 'beheerder' && (
  <>
    {/* Notificaties */}
          <div style={S.cardTitle}>🔔 Push Notificaties</div>
          <p style={{ color: '#aaa', fontSize: '13px', margin: '0 0 12px' }}>
            Ontvang een melding wanneer een product op stock 0 valt.
          </p>
          {!window.matchMedia('(display-mode: standalone)').matches && window.navigator.standalone !== true && (
            <div style={{ background: 'rgba(255,165,0,0.15)', border: '1px solid orange', borderRadius: '8px', padding: '12px', fontSize: '13px', color: 'orange', marginBottom: '12px' }}>
              Push meldingen werken enkel wanneer de app geinstalleerd is op je beginscherm. Voeg de app toe via je browser en open hem opnieuw.
            </div>
          )}
          {notifStatus === 'geblokkeerd' ? (
            <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid #e74c3c', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#e74c3c' }}>
              Notificaties zijn geblokkeerd in je browser. Sta ze toe via de browserinstellingen en herlaad de pagina.
            </div>
          ) : (
            <div style={S.row}>
              <div>
                <div style={S.label}>Stockmeldingen</div>
                <div style={S.sublabel}>
                  {notifStatus === 'aan' ? 'Actief op dit apparaat' : 'Niet actief op dit apparaat'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                {notifStatus === 'aan' && <span style={S.statusBadge(true)}>Aan</span>}
                <button
                  style={S.toggle(notifStatus === 'aan')}
                  onClick={toggleNotificaties}
                  disabled={notifLoading}
                >
                  <div style={S.toggleDot(notifStatus === 'aan')} />
                </button>
              </div>
            </div>
          )}
          {notifFout && (
            <div style={{ marginTop: '8px', color: '#e74c3c', fontSize: '13px' }}>
              {notifFout}
            </div>
          )}
          {notifLoading && (
            <div style={{ marginTop: '8px', color: '#aaa', fontSize: '13px' }}>
              Bezig...
            </div>
          )}
        </div>
      )}

      {/* Layout density */}
      <div style={S.card}>
        <div style={S.cardTitle}>Lay-out dichtheid</div>
        <p style={{ color:'#aaa', fontSize:'13px', margin:'0 0 12px' }}>Bepaalt de ruimte tussen elementen</p>
        <div style={S.densityBtns}>
          {['compact','comfort','ruim'].map(d => (
            <button key={d} style={S.densityBtn(settings.density===d)} onClick={() => update('density', d)}>
              {d === 'compact' ? '⊟ Compact' : d === 'comfort' ? '⊞ Comfort' : '⊟ Ruim'}
            </button>
          ))}
        </div>
      </div>

      {/* Font size */}
      <div style={S.card}>
        <div style={S.cardTitle}>Lettergrootte</div>
        <div style={S.densityBtns}>
          {['klein','normaal','groot'].map(s => (
            <button key={s} style={S.densityBtn(settings.fontSize===s)} onClick={() => update('fontSize', s)}>
              {s === 'klein' ? 'A klein' : s === 'normaal' ? 'A normaal' : 'A groot'}
            </button>
          ))}
        </div>
      </div>

      {/* Device info */}
      <div style={S.card}>
        <div style={S.cardTitle}>Apparaatinformatie</div>
        {[
          ['Schermresolutie', `${window.screen.width} × ${window.screen.height}`],
          ['Viewport', `${window.innerWidth} × ${window.innerHeight}`],
          ['Pixelverhouding', window.devicePixelRatio],
          ['Touchscreen', 'ontouchstart' in window ? 'Ja' : 'Nee'],
          ['Online', navigator.onLine ? 'Ja' : 'Nee'],
          ['Platform', navigator.platform || '-'],
          ['PWA geïnstalleerd', window.matchMedia('(display-mode: standalone)').matches ? 'Ja' : 'Nee'],
          ['WakeLock API', 'wakeLock' in navigator ? 'Ondersteund' : 'Niet ondersteund'],
        ].map(([k,v]) => (
          <div key={k} style={S.infoRow}>
            <span style={{ color:'#aaa' }}>{k}</span>
            <span style={{ fontWeight:'500' }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Reset */}
      <div style={S.card}>
        <div style={S.cardTitle}>Reset</div>
        <p style={{ color:'#aaa', fontSize:'14px', margin:'0 0 12px' }}>Herstel alle instellingen naar standaard</p>
        <button style={{ background:'#3a3a3a', border:'1px solid #e74c3c', color:'#e74c3c', padding:'12px 20px', borderRadius:'8px', cursor:'pointer', fontSize:'15px', fontWeight:'600' }}
          onClick={resetSettings}>
          ↩ Instellingen resetten
        </button>
      </div>
    </div>
  );
}
