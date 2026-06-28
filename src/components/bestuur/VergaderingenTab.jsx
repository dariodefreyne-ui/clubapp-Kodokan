// src/components/bestuur/VergaderingenTab.jsx
// Tab "Vergaderingen" — live-vergadering-modus, agenda-notulen, actiepunten, verslagen.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../firebase';
import {
  addBestuursVergadering, updateBestuursVergadering, deleteBestuursVergadering,
  addBestuursActiepunt,
} from '../../services/firestoreService';
import { C } from '../../styles/tokens';
import {
  VERGADERING_TYPES, AANWEZIG_OPTIES, DOC_CATS, VERG_STATUS_KLEUR, VERG_STATUS_LABEL, LEGE_VERGADERING,
  S, vandaagISO, formatDatum, formatSize, fileEmoji, getAgendaPunten, genereerVerslagTekst,
  SectieTitel, Blok, ActiepuntRij,
} from './shared.jsx';

export default function VergaderingenTab({ vergaderingen, loading, actiepunten, documenten, bestuursleden, confirm }) {
  const [openId, setOpenId] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(LEGE_VERGADERING);

  function openNieuw() {
    setForm({ ...LEGE_VERGADERING, datum: vandaagISO() });
    setModal('nieuw');
  }
  function openEdit(v) {
    setForm({
      titel: v.titel || '', type: v.type || 'bestuur', datum: v.datum || '',
      tijdVan: v.tijdVan || '', tijdTot: v.tijdTot || '', locatie: v.locatie || '',
      herinneringDagen: v.herinneringDagen ?? 3,
      agendaTekst: (v.agenda || []).join('\n'),
      besluitenTekst: (v.besluiten || []).join('\n'),
    });
    setModal(v);
  }

  async function bewaar() {
    if (!form.titel.trim() || !form.datum) return;
    const agendaLijst = form.agendaTekst.split('\n').map(s => s.trim()).filter(Boolean);
    const bestaandeAP = modal === 'nieuw' ? [] : (modal.agendaPunten || []);
    const agendaPunten = agendaLijst.map(tekst => {
      const gevonden = bestaandeAP.find(p => p.tekst === tekst);
      return gevonden || { tekst, notities: '', behandeld: false, discussiepunten: [] };
    });
    const data = {
      titel: form.titel.trim(), type: form.type, datum: form.datum,
      tijdVan: form.tijdVan, tijdTot: form.tijdTot, locatie: form.locatie.trim(),
      herinneringDagen: Number(form.herinneringDagen) || 0,
      agenda: agendaLijst, agendaPunten,
      besluiten: form.besluitenTekst.split('\n').map(s => s.trim()).filter(Boolean),
    };
    if (modal === 'nieuw') {
      await addBestuursVergadering({ ...data, status: 'gepland', herinneringVerstuurd: false });
    } else {
      if (modal.datum !== data.datum) data.herinneringVerstuurd = false;
      await updateBestuursVergadering(modal.id, data);
    }
    setModal(null);
  }

  async function verwijder(v) {
    const ok = await confirm({ titel: 'Vergadering verwijderen?', beschrijving: `"${v.titel}" en bijhorende gegevens worden verwijderd.`, bevestigLabel: 'Verwijderen', variant: 'danger' });
    if (!ok) return;
    await deleteBestuursVergadering(v.id);
  }

  if (loading) return <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>Laden…</div>;

  const nu = vandaagISO();
  const live    = vergaderingen.filter(v => v.status === 'bezig');
  // Wees inclusief: vergaderingen met een onbekende/ontbrekende status vallen
  // in 'komend' of 'verleden' op basis van de datum, niet verloren.
  const komend  = vergaderingen.filter(v => v.status !== 'bezig' && v.status !== 'afgerond' && (v.datum || '') >= nu);
  const verleden = vergaderingen.filter(v => v.status !== 'bezig' && (v.status === 'afgerond' || (v.datum || '') < nu));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button style={S.btn('primary')} onClick={openNieuw}>+ Nieuwe vergadering</button>
      </div>

      {vergaderingen.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px' }}>Nog geen vergaderingen ingepland.</div>
      )}

      {live.length > 0 && <SectieTitel accent>🔴 Live vergadering</SectieTitel>}
      {live.map(v => (
        <VergaderingKaart key={v.id} v={v} open={openId === v.id} onToggle={() => setOpenId(openId === v.id ? null : v.id)}
          onEdit={() => openEdit(v)} onDelete={() => verwijder(v)} actiepunten={actiepunten} documenten={documenten} bestuursleden={bestuursleden} confirm={confirm} />
      ))}

      {komend.length > 0 && <SectieTitel>Komende vergaderingen</SectieTitel>}
      {komend.map(v => (
        <VergaderingKaart key={v.id} v={v} open={openId === v.id} onToggle={() => setOpenId(openId === v.id ? null : v.id)}
          onEdit={() => openEdit(v)} onDelete={() => verwijder(v)} actiepunten={actiepunten} documenten={documenten} bestuursleden={bestuursleden} confirm={confirm} />
      ))}

      {verleden.length > 0 && <SectieTitel>Afgelopen vergaderingen</SectieTitel>}
      {verleden.map(v => (
        <VergaderingKaart key={v.id} v={v} open={openId === v.id} onToggle={() => setOpenId(openId === v.id ? null : v.id)}
          onEdit={() => openEdit(v)} onDelete={() => verwijder(v)} actiepunten={actiepunten} documenten={documenten} bestuursleden={bestuursleden} confirm={confirm} />
      ))}

      {modal && (
        <div style={S.modal} onClick={() => setModal(null)} onKeyDown={e => e.key === 'Escape' && setModal(null)}>
          <div style={S.modalCard} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="vergadering-modal-titel">
            <h3 style={{ marginTop: 0 }} id="vergadering-modal-titel">{modal === 'nieuw' ? 'Nieuwe vergadering' : 'Vergadering bewerken'}</h3>
            <label style={S.label}>Titel *</label>
            <input style={S.input} value={form.titel} onChange={e => setForm(f => ({ ...f, titel: e.target.value }))} placeholder="Bv. Bestuursvergadering juni" />
            <label style={S.label}>Type</label>
            <select style={S.input} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {Object.entries(VERGADERING_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ flex: '2 1 140px' }}>
                <label style={S.label}>Datum *</label>
                <input type="date" style={S.input} value={form.datum} onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} />
              </div>
              <div style={{ flex: '1 1 90px', minWidth: '90px' }}>
                <label style={S.label}>Van</label>
                <input type="time" style={S.input} value={form.tijdVan} onChange={e => setForm(f => ({ ...f, tijdVan: e.target.value }))} />
              </div>
              <div style={{ flex: '1 1 90px', minWidth: '90px' }}>
                <label style={S.label}>Tot</label>
                <input type="time" style={S.input} value={form.tijdTot} onChange={e => setForm(f => ({ ...f, tijdTot: e.target.value }))} />
              </div>
            </div>
            <label style={S.label}>Locatie</label>
            <input style={S.input} value={form.locatie} onChange={e => setForm(f => ({ ...f, locatie: e.target.value }))} placeholder="Bv. Clubhuis / online" />
            <label style={S.label}>Herinnering (dagen vooraf — push + e-mail naar bestuur)</label>
            <input type="number" min="0" max="30" style={S.input} value={form.herinneringDagen} onChange={e => setForm(f => ({ ...f, herinneringDagen: e.target.value }))} />
            <label style={S.label}>Agenda (één punt per lijn)</label>
            <textarea style={{ ...S.input, minHeight: '90px', resize: 'vertical' }} value={form.agendaTekst} onChange={e => setForm(f => ({ ...f, agendaTekst: e.target.value }))} placeholder={'Goedkeuring vorig verslag\nFinancieel overzicht\nVaria'} />
            <label style={S.label}>Besluiten (één per lijn — kan ook achteraf)</label>
            <textarea style={{ ...S.input, minHeight: '70px', resize: 'vertical' }} value={form.besluitenTekst} onChange={e => setForm(f => ({ ...f, besluitenTekst: e.target.value }))} placeholder="Genomen beslissingen…" />
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button style={{ ...S.btn('primary'), flex: 1 }} onClick={bewaar} disabled={!form.titel.trim() || !form.datum}>Bewaren</button>
              <button style={S.btn('ghost')} onClick={() => setModal(null)}>Annuleren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── VERGADERING KAART ─────────────────────────────────────────────────────────
function VergaderingKaart({ v, open, onToggle, onEdit, onDelete, actiepunten, documenten, bestuursleden, confirm }) {
  const eigenActies = actiepunten.filter(a => a.vergaderingId === v.id);
  const openActies = eigenActies.filter(a => a.status !== 'afgerond').length;
  const gekoppeldeDocs = (documenten || []).filter(d => d.vergaderingId === v.id);
  const totaalVerslagen = (v.verslagen || []).length + gekoppeldeDocs.length;
  const isLive = v.status === 'bezig';
  const statusKleur = VERG_STATUS_KLEUR[v.status] || C.blue;
  const statusLabel = VERG_STATUS_LABEL[v.status] || v.status;
  const agendaAantal = (v.agendaPunten || v.agenda || []).length;

  async function startVergadering() {
    await updateBestuursVergadering(v.id, { status: 'bezig', startTijdstip: new Date().toISOString() });
  }
  async function beeindigVergadering() {
    await updateBestuursVergadering(v.id, { status: 'afgerond', eindTijdstip: new Date().toISOString() });
  }
  async function heropenen() {
    await updateBestuursVergadering(v.id, { status: 'gepland' });
  }

  return (
    <div style={{ ...S.card, border: isLive ? `2px solid ${C.red}` : `1px solid ${C.border}` }}>
      {isLive && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', padding: '7px 12px', background: `${C.red}15`, borderRadius: '8px' }}>
          <span style={{ color: C.red, fontWeight: '800', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>🔴 Live vergadering</span>
          {v.startTijdstip && <LiveTimer startTijdstip={v.startTijdstip} />}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }} onClick={onToggle} role="button" tabIndex={0} onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && onToggle()}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: '700', fontSize: '15px' }}>{v.titel}</span>
            <span style={S.badge(statusKleur)}>{statusLabel}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{VERGADERING_TYPES[v.type] || v.type}</span>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            📅 {formatDatum(v.datum)}{v.tijdVan ? ` · ${v.tijdVan}${v.tijdTot ? '–' + v.tijdTot : ''}` : ''}{v.locatie ? ` · 📍 ${v.locatie}` : ''}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {agendaAantal > 0 && <span>📋 {agendaAantal} agendapunt{agendaAantal === 1 ? '' : 'en'}</span>}
            {totaalVerslagen > 0 && <span>📄 {totaalVerslagen} verslag{totaalVerslagen === 1 ? '' : 'en'}</span>}
            {openActies > 0 && <span style={{ color: C.orange }}>✅ {openActies} open actiepunt{openActies === 1 ? '' : 'en'}</span>}
          </div>
        </div>
        <span style={{ color: 'var(--text-secondary)' }}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div style={{ marginTop: '14px', borderTop: `1px solid ${C.border}`, paddingTop: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
            <button style={S.btn('ghost')} onClick={onEdit}>✏️ Bewerken</button>
            {v.status === 'gepland' && (
              <button style={{ ...S.btn('ghost'), color: C.red, border: `1px solid ${C.red}` }} onClick={startVergadering}>
                ▶️ Start vergadering
              </button>
            )}
            {v.status === 'bezig' && (
              <button style={{ ...S.btn('ghost'), color: C.green, border: `1px solid ${C.green}` }} onClick={beeindigVergadering}>
                ⏹ Beëindig vergadering
              </button>
            )}
            {v.status === 'afgerond' && (
              <button style={S.btn('ghost')} onClick={heropenen}>↩️ Heropenen</button>
            )}
            <button style={{ ...S.btn('ghost'), color: C.red }} onClick={onDelete}>🗑 Verwijderen</button>
          </div>

          <AgendaPuntenBlok v={v} />
          <AanwezigheidBlok v={v} bestuursleden={bestuursleden} />
          <NotulenBlok v={v} />

          {(v.besluiten || []).length > 0 && (
            <Blok titel="Besluiten">
              <ul style={{ margin: 0, paddingLeft: '20px', color: 'var(--text-primary)', fontSize: '14px' }}>
                {v.besluiten.map((b, i) => <li key={i} style={{ marginBottom: '3px' }}>{b}</li>)}
              </ul>
            </Blok>
          )}

          <ActiepuntenBlok v={v} eigenActies={eigenActies} confirm={confirm} />
          <VerslagenBlok v={v} gekoppeldeDocs={gekoppeldeDocs} eigenActies={eigenActies} confirm={confirm} />
        </div>
      )}
    </div>
  );
}

