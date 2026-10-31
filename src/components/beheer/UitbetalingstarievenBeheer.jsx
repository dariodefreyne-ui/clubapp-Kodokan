// src/components/beheer/UitbetalingstarievenBeheer.jsx
// Uurloon per lesgever-type + kilometervergoeding, MET INGANGSDATUM.
// Een tarief wijzigen = een nieuwe regel "vanaf <datum>" toevoegen. Oudere periodes blijven
// zo met het toenmalige tarief afrekenen. Het bestaande veld (bedragPerUur / bedragPerKm)
// blijft de startwaarde; de wijzigingen staan in dezelfde document-array `wijzigingen`
// (geen extra reads, alle bestaande lezers van 'tarieven' blijven werken).
import React, { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../ui/Toast.jsx';
import { tariefOpDatum, datumNaarISO, formatDagMetJaar } from '../uitbetalingen/uitbetalingHelpers';

const S = {
  wrap: { background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '20px', marginBottom: '16px' },
  sectie: { fontSize: '13px', fontWeight: '700', color: 'var(--accent-red)', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 12px' },
  rij: { display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', flexWrap: 'wrap' },
  label: { flex: 1, minWidth: '120px', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600' },
  input: {
    width: '100px', padding: '8px 10px', background: 'var(--bg-primary)', minHeight: '40px', boxSizing: 'border-box',
    border: '1px solid var(--border-color)', borderRadius: '6px',
    color: 'var(--text-primary)', fontSize: '14px', textAlign: 'right',
  },
  datum: { width: '150px', textAlign: 'left' },
  knop: { minHeight: '40px', padding: '8px 14px', background: 'var(--accent-red)', border: 'none', borderRadius: '6px', color: 'white', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  knopGhost: { minHeight: '40px', padding: '8px 12px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
  hint: { fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' },
  histRij: { display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', fontSize: '13px', color: 'var(--text-secondary)' },
  waarschuwing: { fontSize: '12px', color: 'var(--accent-orange, #F59E0B)', margin: '6px 0 0' },
};

const eur = (n) => `€ ${Number(n).toFixed(2).replace('.', ',')}`;

// Eén tarief (uur of km) met startwaarde, huidige waarde en geschiedenis.
function TariefBlok({ label, eenheid, veld, tariefDoc, onOpslaan }) {
  const [open, setOpen]       = useState(false);
  const [bedrag, setBedrag]   = useState('');
  const [vanaf, setVanaf]     = useState(() => datumNaarISO(new Date()));
  const [bezig, setBezig]     = useState(false);
  const vandaag = datumNaarISO(new Date());
  const wijzigingen = [...(Array.isArray(tariefDoc?.wijzigingen) ? tariefDoc.wijzigingen : [])]
    .sort((a, b) => String(a.vanaf).localeCompare(String(b.vanaf)));
  const start   = tariefDoc?.[veld];
  const nu      = tariefOpDatum(tariefDoc, vandaag, veld);
  const heeftStart = start !== undefined && start !== null && start !== '';
  const bedragNum  = parseFloat(String(bedrag).replace(',', '.'));
  const geldig = !isNaN(bedragNum) && bedragNum >= 0 && /^\d{4}-\d{2}-\d{2}$/.test(vanaf);
  const verledenDatum = vanaf < vandaag;

  async function bewaar(nieuweStart, nieuweLijst) {
    setBezig(true);
    try { await onOpslaan(nieuweStart, nieuweLijst); return true; }
    finally { setBezig(false); }
  }

  async function voegToe() {
    if (!geldig) return;
    // Zelfde ingangsdatum = vervangen i.p.v. dubbel toevoegen
    const lijst = wijzigingen.filter(w => w.vanaf !== vanaf).concat({ vanaf, bedrag: bedragNum });
    if (!heeftStart && wijzigingen.length === 0) {
      // eerste tarief ooit: dit wordt de startwaarde, geldig voor alle periodes
      if (await bewaar(bedragNum, [])) { setOpen(false); setBedrag(''); }
      return;
    }
    if (await bewaar(start, lijst)) { setOpen(false); setBedrag(''); }
  }
  async function verwijder(w) {
    if (!window.confirm(`Tarief vanaf ${formatDagMetJaar(w.vanaf)} (${eur(w.bedrag)}) verwijderen? Periodes vanaf die datum rekenen dan opnieuw met het vorige tarief.`)) return;
    await bewaar(start, wijzigingen.filter(x => x.vanaf !== w.vanaf));
  }

  return (
    <div style={{ padding: '8px 0', borderTop: '1px solid var(--border-color)' }}>
      <div style={S.rij}>
        <span style={S.label}>{label}</span>
        <span style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: '700' }}>
          {heeftStart || wijzigingen.length ? `${eur(nu)} ${eenheid}` : <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>niet ingesteld</span>}
        </span>
        <button type="button" style={S.knopGhost} onClick={() => setOpen(o => !o)}>{open ? 'Annuleren' : (heeftStart ? 'Tarief wijzigen' : 'Tarief instellen')}</button>
      </div>

      {open && (
        <div style={{ ...S.rij, background: 'var(--bg-primary)', borderRadius: '8px', padding: '10px 12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Nieuw tarief</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>€</span>
          <input type="number" inputMode="decimal" step="0.01" min="0" placeholder="0.00" value={bedrag}
                 onChange={e => setBedrag(e.target.value)} style={S.input} aria-label={`Nieuw tarief ${label}`} />
          {(heeftStart || wijzigingen.length > 0) && (
            <>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>geldig vanaf</span>
              <input type="date" value={vanaf} onChange={e => setVanaf(e.target.value)} style={{ ...S.input, ...S.datum }} aria-label="Geldig vanaf" />
            </>
          )}
          <button type="button" style={{ ...S.knop, opacity: geldig && !bezig ? 1 : 0.5 }} disabled={!geldig || bezig} onClick={voegToe}>
            {bezig ? '…' : 'Opslaan'}
          </button>
          {(heeftStart || wijzigingen.length > 0) && verledenDatum && geldig && (
            <div style={{ ...S.waarschuwing, flexBasis: '100%' }}>
              ⚠ Deze datum ligt in het verleden: afrekeningen vanaf {formatDagMetJaar(vanaf)} worden herberekend met dit tarief.
            </div>
          )}
          {!heeftStart && wijzigingen.length === 0 && (
            <div style={{ ...S.hint, flexBasis: '100%', marginTop: 0 }}>Eerste tarief: geldt voor alle periodes. Latere wijzigingen voeg je toe met een ingangsdatum.</div>
          )}
        </div>
      )}

      {(heeftStart || wijzigingen.length > 0) && (
        <details style={{ marginTop: '4px' }}>
          <summary style={{ cursor: 'pointer', fontSize: '12px', color: 'var(--text-muted)' }}>Tariefgeschiedenis ({wijzigingen.length + (heeftStart ? 1 : 0)})</summary>
          {heeftStart && <div style={S.histRij}><span style={{ flex: 1 }}>{wijzigingen.length ? `Tot ${formatDagMetJaar(wijzigingen[0].vanaf)}` : 'Altijd'}</span><strong>{eur(start)}</strong></div>}
          {wijzigingen.map(w => (
            <div key={w.vanaf} style={S.histRij}>
              <span style={{ flex: 1 }}>Vanaf {formatDagMetJaar(w.vanaf)}</span>
              <strong>{eur(w.bedrag)}</strong>
              <button type="button" aria-label={`Verwijder tarief vanaf ${w.vanaf}`} onClick={() => verwijder(w)}
                      style={{ ...S.knopGhost, minHeight: '32px', padding: '2px 10px' }}>×</button>
            </div>
          ))}
        </details>
      )}
    </div>
  );
}

export default function UitbetalingstarievenBeheer() {
  const { configCache } = useAuth();
  const toast = useToast();
  const [tarieven, setTarieven] = useState({});

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'tarieven'), snap => {
      const data = {};
      snap.docs.forEach(d => { data[d.id] = d.data(); });
      setTarieven(data);
    });
    return unsub;
  }, []);

  async function slaOp(docId, extra, veld, start, wijzigingen, melding) {
    try {
      await setDoc(doc(db, 'tarieven', docId), {
        ...extra, ...(start !== undefined && start !== null ? { [veld]: start } : {}), wijzigingen, bijgewerkt: serverTimestamp(),
      }, { merge: true });
      toast({ bericht: melding, type: 'success' });
    } catch (e) {
      toast({ bericht: `Fout: ${e.message}`, type: 'error' });
      throw e;
    }
  }

  // Gebruik tarieftypes uit configCache; lege lijst → toon waarschuwing.
  const lesgevertypes = configCache?.lesgeverTypes || [];

  return (
    <>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 16px' }}>
        Stel hier de uurlonen per lesgever-type en de kilometervergoeding in. Een wijziging krijgt een
        ingangsdatum: afrekeningen van vóór die datum blijven met het oude tarief rekenen.
      </p>

      <div style={S.wrap}>
        <div style={S.sectie}>💶 Uurloon per lesgever-type</div>
        {lesgevertypes.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Geen lesgever-types geconfigureerd — voeg ze eerst toe via "Lesgever-types".
          </div>
        ) : lesgevertypes.map(type => (
          <TariefBlok key={type.id} label={type.label} eenheid="/uur" veld="bedragPerUur"
            tariefDoc={tarieven[type.code]}
            onOpslaan={(start, lijst) => slaOp(type.code, { type: type.code }, 'bedragPerUur', start, lijst, 'Tarief opgeslagen')} />
        ))}
      </div>

      <div style={S.wrap}>
        <div style={S.sectie}>🚗 Kilometervergoeding</div>
        <TariefBlok label="Per km" eenheid="/km" veld="bedragPerKm" tariefDoc={tarieven['kilometer']}
          onOpslaan={(start, lijst) => slaOp('kilometer', { type: 'kilometer' }, 'bedragPerKm', start, lijst, 'Km-vergoeding opgeslagen')} />
        <div style={S.hint}>Gebruikt voor terugbetaling bij wedstrijdbegeleiding. Geldt op de datum van de wedstrijd.</div>
      </div>
    </>
  );
}
