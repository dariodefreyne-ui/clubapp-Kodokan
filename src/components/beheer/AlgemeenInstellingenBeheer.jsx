// src/components/beheer/AlgemeenInstellingenBeheer.jsx
// Beheer van settings/club en settings/seizoen documenten.
// Exporteert ClubInstellingenBeheer en SeizoenInstellingenBeheer.
import React, { useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useToast } from '../ui/Toast.jsx';
import { CLUB_NAAM, CLUB_NAAM_KORT } from '../../config/appConfig';

const S = {
  wrap: { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', marginBottom: '16px' },
  rij: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '14px' },
  label: { fontSize: '12px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  hint: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' },
  input: {
    padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)',
    borderRadius: '8px', color: 'var(--text-primary)', fontSize: '14px',
    width: '100%', boxSizing: 'border-box',
  },
  btn: {
    padding: '10px 20px', background: 'var(--accent-red)', border: 'none',
    borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: '600',
    cursor: 'pointer', fontFamily: 'inherit', marginTop: '4px',
  },
};

// ─── Club instellingen ────────────────────────────────────────────────────────
export function ClubInstellingenBeheer() {
  const toast = useToast();
  const [data, setData] = useState({ clubname: '', naamKort: '', contactEmail: '', logoUrl: '', timezone: 'Europe/Brussels' });
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'club')).then(snap => {
      if (snap.exists()) {
        const cur = snap.data();
        // Compatibel met oude veldnaam 'naam' en nieuwe 'clubname'
        setData(d => ({ ...d, ...cur, clubname: cur.clubname || cur.naam || CLUB_NAAM }));
      } else {
        setData(d => ({ ...d, clubname: CLUB_NAAM, naamKort: CLUB_NAAM_KORT }));
      }
      setLaden(false);
    }).catch(() => setLaden(false));
  }, []);

  function setVeld(key, val) { setData(d => ({ ...d, [key]: val })); }

  async function slaOp() {
    if (!data.clubname?.trim()) {
      toast({ bericht: 'Naam is verplicht', type: 'error' });
      return;
    }
    setBezig(true);
    try {
      await setDoc(doc(db, 'settings', 'club'), {
        clubname: data.clubname.trim(),
        naamKort: data.clubnameKort?.trim() || data.clubname.trim(),
        contactEmail: data.contactEmail?.trim() || '',
        logoUrl: data.logoUrl?.trim() || '',
        timezone: data.timezone || 'Europe/Brussels',
        bijgewerkt: serverTimestamp(),
      }, { merge: true });
      toast({ bericht: 'Clubinstellingen opgeslagen', type: 'success' });
    } catch (e) {
      toast({ bericht: `Fout: ${e.message}`, type: 'error' });
    }
    setBezig(false);
  }

  if (laden) return <div style={{ color: 'var(--text-secondary)' }}>Laden...</div>;

  return (
    <>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 16px' }}>
        Deze gegevens worden gebruikt in mails, push-meldingen, login-scherm en onboarding.
      </p>
      <div style={S.wrap}>
        <div style={S.rij}>
          <label style={S.label}>Volledige naam *</label>
          <input style={S.input} value={data.clubname} onChange={e => setVeld('clubname', e.target.value)} placeholder="Judo Kodokan Merchtem" />
        </div>
        <div style={S.rij}>
          <label style={S.label}>Korte naam</label>
          <input style={S.input} value={data.clubnameKort} onChange={e => setVeld('naamKort', e.target.value)} placeholder="Kodokan Merchtem" />
          <div style={S.hint}>Wordt getoond in koptekst en mobiele view.</div>
        </div>
        <div style={S.rij}>
          <label style={S.label}>Contact-e-mail</label>
          <input style={S.input} type="email" value={data.contactEmail} onChange={e => setVeld('contactEmail', e.target.value)} placeholder="info@kodokan.be" />
        </div>
        <div style={S.rij}>
          <label style={S.label}>Logo URL</label>
          <input style={S.input} value={data.logoUrl} onChange={e => setVeld('logoUrl', e.target.value)} placeholder="https://..." />
          <div style={S.hint}>Verschijnt in mails en op het login-scherm.</div>
        </div>
        <div style={S.rij}>
          <label style={S.label}>Tijdzone</label>
          <input style={S.input} value={data.timezone} onChange={e => setVeld('timezone', e.target.value)} placeholder="Europe/Brussels" />
        </div>
        <button style={S.btn} onClick={slaOp} disabled={bezig}>{bezig ? 'Opslaan...' : 'Opslaan'}</button>
      </div>
    </>
  );
}

// ─── Seizoen instellingen ─────────────────────────────────────────────────────
const MAANDEN = [
  { val: 1, label: 'januari' }, { val: 2, label: 'februari' }, { val: 3, label: 'maart' },
  { val: 4, label: 'april' }, { val: 5, label: 'mei' }, { val: 6, label: 'juni' },
  { val: 7, label: 'juli' }, { val: 8, label: 'augustus' }, { val: 9, label: 'september' },
  { val: 10, label: 'oktober' }, { val: 11, label: 'november' }, { val: 12, label: 'december' },
];

export function SeizoenInstellingenBeheer() {
  const toast = useToast();
  const [data, setData] = useState({ startMaand: 9, startDag: 1, eindMaand: 6, eindDag: 30 });
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    getDoc(doc(db, 'settings', 'seizoen')).then(snap => {
      if (snap.exists()) setData(d => ({ ...d, ...snap.data() }));
      setLaden(false);
    }).catch(() => setLaden(false));
  }, []);

  async function slaOp() {
    setBezig(true);
    try {
      await setDoc(doc(db, 'settings', 'seizoen'), {
        startMaand: Number(data.startMaand) || 9,
        startDag: Number(data.startDag) || 1,
        eindMaand: Number(data.eindMaand) || 6,
        eindDag: Number(data.eindDag) || 30,
        bijgewerkt: serverTimestamp(),
      }, { merge: true });
      toast({ bericht: 'Seizoen opgeslagen', type: 'success' });
    } catch (e) {
      toast({ bericht: `Fout: ${e.message}`, type: 'error' });
    }
    setBezig(false);
  }

  if (laden) return <div style={{ color: 'var(--text-secondary)' }}>Laden...</div>;

  return (
    <>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 16px' }}>
        Het sportseizoen loopt standaard van 1 september tot 30 juni. Pas aan indien je club andere periodes gebruikt.
      </p>
      <div style={S.wrap}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div style={S.rij}>
            <label style={S.label}>Start maand</label>
            <select style={S.input} value={data.startMaand} onChange={e => setData(d => ({ ...d, startMaand: e.target.value }))}>
              {MAANDEN.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
            </select>
          </div>
          <div style={S.rij}>
            <label style={S.label}>Start dag</label>
            <input style={S.input} type="number" min="1" max="31" value={data.startDag} onChange={e => setData(d => ({ ...d, startDag: e.target.value }))} />
          </div>
          <div style={S.rij}>
            <label style={S.label}>Eind maand</label>
            <select style={S.input} value={data.eindMaand} onChange={e => setData(d => ({ ...d, eindMaand: e.target.value }))}>
              {MAANDEN.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
            </select>
          </div>
          <div style={S.rij}>
            <label style={S.label}>Eind dag</label>
            <input style={S.input} type="number" min="1" max="31" value={data.eindDag} onChange={e => setData(d => ({ ...d, eindDag: e.target.value }))} />
          </div>
        </div>
        <button style={S.btn} onClick={slaOp} disabled={bezig}>{bezig ? 'Opslaan...' : 'Opslaan'}</button>
      </div>
    </>
  );
}
