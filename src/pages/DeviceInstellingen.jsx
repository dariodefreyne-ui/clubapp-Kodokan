import React, { useState, useEffect, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { messaging } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext.jsx';
import { CLUB_STORAGE_PREFIX } from '../config/appConfig';

const VAPID_KEY = 'BHfJZX-L_pwL9Z0-Ce9G4IQD9adYPPTlUwYQ_1RgNIu2SuroElB6-ls9VYg0PYu9Fdmh1meagyUPF40fpNG3ZDg';

const S = {
  page: { minHeight:'100vh', background:'#1a1a1a', color:'#fff', padding:'16px' },
  title: { fontSize:'22px', fontWeight:'700', marginBottom:'16px' },
  card: { background:'#2d2d2d', borderRadius:'12px', padding:'16px', marginBottom:'16px' },
  cardTitle: { fontSize:'16px', fontWeight:'700', marginBottom:'12px', color:'#c0392b' },
  row: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 0', borderBottom:'1px solid #3a3a3a' },
  label: { fontSize:'15px', fontWeight:'500' },
  sublabel: { color:'#aaa', fontSize:'13px', marginTop:'2px' },
  toggle: (on) => ({ width:'52px', height:'28px', borderRadius:'14px', background: on?'#c0392b':'#555', position:'relative', cursor:'pointer', border:'none' }),
  toggleDot: (on) => ({ position:'absolute', top:'3px', left: on?'25px':'3px', width:'22px', height:'22px', borderRadius:'50%', background:'#fff' }),
  densityBtns: { display:'flex', gap:'8px' },
  densityBtn: (active) => ({ background:active?'#c0392b':'#1a1a1a', border:`1px solid ${active?'#c0392b':'#3a3a3a'}`, color:'#fff', padding:'8px 16px', borderRadius:'8px', cursor:'pointer' }),
  statusBadge: (ok) => ({ background:ok?'rgba(39,174,96,0.2)':'rgba(231,76,60,0.2)', color:ok?'#27ae60':'#e74c3c', padding:'4px 10px', borderRadius:'10px', fontSize:'12px' }),
  infoRow: { display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid #2a2a2a', fontSize:'13px' },
};

const STORAGE_KEY = `${CLUB_STORAGE_PREFIX}_device_settings`;
const defaults = { fullscreen: false, keepAwake: false, density: 'comfort', fontSize: 'normaal' };

export default function DeviceInstellingen() {
  const { firebaseUser, profiel } = useAuth();
  const [settings, setSettings] = useState(() => {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
    catch { return defaults; }
  });

  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [fullscreenActive, setFullscreenActive] = useState(false);
  const [saved, setSaved] = useState(false);
  const wakeLockRef = useRef(null);

  const [notifStatus, setNotifStatus] = useState('onbekend');
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifFout, setNotifFout] = useState(null);

  useEffect(() => {
    const handleFullscreenChange = () => setFullscreenActive(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

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
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setWakeLockActive(true);
    }
  }

  async function toggleNotificaties() {
    if (!firebaseUser) return;

    setNotifLoading(true);
    setNotifFout(null);

    try {
      if (notifStatus === 'aan') {
        setNotifStatus('uit');
      } else {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setNotifStatus('geblokkeerd');
          return;
        }
        const swReg = await navigator.serviceWorker.ready;
        const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
        await setDoc(doc(db, 'notificationTokens', token), { active: true }, { merge: true });
        setNotifStatus('aan');
      }
    } catch (e) {
      setNotifFout(e.message);
    }

    setNotifLoading(false);
  }

  return (
    <div style={S.page}>
      <div style={S.title}>⚙️ Device Instellingen</div>

      {/* Notificaties */}
      {profiel?.rol === 'beheerder' && (
        <div style={S.card}>
          <div style={S.cardTitle}>🔔 Push Notificaties</div>

          <div style={S.row}>
            <div>
              <div style={S.label}>Stockmeldingen</div>
              <div style={S.sublabel}>
                {notifStatus === 'aan' ? 'Actief' : 'Niet actief'}
              </div>
            </div>

            <button
              style={S.toggle(notifStatus === 'aan')}
              onClick={toggleNotificaties}
            >
              <div style={S.toggleDot(notifStatus === 'aan')} />
            </button>
          </div>

          {notifFout && <div style={{ color: 'red' }}>{notifFout}</div>}
          {notifLoading && <div>Bezig...</div>}
        </div>
      )}
    </div>
  );
}