// ─── LIVE TIMER ────────────────────────────────────────────────────────────────
function LiveTimer({ startTijdstip }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const start = new Date(startTijdstip).getTime();
    setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    const iv = setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000))), 1000);
    return () => clearInterval(iv);
  }, [startTijdstip]);
  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;
  return (
    <span style={{ fontFamily: 'monospace', fontSize: '13px', color: C.red, marginLeft: 'auto', fontWeight: '700' }}>
      {h > 0 ? `${h}:` : ''}{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  );
}

// ─── AGENDA PUNTEN BLOK ───────────────────────────────────────────────────────
function AgendaPuntenBlok({ v }) {
  const [localPunten, setLocalPunten] = useState(() => getAgendaPunten(v));
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [nieuwPunt, setNieuwPunt] = useState({});
  const saveTimerRef = useRef(null);

  // Sync when vergadering or agenda changes (agenda text modified from modal)
  useEffect(() => {
    const nieuw = getAgendaPunten(v);
    const huidig = localPunten;
    const teksGewijzigd = nieuw.length !== huidig.length || nieuw.some((p, i) => p.tekst !== huidig[i]?.tekst);
    if (teksGewijzigd) setLocalPunten(nieuw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.agenda, v.agendaPunten]);

  function slaOp(punten) {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      updateBestuursVergadering(v.id, { agendaPunten: punten }).catch(() => {});
    }, 600);
  }

  function zetBehandeld(i, val) {
    const nieuw = localPunten.map((p, j) => j === i ? { ...p, behandeld: val } : p);
    setLocalPunten(nieuw);
    updateBestuursVergadering(v.id, { agendaPunten: nieuw }).catch(() => {});
  }

  function zetNotities(i, tekst) {
    const nieuw = localPunten.map((p, j) => j === i ? { ...p, notities: tekst } : p);
    setLocalPunten(nieuw);
    slaOp(nieuw);
  }

  function voegDiscussieToe(i) {
    const tekst = (nieuwPunt[i] || '').trim();
    if (!tekst) return;
    const dp = [...(localPunten[i].discussiepunten || []), { tekst, opgelost: false }];
    const nieuw = localPunten.map((p, j) => j === i ? { ...p, discussiepunten: dp } : p);
    setLocalPunten(nieuw);
    updateBestuursVergadering(v.id, { agendaPunten: nieuw }).catch(() => {});
    setNieuwPunt(np => ({ ...np, [i]: '' }));
  }

  function zetDiscussieOpgelost(i, di, opgelost) {
    const dp = localPunten[i].discussiepunten.map((d, j) => j === di ? { ...d, opgelost } : d);
    const nieuw = localPunten.map((p, j) => j === i ? { ...p, discussiepunten: dp } : p);
    setLocalPunten(nieuw);
    updateBestuursVergadering(v.id, { agendaPunten: nieuw }).catch(() => {});
  }

  function verwijderDiscussie(i, di) {
    const dp = localPunten[i].discussiepunten.filter((_, j) => j !== di);
    const nieuw = localPunten.map((p, j) => j === i ? { ...p, discussiepunten: dp } : p);
    setLocalPunten(nieuw);
    updateBestuursVergadering(v.id, { agendaPunten: nieuw }).catch(() => {});
  }

  if (!localPunten.length) return null;

  return (
    <Blok titel="Agenda & discussiepunten">
      {localPunten.map((p, i) => {
        const expanded = expandedIdx === i;
        const heeftInhoud = p.notities || (p.discussiepunten || []).length > 0;
        return (
          <div key={i} style={{ marginBottom: '6px', border: `1px solid ${p.behandeld ? `${C.green}44` : C.border}`, borderRadius: '8px', overflow: 'hidden' }}>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', cursor: 'pointer', background: p.behandeld ? `${C.green}0d` : 'transparent', transition: 'background 0.15s' }}
              onClick={() => setExpandedIdx(expanded ? null : i)}
            >
              <input
                type="checkbox"
                checked={p.behandeld || false}
                onChange={e => { e.stopPropagation(); zetBehandeld(i, e.target.checked); }}
                style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: C.green, flexShrink: 0 }}
              />
              <span style={{ flex: 1, fontSize: '14px', fontWeight: '600', textDecoration: p.behandeld ? 'line-through' : 'none', opacity: p.behandeld ? 0.65 : 1 }}>
                {i + 1}. {p.tekst}
              </span>
              {heeftInhoud && (
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '4px' }}>
                  {p.notities && <span>📝</span>}
                  {(p.discussiepunten || []).length > 0 && <span>💬{p.discussiepunten.length}</span>}
                </span>
              )}
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{expanded ? '▲' : '▼'}</span>
            </div>

            {expanded && (
              <div style={{ padding: '12px', borderTop: `1px solid ${C.border}`, background: 'var(--bg-primary)' }}>
                <label style={S.label}>Notities</label>
                <textarea
                  style={{ ...S.input, minHeight: '70px', resize: 'vertical', marginBottom: '14px' }}
                  value={p.notities || ''}
                  onChange={e => zetNotities(i, e.target.value)}
                  placeholder="Bespreking, opmerkingen…"
                />

                {(p.discussiepunten || []).length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Discussiepunten</div>
                    {p.discussiepunten.map((d, di) => (
                      <div key={di} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: `1px solid ${C.border}` }}>
                        <input type="checkbox" checked={d.opgelost || false} onChange={e => zetDiscussieOpgelost(i, di, e.target.checked)} style={{ accentColor: C.green, flexShrink: 0 }} />
                        <span style={{ fontSize: '13px', flex: 1, textDecoration: d.opgelost ? 'line-through' : 'none', opacity: d.opgelost ? 0.55 : 1, color: d.opgelost ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                          {d.tekst}
                        </span>
                        <button style={{ ...S.iconBtn, fontSize: '13px' }} onClick={() => verwijderDiscussie(i, di)}>✕</button>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    style={{ ...S.input, marginBottom: 0, flex: 1, fontSize: '13px' }}
                    value={nieuwPunt[i] || ''}
                    onChange={e => setNieuwPunt(np => ({ ...np, [i]: e.target.value }))}
                    placeholder="Nieuw discussiepunt…"
                    onKeyDown={e => e.key === 'Enter' && voegDiscussieToe(i)}
                  />
                  <button style={{ ...S.btn('ghost'), padding: '9px 12px' }} onClick={() => voegDiscussieToe(i)}>+</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </Blok>
  );
}

// ─── NOTULEN BLOK ─────────────────────────────────────────────────────────────
function NotulenBlok({ v }) {
  const [tekst, setTekst] = useState(v.notulen || '');
  const [status, setStatus] = useState(null); // null | 'saving' | 'saved'
  const timerRef = useRef(null);

  useEffect(() => {
    setTekst(v.notulen || '');
  }, [v.id]); // reset only when switching to a different vergadering

  function wijzig(val) {
    setTekst(val);
    setStatus('saving');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      updateBestuursVergadering(v.id, { notulen: val })
        .then(() => { setStatus('saved'); setTimeout(() => setStatus(null), 2000); })
        .catch(() => setStatus(null));
    }, 1200);
  }

  const label = status === 'saved' ? 'Notulen · ✓ opgeslagen' : status === 'saving' ? 'Notulen · opslaan…' : 'Notulen';

  return (
    <Blok titel={label}>
      <textarea
        style={{ ...S.input, minHeight: '100px', resize: 'vertical', marginBottom: 0 }}
        value={tekst}
        onChange={e => wijzig(e.target.value)}
        placeholder="Vrije notulen — automatisch opgeslagen na stoppen met typen…"
      />
    </Blok>
  );
}

// ─── AANWEZIGHEID ──────────────────────────────────────────────────────────────
function AanwezigheidBlok({ v, bestuursleden }) {
  const huidig = useMemo(() => {
    const map = {};
    (v.aanwezigheid || []).forEach(a => { if (a.uid) map[a.uid] = a.status; });
    return map;
  }, [v.aanwezigheid]);

  async function zet(lid, status) {
    const basis = bestuursleden.length ? bestuursleden : (v.aanwezigheid || []).map(a => ({ uid: a.uid, naam: a.naam }));
    const nieuw = basis.map(b => ({
      uid: b.uid, naam: b.naam || b.email || b.uid,
      status: b.uid === lid.uid ? status : (huidig[b.uid] || 'aanwezig'),
    }));
    await updateBestuursVergadering(v.id, { aanwezigheid: nieuw });
  }

  if (!bestuursleden.length) return null;
  return (
    <Blok titel="Aanwezigheid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {bestuursleden.map(lid => {
          const status = huidig[lid.uid] || 'aanwezig';
          const kleur = status === 'aanwezig' ? C.green : status === 'verontschuldigd' ? C.orange : C.red;
          return (
            <div key={lid.uid} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: kleur, flexShrink: 0 }} />
              <span style={{ flex: 1, minWidth: '120px', fontSize: '14px' }}>{lid.naam || lid.email || lid.uid}</span>
              <select style={{ ...S.input, marginBottom: 0, width: 'auto', padding: '6px 8px', fontSize: '13px' }} value={status} onChange={e => zet(lid, e.target.value)}>
                {Object.entries(AANWEZIG_OPTIES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </div>
          );
        })}
      </div>
    </Blok>
  );
}

