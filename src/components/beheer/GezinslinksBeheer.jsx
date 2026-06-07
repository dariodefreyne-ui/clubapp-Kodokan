// src/components/beheer/GezinslinksBeheer.jsx
// Admin-scherm voor het beheren van gezinsaanvragen (ouder ↔ kind-koppeling).
import React, { useState, useEffect } from 'react';
import { getPendingGezinslinks, keurGezinslinkGoed, wijsGezinslinkAf } from '../../services/firestoreService';
import { useToast } from '../ui/Toast.jsx';
import { formatDatum } from '../../utils/datumUtils';
import { buttonStyle } from '../../styles/tokens';

const S = {
  rij: {
    display: 'flex', flexDirection: 'column', gap: '8px',
    padding: '14px 0', borderBottom: '1px solid var(--border-color)',
  },
  naam: { fontWeight: '700', fontSize: 'var(--font-size-md)' },
  meta: { fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' },
  acties: { display: 'flex', gap: '8px', marginTop: '4px' },
};

export default function GezinslinksBeheer() {
  const toast = useToast();
  const [links, setLinks] = useState([]);
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(null);

  useEffect(() => {
    laadLinks();
  }, []);

  async function laadLinks() {
    setLaden(true);
    try {
      const data = await getPendingGezinslinks();
      setLinks(data);
    } catch (e) {
      toast({ bericht: 'Fout bij laden aanvragen', type: 'error' });
    } finally {
      setLaden(false);
    }
  }

  async function handelActie(link, serviceFn, succesMsg, foutMsg) {
    setBezig(link.id);
    try {
      await serviceFn(link);
      toast({ bericht: succesMsg, type: 'success' });
      setLinks(prev => prev.filter(l => l.id !== link.id));
    } catch {
      toast({ bericht: foutMsg, type: 'error' });
    } finally {
      setBezig(null);
    }
  }

  async function goedkeuren(link) {
    if (!link.memberId) {
      toast({ bericht: 'Geen lid gevonden — aanvraag kan niet goedgekeurd worden', type: 'error' });
      return;
    }
    await handelActie(
      link,
      l => keurGezinslinkGoed(l.id, l.memberId, l.ouderUid),
      `Aanvraag voor ${link.lidNaam} goedgekeurd`,
      'Fout bij goedkeuren',
    );
  }

  async function afwijzen(link) {
    await handelActie(
      link,
      l => wijsGezinslinkAf(l.id),
      `Aanvraag voor ${link.lidNaam} afgewezen`,
      'Fout bij afwijzen',
    );
  }

  if (laden) return <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>Laden...</div>;

  return (
    <div>
      <h2 style={{ margin: '0 0 4px', fontSize: 'var(--font-size-lg)', color: 'var(--accent-red)' }}>Gezinsaanvragen</h2>
      <p style={{ margin: '0 0 16px', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
        Ouders die een kind willen beheren, moeten hier goedgekeurd worden.
        Na goedkeuring kan de ouder wedstrijdinschrijvingen en andere acties uitvoeren namens het kind.
      </p>

      {links.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', padding: '20px 0' }}>
          Geen openstaande aanvragen.
        </div>
      ) : (
        <div>
          {links.map(link => (
            <div key={link.id} style={S.rij}>
              <div>
                <div style={S.naam}>{link.ouderNaam || '—'}</div>
                <div style={S.meta}>wil beheer aanvragen voor <strong>{link.lidNaam || '—'}</strong></div>
                {link.lidGeboortedatum && (
                  <div style={S.meta}>Geboortedatum kind: {link.lidGeboortedatum}</div>
                )}
                <div style={S.meta}>Aangevraagd op: {formatDatum(link.aangemaaktOp)}</div>
                {!link.memberId && (
                  <div style={{ ...S.meta, color: 'var(--accent-red)', marginTop: '4px' }}>
                    Lid niet gevonden in ledenbeheer — controleer naam en geboortedatum.
                  </div>
                )}
              </div>
              <div style={S.acties}>
                <button
                  style={{ ...buttonStyle('success'), opacity: bezig === link.id ? 0.6 : 1 }}
                  disabled={bezig === link.id || !link.memberId}
                  onClick={() => goedkeuren(link)}
                >
                  ✓ Goedkeuren
                </button>
                <button
                  style={{ ...buttonStyle('danger'), opacity: bezig === link.id ? 0.6 : 1 }}
                  disabled={bezig === link.id}
                  onClick={() => afwijzen(link)}
                >
                  ✕ Afwijzen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
