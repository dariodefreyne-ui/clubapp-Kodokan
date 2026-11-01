// src/components/trainingen/TechniekBeheerBlok.jsx
// Bewerkbare technieken-lijst voor de trainer-subpagina (TrainerModus).
// Toevoegen mag vrij. Aanpassen/verwijderen van een reeds opgeladen techniek
// vraagt dubbele bevestiging: eerst een pop-up met "was → wordt", dan een
// tweede, korte bevestiging — zodat een trainer die per ongeluk tikt op
// mobiel/iPad niet meteen een geplande techniek overschrijft of verwijdert.
// Enkel gebruikt binnen TrainerModus, gated op isTrainer (zie AuthContext:
// isTrainer = rol 'trainer' OF isBeheerder — assistenten vallen hier niet onder).
import React, { useState } from 'react';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { setMetAudit, updateMetAudit } from '../../services/firestoreService';
import { useConfirm } from '../../contexts/ConfirmContext';
import { useToast } from '../ui/Toast.jsx';
import { C } from './tokens';

const TECHNIEK_TYPES = ['Val', 'houdgreep', 'Verplaatsing', 'Worpen', 'Transitie'];
const FASES = ['basis', 'verdieping'];

const legeVorm = () => ({ techniekId: '', techniekNaam: '', basisvaardigheid: '', fase: 'basis', commentaar: '' });

// Eén bron voor de weergavenaam: databanknaam wint, anders de vrije naam.
// Zo staat techniekNaam altijd ingevuld (net als bij TrainingFormulier en de
// Excel-import) en blijven detailpanel, exports en badges correct.
function naamVanVorm(vorm, techniekDatabank) {
  if (vorm.techniekId) {
    return techniekDatabank.find(tk => tk.id === vorm.techniekId)?.techniek || vorm.techniekNaam || '';
  }
  return (vorm.techniekNaam || '').trim();
}

// Badges op het trainingsdocument (gebruikt door de kaarten in Beheer zonder
// extra reads). Valt terug op de databank voor oudere records zonder techniekNaam.
function badgesVan(lijst, techniekDatabank) {
  return lijst
    .map(t => ({ naam: t.techniekNaam || techniekDatabank.find(tk => tk.id === t.techniekId)?.techniek || '', fase: t.fase || 'basis' }))
    .filter(b => b.naam);
}

function techniekLabel(vorm, techniekDatabank) {
  if (vorm.techniekId) {
    const gevonden = techniekDatabank.find(tk => tk.id === vorm.techniekId);
    return gevonden?.techniek || '(onbekende techniek)';
  }
  return vorm.techniekNaam || '';
}

const lblStyle = { display: 'block', fontSize: '12px', color: C.textMuted, marginBottom: '4px' };
const inputStyle = {
  width: '100%', padding: '8px 10px', background: C.card, border: `1px solid ${C.borderSoft}`,
  borderRadius: '6px', color: C.textPrimary, fontSize: '13px', marginBottom: '10px', boxSizing: 'border-box',
};

function TechniekVormVelden({ vorm, setVorm, techniekDatabank }) {
  return (
    <>
      <label style={lblStyle}>Basisvaardigheid</label>
      <input
        type="text"
        value={vorm.basisvaardigheid}
        onChange={e => setVorm(v => ({ ...v, basisvaardigheid: e.target.value }))}
        placeholder="Bv. Buig-strek, Yoko-ukemi..."
        style={inputStyle}
      />

      <label style={lblStyle}>Techniek</label>
      <select
        value={vorm.techniekId}
        onChange={e => setVorm(v => ({ ...v, techniekId: e.target.value, techniekNaam: e.target.value ? '' : v.techniekNaam }))}
        style={{ ...inputStyle, color: vorm.techniekId ? C.textPrimary : C.textMuted }}
      >
        <option value="">— Kies techniek uit databank —</option>
        {TECHNIEK_TYPES.map(type => (
          <optgroup key={type} label={type}>
            {techniekDatabank.filter(tk => tk.type === type).map(tk => (
              <option key={tk.id} value={tk.id}>{tk.techniek}</option>
            ))}
          </optgroup>
        ))}
      </select>

      {!vorm.techniekId && (
        <input
          type="text"
          value={vorm.techniekNaam}
          onChange={e => setVorm(v => ({ ...v, techniekNaam: e.target.value }))}
          placeholder="Niet in databank? Vrij invullen (bv. omdraaitechniek)…"
          style={{ ...inputStyle, border: `1px solid ${C.orange}` }}
        />
      )}

      <label style={lblStyle}>Fase</label>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
        {FASES.map(fase => (
          <button
            key={fase}
            type="button"
            onClick={() => setVorm(v => ({ ...v, fase }))}
            style={{
              flex: 1, padding: '7px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '600',
              background: vorm.fase === fase ? (fase === 'basis' ? C.blueDim : C.redDim) : C.card,
              border: `1px solid ${vorm.fase === fase ? (fase === 'basis' ? C.blue : C.red) : C.border}`,
              color: vorm.fase === fase ? (fase === 'basis' ? C.blue : C.red) : C.textMuted,
            }}
          >
            {fase}
          </button>
        ))}
      </div>

      <label style={{ ...lblStyle, marginTop: '10px' }}>Getrainde punten / commentaar (optioneel)</label>
      <textarea
        value={vorm.commentaar || ''}
        onChange={e => setVorm(v => ({ ...v, commentaar: e.target.value }))}
        placeholder="Bv. focus op heupbeweging, grip aan de revers, tempo..."
        maxLength={500}
        rows={2}
        style={{ ...inputStyle, marginBottom: '4px', resize: 'vertical', fontFamily: 'inherit' }}
      />
    </>
  );
}