// ─── ACTIEPUNTEN BLOK (binnen vergadering) ─────────────────────────────────────
function ActiepuntenBlok({ v, eigenActies, confirm }) {
  const [omschrijving, setOmschrijving] = useState('');
  const [verantwoordelijke, setVerantwoordelijke] = useState('');
  const [deadline, setDeadline] = useState('');

  async function voegToe() {
    if (!omschrijving.trim()) return;
    await addBestuursActiepunt({
      omschrijving: omschrijving.trim(), verantwoordelijke: verantwoordelijke.trim(),
      deadline: deadline || '', status: 'open',
      vergaderingId: v.id, vergaderingTitel: v.titel || '',
    });
    setOmschrijving(''); setVerantwoordelijke(''); setDeadline('');
  }

  return (
    <Blok titel="Actiepunten">
      {eigenActies.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>Nog geen actiepunten.</div>}
      {eigenActies.map(a => <ActiepuntRij key={a.id} a={a} confirm={confirm} compact />)}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', alignItems: 'flex-end' }}>
        <div style={{ flex: '2 1 160px' }}>
          <input style={{ ...S.input, marginBottom: 0 }} value={omschrijving} onChange={e => setOmschrijving(e.target.value)} placeholder="Nieuw actiepunt…" onKeyDown={e => e.key === 'Enter' && voegToe()} />
        </div>
        <div style={{ flex: '1 1 110px' }}>
          <input style={{ ...S.input, marginBottom: 0 }} value={verantwoordelijke} onChange={e => setVerantwoordelijke(e.target.value)} placeholder="Wie?" />
        </div>
        <input type="date" style={{ ...S.input, marginBottom: 0, width: 'auto' }} value={deadline} onChange={e => setDeadline(e.target.value)} />
        <button style={S.btn('primary')} onClick={voegToe} disabled={!omschrijving.trim()}>+ Toevoegen</button>
      </div>
    </Blok>
  );
}

