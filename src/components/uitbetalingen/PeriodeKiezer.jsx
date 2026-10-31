// ─── PeriodeKiezer ─────────────────────────────────────────────────────────────
// Eén compact blok: begin- en eindmaand vrij kiezen + snelknoppen + opgeslagen periodes.
// Geen Firestore-toegang: de keuze wordt via onKies aan de pagina doorgegeven.
import React, { useMemo } from 'react';
import { C } from '../trainingen/tokens';
import {
  huidigeMaandKey, maandSleutels, maandLabel, periodeVanMaanden, isMaandBereik,
  aantalMaanden, periodeVanSnelknop, formatDagMetJaar,
} from './uitbetalingHelpers';

const LABEL = { fontSize: '11px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.6px', marginBottom: '6px' };
const SELECT = {
  width: '100%', minHeight: '44px', padding: '9px 12px', background: C.card, border: `1px solid ${C.border}`,
  borderRadius: '8px', color: C.textPrimary, fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit',
};
const chip = (actief) => ({
  minHeight: '36px', padding: '7px 14px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
  background: actief ? C.red : C.card, border: `1px solid ${actief ? C.red : C.border}`,
  color: actief ? 'white' : C.textSec, fontFamily: 'inherit',
});

export default function PeriodeKiezer({ actief, opgeslagen = [], onKies }) {
  const vanKey = actief?.van?.slice(0, 7) || '';
  const totKey = actief?.tot?.slice(0, 7) || '';
  const maandBereik = isMaandBereik(actief);

  // Laatste 24 maanden t/m 12 maanden vooruit (ook augustus/juli, ongeacht het seizoen;
  // zo reikt 'Dit seizoen' ook tot juni), uitgebreid als de actieve periode daarbuiten valt.
  // Recentste/toekomstigste bovenaan.
  const opties = useMemo(() => {
    const start = [huidigeMaandKey(-24), vanKey].filter(Boolean).sort()[0];
    const eind  = [huidigeMaandKey(12), totKey].filter(Boolean).sort().slice(-1)[0];
    return maandSleutels(start, eind).reverse().map(k => ({ key: k, label: maandLabel(k) }));
  }, [vanKey, totKey]);

  const wijzigVan = (v) => onKies(periodeVanMaanden(v, totKey && totKey >= v ? totKey : v));
  const wijzigTot = (t) => onKies(periodeVanMaanden(vanKey && vanKey <= t ? vanKey : t, t));

  return (
    <div style={{ marginBottom: '20px' }}>
      <div style={LABEL}>Periode</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', maxWidth: '520px' }}>
        <label>
          <span style={{ display: 'block', fontSize: '12px', color: C.textSec, marginBottom: '4px' }}>Van maand</span>
          <select value={maandBereik ? vanKey : ''} onChange={e => wijzigVan(e.target.value)} style={SELECT}>
            {!maandBereik && <option value="" disabled>Aangepast</option>}
            {opties.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
        <label>
          <span style={{ display: 'block', fontSize: '12px', color: C.textSec, marginBottom: '4px' }}>Tot en met maand</span>
          <select value={maandBereik ? totKey : ''} onChange={e => wijzigTot(e.target.value)} style={SELECT}>
            {!maandBereik && <option value="" disabled>Aangepast</option>}
            {opties.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
      </div>

      {actief && (
        <div style={{ marginTop: '8px', fontSize: '13px', color: C.textSec }}>
          <strong style={{ color: C.textPrimary }}>{formatDagMetJaar(actief.van)} – {formatDagMetJaar(actief.tot)}</strong>
          {maandBereik && <span> · {aantalMaanden(actief)} maand{aantalMaanden(actief) !== 1 ? 'en' : ''}</span>}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
        {['deze-maand', 'vorige-maand', 'dit-seizoen'].map(type => {
          const p = periodeVanSnelknop(type);
          const isActief = !!actief && !actief.id && actief.van === p.van && actief.tot === p.tot;
          return <button key={type} onClick={() => onKies(p)} style={chip(isActief)}>{p.naam}</button>;
        })}
        {opgeslagen.map(p => (
          <button key={p.id} onClick={() => onKies(p)} style={chip(actief?.id === p.id)} title="Opgeslagen periode">📌 {p.naam}</button>
        ))}
      </div>
    </div>
  );
}
