// src/components/rapporten/WedstrijdenTab.jsx
import React, { useState } from 'react';
import { C } from '../../styles/tokens';
import { S, Kpi, RowBg } from './RapportenStyles';

function formatDatum(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function Popup({ title, subtitle, onClose, children }) {
  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
        }}
      />
      <div style={{
        position: 'fixed', zIndex: 501,
        top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
        width: 'min(560px,calc(100vw - 32px))', maxHeight: '80vh',
        background: 'var(--bg-card)', borderRadius: '16px',
        border: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '16px 20px 12px', borderBottom: '1px solid var(--border-color)', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '700', color: C.text }}>{title}</div>
            {subtitle && <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '2px' }}>{subtitle}</div>}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '18px', color: C.textMuted, padding: '2px 6px', marginLeft: '12px', lineHeight: 1,
            }}
          >✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '12px 20px 20px' }}>
          {children}
        </div>
      </div>
    </>
  );
}

export default function WedstrijdenTab({ data }) {
  const { events, toernooien, inschrijvingen, perCategorie, perDeelnemer, tornooiDeelnemers } = data;

  const [detailDeelnemer, setDetailDeelnemer] = useState(null);
  const [detailTornooi,   setDetailTornooi]   = useState(null);

  const totDeelnames  = inschrijvingen.length;
  const topDeelnemers = Object.values(perDeelnemer).sort((a,b) => b.nToernooien - a.nToernooien).slice(0,15);
  const maxN = topDeelnemers[0]?.nToernooien || 1;
  const aantalToernooien = (toernooien || []).length;

  function openTornooi(e) {
    const sleutel = (e.naam || e.name || '').trim().toLowerCase();
    const deelnemers = (tornooiDeelnemers || {})[sleutel] || [];
    setDetailTornooi({ naam: e.naam || e.name, datum: e.datum || e.date, deelnemers });
  }

  return (
    <div>
      {events.length === 0
        ? <div style={S.leeg}>Geen wedstrijden in dit seizoen.</div>
        : <>
            <div style={S.kpiGrid}>
              <Kpi label="Wedstrijddagen"    value={events.length}                    color={C.blue} />
              {aantalToernooien !== events.length && <Kpi label="Toernooien" value={aantalToernooien} color={C.purple} />}
              <Kpi label="Deelnames"         value={totDeelnames}                     color={C.green} />
              <Kpi label="Unieke deelnemers" value={Object.keys(perDeelnemer).length} color={C.orange} />
              <Kpi label="Categorieën"       value={Object.keys(perCategorie).length} color={C.purple} />
            </div>

            {/* Per wedstrijd — klikbaar → deelnemerspopup */}
            <div style={S.card}>
              <h3 style={S.h3}>Wedstrijden dit seizoen</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={S.tbl}>
                  <thead><tr>
                    <th style={S.th}>Wedstrijd</th>
                    <th style={S.th}>Datum</th>
                    <th style={S.th}>Doelgroep</th>
                    <th style={S.thr}>Deelnames</th>
                  </tr></thead>
                  <tbody>
                    {events.map((e, i) => {
                      const n = inschrijvingen.filter(x => x.eventId === e.id).length;
                      return (
                        <tr key={e.id} onClick={() => openTornooi(e)} style={{ background: RowBg(i), cursor: 'pointer' }}>
                          <td style={{ ...S.td, fontWeight: '600' }}>{e.naam || e.name}</td>
                          <td style={{ ...S.td, color: C.textMuted }}>{e.datum || e.date}</td>
                          <td style={{ ...S.td, color: C.textMuted, fontSize: '12px' }}>{(e.doelgroepCodes || []).join(', ') || '—'}</td>
                          <td style={{ ...S.tdr, color: n > 0 ? C.green : C.textMuted, fontWeight: '600' }}>{n}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Per categorie */}
            {Object.keys(perCategorie).length > 0 && (
              <div style={S.card}>
                <h3 style={S.h3}>Deelnames per categorie</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={S.tbl}>
                    <thead><tr>
                      <th style={S.th}>Categorie</th>
                      <th style={S.thr}>Deelnames</th>
                      <th style={{ ...S.thr, width: '40%' }}></th>
                    </tr></thead>
                    <tbody>
                      {Object.entries(perCategorie).sort((a,b) => b[1]-a[1]).map(([cat, n], i) => {
                        const maxCat = Math.max(...Object.values(perCategorie));
                        return (
                          <tr key={cat} style={{ background: RowBg(i) }}>
                            <td style={{ ...S.td, fontWeight: '600' }}>{cat}</td>
                            <td style={{ ...S.tdr, fontWeight: '700', color: C.green }}>{n}</td>
                            <td style={S.tdr}><div style={S.bar(Math.round(n/maxCat*100), C.green)} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Top deelnemers — klikbaar → toernooipopup */}
            {topDeelnemers.length > 0 && (
              <div style={S.card}>
                <h3 style={S.h3}>Meest actieve deelnemers</h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={S.tbl}>
                    <thead><tr>
                      <th style={S.th}>#</th>
                      <th style={S.th}>Naam</th>
                      <th style={S.thr}>Deelnames</th>
                      <th style={{ ...S.thr, color: C.blue }}>Toernooien %<br/><span style={{ fontSize: '10px', fontWeight: '400', color: C.textMuted }}>eigen categorie</span></th>
                      <th style={{ ...S.thr, width: '25%' }}></th>
                    </tr></thead>
                    <tbody>
                      {topDeelnemers.map((d, i) => {
                        const pctKleur = d.pct === null ? C.textMuted : d.pct >= 75 ? C.green : d.pct >= 50 ? C.orange : C.red;
                        return (
                          <tr key={d.naam+i} onClick={() => setDetailDeelnemer(d)} style={{ background: RowBg(i), cursor: 'pointer' }}>
                            <td style={{ ...S.td, color: C.textMuted, fontWeight: '700', width: '32px' }}>{i+1}</td>
                            <td style={{ ...S.td, fontWeight: '600' }}>{d.naam}</td>
                            <td style={{ ...S.tdr, fontWeight: '700', color: C.orange }}>{d.nToernooien}×</td>
                            <td style={{ ...S.tdr, fontWeight: '700', color: pctKleur }}>
                              {d.pct !== null
                                ? <>{d.pct}%<br/><span style={{ fontSize: '11px', fontWeight: '400', color: C.textMuted }}>{d.nToernooien}/{d.eligible} toern.</span></>
                                : '—'}
                            </td>
                            <td style={S.tdr}><div style={S.bar(d.pct ?? Math.round(d.nToernooien/maxN*100), C.blue)} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
      }

      {/* Deelnemer detail popup */}
      {detailDeelnemer && (
        <Popup
          title={detailDeelnemer.naam}
          subtitle={`${detailDeelnemer.nToernooien} toernooi${detailDeelnemer.nToernooien !== 1 ? 'en' : ''} deelgenomen`}
          onClose={() => setDetailDeelnemer(null)}
        >
          {(detailDeelnemer.deelnames || []).length === 0
            ? <div style={{ color: C.textMuted, textAlign: 'center', padding: '20px' }}>Geen deelnames gevonden.</div>
            : <table style={{ ...S.tbl, minWidth: 0 }}>
                <thead><tr>
                  <th style={S.th}>Datum</th>
                  <th style={S.th}>Wedstrijd</th>
                  <th style={S.thr}>Categorie</th>
                </tr></thead>
                <tbody>
                  {detailDeelnemer.deelnames.map((dl, i) => (
                    <tr key={dl.sleutel} style={{ background: RowBg(i) }}>
                      <td style={{ ...S.td, color: C.textMuted, whiteSpace: 'nowrap' }}>{formatDatum(dl.datum)}</td>
                      <td style={{ ...S.td, fontWeight: '600' }}>{dl.tornooiNaam}</td>
                      <td style={{ ...S.tdr, color: C.textMuted, fontSize: '12px' }}>{dl.categorieen || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </Popup>
      )}

      {/* Tornooi detail popup */}
      {detailTornooi && (
        <Popup
          title={detailTornooi.naam}
          subtitle={`${formatDatum(detailTornooi.datum)} · ${detailTornooi.deelnemers.length} deelnemer${detailTornooi.deelnemers.length !== 1 ? 's' : ''}`}
          onClose={() => setDetailTornooi(null)}
        >
          {detailTornooi.deelnemers.length === 0
            ? <div style={{ color: C.textMuted, textAlign: 'center', padding: '20px' }}>Geen deelnemers gevonden.</div>
            : <table style={{ ...S.tbl, minWidth: 0 }}>
                <thead><tr>
                  <th style={S.th}>Naam</th>
                  <th style={S.thr}>Categorie</th>
                </tr></thead>
                <tbody>
                  {detailTornooi.deelnemers.map((dl, i) => (
                    <tr key={dl.naam+i} style={{ background: RowBg(i) }}>
                      <td style={{ ...S.td, fontWeight: '600' }}>{dl.naam}</td>
                      <td style={{ ...S.tdr, color: C.textMuted, fontSize: '12px' }}>{dl.categorie}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
          }
        </Popup>
      )}
    </div>
  );
}