// Zelfde uitklap-paneel als het oorspronkelijke, read-only TechniekAccordeonItem
// (basisfase, verdieping, aandachtspunten, basisvoorwaarden, remediëring,
// oefenvormen uit de globale techniek-databank) — hier aangevuld met
// bewerken/verwijderen-knoppen die niet de uitklap triggeren.
function TechniekRij({ t, detail, onBewerken, onVerwijderen, onCommentaarOpslaan }) {
  const [open, setOpen] = useState(false);
  const [commentEdit, setCommentEdit] = useState(false);
  const [commentTekst, setCommentTekst] = useState('');
  const [commentBezig, setCommentBezig] = useState(false);
  const faseKleur = t.fase === 'basis' ? C.blue : t.fase === 'verdieping' ? C.red : C.textMuted;
  const faseBg = t.fase === 'basis' ? C.blueDim : t.fase === 'verdieping' ? C.redDim : '#2a2a2a';

  const secties = [];
  if (detail?.basisfase?.length) secties.push({ label: 'Basisfase', items: detail.basisfase, kleur: C.blue });
  if (detail?.verdieping?.length) secties.push({ label: 'Verdieping', items: detail.verdieping, kleur: C.red });
  if (detail?.aandachtspunten?.length) secties.push({ label: 'Aandachtspunten', items: detail.aandachtspunten, kleur: C.orange });
  if (detail?.basisvoorwaarden?.length) secties.push({ label: 'Basisvoorwaarden', items: detail.basisvoorwaarden, kleur: C.textMuted });
  if (detail?.remediering?.length) secties.push({ label: 'Remediering', items: detail.remediering, kleur: C.textMuted });
  if (detail?.oefenvormen?.length) secties.push({ label: 'Oefenvormen', items: detail.oefenvormen, kleur: C.green });

  const heeftDetails = secties.length > 0 || t.basisvaardigheid || t.commentaar;

  const startCommentaar = () => { setCommentTekst(t.commentaar || ''); setCommentEdit(true); };
  const bewaarCommentaar = async () => {
    setCommentBezig(true);
    const ok = await onCommentaarOpslaan(t, commentTekst);
    setCommentBezig(false);
    if (ok) setCommentEdit(false);
  };
  const actieKnop = { background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px', minWidth: '40px', minHeight: '40px' };

  return (
    <div style={{ background: C.bg, border: `1px solid ${open ? faseKleur : C.borderSoft}`, borderRadius: '10px', marginBottom: '10px', overflow: 'hidden', transition: 'border-color 0.15s' }}>
      <div
        onClick={() => heeftDetails && setOpen(v => !v)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', padding: '12px', cursor: heeftDetails ? 'pointer' : 'default' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px',
              background: faseBg, color: faseKleur, border: `1px solid ${faseKleur}`,
            }}
          >
            {t.fase || '—'}
          </span>
          <div style={{ fontSize: '14px', fontWeight: '700', color: C.textPrimary, marginTop: '6px' }}>
            {t.techniekNaam || detail?.techniek || '—'}
            {!t.techniekId && t.techniekNaam && (
              <span style={{ fontSize: '11px', color: C.orange, marginLeft: '8px', fontWeight: '400' }}>⚠ niet in databank</span>
            )}
          </div>
          {t.basisvaardigheid && !open && (
            <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>{t.basisvaardigheid}</div>
          )}
          {t.commentaar && !open && (
            <div style={{
              fontSize: '12px', color: C.textPrimary, marginTop: '6px', padding: '4px 8px',
              background: C.card, borderRadius: '6px', borderLeft: `3px solid ${C.orange}`,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
            }}>
              💬 {t.commentaar}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
          {heeftDetails && <span style={{ color: C.textMuted, fontSize: '12px', marginRight: '2px' }}>{open ? '▲' : '▼'}</span>}
          <button
            onClick={e => { e.stopPropagation(); startCommentaar(); }}
            aria-label={t.commentaar ? 'Commentaar bewerken' : 'Commentaar toevoegen'}
            title={t.commentaar ? 'Commentaar bewerken' : 'Wat hebben we specifiek getraind?'}
            style={{ ...actieKnop, color: t.commentaar ? C.orange : C.textMuted }}
          >
            💬
          </button>
          <button
            onClick={e => { e.stopPropagation(); onBewerken(); }}
            aria-label="Techniek bewerken"
            style={{ ...actieKnop, color: C.textSec }}
          >
            ✏️
          </button>
          <button
            onClick={e => { e.stopPropagation(); onVerwijderen(); }}
            aria-label="Techniek verwijderen"
            style={{ ...actieKnop, color: C.red }}
          >
            🗑
          </button>
        </div>
      </div>

      {commentEdit && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 12px' }}>
          <label style={lblStyle}>Getrainde punten / commentaar</label>
          <textarea
            value={commentTekst}
            onChange={e => setCommentTekst(e.target.value)}
            placeholder="Bv. focus op heupbeweging, grip aan de revers..."
            maxLength={500}
            rows={2}
            autoFocus
            style={{ ...inputStyle, marginBottom: '8px', resize: 'vertical', fontFamily: 'inherit' }}
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setCommentEdit(false)}
              style={{ flex: 1, padding: '9px', background: 'transparent', border: `1px solid ${C.borderSoft}`, borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '13px' }}
            >
              Annuleren
            </button>
            <button
              onClick={bewaarCommentaar}
              disabled={commentBezig}
              style={{ flex: 2, padding: '9px', background: C.red, border: 'none', borderRadius: '8px', color: C.btnPrimaryText, cursor: 'pointer', fontSize: '13px', fontWeight: '700', opacity: commentBezig ? 0.6 : 1 }}
            >
              {commentBezig ? 'Bezig...' : '✓ Opslaan'}
            </button>
          </div>
        </div>
      )}

      {open && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {t.commentaar && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: C.orange, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Getrainde punten</div>
              <div style={{ fontSize: '13px', color: C.textPrimary, whiteSpace: 'pre-wrap' }}>{t.commentaar}</div>
            </div>
          )}
          {t.basisvaardigheid && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>Basisvaardigheid</div>
              <div style={{ fontSize: '13px', color: C.textSec }}>{t.basisvaardigheid}</div>
            </div>
          )}
          {secties.map(sectie => (
            <div key={sectie.label}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: sectie.kleur, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '4px' }}>{sectie.label}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {sectie.items.map((item, i) => (
                  <div key={i} style={{ fontSize: '12px', color: C.textSec, padding: '4px 8px', background: C.card, borderRadius: '6px', borderLeft: `3px solid ${sectie.kleur}` }}>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function diffRegel(label, van, naar) {
  if ((van || '') === (naar || '')) return null;
  return (
    <div key={label} style={{ marginBottom: '6px' }}>
      <span style={{ fontWeight: '700' }}>{label}: </span>
      <span style={{ textDecoration: 'line-through', opacity: 0.6 }}>{van || '—'}</span>
      {' → '}
      <span style={{ fontWeight: '700' }}>{naar || '—'}</span>
    </div>
  );
}

export default function TechniekBeheerBlok({ trainingId, technieken, techniekDatabank }) {
  const confirm = useConfirm();
  const toast = useToast();
  const [nieuwOpen, setNieuwOpen] = useState(false);
  const [nieuwVorm, setNieuwVorm] = useState(legeVorm());
  const [nieuwBezig, setNieuwBezig] = useState(false);
  const [bewerkId, setBewerkId] = useState(null);
  const [bewerkVorm, setBewerkVorm] = useState(legeVorm());
  const [bezigId, setBezigId] = useState(null);

  // Houdt techniekBadges op de training in sync, zodat de kaarten in Beheer
  // dezelfde technieken tonen. Mislukken blokkeert de gebruikersactie niet.
  async function syncBadges(lijst) {
    try {
      await updateMetAudit(doc(db, 'trainingen', trainingId), { techniekBadges: badgesVan(lijst, techniekDatabank) });
    } catch (e) {
      console.warn('techniekBadges synchroniseren mislukt:', e);
    }
  }

  async function opslaanCommentaar(t, tekst) {
    try {
      await setMetAudit(doc(db, 'trainingen', trainingId, 'technieken', t.id), { commentaar: (tekst || '').trim() });
      toast({ bericht: 'Commentaar opgeslagen', type: 'success' });
      return true;
    } catch (e) {
      toast({ bericht: `Opslaan mislukt: ${e.message}`, type: 'error' });
      return false;
    }
  }

  async function toevoegen() {
    if (!nieuwVorm.techniekId && !nieuwVorm.techniekNaam.trim() && !nieuwVorm.basisvaardigheid.trim()) {
      toast({ bericht: 'Vul minstens een techniek of basisvaardigheid in', type: 'error' });
      return;
    }
    setNieuwBezig(true);
    try {
      const ref = doc(collection(db, 'trainingen', trainingId, 'technieken'));
      const nieuw = {
        techniekId: nieuwVorm.techniekId,
        techniekNaam: naamVanVorm(nieuwVorm, techniekDatabank),
        basisvaardigheid: nieuwVorm.basisvaardigheid.trim(),
        fase: nieuwVorm.fase,
        commentaar: (nieuwVorm.commentaar || '').trim(),
        // max+1 i.p.v. length: blijft uniek na verwijderingen
        volgorde: technieken.reduce((m, x) => Math.max(m, (x.volgorde ?? -1) + 1), 0),
      };
      await setMetAudit(ref, nieuw);
      await syncBadges([...technieken, { id: ref.id, ...nieuw }]);
      toast({ bericht: 'Techniek toegevoegd', type: 'success' });
      setNieuwVorm(legeVorm());
      setNieuwOpen(false);
    } catch (e) {
      toast({ bericht: `Toevoegen mislukt: ${e.message}`, type: 'error' });
    }
    setNieuwBezig(false);
  }

  function startBewerken(t) {
    setBewerkId(t.id);
    setBewerkVorm({
      techniekId: t.techniekId || '',
      techniekNaam: t.techniekNaam || '',
      basisvaardigheid: t.basisvaardigheid || '',
      fase: t.fase || 'basis',
      commentaar: t.commentaar || '',
    });
  }

  async function bevestigBewerken(t) {
    const oudLabel = techniekLabel(t, techniekDatabank);
    const nieuwLabel = techniekLabel(bewerkVorm, techniekDatabank);
    const verschillen = [
      diffRegel('Techniek', oudLabel, nieuwLabel),
      diffRegel('Basisvaardigheid', t.basisvaardigheid || '', bewerkVorm.basisvaardigheid || ''),
      diffRegel('Fase', t.fase || 'basis', bewerkVorm.fase || 'basis'),
    ].filter(Boolean);

    const commentaarGewijzigd = (t.commentaar || '').trim() !== (bewerkVorm.commentaar || '').trim();
    if (verschillen.length === 0 && !commentaarGewijzigd) { setBewerkId(null); return; }

    // Enkel een commentaar wijzigen overschrijft niets uit de planning:
    // geen dubbele bevestiging nodig.
    const ok1 = verschillen.length === 0 ? true : await confirm({
      titel: 'Techniek aanpassen?',
      beschrijving: <div>{verschillen}</div>,
      bevestigLabel: 'Ja, aanpassen',
      variant: 'danger',
    });
    if (!ok1) return;

    const ok2 = verschillen.length === 0 ? true : await confirm({
      titel: 'Zeker weten?',
      beschrijving: 'Dit overschrijft wat eerder voor deze training gepland stond.',
      bevestigLabel: 'Ja, definitief opslaan',
      variant: 'danger',
    });
    if (!ok2) return;

    setBezigId(t.id);
    try {
      const gewijzigd = {
        techniekId: bewerkVorm.techniekId,
        techniekNaam: naamVanVorm(bewerkVorm, techniekDatabank),
        basisvaardigheid: bewerkVorm.basisvaardigheid.trim(),
        fase: bewerkVorm.fase,
        commentaar: (bewerkVorm.commentaar || '').trim(),
      };
      await setMetAudit(doc(db, 'trainingen', trainingId, 'technieken', t.id), gewijzigd);
      await syncBadges(technieken.map(x => (x.id === t.id ? { ...x, ...gewijzigd } : x)));
      toast({ bericht: 'Techniek aangepast', type: 'success' });
      setBewerkId(null);
    } catch (e) {
      toast({ bericht: `Aanpassen mislukt: ${e.message}`, type: 'error' });
    }
    setBezigId(null);
  }

  async function verwijderen(t) {
    const label = techniekLabel(t, techniekDatabank) || '(naamloze techniek)';
    const ok1 = await confirm({
      titel: 'Techniek verwijderen?',
      beschrijving: `"${label}"${t.basisvaardigheid ? ` (${t.basisvaardigheid})` : ''} wordt uit deze training verwijderd.`,
      bevestigLabel: 'Ja, verwijderen',
      variant: 'danger',
    });
    if (!ok1) return;

    const ok2 = await confirm({
      titel: 'Zeker weten?',
      beschrijving: 'Deze techniek wordt definitief uit de planning van deze training gehaald.',
      bevestigLabel: 'Ja, definitief verwijderen',
      variant: 'danger',
    });
    if (!ok2) return;

    setBezigId(t.id);
    try {
      await deleteDoc(doc(db, 'trainingen', trainingId, 'technieken', t.id));
      await syncBadges(technieken.filter(x => x.id !== t.id));
      toast({ bericht: 'Techniek verwijderd', type: 'success' });
    } catch (e) {
      toast({ bericht: `Verwijderen mislukt: ${e.message}`, type: 'error' });
    }
    setBezigId(null);
  }

  return (
    <div>
      <button
        onClick={() => setNieuwOpen(v => !v)}
        style={{
          display: 'block', marginBottom: '10px', background: C.redDim, border: `1px solid ${C.red}`,
          color: C.red, padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
        }}
      >
        {nieuwOpen ? '✕ Annuleren' : '+ Techniek toevoegen'}
      </button>

      {nieuwOpen && (
        <div style={{ background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
          <TechniekVormVelden vorm={nieuwVorm} setVorm={setNieuwVorm} techniekDatabank={techniekDatabank} />
          <button
            onClick={toevoegen}
            disabled={nieuwBezig}
            style={{
              width: '100%', padding: '10px', background: C.red, border: 'none', borderRadius: '8px',
              color: C.btnPrimaryText, cursor: 'pointer', fontSize: '13px', fontWeight: '700', opacity: nieuwBezig ? 0.6 : 1,
            }}
          >
            {nieuwBezig ? 'Bezig...' : '✓ Toevoegen'}
          </button>
        </div>
      )}

      {technieken.length === 0 && !nieuwOpen && (
        <div style={{ color: C.textMuted, fontSize: '13px', marginBottom: '8px' }}>Geen technieken ingepland.</div>
      )}

      {technieken.map(t => {
        const inBewerking = bewerkId === t.id;
        const detail = techniekDatabank.find(tk => tk.id === t.techniekId);

        if (inBewerking) {
          return (
            <div key={t.id} style={{ background: C.bg, border: `1px solid ${C.borderSoft}`, borderRadius: '10px', padding: '12px', marginBottom: '10px' }}>
              <TechniekVormVelden vorm={bewerkVorm} setVorm={setBewerkVorm} techniekDatabank={techniekDatabank} />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setBewerkId(null)}
                  style={{
                    flex: 1, padding: '9px', background: 'transparent', border: `1px solid ${C.borderSoft}`,
                    borderRadius: '8px', color: C.textSec, cursor: 'pointer', fontSize: '13px',
                  }}
                >
                  Annuleren
                </button>
                <button
                  onClick={() => bevestigBewerken(t)}
                  disabled={bezigId === t.id}
                  style={{
                    flex: 2, padding: '9px', background: C.red, border: 'none', borderRadius: '8px',
                    color: C.btnPrimaryText, cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                    opacity: bezigId === t.id ? 0.6 : 1,
                  }}
                >
                  {bezigId === t.id ? 'Bezig...' : '✓ Wijziging opslaan'}
                </button>
              </div>
            </div>
          );
        }

        return (
          <TechniekRij
            key={t.id}
            t={t}
            detail={detail}
            onBewerken={() => startBewerken(t)}
            onVerwijderen={() => verwijderen(t)}
            onCommentaarOpslaan={opslaanCommentaar}
          />
        );
      })}
    </div>
  );
}
