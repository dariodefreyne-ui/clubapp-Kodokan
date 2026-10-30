import React, { useState } from 'react';
import { laadNaamSyncBronnen, schrijfPatches } from '../../services/naamSyncService';
import { planNaamSync, valideerPatches, CATEGORIEEN } from '../../utils/naamSync';
import { useToast } from '../ui/Toast.jsx';

// Beheerder-only. Stappen: 1) controleren (schrijft niets) 2) back-up downloaden
// 3) toepassen. Terugzetten kan met de back-up (JSON).

const st = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 12px', overflowY: 'auto' },
  modal: { background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)', width: '100%', maxWidth: '640px', padding: '20px' },
  info: { background: 'rgba(41,128,185,0.1)', border: '1px solid rgba(41,128,185,0.3)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '13px', color: '#2980b9', marginBottom: '12px' },
  warn: { background: 'rgba(243,156,18,0.1)', border: '1px solid rgba(243,156,18,0.35)', borderRadius: 'var(--radius-md)', padding: '10px 12px', fontSize: '13px', color: '#e67e22', marginBottom: '12px' },
  rij: { display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--border-color)', fontSize: '14px' },
  voorb: { fontSize: '12px', color: 'var(--text-secondary)', padding: '3px 0', wordBreak: 'break-word' },
  btn: { padding: '8px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', cursor: 'pointer', minHeight: '40px' },
  btnPrimary: { padding: '8px 18px', background: 'var(--accent-red)', border: 'none', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', fontWeight: 600, cursor: 'pointer', minHeight: '40px' },
};

function downloadJson(inhoud, naam) {
  const blob = new Blob([JSON.stringify(inhoud, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = naam; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function NaamSyncModal({ onClose, onKlaar }) {
  const toast = useToast();
  const [plan, setPlan] = useState(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState('');
  const [voortgang, setVoortgang] = useState('');
  const [backupGedaan, setBackupGedaan] = useState(false);
  const [klaar, setKlaar] = useState(false);

  async function controleer() {
    setBezig(true); setFout(''); setBackupGedaan(false); setKlaar(false);
    try {
      const bronnen = await laadNaamSyncBronnen();
      setPlan(planNaamSync(bronnen));
    } catch (e) {
      setFout('Laden mislukt: ' + (e?.message || 'onbekende fout'));
    } finally { setBezig(false); }
  }

  function maakBackup() {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadJson(plan.wijzigingen.map(w => ({ path: w.path, voor: w.voor })), `naam-backup-${stamp}.json`);
    setBackupGedaan(true);
  }

  async function pasToe() {
    if (!window.confirm(`${plan.wijzigingen.length} documenten bijwerken? Dit kan met de back-up teruggezet worden.`)) return;
    setBezig(true); setFout('');
    try {
      await schrijfPatches(plan.wijzigingen, (n, t) => setVoortgang(`${n} / ${t}`));
      setKlaar(true);
      toast({ bericht: `${plan.wijzigingen.length} namen gesynchroniseerd`, type: 'success' });
      if (onKlaar) onKlaar();
    } catch (e) {
      setFout('Schrijven onderbroken: ' + (e?.message || 'onbekende fout') + '. Voer "Controleren" opnieuw uit; reeds geschreven documenten worden overgeslagen.');
    } finally { setBezig(false); setVoortgang(''); }
  }

  async function zetTerug(e) {
    const bestand = e.target.files?.[0];
    e.target.value = '';
    if (!bestand) return;
    try {
      const items = JSON.parse(await bestand.text());
      const probleem = valideerPatches(items);
      if (probleem) { setFout(probleem); return; }
      if (!window.confirm(`${items.length} documenten terugzetten naar de waarden uit de back-up?`)) return;
      setBezig(true); setFout('');
      await schrijfPatches(items.map(i => ({ path: i.path, patch: i.voor })), (n, t) => setVoortgang(`${n} / ${t}`));
      toast({ bericht: `${items.length} documenten teruggezet`, type: 'success' });
      setPlan(null);
      if (onKlaar) onKlaar();
    } catch (err) {
      setFout('Terugzetten mislukt: ' + (err?.message || 'ongeldig bestand'));
    } finally { setBezig(false); setVoortgang(''); }
  }

  return (
    <div style={st.overlay} onClick={e => { if (e.target === e.currentTarget && !bezig) onClose(); }}>
      <div style={st.modal}>
        <h2 style={{ margin: '0 0 12px', fontSize: '18px', color: 'var(--text-primary)' }}>Namen synchroniseren</h2>
        <div style={st.info}>
          Zet de naam in leden, wedstrijd-inschrijvingen, examenkandidaten en evenement-registraties om naar
          "Voornaam Achternaam". Enkel records gekoppeld aan een gesplitst lid, waarvan de woorden identiek zijn
          (alleen de volgorde verschilt). Andere namen blijven ongemoeid. Eerst controleren schrijft niets.
        </div>

        {fout && <div style={st.warn}>{fout}</div>}

        {!plan && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button style={st.btnPrimary} onClick={controleer} disabled={bezig}>{bezig ? 'Bezig…' : 'Controleren (schrijft niets)'}</button>
            <label style={{ ...st.btn, display: 'inline-flex', alignItems: 'center' }}>
              Terugzetten uit back-up…
              <input type="file" accept="application/json,.json" onChange={zetTerug} disabled={bezig} style={{ display: 'none' }} />
            </label>
          </div>
        )}

        {plan && (
          <>
            {Object.entries(CATEGORIEEN).map(([k, label]) => (
              <div key={k} style={st.rij}><span>{label}</span><strong>{plan.telling[k]}</strong></div>
            ))}
            <div style={st.rij}><span>Overgeslagen (afwijkende naam)</span><strong>{plan.overgeslagen.length}</strong></div>

            {plan.wijzigingen.length > 0 && (
              <div style={{ margin: '12px 0' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Voorbeeld (eerste 15)</div>
                {plan.wijzigingen.slice(0, 15).map(w => (
                  <div key={w.path} style={st.voorb}>{w.oud} → <strong>{w.nieuw}</strong></div>
                ))}
              </div>
            )}
            {plan.overgeslagen.length > 0 && (
              <div style={{ margin: '12px 0' }}>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Overgeslagen, controleer manueel (eerste 10)</div>
                {plan.overgeslagen.slice(0, 10).map(o => (
                  <div key={o.path} style={st.voorb}>{o.oud} ≠ {o.lid}</div>
                ))}
              </div>
            )}

            {klaar ? (
              <div style={st.info}>Klaar. Voer "Opnieuw controleren" uit: het aantal wijzigingen moet 0 zijn.</div>
            ) : plan.wijzigingen.length === 0 ? (
              <div style={st.info}>Niets te synchroniseren.</div>
            ) : (
              <div style={st.warn}>Download eerst de back-up. Pas daarna kan je toepassen.</div>
            )}

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '14px' }}>
              <button style={st.btn} onClick={onClose} disabled={bezig}>Sluiten</button>
              <button style={st.btn} onClick={controleer} disabled={bezig}>Opnieuw controleren</button>
              {plan.wijzigingen.length > 0 && !klaar && (
                <>
                  <button style={st.btn} onClick={maakBackup} disabled={bezig}>{backupGedaan ? '✓ Back-up gedownload' : 'Back-up downloaden'}</button>
                  <button style={{ ...st.btnPrimary, opacity: bezig || !backupGedaan ? 0.5 : 1 }} onClick={pasToe} disabled={bezig || !backupGedaan}>
                    {bezig ? `Bezig… ${voortgang}` : `Toepassen (${plan.wijzigingen.length})`}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