// ─── VERSLAGEN BLOK ───────────────────────────────────────────────────────────
function VerslagenBlok({ v, gekoppeldeDocs = [], eigenActies = [], confirm }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [verslagModal, setVerslagModal] = useState(false);

  function kies(e) {
    const file = e.target.files[0];
    if (file) upload(file);
    e.target.value = '';
  }

  function upload(file) {
    setUploading(true); setProgress(0);
    const pad = `bestuur/${v.id}/${Date.now()}_${file.name}`;
    const task = uploadBytesResumable(ref(storage, pad), file);
    task.on('state_changed',
      snap => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      err => { console.error(err); setUploading(false); },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        const entry = { titel: file.name.replace(/\.[^.]+$/, ''), url, pad, fileName: file.name, fileSize: file.size, uploadedAt: Date.now() };
        await updateBestuursVergadering(v.id, { verslagen: [...(v.verslagen || []), entry] });
        setUploading(false); setProgress(0);
      }
    );
  }

  async function verwijder(entry) {
    const ok = await confirm({ titel: 'Verslag verwijderen?', beschrijving: entry.fileName, bevestigLabel: 'Verwijderen', variant: 'danger' });
    if (!ok) return;
    if (entry.pad) { try { await deleteObject(ref(storage, entry.pad)); } catch { /* al weg */ } }
    await updateBestuursVergadering(v.id, { verslagen: (v.verslagen || []).filter(x => x.url !== entry.url) });
  }

  return (
    <Blok titel="Verslagen & bijlagen">
      {(v.verslagen || []).map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: '20px' }}>{fileEmoji(d.fileName)}</span>
          <a href={d.url} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0, color: 'var(--text-primary)', textDecoration: 'none', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.titel || d.fileName}
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}> · {formatSize(d.fileSize)}</span>
          </a>
          <button style={{ ...S.iconBtn, color: C.red }} onClick={() => verwijder(d)}>🗑</button>
        </div>
      ))}
      {gekoppeldeDocs.map(d => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: '20px' }}>{fileEmoji(d.fileName)}</span>
          <a href={d.url} target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 0, color: 'var(--text-primary)', textDecoration: 'none', fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.titel || d.fileName}
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}> · {DOC_CATS[d.categorie] || d.categorie} · gekoppeld</span>
          </a>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
        <label style={{ display: 'inline-block', cursor: 'pointer', ...S.btn('ghost') }}>
          {uploading ? `Uploaden… ${progress}%` : '⬆️ Verslag opladen'}
          <input type="file" accept=".doc,.docx,.pdf,.odt,.xlsx,.png,.jpg,.jpeg" style={{ display: 'none' }} onChange={kies} disabled={uploading} />
        </label>
        <button style={S.btn('ghost')} onClick={() => setVerslagModal(true)}>📋 Genereer verslag</button>
      </div>
      {uploading && (
        <div style={{ marginTop: '8px', height: '4px', background: 'var(--bg-primary)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', background: C.red, width: `${progress}%`, transition: 'width 0.3s' }} />
        </div>
      )}
      {verslagModal && <VerslagModal v={v} eigenActies={eigenActies} onSluit={() => setVerslagModal(false)} />}
    </Blok>
  );
}

