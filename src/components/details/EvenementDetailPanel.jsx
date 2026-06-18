// src/components/details/EvenementDetailPanel.jsx
// Detailpanel voor een clubevenement (clubactiviteit, stage, meeting, ...).
// Toont info + in-/uitschrijven voor het gekoppelde lid en — voor trainers/
// bestuur — de deelnemerslijst met beheer (anderen toevoegen/verwijderen).

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { C, buttonStyle, badgeStyle, inputStyle } from '../../styles/tokens';
import { formatDatum, vandaagISO } from '../trainingen/seizoenHelpers';
import {
  subscribeEvenementRegistrations,
  setEvenementRegistration,
  verwijderEvenementRegistration,
  getMemberById,
  zoekLedenOpNaam,
} from '../../services/firestoreService';
import DetailModal from './DetailModal';
import { useToast } from '../ui/Toast';

const TYPE_LABELS = {
  clubactiviteit: 'Clubactiviteit',
  stage: 'Stage',
  meeting: 'Meeting',
  tornooi: 'Tornooi',
  overig: 'Overig',
};

const TYPE_BADGE_COLOR = {
  clubactiviteit: 'purple',
  stage: 'green',
  meeting: 'blue',
  tornooi: 'orange',
  overig: 'red',
};

const ZICHTBAARHEID_LABELS = {
  trainers: 'Trainers & bestuur',
  bestuur: 'Enkel bestuur',
};

