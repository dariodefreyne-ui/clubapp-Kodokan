// src/components/beheer/AlgemeenInstellingenBeheer.jsx
// Beheer van settings/club, settings/seizoen en training-detectie.
// Exporteert ClubInstellingenBeheer, SeizoenInstellingenBeheer en TrainingDetectieBeheer.
import React, { useEffect, useRef, useState } from 'react';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useToast } from '../ui/Toast.jsx';
import { useAuth } from '../../contexts/AuthContext';
import { CLUB_NAAM, CLUB_NAAM_KORT } from '../../config/appConfig';
import { bepaalSeizoen, getSeizoenSettings } from '../../utils/seizoenUtils';
import {
  getClubSettings, setClubSettings,
  DEFAULT_GEEN_TRAINING_MARKERS, DEFAULT_PROVINCIALE_MARKERS,
  normaliseerGeenTrainingMarkers, markersProvinciaalUitSettings,
} from '../../services/firestoreService';

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
  const { refreshConfigCache } = useAuth();
  const [data, setData] = useState({ clubname: '', naamKort: '', contactEmail: '', logoUrl: '', timezone: 'Europe/Brussels' });
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [uploadVoortgang, setUploadVoortgang] = useState(null);
  const fileInputRef = useRef(null);

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

  async function uploadLogo(file) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ bericht: 'Bestand is te groot (max 2 MB)', type: 'error' });
      return;
    }
    if (!file.type.startsWith('image/')) {
      toast({ bericht: 'Alleen afbeeldingen zijn toegelaten', type: 'error' });
      return;
    }
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    // Vaste naam zodat de PWA-build altijd hetzelfde publieke URL kan gebruiken
    const storageRef = ref(storage, `logos/club-logo.${ext}`);
    const task = uploadBytesResumable(storageRef, file);
    setUploadVoortgang(0);
    task.on('state_changed',
      snap => setUploadVoortgang(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      err => {
        console.error(err);
        toast({ bericht: `Upload mislukt: ${err.message}`, type: 'error' });
        setUploadVoortgang(null);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setVeld('logoUrl', url);
        setUploadVoortgang(null);
        toast({ bericht: 'Logo geüpload — vergeet niet op te slaan', type: 'success' });
      }
    );
  }

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
      refreshConfigCache();
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
          <label style={S.label}>Clublogo</label>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
            {data.logoUrl && (
              <div style={{
                width: '72px', height: '72px', borderRadius: '8px',
                border: '1px solid var(--border-color)', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#fff', flexShrink: 0,
              }}>
                <img src={data.logoUrl} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              </div>
            )}
            <div style={{ flex: 1 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) uploadLogo(f);
                  e.target.value = '';
                }}
              />
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{ ...S.btn, marginTop: 0, padding: '8px 14px', fontSize: '13px' }}
                  disabled={uploadVoortgang !== null}
                >
                  {uploadVoortgang !== null ? `Bezig... ${uploadVoortgang}%` : (data.logoUrl ? 'Vervangen' : 'Upload logo')}
                </button>
                {data.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setVeld('logoUrl', '')}
                    style={{ padding: '8px 14px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    Verwijderen
                  </button>
                )}
              </div>
              <input
                style={{ ...S.input, fontSize: '12px' }}
                value={data.logoUrl}
                onChange={e => setVeld('logoUrl', e.target.value)}
                placeholder="https://... (of upload hierboven)"
              />
              <div style={S.hint}>Max 2 MB, PNG/JPG/SVG. Verschijnt in mails en op het login-scherm.</div>
            </div>
          </div>
        </div>
        <div style={S.rij}>
          <label style={S.label}>Tijdzone</label>
          <input style={S.input} value={data.timezone} onChange={e => setVeld('timezone', e.target.value)} placeholder="Europe/Brussels" />
        </div>
        <button style={S.btn} onClick={slaOp} disabled={bezig}>{bezig ? 'Opslaan...' : 'Opslaan'}</button>
      </div>

      {/* ── Correctie van fout opgeslagen seizoen-velden ── */}
      <SeizoenCorrectie />
    </>
  );
}