// ─── VERSLAG GENERATIE MODAL ──────────────────────────────────────────────────
function VerslagModal({ v, eigenActies, onSluit }) {
  const tekst = genereerVerslagTekst(v, eigenActies);
  const [gekopieerd, setGekopieerd] = useState(false);

  function kopieer() {
    navigator.clipboard?.writeText(tekst).then(() => {
      setGekopieerd(true);
      setTimeout(() => setGekopieerd(false), 2500);
    });
  }

  function download() {
    const blob = new Blob([tekst], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `verslag-${v.datum || 'onbekend'}-${(v.titel || 'vergadering').replace(/[^a-z0-9]/gi, '-').toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={S.modal} onClick={onSluit} onKeyDown={e => e.key === 'Escape' && onSluit()}>
      <div style={{ ...S.modalCard, maxWidth: '620px' }} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="verslag-modal-titel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }} id="verslag-modal-titel">📋 Gegenereerd verslag</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button style={S.btn('ghost')} onClick={kopieer}>{gekopieerd ? '✓ Gekopieerd!' : '📋 Kopiëren'}</button>
            <button style={S.btn('ghost')} onClick={download}>⬇️ .txt</button>
          </div>
        </div>
        <pre style={{ background: 'var(--bg-primary)', borderRadius: '8px', padding: '14px', overflow: 'auto', fontSize: '12px', lineHeight: '1.65', color: 'var(--text-primary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '55vh', border: `1px solid ${C.border}` }}>
          {tekst}
        </pre>
        <div style={{ marginTop: '12px' }}>
          <button style={{ ...S.btn('ghost'), width: '100%' }} onClick={onSluit}>Sluiten</button>
        </div>
      </div>
    </div>
  );
}