export default function EvenementDetailPanel({ evenementId, onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { profiel, isTrainer, isBeheerder } = useAuth();
  const magBeheren = isTrainer || isBeheerder;
  const mijnMemberId = profiel?.linkedMemberId || null;

  const [ev, setEv] = useState(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState('');

  const [registraties, setRegistraties] = useState([]);
  const [mijnNaam, setMijnNaam] = useState(profiel?.naam || '');
  const [aantalGasten, setAantalGasten] = useState(0);
  const [bezig, setBezig] = useState(false);

  // Ledenzoeker voor beheer (anderen in-/uitschrijven)
  const [zoekterm, setZoekterm] = useState('');
  const [zoekResultaten, setZoekResultaten] = useState([]);
  const [zoeken, setZoeken] = useState(false);

  // Evenement laden
  useEffect(() => {
    let actief = true;
    setLaden(true);
    setFout('');
    setEv(null);

    (async () => {
      try {
        const snap = await getDoc(doc(db, 'evenementen', evenementId));
        if (!actief) return;
        if (!snap.exists()) {
          setFout('Evenement niet gevonden');
          setLaden(false);
          return;
        }
        setEv({ id: snap.id, ...snap.data() });
        setLaden(false);
      } catch (e) {
        if (!actief) return;
        console.error('EvenementDetailPanel:', e);
        setFout('Fout bij laden van evenement');
        setLaden(false);
      }
    })();
    return () => { actief = false; };
  }, [evenementId]);

  // Live deelnemerslijst
  useEffect(() => {
    const unsub = subscribeEvenementRegistrations(evenementId, setRegistraties);
    return unsub;
  }, [evenementId]);

  // Eigen naam ophalen (voor de inschrijving)
  useEffect(() => {
    if (!mijnMemberId) return;
    let actief = true;
    getMemberById(mijnMemberId).then(m => {
      if (actief && m?.naam) setMijnNaam(m.naam);
    }).catch(() => {});
    return () => { actief = false; };
  }, [mijnMemberId]);

  const mijnInschrijving = useMemo(
    () => registraties.find(r => r.id === mijnMemberId) || null,
    [registraties, mijnMemberId],
  );

  // Bij wijziging van eigen inschrijving het gasten-veld synchroniseren
  useEffect(() => {
    setAantalGasten(mijnInschrijving?.aantalGasten || 0);
  }, [mijnInschrijving]);

  // Ledenzoeker (debounce)
  useEffect(() => {
    if (!magBeheren || zoekterm.trim().length < 2) { setZoekResultaten([]); return; }
    let actief = true;
    setZoeken(true);
    const t = setTimeout(async () => {
      try {
        const res = await zoekLedenOpNaam(zoekterm);
        if (actief) setZoekResultaten(res);
      } catch { if (actief) setZoekResultaten([]); }
      finally { if (actief) setZoeken(false); }
    }, 300);
    return () => { actief = false; clearTimeout(t); };
  }, [zoekterm, magBeheren]);

  const inschrijvenMogelijk = ev?.inschrijvenMogelijk !== false;
  const gastenToegestaan = ev?.gastenToegestaan === true;
  const deadline = ev?.inschrijfDeadline || '';
  const deadlineVoorbij = deadline && vandaagISO() > deadline;
  const kanZelfInschrijven = inschrijvenMogelijk && !!mijnMemberId;

  const totaalGasten = registraties.reduce((n, r) => n + (Number(r.aantalGasten) || 0), 0);
  const totaalPersonen = registraties.length + totaalGasten;

  const titel = ev?.titel || 'Evenement';
  const typeKleur = ev?.type ? TYPE_BADGE_COLOR[ev.type] || 'purple' : 'purple';
  const typeLabel = ev?.type ? TYPE_LABELS[ev.type] || ev.type : '';

  async function schrijfMijIn() {
    if (!mijnMemberId || bezig) return;
    setBezig(true);
    try {
      await setEvenementRegistration(evenementId, mijnMemberId, {
        naam: mijnNaam || 'Onbekend',
        aantalGasten: gastenToegestaan ? Math.max(0, Number(aantalGasten) || 0) : 0,
        seizoen: ev?.seizoen || '',
      });
    } catch (e) {
      console.error('inschrijven:', e);
      toast({ bericht: `Inschrijven mislukt: ${e.message}`, type: 'error' });
    } finally {
      setBezig(false);
    }
  }

  async function schrijfMijUit() {
    if (!mijnMemberId || bezig) return;
    setBezig(true);
    try {
      await verwijderEvenementRegistration(evenementId, mijnMemberId);
    } catch (e) {
      console.error('uitschrijven:', e);
      toast({ bericht: `Uitschrijven mislukt: ${e.message}`, type: 'error' });
    } finally {
      setBezig(false);
    }
  }

  async function voegLidToe(member) {
    try {
      await setEvenementRegistration(evenementId, member.id, { naam: member.naam || 'Onbekend', aantalGasten: 0, seizoen: ev?.seizoen || '' });
      setZoekterm('');
      setZoekResultaten([]);
    } catch (e) {
      console.error('lid toevoegen:', e);
      toast({ bericht: `Toevoegen mislukt: ${e.message}`, type: 'error' });
    }
  }

  async function verwijderLid(memberId) {
    try {
      await verwijderEvenementRegistration(evenementId, memberId);
    } catch (e) {
      console.error('lid verwijderen:', e);
      toast({ bericht: `Verwijderen mislukt: ${e.message}`, type: 'error' });
    }
  }

  const reedsIngeschrevenIds = new Set(registraties.map(r => r.id));

  return (
    <DetailModal open={true} onClose={onClose} title={titel} accentKleur={C.purple}>
      {laden && (
        <div style={{ textAlign: 'center', padding: '24px', color: C.textSec }}>Laden...</div>
      )}

      {!laden && fout && (
        <div style={{ textAlign: 'center', padding: '20px', color: C.textSec }}>{fout}</div>
      )}

      {!laden && !fout && ev && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {typeLabel && <span style={badgeStyle(typeKleur)}>{typeLabel}</span>}
            {ev.zichtbaarheid && ZICHTBAARHEID_LABELS[ev.zichtbaarheid] && (
              <span style={badgeStyle('blue')}>👁 {ZICHTBAARHEID_LABELS[ev.zichtbaarheid]}</span>
            )}
          </div>

          {ev.datum && (
            <div style={{ fontSize: '16px', marginBottom: '8px', color: C.textPrimary }}>
              {formatDatum(ev.datum)}
              {ev.eindDatum && ev.eindDatum !== ev.datum && (
                <span> – {formatDatum(ev.eindDatum)}</span>
              )}
            </div>
          )}

          {ev.beschrijving && (
            <div style={{ marginTop: '12px', color: C.textPrimary, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
              {ev.beschrijving}
            </div>
          )}

          {/* ── Inschrijving ──────────────────────────────────────────── */}
          {inschrijvenMogelijk && (
            <div style={{ marginTop: '20px', padding: '14px', background: C.surface, borderRadius: '10px', border: `1px solid ${C.borderSoft}` }}>
              {deadline && (
                <div style={{ fontSize: '12px', color: deadlineVoorbij ? C.red : C.textSec, marginBottom: '10px' }}>
                  {deadlineVoorbij
                    ? `Inschrijven gesloten sinds ${formatDatum(deadline)}`
                    : `Inschrijven kan tot ${formatDatum(deadline)}`}
                </div>
              )}

              {!mijnMemberId && (
                <div style={{ fontSize: '13px', color: C.textSec }}>
                  Je profiel is nog niet aan een lid gekoppeld; inschrijven kan daarom niet.
                </div>
              )}

              {kanZelfInschrijven && mijnInschrijving && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: gastenToegestaan ? '10px' : '0' }}>
                  <span style={badgeStyle('green')}>✓ Je bent ingeschreven</span>
                  {mijnInschrijving.aantalGasten > 0 && (
                    <span style={{ fontSize: '12px', color: C.textSec }}>+ {mijnInschrijving.aantalGasten} gast{mijnInschrijving.aantalGasten === 1 ? '' : 'en'}</span>
                  )}
                </div>
              )}

              {kanZelfInschrijven && gastenToegestaan && !deadlineVoorbij && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <label style={{ fontSize: '13px', color: C.textSec }}>Aantal gasten</label>
                  <input
                    type="number"
                    min="0"
                    value={aantalGasten}
                    onChange={e => setAantalGasten(e.target.value)}
                    style={{ ...inputStyle, width: '72px', padding: '6px 8px' }}
                  />
                </div>
              )}

              {kanZelfInschrijven && !deadlineVoorbij && (
                mijnInschrijving ? (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {gastenToegestaan && (
                      <button onClick={schrijfMijIn} disabled={bezig} style={buttonStyle('accent')}>
                        Aantal gasten bijwerken
                      </button>
                    )}
                    <button onClick={schrijfMijUit} disabled={bezig} style={buttonStyle('danger')}>
                      Uitschrijven
                    </button>
                  </div>
                ) : (
                  <button onClick={schrijfMijIn} disabled={bezig} style={buttonStyle('success')}>
                    {bezig ? 'Bezig...' : 'Inschrijven'}
                  </button>
                )
              )}
            </div>
          )}

          {/* ── Deelnemerslijst + beheer ─────────────────────────────── */}
          {inschrijvenMogelijk && magBeheren && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '11px', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
                Ingeschreven · {registraties.length} {registraties.length === 1 ? 'lid' : 'leden'}
                {totaalGasten > 0 && ` + ${totaalGasten} gast${totaalGasten === 1 ? '' : 'en'} (${totaalPersonen} totaal)`}
              </div>

              {registraties.length === 0 && (
                <div style={{ fontSize: '13px', color: C.textSec, marginBottom: '10px' }}>Nog niemand ingeschreven.</div>
              )}

              {registraties.map(r => (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '6px 0', borderBottom: `1px solid ${C.borderSoft}` }}>
                  <span style={{ color: C.textPrimary, fontSize: '14px' }}>
                    {r.naam || r.id}
                    {r.aantalGasten > 0 && <span style={{ color: C.textSec }}> (+{r.aantalGasten})</span>}
                  </span>
                  <button onClick={() => verwijderLid(r.id)} style={{ ...buttonStyle('subtle'), minHeight: '32px', padding: '4px 10px' }}>
                    Verwijderen
                  </button>
                </div>
              ))}

              {/* Lid toevoegen */}
              <div style={{ marginTop: '12px' }}>
                <input
                  value={zoekterm}
                  onChange={e => setZoekterm(e.target.value)}
                  placeholder="Lid zoeken om toe te voegen..."
                  style={inputStyle}
                />
                {zoeken && <div style={{ fontSize: '12px', color: C.textSec, marginTop: '6px' }}>Zoeken...</div>}
                {zoekResultaten.length > 0 && (
                  <div style={{ marginTop: '6px', border: `1px solid ${C.borderSoft}`, borderRadius: '8px', overflow: 'hidden' }}>
                    {zoekResultaten.map(m => {
                      const al = reedsIngeschrevenIds.has(m.id);
                      return (
                        <button
                          key={m.id}
                          onClick={() => !al && voegLidToe(m)}
                          disabled={al}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left', padding: '8px 10px',
                            background: 'transparent', border: 'none', borderBottom: `1px solid ${C.borderSoft}`,
                            color: al ? C.textMuted : C.textPrimary, fontSize: '13px', cursor: al ? 'default' : 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          {m.naam} {al && <span style={{ fontSize: '11px' }}>· al ingeschreven</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {magBeheren && (
            <button
              onClick={() => { onClose(); navigate('/evenementen'); }}
              style={{ ...buttonStyle('accent'), marginTop: '20px' }}
            >
              Open volledige pagina
            </button>
          )}
        </>
      )}
    </DetailModal>
  );
}
