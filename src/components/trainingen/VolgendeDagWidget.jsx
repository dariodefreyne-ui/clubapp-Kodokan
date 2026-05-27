// src/components/trainingen/VolgendeDagWidget.jsx
import React, { useState } from 'react';
import { getDocs, query, collection, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { C } from './tokens';
import { formatDatum } from './seizoenHelpers';
import { TechniekAccordeonLijst } from './TechniekAccordeon';

export default function VolgendeDagWidget({
  mijnVolgendeTraining,
  volgendeDagTrainingen,
  groepen,
  technieken,
  lesgeversLijst,
  profielGroepen,
}) {
  const [openId, setOpenId]         = useState(null);
  const [technieken2, setTechnieken2] = useState([]);
  const [laden, setLaden]           = useState(false);

  const duurLabel = (min) => {
    if (!min) return null;
    return min >= 60 ? `${Math.floor(min / 60)}u${min % 60 ? min % 60 + 'min' : ''}` : `${min}min`;
  };

  const lesgeversLabel = (t) =>
    (t?.lesgevers || []).map(id => lesgeversLijst.find(l => l.id === id)?.naam ?? id).join(' + ');

  const toggle = async (t) => {
    if (openId === t.id) { setOpenId(null); return; }
    setOpenId(t.id);
    setLaden(true);
    setTechnieken2([]);
    try {
      const snap = await getDocs(query(collection(db, 'trainingen', t.id, 'technieken'), orderBy('volgorde')));
      setTechnieken2(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch { setTechnieken2([]); }
    setLaden(false);
  };

  const meerdere = volgendeDagTrainingen.length > 1;

  return (
    <section style={{ background: 'linear-gradient(135deg, rgba(56,189,248,0.18) 0%, #1B2A3D 100%)', border: `1px solid ${C.blue}`, borderRadius: '18px', padding: '18px', marginBottom: '16px', boxShadow: '0 12px 30px rgba(0,0,0,0.20)' }}>
      <div style={{ fontSize: '12px', color: C.blue, fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: '8px' }}>
        {meerdere ? 'Mijn volgende lesdag' : 'Mijn volgende training'}
      </div>
      {mijnVolgendeTraining ? (
        <>
          <div style={{ fontSize: 'clamp(22px,6vw,32px)', lineHeight: 1.1, fontWeight: '900', color: C.textPrimary, marginBottom: '12px' }}>
            {formatDatum(mijnVolgendeTraining.datum)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {volgendeDagTrainingen.map(t => {
              const groep = groepen.find(g => g.id === t.groepId);
              const open = openId === t.id;
              const tijd = t.startTijd && t.eindTijd ? `${t.startTijd}–${t.eindTijd}` : duurLabel(t.duurMinuten);
              return (
                <div key={t.id} style={{ background: C.card, border: `1px solid ${open ? C.blue : C.borderSoft}`, borderRadius: '12px', overflow: 'hidden' }}>
                  <div onClick={() => toggle(t)} role="button" aria-expanded={open}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', cursor: 'pointer' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '15px', fontWeight: '800', color: C.textPrimary }}>{groep?.naam || t.groepId}</div>
                      {(tijd || lesgeversLabel(t)) && (
                        <div style={{ fontSize: '12px', color: C.textSec, marginTop: '2px' }}>
                          {[tijd, lesgeversLabel(t)].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                    <span style={{ flexShrink: 0, color: C.textMuted, fontSize: '12px' }}>{open ? '▲' : '▼'}</span>
                  </div>
                  {t.opmerking && (
                    <div style={{ margin: '0 14px 12px', fontSize: '12px', color: C.orange, background: C.orangeDim, border: `1px solid ${C.orange}`, borderRadius: '8px', padding: '6px 10px' }}>
                      {t.opmerking}
                    </div>
                  )}
                  {open && (
                    <div style={{ borderTop: `1px solid ${C.borderSoft}`, padding: '12px 14px' }}>
                      {laden
                        ? <div style={{ color: C.textMuted, fontSize: '13px' }}>Technieken laden…</div>
                        : <TechniekAccordeonLijst technieksLijst={technieken2} techniekDatabank={technieken} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div style={{ color: C.textSec, fontSize: '14px', lineHeight: 1.5 }}>
          Geen komende training gevonden voor jouw groepen.
          {profielGroepen.length === 0 && (
            <div style={{ marginTop: '4px', color: C.textMuted }}>Kies je standaardgroepen in Mijn profiel.</div>
          )}
        </div>
      )}
    </section>
  );
}