// ─── SeizoenCorrectie ──────────────────────────────────────────────────────────
// Herberekent het 'seizoen'-veld voor bestaande trainingen op basis van de
// huidige seizoeninstellingen. Veilig: werkt per batch, toont previews,
// retroactief voor gewijzigde startmaanden.
function SeizoenCorrectie() {
  const toast = useToast();
  const [bezig, setBezig] = useState(false);
  const [preview, setPreview] = useState(null); // null | { totaal, teCorrigeren, voorbeelden }

  async function scanTrainingen() {
    setBezig(true);
    setPreview(null);
    try {
      const snap = await getDocs(collection(db, 'trainingen'));
      const trainingen = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const teCorrigeren = [];
      for (const t of trainingen) {
        if (!t.datum) continue;
        const correct = bepaalSeizoen(t.datum);
        if (t.seizoen !== correct) {
          teCorrigeren.push({ id: t.id, datum: t.datum, oud: t.seizoen, nieuw: correct });
        }
      }
      setPreview({
        totaal: trainingen.length,
        teCorrigeren,
        voorbeelden: teCorrigeren.slice(0, 5),
      });
    } catch (e) {
      toast({ bericht: `Scan mislukt: ${e.message}`, type: 'error' });
    }
    setBezig(false);
  }

  async function corrigeer() {
    if (!preview || preview.teCorrigeren.length === 0) return;
    setBezig(true);
    try {
      // Verwerk in batches van 400 (Firestore limit = 500 per batch)
      const items = preview.teCorrigeren;
      for (let i = 0; i < items.length; i += 400) {
        const batch = writeBatch(db);
        for (const item of items.slice(i, i + 400)) {
          batch.update(doc(db, 'trainingen', item.id), { seizoen: item.nieuw });
        }
        await batch.commit();
      }
      toast({ bericht: `${items.length} training(en) gecorrigeerd ✓`, type: 'success' });
      setPreview(null);
    } catch (e) {
      toast({ bericht: `Correctie mislukt: ${e.message}`, type: 'error' });
    }
    setBezig(false);
  }

  return (
    <div style={{ ...S.wrap, marginTop: '16px', border: '1px dashed var(--border-color)' }}>
      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
        🔧 Retroactieve seizoencorrectie
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
        Herbereken het seizoen-veld voor alle bestaande trainingen op basis van de huidige startmaand-instelling.
        Gebruik dit na een startmaand-wijziging. Toekomstige seizoenen worden niet aangeraakt.
      </p>

      {!preview ? (
        <button onClick={scanTrainingen} disabled={bezig}
          style={{ ...S.btn, background: 'var(--accent-orange, #FB923C)' }}>
          {bezig ? 'Scannen...' : '🔍 Scan trainingen'}
        </button>
      ) : (
        <div>
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '10px' }}>
            <strong style={{ color: 'var(--text-primary)' }}>{preview.totaal}</strong> trainingen gescand —{' '}
            <strong style={{ color: preview.teCorrigeren.length > 0 ? 'var(--accent-orange, #FB923C)' : 'var(--accent-green, #22C55E)' }}>
              {preview.teCorrigeren.length}
            </strong> te corrigeren
          </div>

          {preview.teCorrigeren.length === 0 ? (
            <div style={{ color: 'var(--accent-green, #22C55E)', fontSize: '13px', fontWeight: '600' }}>
              ✓ Alle trainingen hebben het juiste seizoen-veld.
            </div>
          ) : (
            <>
              {preview.voorbeelden.length > 0 && (
                <div style={{ background: 'var(--bg-primary)', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px', fontSize: '12px' }}>
                  <div style={{ color: 'var(--text-muted)', fontWeight: '700', marginBottom: '6px', textTransform: 'uppercase', fontSize: '11px' }}>Voorbeelden</div>
                  {preview.voorbeelden.map(v => (
                    <div key={v.id} style={{ display: 'flex', gap: '12px', color: 'var(--text-secondary)', marginBottom: '3px' }}>
                      <span style={{ minWidth: '100px' }}>{v.datum}</span>
                      <span style={{ color: 'var(--accent-red)', textDecoration: 'line-through' }}>{v.oud || '(leeg)'}</span>
                      <span>→</span>
                      <span style={{ color: 'var(--accent-green, #22C55E)', fontWeight: '600' }}>{v.nieuw}</span>
                    </div>
                  ))}
                  {preview.teCorrigeren.length > 5 && (
                    <div style={{ color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                      … en nog {preview.teCorrigeren.length - 5} andere
                    </div>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={corrigeer} disabled={bezig}
                  style={{ ...S.btn, background: 'var(--accent-green, #22C55E)' }}>
                  {bezig ? 'Corrigeren...' : `✓ Corrigeer ${preview.teCorrigeren.length} training(en)`}
                </button>
                <button onClick={() => setPreview(null)} disabled={bezig}
                  style={{ ...S.btn, background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                  Annuleren
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
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
  const { refreshConfigCache } = useAuth();
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
      refreshConfigCache();
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

// ─── Training detectie ────────────────────────────────────────────────────────
export function TrainingDetectieBeheer() {
  const toast = useToast();
  const [markers, setMarkers] = useState(DEFAULT_GEEN_TRAINING_MARKERS);
  const [provincialeMarkers, setProvinciale] = useState(DEFAULT_PROVINCIALE_MARKERS);
  const [bezig, setBezig] = useState(false);

  useEffect(() => {
    getClubSettings().then(data => {
      const s = data || {};
      setMarkers(normaliseerGeenTrainingMarkers([
        ...(Array.isArray(s.trainingGeenTrainingMarkers) ? s.trainingGeenTrainingMarkers : []),
        s.geenTrainingMarker, s.geenTrainingTekst, s.geenTrainingMarkers,
        s.trainerReminder?.uitsluitZin,
      ].filter(Boolean)));
      setProvinciale(markersProvinciaalUitSettings(s));
    });
  }, []);

  const updateMarker = (setter, index, value) =>
    setter(prev => prev.map((m, i) => i === index ? value : m));
  const voegToe = setter => setter(prev => [...prev, '']);
  const verwijder = (setter, index) => setter(prev => prev.filter((_, i) => i !== index));

  async function slaOp() {
    setBezig(true);
    try {
      const schoonMarkers = normaliseerGeenTrainingMarkers(markers.filter(Boolean));
      const schoonProv = Array.from(new Map(
        provincialeMarkers.map(x => String(x || '').trim()).filter(Boolean).map(x => [x.toLowerCase(), x])
      ).values());
      const bestaand = await getClubSettings() || {};
      await setClubSettings({
        ...bestaand,
        trainingGeenTrainingMarkers: schoonMarkers,
        trainingProvincialeMarkers: schoonProv,
      });
      setMarkers(schoonMarkers);
      setProvinciale(schoonProv);
      toast({ bericht: 'Training detectie opgeslagen', type: 'success' });
    } catch (e) {
      toast({ bericht: `Fout: ${e.message}`, type: 'error' });
    }
    setBezig(false);
  }

  function MarkerLijst({ items, setItems, placeholder }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        {items.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              value={m}
              onChange={e => updateMarker(setItems, i, e.target.value)}
              placeholder={placeholder}
              style={S.input}
            />
            <button
              onClick={() => verwijder(setItems, i)}
              style={{ padding: '10px 12px', background: 'transparent', border: '1px solid var(--danger)', borderRadius: '8px', color: 'var(--danger)', cursor: 'pointer', whiteSpace: 'nowrap' }}
            >
              Verwijder
            </button>
          </div>
        ))}
        <button
          onClick={() => voegToe(setItems)}
          style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-secondary)', padding: '10px 14px', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', alignSelf: 'flex-start' }}
        >
          + Tekst toevoegen
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={S.wrap}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
          Geen-training labels (alle groepen)
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 12px' }}>
          Teksten die voor <strong>elke</strong> groep betekenen dat er geen gewone training is (bv. sporthal gesloten, vakantie).
          Herkenning is hoofdletterongevoelig.
        </p>
        <MarkerLijst items={markers} setItems={setMarkers} placeholder="Bijv. sporthal gesloten" />
      </div>

      <div style={S.wrap}>
        <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
          Provinciale labels (enkel groepen die provinciale kalender volgen)
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 12px' }}>
          Deze teksten betekenen enkel "geen training" voor groepen waarbij <strong>"Volgt de provinciale kalender"</strong> aanstaat.
          Voor andere groepen gaat de training gewoon door.
        </p>
        <MarkerLijst items={provincialeMarkers} setItems={setProvinciale} placeholder="Bijv. prov. training" />
      </div>

      <div>
        <button style={S.btn} onClick={slaOp} disabled={bezig}>{bezig ? 'Opslaan...' : 'Opslaan'}</button>
      </div>
    </div>
  );
}
